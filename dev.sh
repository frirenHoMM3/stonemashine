#!/usr/bin/env bash
# Локальный сервер STONEMACHINE (Next.js + Postgres).
#   ./dev.sh [порт]     — http://localhost:порт (по умолчанию 3000)
#   ./dev.sh --seed     — наполнить базу демо-товарами (на новой базе делается само)
#   ./dev.sh --keep-db  — не останавливать контейнер Postgres при выходе
#   ./dev.sh --no-db    — не трогать базу (когда Postgres уже запущен вами)
# Остановка — Ctrl+C.
#
# БД берётся из DATABASE_URL (окружение, затем .env). Если на её порту никто не слушает,
# а хост локальный, скрипт сам поднимает контейнер postgres:17-alpine с теми же
# логином/паролем и именем базы; данные лежат в docker-томе и переживают перезапуск.
set -euo pipefail
cd "$(dirname "$0")"
ROOT="$PWD"
# shellcheck source=scripts/tui.sh
source scripts/tui.sh
ui_abort_on_signal

PORT="${PORT:-3000}"; DO_SEED=0; KEEP_DB=0; NO_DB=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    -p|--port)  [[ -n "${2:-}" ]] || ui_die "--port требует номер порта"; PORT="$2"; shift ;;
    --seed)     DO_SEED=1 ;;
    --keep-db)  KEEP_DB=1 ;;
    --no-db)    NO_DB=1 ;;
    -h|--help)  sed -n '2,11p' "$0"; exit 0 ;;
    [0-9]*)     PORT="$1" ;;
    *) ui_die "неизвестный аргумент: $1 (см. --help)" ;;
  esac
  shift
done
ui_valid_port "$PORT" || ui_die "порт должен быть числом 1–65535, получено: $PORT"

ui_title "STONEMACHINE" "dev-сервер"

# ── окружение ───────────────────────────────────────────────────────────────
command -v node >/dev/null || ui_die "Node.js не найден"
command -v npm  >/dev/null || ui_die "npm не найден"
env_file_get() { [[ -f .env ]] && grep -E "^$1=" .env | head -1 | cut -d= -f2- | tr -d '"' || true; }

DATABASE_URL="${DATABASE_URL:-$(env_file_get DATABASE_URL)}"
DATABASE_URL="${DATABASE_URL:-postgresql://stonemachine:dev@localhost:55432/stonemachine}"
SESSION_SECRET="${SESSION_SECRET:-$(env_file_get SESSION_SECRET)}"
SESSION_SECRET="${SESSION_SECRET:-dev-session-secret-local-only-0123456789abcdef}"
export DATABASE_URL SESSION_SECRET
export UPLOAD_DIR="${UPLOAD_DIR:-./data/uploads}"
export SITE_URL="http://localhost:$PORT" COOKIE_SECURE=false

# postgresql://user:pass@host:port/db
re='^postgres(ql)?://([^:/@]+):([^@]*)@([^:/]+):([0-9]+)/([^?]+)'
[[ "$DATABASE_URL" =~ $re ]] || ui_die "не разобрал DATABASE_URL (ожидается postgresql://user:pass@host:port/db)"
DB_USER="${BASH_REMATCH[2]}"; DB_PASS="${BASH_REMATCH[3]}"; DB_HOST="${BASH_REMATCH[4]}"
DB_PORT="${BASH_REMATCH[5]}"; DB_NAME="${BASH_REMATCH[6]}"

# ── зависимости ─────────────────────────────────────────────────────────────
if [[ ! -d node_modules ]]; then
  ui_run "npm install" npm install
else
  ui_ok "зависимости на месте"
fi

# ── Postgres ────────────────────────────────────────────────────────────────
CONTAINER="stonemachine-dev-db"; VOLUME="stonemachine_dev_pgdata"
DB_MANAGED=0; NEW_DB=0
db_listening() { (exec 3<>"/dev/tcp/127.0.0.1/$DB_PORT") 2>/dev/null; }

DB_STOPPED=0
stop_db() {
  (( DB_MANAGED && ! KEEP_DB && ! DB_STOPPED )) || return 0
  DB_STOPPED=1
  ui_docker_reauth
  docker stop "$CONTAINER" >/dev/null 2>&1 && ui_dim "Postgres остановлен (данные сохранены в томе $VOLUME)"
}
_UI_ON_STOP=stop_db
# Выход из скрипта по ошибке или Ctrl+C до старта сервера не должен оставлять контейнер работать
trap 'stop_db; tui_cleanup_logs' EXIT

if (( ! NO_DB )); then
  if db_listening; then
    ui_ok "Postgres уже слушает :$DB_PORT"
  else
    [[ "$DB_HOST" == localhost || "$DB_HOST" == 127.0.0.1 ]] \
      || ui_die "Postgres на $DB_HOST:$DB_PORT недоступен (локально поднять его я не могу — хост не локальный)"
    command -v docker >/dev/null \
      || ui_die "нужен Postgres на :$DB_PORT, а docker не установлен. Запустите свой Postgres или поставьте docker"
    ui_ensure_docker
    docker volume inspect "$VOLUME" >/dev/null 2>&1 || NEW_DB=1
    if docker container inspect "$CONTAINER" >/dev/null 2>&1; then
      ui_run "запуск контейнера $CONTAINER" docker start "$CONTAINER"
    else
      ui_run "создание контейнера $CONTAINER" docker run -d --name "$CONTAINER" \
        -e POSTGRES_USER="$DB_USER" -e POSTGRES_PASSWORD="$DB_PASS" -e POSTGRES_DB="$DB_NAME" \
        -p "127.0.0.1:$DB_PORT:5432" -v "$VOLUME:/var/lib/postgresql/data" postgres:17-alpine
    fi
    DB_MANAGED=1
    ui_health "Postgres принимает соединения" 40 0.5 docker exec "$CONTAINER" pg_isready -U "$DB_USER" -d "$DB_NAME" \
      || ui_die "Postgres не поднялся"
  fi

  ui_run "prisma generate" node_modules/.bin/prisma generate
  ui_run "миграции (prisma migrate deploy)" node_modules/.bin/prisma migrate deploy
  if (( DO_SEED || NEW_DB )); then
    ui_run "демо-данные" node_modules/.bin/tsx prisma/seed.ts
  fi
  admins=$(node --env-file-if-exists=.env scripts/create-admin.mjs --count 2>/dev/null | tr -d '[:space:]' || echo "")
  if [[ "$admins" == "0" ]]; then
    ui_run "админ admin / admin123" bash -c "printf '%s\n' admin123 | ADMIN_USERNAME=admin node --env-file-if-exists=.env scripts/create-admin.mjs"
  fi
fi

ui_free_port "$PORT" "$ROOT"

# Сводка по таблицам — запросом через тот же Prisma, без psql на машине
db_summary() {
  local out
  out=$(node --input-type=module -e '
    import { PrismaClient } from "@prisma/client";
    const db = new PrismaClient();
    const t = await db.$queryRawUnsafe("select table_name n from information_schema.tables where table_schema=\x27public\x27 and table_name not like \x27\\_prisma%\x27");
    const rows = [];
    for (const { n } of t) rows.push([Number((await db.$queryRawUnsafe(`select count(*)::int c from "${n}"`))[0].c), n]);
    rows.sort((a, b) => b[0] - a[0]);
    console.log(rows.length, rows.reduce((s, r) => s + r[0], 0));
    for (const [c, n] of rows.slice(0, 5)) console.log(c, n);
    await db.$disconnect();
  ' 2>/dev/null) || { ui_kv "База" "postgres $DB_HOST:$DB_PORT/$DB_NAME (сводка недоступна)"; return 0; }
  local head=${out%%$'\n'*} line max=0 first=1
  ui_kv "База" "postgres $DB_HOST:$DB_PORT/$DB_NAME  ·  таблиц ${head% *}, строк ${head#* }"
  while IFS= read -r line; do
    (( first )) && { max=${line%% *}; first=0; }
    printf '    %s %6s  %s\n' "$(ui_bar "${line%% *}" "$max" 16)" "${line%% *}" "${line#* }"
  done < <(printf '%s\n' "$out" | tail -n +2)
}

ui_panel "Сервер"
ui_kv "Сайт"    "http://localhost:$PORT/"
ui_kv "Админка" "http://localhost:$PORT/admin  (admin / admin123)"
ui_kv "Окружение" "development, SITE_URL и cookie настроены под localhost"
if (( NO_DB )); then ui_kv "База" "не трогаю (--no-db)"; else db_summary; fi
ui_dim "Ctrl+C — остановить"
echo

ui_serve node_modules/.bin/next dev --port "$PORT"
