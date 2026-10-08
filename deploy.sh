#!/usr/bin/env bash
# Деплой STONEMACHINE на VPS.
#
#   ./deploy.sh                 — залить текущий код и перезапустить
#   ./deploy.sh --reset-admin   — то же + сменить логин/пароль админки
#
# Нужно на своей машине: bash, ssh, tar. На сервере: любой свежий Debian/Ubuntu,
# nginx, PostgreSQL и Node.js 22 поставятся сами при первом запуске (без Docker).
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
[[ -f package.json && -d prisma ]] || ui_die "запускайте из папки проекта"

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

# ——— пакеты ———
ui_step "Пакеты на сервере"
ui_run "nginx, PostgreSQL, утилиты (apt)" remote "export DEBIAN_FRONTEND=noninteractive; $SUDO apt-get update -qq && $SUDO apt-get install -y -qq nginx postgresql curl ca-certificates openssl" \
  || ui_die "apt не справился (нужен Debian/Ubuntu с доступом в интернет)"
if remote "command -v node >/dev/null && [ \$(node -v | cut -d. -f1 | tr -d v) -ge 20 ]"; then
  ui_ok "Node.js $(remote 'node -v')"
else
  ui_run "Node.js 22 (nodesource)" remote "curl -fsSL https://deb.nodesource.com/setup_22.x | $SUDO bash - && $SUDO apt-get install -y -qq nodejs" \
    || ui_die "не удалось поставить Node.js"
fi
remote "id stonemachine >/dev/null 2>&1 || $SUDO useradd --system --home-dir $APP_DIR --shell /usr/sbin/nologin stonemachine"

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
remote "$SUDO mkdir -p $APP_DIR && $SUDO chown -R \$(id -u):\$(id -g) $APP_DIR"
upload_code() {
  tar czf - \
    --exclude=./node_modules --exclude=./.next --exclude=./.git --exclude=./data \
    --exclude='./.env' --exclude='./.env.local' --exclude='*.log' --exclude='*.tsbuildinfo' \
    . | tee >(wc -c > "$WORK/upload.size") \
      | remote "cd $APP_DIR && find . -mindepth 1 -maxdepth 1 ! -name .env ! -name node_modules ! -name .lock.installed -exec rm -rf {} + && tar xzf - --no-same-owner"
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

# ——— PostgreSQL ———
ui_step "База данных"
setup_db() {
  remote "$SUDO bash -s -- $APP_DIR" <<'SH'
set -euo pipefail
cd "$1"
set -a; . ./.env; set +a
systemctl enable --now postgresql >/dev/null 2>&1
for _ in $(seq 1 30); do runuser -u postgres -- pg_isready -q && break; sleep 1; done
psql_() { (cd /tmp && runuser -u postgres -- psql -v ON_ERROR_STOP=1 -tA "$@"); }
if [ "$(psql_ -c "SELECT 1 FROM pg_roles WHERE rolname='$POSTGRES_USER'")" = 1 ]; then
  psql_ -c "ALTER ROLE \"$POSTGRES_USER\" PASSWORD '$POSTGRES_PASSWORD'" >/dev/null
else
  psql_ -c "CREATE ROLE \"$POSTGRES_USER\" LOGIN PASSWORD '$POSTGRES_PASSWORD'" >/dev/null
fi
[ "$(psql_ -c "SELECT 1 FROM pg_database WHERE datname='$POSTGRES_DB'")" = 1 ] \
  || psql_ -c "CREATE DATABASE \"$POSTGRES_DB\" OWNER \"$POSTGRES_USER\"" >/dev/null
# .env мог остаться от docker-версии — дописываем недостающее
grep -q '^DATABASE_URL=' .env || echo "DATABASE_URL=postgresql://$POSTGRES_USER:$POSTGRES_PASSWORD@127.0.0.1:5432/$POSTGRES_DB" >> .env
grep -q '^UPLOAD_DIR=' .env || echo "UPLOAD_DIR=/var/lib/stonemachine/uploads" >> .env
mkdir -p /var/lib/stonemachine/uploads
SH
}
ui_run "роль и база PostgreSQL" setup_db || ui_die "не удалось настроить PostgreSQL"

# ——— сборка ———
ui_step "Сборка приложения"
ui_info "первый раз — 3–7 минут; строка справа показывает, что собирается сейчас"
build_app() {
  remote "$SUDO bash -s -- $APP_DIR" <<'SH'
set -euo pipefail
cd "$1"
export NEXT_TELEMETRY_DISABLED=1
if [ ! -d node_modules ] || ! cmp -s package-lock.json .lock.installed; then
  npm ci --no-audit --no-fund
  cp package-lock.json .lock.installed
fi
npx prisma generate
npx next build
set -a; . ./.env; set +a
npx prisma migrate deploy
chown -R stonemachine:stonemachine "$1" /var/lib/stonemachine
SH
}
ui_run "npm ci · next build · миграции" build_app || ui_die "сборка не удалась — ошибка выше"

# ——— сервис и nginx ———
ui_step "Запуск: systemd + nginx"
configure_services() {
  remote "$SUDO bash -s -- $APP_DIR" <<'SH'
set -euo pipefail
APP="$1"
cat > /etc/systemd/system/stonemachine.service <<UNIT
[Unit]
Description=STONEMACHINE (Next.js)
After=network.target postgresql.service
Requires=postgresql.service

[Service]
User=stonemachine
WorkingDirectory=$APP
EnvironmentFile=$APP/.env
Environment=NODE_ENV=production NEXT_TELEMETRY_DISABLED=1
ExecStart=/usr/bin/env node node_modules/next/dist/bin/next start -p 3000 -H 127.0.0.1
Restart=always
RestartSec=3
NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload
systemctl enable stonemachine >/dev/null 2>&1
systemctl restart stonemachine

set -a; . "$APP/.env"; set +a
SN="${SITE_ADDRESS:-_}"; case "$SN" in :*|"") SN="_" ;; esac
cat > /etc/nginx/conf.d/stonemachine.conf <<'NGX'
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name __SERVER_NAME__;
    server_tokens off;
    client_max_body_size 30m;

    gzip on;
    gzip_proxied any;
    gzip_types text/plain text/css text/xml application/json application/javascript application/xml image/svg+xml;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 60s;
    }
}
NGX
sed -i "s/__SERVER_NAME__/$SN/" /etc/nginx/conf.d/stonemachine.conf
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl enable nginx >/dev/null 2>&1
systemctl reload nginx 2>/dev/null || systemctl restart nginx
SH
}
ui_run "сервис stonemachine и конфиг nginx" configure_services || ui_die "не удалось настроить systemd/nginx"

# HTTPS: если в .env указан домен, а не «:80»
DOMAIN=$(remote "grep -E '^SITE_ADDRESS=' $APP_DIR/.env | cut -d= -f2-" | tr -d '[:space:]' || true)
if [[ -n "$DOMAIN" && "$DOMAIN" != :* ]]; then
  ui_run "HTTPS-сертификат для $DOMAIN (certbot)" remote "export DEBIAN_FRONTEND=noninteractive; $SUDO apt-get install -y -qq certbot python3-certbot-nginx && $SUDO certbot --nginx -d $DOMAIN --non-interactive --agree-tos --register-unsafely-without-email --redirect" \
    || ui_warn "certbot не справился: проверьте, что A-запись $DOMAIN указывает на $HOST. Сайт пока работает по http"
fi

ui_step "Ожидание приложения"
app_healthy() { remote "curl -fsS -o /dev/null http://127.0.0.1/admin/login"; }
if ! ui_health "сайт отвечает через nginx" 40 3 app_healthy; then
  remote "$SUDO journalctl -u stonemachine --no-pager -n 40" || true
  ui_die "приложение не стартовало, логи выше"
fi

# ——— админ ———
HAS_ADMIN=$(remote "cd $APP_DIR && $SUDO node --env-file=.env scripts/create-admin.mjs --count" 2>/dev/null | tr -d '[:space:]' || echo 0)
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
  printf '%s\n' "$P1" | remote "cd $APP_DIR && $SUDO env ADMIN_USERNAME='$ADMIN_USER' node --env-file=.env scripts/create-admin.mjs"
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
  ui_dim "и запустите ./deploy.sh ещё раз — certbot выпустит HTTPS-сертификат для nginx."
fi
