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
for arg in "$@"; do
  case "$arg" in
    --reset-admin) RESET_ADMIN=1 ;;
    -h|--help) sed -n '2,8p' "$0"; exit 0 ;;
    *) echo "Неизвестный параметр: $arg (см. --help)"; exit 1 ;;
  esac
done

cd "$(dirname "$0")"
# shellcheck source=scripts/tui.sh
source scripts/tui.sh

rand_hex() { openssl rand -hex "$1" 2>/dev/null || od -An -tx1 -N "$1" /dev/urandom | tr -d ' \n'; }

for bin in ssh tar; do command -v "$bin" >/dev/null || ui_die "не найдена программа $bin"; done
[[ -f docker-compose.yml && -f Dockerfile ]] || ui_die "запускайте из папки проекта"

# ——— ввод ———
ui_title "Деплой STONEMACHINE"
read -rp "IP сервера: " HOST
[[ "$HOST" =~ ^[0-9]{1,3}(\.[0-9]{1,3}){3}$ || "$HOST" =~ ^[0-9a-fA-F:]+$ ]] || ui_die "это не похоже на IP-адрес"
read -rp "Пользователь SSH [root]: " SSH_USER
SSH_USER="${SSH_USER:-root}"
read -rp "Порт SSH [22]: " SSH_PORT
SSH_PORT="${SSH_PORT:-22}"
read -rsp "Пароль SSH (пусто — вход по ключу): " SSH_PASS
echo

# ——— одно SSH-соединение на весь деплой ———
# Пароль отдаём ssh через SSH_ASKPASS: не нужен sshpass, пароль не светится в аргументах процессов.
# Короткий путь: у unix-сокета SSH лимит ~100 символов
WORK="$(mktemp -d /tmp/smdeploy.XXXXXX)"
CTL="$WORK/ctl"
cleanup() {
  ssh -S "$CTL" -O exit "$SSH_USER@$HOST" >/dev/null 2>&1 || true
  rm -rf "$WORK"
  tui_cleanup_logs
}
trap cleanup EXIT
ui_abort_on_signal
ui_trap_errors

SSH_OPTS=(-p "$SSH_PORT" -o ControlPath="$CTL" -o StrictHostKeyChecking=accept-new -o ServerAliveInterval=30)

ui_step "Подключение к $SSH_USER@$HOST:$SSH_PORT"
if [[ -n "$SSH_PASS" ]]; then
  # shellcheck disable=SC2016  # $DEPLOY_SSH_PASS должен раскрыться в askpass, а не здесь
  printf '#!/bin/sh\nprintf "%%s\\n" "$DEPLOY_SSH_PASS"\n' > "$WORK/askpass"
  chmod 700 "$WORK/askpass"
  DEPLOY_SSH_PASS="$SSH_PASS" SSH_ASKPASS="$WORK/askpass" SSH_ASKPASS_REQUIRE=force DISPLAY=:0 \
    ssh "${SSH_OPTS[@]}" -o ControlMaster=yes -o ControlPersist=15m -o NumberOfPasswordPrompts=1 \
        -o PreferredAuthentications=password,keyboard-interactive -fN "$SSH_USER@$HOST" </dev/null \
    || ui_die "не удалось войти: проверьте IP, пользователя и пароль"
else
  ssh "${SSH_OPTS[@]}" -o ControlMaster=yes -o ControlPersist=15m -o BatchMode=yes -fN "$SSH_USER@$HOST" \
    || ui_die "вход по ключу не удался. Запустите снова и введите пароль"
fi
unset SSH_PASS

# shellcheck disable=SC2029  # команды намеренно собираются локально
remote() { ssh "${SSH_OPTS[@]}" "$SSH_USER@$HOST" "$@"; }

SUDO=""
if [[ "$SSH_USER" != "root" ]]; then
  remote 'sudo -n true' 2>/dev/null || ui_die "у пользователя $SSH_USER нет sudo без пароля. Используйте root или настройте NOPASSWD"
  SUDO="sudo"
fi
ui_ok "соединение установлено"

# ——— Docker ———
ui_step "Docker на сервере"
if remote "command -v docker >/dev/null && $SUDO docker compose version >/dev/null 2>&1"; then
  ui_ok "уже установлен"
else
  ui_run "curl на сервере" remote "command -v curl >/dev/null || { $SUDO apt-get update -qq && $SUDO apt-get install -y -qq curl ca-certificates; }" \
    || ui_die "на сервере нет curl и не получилось его поставить (нужен Debian/Ubuntu)"
  ui_run "установка Docker (get.docker.com)" remote "curl -fsSL https://get.docker.com | $SUDO sh" || ui_die "не удалось установить Docker"
  remote "$SUDO systemctl enable --now docker" >/dev/null 2>&1 || true
fi

# ——— память ———
# Сборка Next.js съедает ~1.5 ГБ. На дешёвых VPS с 1 ГБ без swap она просто падает.
MEM_MB=$(remote "awk '/MemTotal/ {print int(\$2/1024)}' /proc/meminfo")
SWAP_MB=$(remote "awk '/SwapTotal/ {print int(\$2/1024)}' /proc/meminfo")
have_mb=$(( MEM_MB + SWAP_MB )); (( have_mb > 2500 )) && have_mb=2500
ui_kv "Память" "$MEM_MB МБ RAM + $SWAP_MB МБ swap  $(ui_bar "$have_mb" 2500 16)  для сборки нужно ≥ 2500 МБ"
if (( MEM_MB + SWAP_MB < 2500 )); then
  ui_run "swap 2 ГБ" remote "$SUDO sh -c 'test -f /swapfile || { fallocate -l 2G /swapfile || dd if=/dev/zero of=/swapfile bs=1M count=2048; } && chmod 600 /swapfile && mkswap /swapfile >/dev/null && swapon /swapfile && grep -q /swapfile /etc/fstab || echo \"/swapfile none swap sw 0 0\" >> /etc/fstab'" \
    || ui_warn "не получилось — если сборка упадёт, увеличьте RAM сервера"
fi

# ——— код ———
ui_step "Код в $APP_DIR"
remote "$SUDO mkdir -p $APP_DIR && $SUDO chown \$(id -u):\$(id -g) $APP_DIR"
upload_code() {
  tar czf - \
    --exclude=./node_modules --exclude=./.next --exclude=./.git --exclude=./data \
    --exclude='./.env' --exclude='./.env.local' --exclude='*.log' --exclude='*.tsbuildinfo' \
    . | tee >(wc -c > "$WORK/upload.size") \
      | remote "cd $APP_DIR && find . -mindepth 1 -maxdepth 1 ! -name .env -exec rm -rf {} + && tar xzf - --no-same-owner"
}
ui_run "архив и распаковка" upload_code
ui_xfer_add "код (tar.gz)" "$(tr -d '[:space:]' < "$WORK/upload.size" 2>/dev/null || echo 0)"

# ——— секреты (только при первом деплое) ———
FIRST_DEPLOY=0
if ! remote "test -f $APP_DIR/.env"; then
  FIRST_DEPLOY=1
  ui_step "Секреты (первый деплой)"
  remote "cd $APP_DIR && umask 077 && cat > .env" <<ENV
POSTGRES_USER=stonemachine
POSTGRES_PASSWORD=$(rand_hex 24)
POSTGRES_DB=stonemachine
SESSION_SECRET=$(rand_hex 32)
SITE_URL=http://$HOST
SITE_ADDRESS=:80
COOKIE_SECURE=false
ENV
  ui_ok ".env создан на сервере (в репозиторий не попадает)"
fi

# ——— сборка и запуск ———
ui_step "Сборка и запуск контейнеров"
ui_info "первый раз — 3–7 минут; строка справа показывает, что собирается сейчас"
ui_run "docker compose up --build" remote "cd $APP_DIR && $SUDO docker compose --progress plain up -d --build --remove-orphans 2>&1" \
  || ui_die "сборка не удалась — ошибка выше"
# Caddyfile смонтирован файлом: после замены кода Caddy видел бы старую версию
remote "cd $APP_DIR && $SUDO docker compose up -d --force-recreate --no-deps caddy" >/dev/null 2>&1

ui_step "Ожидание приложения"
app_healthy() { [[ "$(remote "cd $APP_DIR && $SUDO docker compose ps app --format '{{.Health}}'" 2>/dev/null || true)" == "healthy" ]]; }
if ! ui_health "контейнер app → healthy" 60 3 app_healthy; then
  remote "cd $APP_DIR && $SUDO docker compose logs --tail 40 app" || true
  ui_die "приложение не стартовало, логи выше"
fi

# ——— админ ———
HAS_ADMIN=$(remote "cd $APP_DIR && $SUDO docker compose exec -T app node scripts/create-admin.mjs --count" 2>/dev/null | tr -d '[:space:]' || echo 0)
if [[ "$HAS_ADMIN" == "0" || $RESET_ADMIN -eq 1 ]]; then
  ui_step "Учётка админки"
  read -rp "Логин админа [admin]: " ADMIN_USER
  ADMIN_USER="${ADMIN_USER:-admin}"
  [[ "$ADMIN_USER" =~ ^[A-Za-z0-9_.-]{3,64}$ ]] || ui_die "логин: 3–64 символа, латиница/цифры/._-"
  while :; do
    read -rsp "Пароль админа (мин. 10 символов): " P1; echo
    read -rsp "Повторите: " P2; echo
    [[ "$P1" == "$P2" ]] || { ui_warn "не совпадают"; continue; }
    [[ ${#P1} -ge 10 ]] || { ui_warn "короче 10 символов"; continue; }
    break
  done
  # Пароль идёт через stdin, а не аргументами — его не видно в списке процессов сервера
  printf '%s\n' "$P1" | remote "cd $APP_DIR && $SUDO docker compose exec -T -e ADMIN_USERNAME='$ADMIN_USER' app node scripts/create-admin.mjs"
  unset P1 P2
fi

# ——— итог ———
ui_summary "Готово"
echo
ui_kv "Сайт"    "http://$HOST"
ui_kv "Админка" "http://$HOST/admin"
if [[ $FIRST_DEPLOY -eq 1 ]]; then
  echo
  ui_dim "Когда появится домен: направьте A-запись на $HOST, затем на сервере в $APP_DIR/.env"
  ui_dim "поставьте SITE_ADDRESS=ваш-домен.ru, SITE_URL=https://ваш-домен.ru, COOKIE_SECURE=true"
  ui_dim "и запустите ./deploy.sh ещё раз — Caddy сам получит HTTPS-сертификат."
fi
