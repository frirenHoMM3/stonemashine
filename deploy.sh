#!/usr/bin/env bash
# Деплой STONEMACHINE на VPS.
#
#   ./deploy.sh                 — залить текущий код и перезапустить
#   ./deploy.sh --reset-admin   — то же + сменить логин/пароль админки
#
# Нужно на своей машине: bash, ssh, tar. На сервере: любой свежий Debian/Ubuntu,
# Docker поставится сам при первом запуске.
set -euo pipefail

APP_DIR="/opt/stonemachine"
RESET_ADMIN=0
[[ "${1:-}" == "--reset-admin" ]] && RESET_ADMIN=1

cd "$(dirname "$0")"

red()  { printf '\033[31m%s\033[0m\n' "$*"; }
bold() { printf '\033[1m%s\033[0m\n' "$*"; }
step() { printf '\n\033[31m▌\033[0m \033[1m%s\033[0m\n' "$*"; }
die()  { red "✘ $*"; exit 1; }

# ——— ввод ———
bold "STONEMACHINE — деплой"
read -rp "IP сервера: " HOST
[[ "$HOST" =~ ^[0-9]{1,3}(\.[0-9]{1,3}){3}$ || "$HOST" =~ ^[0-9a-fA-F:]+$ ]] || die "Это не похоже на IP-адрес"
read -rp "Пользователь SSH [root]: " SSH_USER
SSH_USER="${SSH_USER:-root}"
read -rp "Порт SSH [22]: " SSH_PORT
SSH_PORT="${SSH_PORT:-22}"
read -rsp "Пароль SSH (пусто — вход по ключу): " SSH_PASS
echo

# ——— одно SSH-соединение на весь деплой ———
# Пароль отдаём ssh через SSH_ASKPASS: не нужен sshpass, пароль не светится в аргументах процессов.
WORK="$(mktemp -d)"
CTL="$WORK/ctl"
cleanup() {
  ssh -S "$CTL" -O exit "$SSH_USER@$HOST" >/dev/null 2>&1 || true
  rm -rf "$WORK"
}
trap cleanup EXIT

SSH_OPTS=(-p "$SSH_PORT" -o ControlPath="$CTL" -o StrictHostKeyChecking=accept-new -o ServerAliveInterval=30)

step "Подключаюсь к $SSH_USER@$HOST:$SSH_PORT"
if [[ -n "$SSH_PASS" ]]; then
  printf '#!/bin/sh\nprintf "%%s\\n" "$DEPLOY_SSH_PASS"\n' > "$WORK/askpass"
  chmod 700 "$WORK/askpass"
  DEPLOY_SSH_PASS="$SSH_PASS" SSH_ASKPASS="$WORK/askpass" SSH_ASKPASS_REQUIRE=force DISPLAY=:0 \
    ssh "${SSH_OPTS[@]}" -o ControlMaster=yes -o ControlPersist=15m -o NumberOfPasswordPrompts=1 \
        -o PreferredAuthentications=password,keyboard-interactive -fN "$SSH_USER@$HOST" </dev/null \
    || die "Не удалось войти: проверьте IP, пользователя и пароль"
else
  ssh "${SSH_OPTS[@]}" -o ControlMaster=yes -o ControlPersist=15m -o BatchMode=yes -fN "$SSH_USER@$HOST" \
    || die "Вход по ключу не удался. Запустите снова и введите пароль"
fi
unset SSH_PASS

remote() { ssh "${SSH_OPTS[@]}" "$SSH_USER@$HOST" "$@"; }

SUDO=""
if [[ "$SSH_USER" != "root" ]]; then
  remote 'sudo -n true' 2>/dev/null || die "У пользователя $SSH_USER нет sudo без пароля. Используйте root или настройте NOPASSWD"
  SUDO="sudo"
fi
echo "  ok"

# ——— Docker ———
step "Проверяю Docker на сервере"
if remote "command -v docker >/dev/null && $SUDO docker compose version >/dev/null 2>&1"; then
  echo "  уже установлен"
else
  echo "  ставлю Docker (официальный скрипт get.docker.com)…"
  remote "curl -fsSL https://get.docker.com | $SUDO sh" >/dev/null || die "Не удалось установить Docker"
  remote "$SUDO systemctl enable --now docker" >/dev/null
  echo "  ok"
fi

# ——— код ———
step "Заливаю код в $APP_DIR"
remote "$SUDO mkdir -p $APP_DIR && $SUDO chown \$(id -u):\$(id -g) $APP_DIR"
tar czf - \
  --exclude=./node_modules --exclude=./.next --exclude=./.git --exclude=./data \
  --exclude='./.env' --exclude='./.env.local' --exclude='*.log' --exclude='*.tsbuildinfo' \
  . | remote "cd $APP_DIR && find . -mindepth 1 -maxdepth 1 ! -name .env -exec rm -rf {} + && tar xzf -"
echo "  ok"

# ——— секреты (только при первом деплое) ———
FIRST_DEPLOY=0
if ! remote "test -f $APP_DIR/.env"; then
  FIRST_DEPLOY=1
  step "Первый деплой: генерирую секреты"
  remote "cd $APP_DIR && umask 077 && cat > .env" <<ENV
POSTGRES_USER=stonemachine
POSTGRES_PASSWORD=$(openssl rand -hex 24)
POSTGRES_DB=stonemachine
SESSION_SECRET=$(openssl rand -hex 32)
SITE_URL=http://$HOST
SITE_ADDRESS=:80
COOKIE_SECURE=false
ENV
  echo "  .env создан на сервере (в репозиторий не попадает)"
fi

# ——— сборка и запуск ———
step "Собираю и запускаю контейнеры (первый раз — несколько минут)"
remote "cd $APP_DIR && $SUDO docker compose up -d --build --remove-orphans" 2>&1 | grep -vE '^\s*$' | sed 's/^/  /' | tail -15

step "Жду, пока приложение поднимется"
for i in $(seq 1 60); do
  status=$(remote "cd $APP_DIR && $SUDO docker compose ps app --format '{{.Health}}'" 2>/dev/null || true)
  [[ "$status" == "healthy" ]] && break
  [[ $i -eq 60 ]] && { remote "cd $APP_DIR && $SUDO docker compose logs --tail 40 app"; die "Приложение не стартовало, логи выше"; }
  sleep 3
done
echo "  ok"

# ——— админ ———
HAS_ADMIN=$(remote "cd $APP_DIR && $SUDO docker compose exec -T app node scripts/create-admin.mjs --count" 2>/dev/null | tr -d '[:space:]' || echo 0)
if [[ "$HAS_ADMIN" == "0" || $RESET_ADMIN -eq 1 ]]; then
  step "Учётка админки"
  read -rp "Логин админа [admin]: " ADMIN_USER
  ADMIN_USER="${ADMIN_USER:-admin}"
  [[ "$ADMIN_USER" =~ ^[A-Za-z0-9_.-]{3,64}$ ]] || die "Логин: 3–64 символа, латиница/цифры/._-"
  while :; do
    read -rsp "Пароль админа (мин. 10 символов): " P1; echo
    read -rsp "Повторите: " P2; echo
    [[ "$P1" == "$P2" ]] || { red "  не совпадают"; continue; }
    [[ ${#P1} -ge 10 ]] || { red "  короче 10 символов"; continue; }
    break
  done
  # Пароль идёт через stdin, а не аргументами — его не видно в списке процессов сервера
  printf '%s\n' "$P1" | remote "cd $APP_DIR && $SUDO docker compose exec -T -e ADMIN_USERNAME='$ADMIN_USER' app node scripts/create-admin.mjs"
  unset P1 P2
fi

# ——— итог ———
step "Готово"
echo "  Сайт:     http://$HOST"
echo "  Админка:  http://$HOST/admin"
if [[ $FIRST_DEPLOY -eq 1 ]]; then
  echo
  echo "  Когда появится домен: направьте A-запись на $HOST, затем на сервере в $APP_DIR/.env"
  echo "  поставьте SITE_ADDRESS=ваш-домен.ru, SITE_URL=https://ваш-домен.ru, COOKIE_SECURE=true"
  echo "  и запустите ./deploy.sh ещё раз — Caddy сам получит HTTPS-сертификат."
fi
