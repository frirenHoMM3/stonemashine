#!/usr/bin/env bash
# ==============================================================================
# tui.sh — общий вывод для dev.sh и deploy.sh: шаги с таймером, спиннер,
# столбики, спарклайны, итоговая диаграмма времени, аккуратная остановка сервера.
#
# Источник правды — infra/lib/tui.sh. В каждый проект копия кладётся командой
#   infra/lib/sync-tui.sh
# (проекты — отдельные репозитории и должны собираться без соседних каталогов).
#
# Подключение:  source "$(dirname "${BASH_SOURCE[0]}")/scripts/tui.sh"
# Без tty и при NO_COLOR вывод остаётся читаемым: без цвета, без анимации.
# ==============================================================================

[[ -n "${_TUI_LOADED:-}" ]] && return 0
_TUI_LOADED=1

# ── цвет и режимы ───────────────────────────────────────────────────────────
if [[ -t 1 && -z "${NO_COLOR:-}" ]]; then
  _C_RST=$'\033[0m'; _C_DIM=$'\033[2m'; _C_BOLD=$'\033[1m'
  _C_RED=$'\033[31m'; _C_GRN=$'\033[32m'; _C_YEL=$'\033[33m'; _C_BLU=$'\033[34m'; _C_CYN=$'\033[36m'
  _TUI_COLOR=1
else
  _C_RST=''; _C_DIM=''; _C_BOLD=''; _C_RED=''; _C_GRN=''; _C_YEL=''; _C_BLU=''; _C_CYN=''
  _TUI_COLOR=0
fi
[[ -t 1 ]] && _TUI_TTY=1 || _TUI_TTY=0

_TUI_LOG_DIR="$(mktemp -d "${TMPDIR:-/tmp}/tui.XXXXXX")"
_TUI_STEP_NAMES=()
_TUI_STEP_SECS=()
_TUI_CUR_NAME=""
_TUI_CUR_T0=0
_TUI_TOTAL=0
_TUI_IDX=0
_TUI_HAD_WARN=0

# Длительности считаем в десятых долях секунды через EPOCHREALTIME (bash 5).
_tui_now() { local t=${EPOCHREALTIME/./}; echo $(( t / 100000 )); }   # десятые доли секунды
_tui_fmt() {   # десятые → "3.2s" / "1m04s"
  local d=$1
  if (( d >= 600 )); then printf '%dm%02ds' $(( d / 600 )) $(( (d % 600) / 10 ))
  else printf '%d.%ds' $(( d / 10 )) $(( d % 10 )); fi
}

_TUI_T0_DEC=$(_tui_now)

tui_cleanup_logs() { [[ -n "${_TUI_LOG_DIR:-}" ]] && rm -rf "$_TUI_LOG_DIR"; }

# ── заголовок и строки ──────────────────────────────────────────────────────
# ui_title "Деплой SmartKIM" "root@host · стандартный"
ui_title() {
  printf '%s%s%s' "$_C_BOLD" "$1" "$_C_RST"
  [[ -n "${2:-}" ]] && printf '  %s%s%s' "$_C_DIM" "$2" "$_C_RST"
  printf '\n'
}
ui_info() { printf '  %s\n' "$*"; }
ui_dim()  { printf '  %s%s%s\n' "$_C_DIM" "$*" "$_C_RST"; }
ui_warn() { _TUI_HAD_WARN=1; printf '  %s!%s %s\n' "$_C_YEL" "$_C_RST" "$*" >&2; }
ui_ok()   { printf '  %s✓%s %s\n' "$_C_GRN" "$_C_RST" "$*"; }
ui_die()  { printf '  %s✗%s %s\n' "$_C_RED" "$_C_RST" "$*" >&2; exit 1; }
# ui_kv "URL" "http://…" — ключ выровнен по ширине 10
ui_kv()   { printf '  %s%s%*s%s %s\n' "$_C_DIM" "$1" $(( 10 - ${#1} )) '' "$_C_RST" "$2"; }   # ширина по символам, не байтам

# ── столбики и спарклайны ───────────────────────────────────────────────────
# ui_bar значение максимум [ширина] → полоска из █ и ░
ui_bar() {
  local v=$1 max=$2 w=${3:-24} n i out=""
  (( max <= 0 )) && max=1
  n=$(( v * w / max )); (( n > w )) && n=$w
  (( v > 0 && n == 0 )) && n=1
  for (( i = 0; i < w; i++ )); do (( i < n )) && out+="█" || out+="░"; done
  printf '%s' "$out"
}

# ui_spark 12 40 33 … → ▂▅▄ (минимум..максимум на 8 уровней)
ui_spark() {
  local -a lv=(▁ ▂ ▃ ▄ ▅ ▆ ▇ █)
  local min=999999999 max=0 v out=""
  for v in "$@"; do (( v < min )) && min=$v; (( v > max )) && max=$v; done
  for v in "$@"; do
    if (( max == min )); then out+="${lv[3]}"
    else out+="${lv[$(( (v - min) * 7 / (max - min) ))]}"; fi
  done
  printf '%s' "$out"
}

# ui_bytes 123456 → "120.6 KB"
ui_bytes() {
  local b=${1:-0}
  if   (( b >= 1073741824 )); then printf '%d.%d GB' $(( b / 1073741824 )) $(( b % 1073741824 * 10 / 1073741824 ))
  elif (( b >= 1048576 ));    then printf '%d.%d MB' $(( b / 1048576 )) $(( b % 1048576 * 10 / 1048576 ))
  elif (( b >= 1024 ));       then printf '%d.%d KB' $(( b / 1024 )) $(( b % 1024 * 10 / 1024 ))
  else printf '%d B' "$b"; fi
}

# ── шаги и их время ─────────────────────────────────────────────────────────
# ui_plan N — сколько шагов ожидается (для счётчика [3/9]); необязательно.
ui_plan() { _TUI_TOTAL=${1:-0}; }

_tui_close_step() {
  [[ -z "$_TUI_CUR_NAME" ]] && return 0
  local d=$(( $(_tui_now) - _TUI_CUR_T0 ))
  _TUI_STEP_NAMES+=("$_TUI_CUR_NAME"); _TUI_STEP_SECS+=("$d")
  _TUI_CUR_NAME=""
}

# ui_step "Сборка фронтенда" — закрывает предыдущий шаг и открывает новый.
ui_step() {
  _tui_close_step
  _TUI_IDX=$(( _TUI_IDX + 1 ))
  _TUI_CUR_NAME="$1"; _TUI_CUR_T0=$(_tui_now)
  local ctr=""
  (( _TUI_TOTAL > 0 )) && ctr=$(printf '%s%2d/%d%s ' "$_C_DIM" "$_TUI_IDX" "$_TUI_TOTAL" "$_C_RST")
  printf '\n%s%s%s%s\n' "$ctr" "$_C_BOLD" "$1" "$_C_RST"
}

# ── запуск команды со спиннером ─────────────────────────────────────────────
# ui_run "подпись" команда аргументы…
# Вывод команды уходит в лог; при ошибке печатается его хвост, и функция
# возвращает код команды (под set -e скрипт остановится). Лог последней
# команды: $UI_LAST_LOG.
UI_LAST_LOG=""
ui_run() {
  local label="$1"; shift
  local log="$_TUI_LOG_DIR/run.$RANDOM.log" t0 pid rc d
  UI_LAST_LOG="$log"
  t0=$(_tui_now)
  # ERR-ловушку в фоновом процессе гасим: об ошибке сообщит сам ui_run, а не дубль внутри лога
  { trap - ERR; "$@"; } >"$log" 2>&1 </dev/null &
  pid=$!
  if (( _TUI_TTY )); then
    local -a fr=(⠋ ⠙ ⠹ ⠸ ⠼ ⠴ ⠦ ⠧ ⠇ ⠏); local i=0
    local cols=${COLUMNS:-$(tput cols 2>/dev/null || echo 100)} last="" room
    while kill -0 "$pid" 2>/dev/null; do
      # Последняя строка вывода — видно, что сборка идёт, а не повисла
      if (( i % 6 == 0 )); then
        last=$(tail -n 1 "$log" 2>/dev/null | tr -d '\r' | tr -c '[:print:]\n' '?' | sed 's/\x1b\[[0-9;]*m//g')
      fi
      room=$(( cols - ${#label} - 16 ))
      (( room < 10 )) && last="" || last=${last:0:room}
      printf '\r  %s%s%s %s %s%s%s%s\033[K' "$_C_CYN" "${fr[i % 10]}" "$_C_RST" "$label" "$_C_DIM" "$(_tui_fmt $(( $(_tui_now) - t0 )))" "${last:+  $last}" "$_C_RST"
      i=$(( i + 1 )); sleep 0.08
    done
    printf '\r\033[K'
  fi
  wait "$pid" && rc=0 || rc=$?
  d=$(( $(_tui_now) - t0 ))
  if (( rc == 0 )); then
    local note=""
    [[ -n "${UI_RUN_NOTE_FN:-}" ]] && note=$("$UI_RUN_NOTE_FN" "$log" 2>/dev/null || true)
    printf '  %s✓%s %s %s%s%s%s\n' "$_C_GRN" "$_C_RST" "$label" "$_C_DIM" "$(_tui_fmt "$d")" "${note:+  ·  $note}" "$_C_RST"
  else
    printf '  %s✗%s %s %s(код %d, %s)%s\n' "$_C_RED" "$_C_RST" "$label" "$_C_DIM" "$rc" "$(_tui_fmt "$d")" "$_C_RST" >&2
    ui_tail "$log" 25 >&2
  fi
  return "$rc"
}

# ui_tail файл [строк] — хвост лога с отступом и серым цветом
ui_tail() {
  local f=$1 n=${2:-20}
  [[ -s "$f" ]] || return 0
  tail -n "$n" "$f" | sed "s/^/    ${_C_DIM}│${_C_RST} /"
}

# ── rsync: одна строка на вызов и диаграмма объёма в итоге ──────────────────
_TUI_XFER_LABELS=()
_TUI_XFER_BYTES=()

# ui_rsync "подпись" источник приёмник [опции rsync…]
ui_rsync() {
  local label="$1" src="$2" dst="$3"; shift 3
  _ui_rsync_run "$label" "$@" -- "$src" "$dst"
}

# ui_rsync_files "подпись" приёмник файл… — несколько файлов за один вызов rsync
ui_rsync_files() {
  local label="$1" dst="$2"; shift 2
  _ui_rsync_run "$label" -c -- "$@" "$dst"
}

# Выдаёт «передано_файлов байт всего_файлов» из лога rsync --stats.
_ui_rsync_parse() {
  awk -F': ' '
    /Number of regular files transferred/ {gsub(/[,.]/,"",$2); f=$2+0}
    /Total transferred file size/        {gsub(/[,. ]/,"",$2); sub(/bytes.*/,"",$2); b=$2+0}
    /Number of files:/                   {gsub(/[,.]/,"",$2); sub(/ .*/,"",$2); t=$2+0}
    END {print f+0, b+0, t+0}' "$1"
}
_ui_rsync_note() {
  local f b t; read -r f b t < <(_ui_rsync_parse "$1")
  printf '%s из %s файлов, %s' "$f" "$t" "$(ui_bytes "$b")"
}

# Аргументы после «--» — источники и приёмник; до него — опции rsync.
_ui_rsync_run() {
  local label="$1"; shift
  local -a opts=() paths=(); local seen=0 a
  for a in "$@"; do
    if (( seen )); then paths+=("$a"); elif [[ "$a" == "--" ]]; then seen=1; else opts+=("$a"); fi
  done
  local rc=0 UI_RUN_NOTE_FN=_ui_rsync_note
  ui_run "$label" rsync -a --stats "${opts[@]}" "${paths[@]}" || rc=$?
  (( rc != 0 )) && return "$rc"
  local f b t; read -r f b t < <(_ui_rsync_parse "$UI_LAST_LOG")
  _TUI_XFER_LABELS+=("$label"); _TUI_XFER_BYTES+=("$b")
}

# ui_xfer_add "подпись" байты — учесть передачу не через rsync (tar | ssh и т.п.)
ui_xfer_add() { _TUI_XFER_LABELS+=("$1"); _TUI_XFER_BYTES+=("${2:-0}"); }

# Диаграмма объёма, переданного rsync, — печатается из ui_summary.
_ui_xfer_chart() {
  (( ${#_TUI_XFER_LABELS[@]} == 0 )) && return 0
  local i max=0 sum=0 w=0 name
  for i in "${!_TUI_XFER_BYTES[@]}"; do
    (( _TUI_XFER_BYTES[i] > max )) && max=${_TUI_XFER_BYTES[i]}
    sum=$(( sum + _TUI_XFER_BYTES[i] ))
    name=${_TUI_XFER_LABELS[i]}; (( ${#name} > w )) && w=${#name}
  done
  (( sum == 0 )) && { printf '\n%sПередано%s  нового нет, всё уже на сервере\n' "$_C_BOLD" "$_C_RST"; return 0; }
  (( w > 34 )) && w=34
  printf '\n%sПередано%s  %s%s%s\n' "$_C_BOLD" "$_C_RST" "$_C_DIM" "$(ui_bytes "$sum")" "$_C_RST"
  # от большего к меньшему, нулевые пропускаем
  local -a order; mapfile -t order < <(for i in "${!_TUI_XFER_BYTES[@]}"; do echo "${_TUI_XFER_BYTES[i]} $i"; done | sort -rn)
  local line n shown=0
  for line in "${order[@]}"; do
    n=${line%% *}; i=${line#* }
    (( n == 0 )) && continue
    (( shown >= 6 )) && break; shown=$(( shown + 1 ))
    name=${_TUI_XFER_LABELS[i]}; (( ${#name} > w )) && name="${name:0:w-1}…"
    printf '  %s%*s %s %9s\n' "$name" $(( w - ${#name} )) '' "$(ui_bar "$n" "$max" 20)" "$(ui_bytes "$n")"
  done
}

# ── размеры сборки ──────────────────────────────────────────────────────────
# Файлы каталога без .git, node_modules и сжатых копий; доп. каталоги для пропуска —
# в UI_SIZES_PRUNE через пробел (например "scripts docs").
_ui_find_files() {
  local dir=$1 pat=$2 name; local -a prune=(-name .git -o -name node_modules)
  for name in ${UI_SIZES_PRUNE:-}; do prune+=(-o -name "$name"); done
  find "$dir" \( "${prune[@]}" \) -prune -o -type f ! -name '*.gz' ! -name '*.br' -name "$pat" -print 2>/dev/null
}

# ui_sizes каталог [сколько] [маска] — самые тяжёлые файлы столбиками, сжатые
# (.gz рядом) показываются вторым числом.
ui_sizes() {
  local dir=$1 n=${2:-6} pat=${3:-*}
  [[ -d "$dir" ]] || return 0
  local -a rows=(); local f sz gz max=0 total=0
  while IFS= read -r f; do
    sz=$(stat -c %s "$f"); total=$(( total + sz ))
    rows+=("$sz|$f")
  done < <(_ui_find_files "$dir" "$pat")
  (( ${#rows[@]} == 0 )) && return 0
  mapfile -t rows < <(printf '%s\n' "${rows[@]}" | sort -t'|' -k1,1nr | head -n "$n")
  max=${rows[0]%%|*}
  local r
  for r in "${rows[@]}"; do
    sz=${r%%|*}; f=${r#*|}
    gz=""
    [[ -f "$f.gz" ]] && gz=" → $(ui_bytes "$(stat -c %s "$f.gz")") gzip"
    printf '    %s %8s  %s%s\n' "$(ui_bar "$sz" "$max" 18)" "$(ui_bytes "$sz")" "${f#"$dir"/}" "$gz"
  done
  printf '    %sвсего %s в %d файлах%s\n' "$_C_DIM" "$(ui_bytes "$total")" "$(_ui_find_files "$dir" '*' | wc -l)" "$_C_RST"
}

# ── проверка здоровья с графиком отклика ────────────────────────────────────
# ui_health "подпись" попыток пауза команда…
# Команда должна вернуть 0, когда сервис здоров. Каждая попытка рисуется
# столбиком времени ответа; в конце — спарклайн и итог.
ui_health() {
  local label="$1" tries=$2 pause=$3; shift 3
  local -a lat=(); local i t0 ok=0 d
  local log="$_TUI_LOG_DIR/health.$RANDOM.log"; UI_LAST_LOG="$log"
  for (( i = 1; i <= tries; i++ )); do
    t0=$(_tui_now)
    if "$@" >"$log" 2>&1 </dev/null; then ok=1; fi
    d=$(( ($(_tui_now) - t0) * 100 ))   # мс
    lat+=("$d")
    if (( _TUI_TTY )); then
      printf '\r  %s %s %s%d/%d%s\033[K' "$_C_CYN" "$label" "$_C_DIM" "$i" "$tries" "$_C_RST"
    fi
    (( ok )) && break
    sleep "$pause"
  done
  (( _TUI_TTY )) && printf '\r\033[K'
  if (( ok )); then
    printf '  %s✓%s %s  %s%d поп. %s  отклик %d мс%s\n' "$_C_GRN" "$_C_RST" "$label" "$_C_DIM" "${#lat[@]}" "$(ui_spark "${lat[@]}")" "${lat[-1]}" "$_C_RST"
    return 0
  fi
  printf '  %s✗%s %s  %d попыток %s\n' "$_C_RED" "$_C_RST" "$label" "${#lat[@]}" "$(ui_spark "${lat[@]}")" >&2
  ui_tail "$log" 15 >&2
  return 1
}

# ── итог: где ушло время ────────────────────────────────────────────────────
# ui_summary "Готово" — закрывает шаг и рисует диаграмму длительностей.
ui_summary() {
  _tui_close_step
  local title=${1:-Готово}
  local i max=0 sum=0 name w=0
  for i in "${!_TUI_STEP_SECS[@]}"; do
    (( _TUI_STEP_SECS[i] > max )) && max=${_TUI_STEP_SECS[i]}
    sum=$(( sum + _TUI_STEP_SECS[i] ))
    name=${_TUI_STEP_NAMES[i]}; (( ${#name} > w )) && w=${#name}
  done
  (( w > 34 )) && w=34
  printf '\n%s%s%s  %s%s%s\n' "$_C_BOLD" "$title" "$_C_RST" "$_C_DIM" "$(_tui_fmt "$sum")" "$_C_RST"
  (( ${#_TUI_STEP_NAMES[@]} == 0 )) && return 0
  for i in "${!_TUI_STEP_SECS[@]}"; do
    local pct=$(( sum > 0 ? _TUI_STEP_SECS[i] * 100 / sum : 0 ))
    name=${_TUI_STEP_NAMES[i]}
    (( ${#name} > w )) && name="${name:0:w-1}…"       # по символам, а не байтам
    printf '  %s%*s %s %6s %s%3d%%%s\n' "$name" $(( w - ${#name} )) '' \
      "$(ui_bar "${_TUI_STEP_SECS[i]}" "$max" 20)" "$(_tui_fmt "${_TUI_STEP_SECS[i]}")" "$_C_DIM" "$pct" "$_C_RST"
  done
  _ui_xfer_chart
}

# ── прерывание деплоя ───────────────────────────────────────────────────────
# ui_abort_on_signal — Ctrl+C: гасим фоновые команды, пишем, на каком шаге
# остановились, выходим с кодом 130. EXIT-ловушки проекта при этом срабатывают.
ui_abort_on_signal() {
  trap '_tui_abort' INT TERM
}
_tui_abort() {
  trap - INT TERM
  local j; for j in $(jobs -p); do kill "$j" 2>/dev/null || true; done
  printf '\r\033[K\n  %s!%s прервано на шаге «%s»\n' "$_C_YEL" "$_C_RST" "${_TUI_CUR_NAME:-—}" >&2
  exit 130
}

# ── ошибки ──────────────────────────────────────────────────────────────────
# ui_trap_errors — при падении под set -e показывает, на каком шаге упали.
ui_trap_errors() {
  trap '_tui_on_err $? $LINENO' ERR
  set -o errtrace
}
_tui_on_err() {
  local rc=$1 line=$2
  trap - ERR
  printf '\n  %s✗%s шаг «%s» не выполнен (строка %s, код %s)\n' "$_C_RED" "$_C_RST" "${_TUI_CUR_NAME:-—}" "$line" "$rc" >&2
}

# ── dev-сервер: порт, процесс, аккуратная остановка ─────────────────────────
# ui_parse_port "$arg" — проверка номера порта 1..65535.
ui_valid_port() { [[ "$1" =~ ^[0-9]+$ ]] && (( $1 >= 1 && $1 <= 65535 )); }

ui_port_pid() { # PID слушающего процесса на порту; пусто — порт свободен (всегда код 0)
  if command -v ss >/dev/null 2>&1; then
    ss -ltnpH "sport = :$1" 2>/dev/null | grep -o 'pid=[0-9]*' | head -1 | cut -d= -f2 || true
  elif command -v lsof >/dev/null 2>&1; then
    lsof -ti tcp:"$1" -sTCP:LISTEN 2>/dev/null | head -1 || true
  fi
  return 0
}

# ui_free_port порт каталог_проекта
# Порт занят нашим же старым dev-сервером (cwd внутри проекта) — гасим его.
# Чужой процесс не трогаем: сообщаем, кто занял, и предлагаем свободный порт.
ui_free_port() {
  local port=$1 proj=$2 pid cwd name p
  pid=$(ui_port_pid "$port"); [[ -z "$pid" ]] && return 0
  cwd=$(readlink "/proc/$pid/cwd" 2>/dev/null || true)
  name=$(ps -o comm= -p "$pid" 2>/dev/null || echo "?")
  if [[ -n "$cwd" && "$cwd" == "$proj"* ]]; then
    ui_warn "порт $port держит прошлый запуск этого проекта ($name, pid $pid) — останавливаю"
    kill "$pid" 2>/dev/null || true
    for _ in 1 2 3 4 5 6 7 8 9 10; do sleep 0.3; [[ -z "$(ui_port_pid "$port")" ]] && return 0; done
    kill -9 "$pid" 2>/dev/null || true; sleep 0.3
    return 0
  fi
  for (( p = port + 1; p < port + 50; p++ )); do [[ -z "$(ui_port_pid "$p")" ]] && break; done
  ui_die "порт $port занят чужим процессом: $name (pid $pid). Свободен, например, $p: ./dev.sh $p"
}

_UI_SERVER_PID=""
_UI_ON_STOP=""      # функция, которую вызвать после остановки (закрыть БД и т.п.)
_UI_SERVE_T0=0
_UI_STOPPING=0

# ui_serve команда аргументы… — запускает сервер отдельной группой процессов
# и ждёт. Ctrl+C / SIGTERM → мягко останавливаем всю группу, потом выходим 0.
ui_serve() {
  _UI_SERVE_T0=$SECONDS
  trap '_ui_stop INT'  INT
  trap '_ui_stop TERM' TERM
  if command -v setsid >/dev/null 2>&1; then setsid "$@" & else "$@" & fi
  _UI_SERVER_PID=$!
  local rc=0
  # wait прерывается сигналом; возвращаемся к ожиданию, пока процесс жив
  while kill -0 "$_UI_SERVER_PID" 2>/dev/null; do
    wait "$_UI_SERVER_PID" 2>/dev/null && rc=0 || rc=$?
    (( _UI_STOPPING )) && break
  done
  if (( ! _UI_STOPPING )); then
    printf '\n  %s✗%s сервер завершился сам (код %s)\n' "$_C_RED" "$_C_RST" "$rc" >&2
    _ui_after_stop; return "$rc"
  fi
  _ui_after_stop
}

_ui_stop() {
  (( _UI_STOPPING )) && return 0
  _UI_STOPPING=1
  printf '\r\033[K\n  %sОстанавливаю…%s' "$_C_DIM" "$_C_RST"
  if [[ -n "$_UI_SERVER_PID" ]] && kill -0 "$_UI_SERVER_PID" 2>/dev/null; then
    kill -TERM -- "-$_UI_SERVER_PID" 2>/dev/null || kill -TERM "$_UI_SERVER_PID" 2>/dev/null || true
    local i
    for i in $(seq 1 30); do kill -0 "$_UI_SERVER_PID" 2>/dev/null || break; sleep 0.1; done
    if kill -0 "$_UI_SERVER_PID" 2>/dev/null; then
      kill -KILL -- "-$_UI_SERVER_PID" 2>/dev/null || kill -KILL "$_UI_SERVER_PID" 2>/dev/null || true
    fi
  fi
}

_ui_after_stop() {
  trap - INT TERM
  [[ -n "$_UI_ON_STOP" ]] && "$_UI_ON_STOP" || true
  local up=$(( SECONDS - _UI_SERVE_T0 ))
  printf '\r\033[K  %s✓%s остановлено, работал %s\n' "$_C_GRN" "$_C_RST" "$(_tui_fmt $(( up * 10 )))"
  tui_cleanup_logs
}

# ui_wait_port порт [секунд] — ждёт, пока сервер начнёт слушать порт.
ui_wait_port() {
  local port=$1 max=${2:-30} i
  for (( i = 0; i < max * 5; i++ )); do
    (bash -c "exec 3<>/dev/tcp/127.0.0.1/$port" 2>/dev/null) && return 0
    sleep 0.2
  done
  return 1
}

# ui_sqlite_summary файл [сколько_таблиц] — размер базы и самые наполненные
# таблицы столбиками. Открывает файл только на чтение.
ui_sqlite_summary() {
  local db=$1 top=${2:-5}
  [[ -f "$db" ]] || { ui_kv "База" "ещё не создана"; return 0; }
  local out
  out=$(python3 - "$db" "$top" <<'PY' 2>/dev/null || true
import sqlite3, sys
db, top = sys.argv[1], int(sys.argv[2])
con = sqlite3.connect(f"file:{db}?mode=ro", uri=True)
tables = [r[0] for r in con.execute("select name from sqlite_master where type='table' and name not like 'sqlite_%' and name != 'alembic_version'")]
rows = sorted(((con.execute(f'select count(*) from "{t}"').fetchone()[0], t) for t in tables), reverse=True)
print(len(tables), sum(n for n, _ in rows))
for n, t in rows[:top]:
    print(n, t)
PY
)
  [[ -z "$out" ]] && { ui_kv "База" "$db (не удалось прочитать)"; return 0; }
  local head tables total
  head=$(printf '%s\n' "$out" | head -1); tables=${head% *}; total=${head#* }
  ui_kv "База" "${db#"$PWD"/}  ·  $(ui_bytes "$(stat -c %s "$db")"), таблиц $tables, строк $total"
  local -a rows=(); local line max=0
  while IFS= read -r line; do rows+=("$line"); done < <(printf '%s\n' "$out" | tail -n +2)
  (( ${#rows[@]} == 0 )) && return 0
  max=${rows[0]%% *}
  for line in "${rows[@]}"; do
    local n=${line%% *} t=${line#* }
    printf '    %s %6s  %s\n' "$(ui_bar "$n" "$max" 16)" "$n" "$t"
  done
}

# ui_ensure_docker — после вызова команда `docker` гарантированно работает.
#  * демон не запущен → sudo systemctl start docker (пароль спросят в этом терминале);
#  * сокет есть, но пользователя нет в группе docker → дальше `docker` — это обёртка
#    над `sudo docker` (один запрос пароля на сессию), ничего в системе не меняется.
ui_ensure_docker() {
  command -v docker >/dev/null 2>&1 || ui_die "docker не установлен"
  docker info >/dev/null 2>&1 && return 0
  local err; err=$(docker info 2>&1 || true)

  if ! grep -qi "permission denied" <<<"$err"; then
    # сокета нет — демон не запущен
    command -v systemctl >/dev/null 2>&1 || ui_die "docker-демон не запущен, а systemd нет — запустите его вручную"
    ui_warn "docker-демон не запущен — запускаю: sudo systemctl start docker"
    if ! sudo -n true 2>/dev/null && [[ ! -t 0 ]]; then
      ui_die "для запуска демона нужен sudo, а терминала для пароля нет — выполните: sudo systemctl start docker"
    fi
    sudo systemctl start docker || ui_die "не удалось запустить docker-демон"
    local i
    for (( i = 0; i < 60; i++ )); do [[ -S /var/run/docker.sock ]] && break; sleep 0.5; done
    ui_dim "чтобы демон поднимался сам после перезагрузки: sudo systemctl enable docker"
    docker info >/dev/null 2>&1 && { ui_ok "docker-демон запущен"; return 0; }
    err=$(docker info 2>&1 || true)
  fi

  if grep -qi "permission denied" <<<"$err"; then
    # Нет прав на сокет: работаем через sudo, пока скрипт жив
    ui_warn "нет доступа к docker-сокету (вас нет в группе docker) — использую sudo docker"
    ui_dim "насовсем: sudo usermod -aG docker $USER и перелогиниться"
    sudo -v || ui_die "без sudo и без группы docker работать с docker нельзя"
    docker() { sudo docker "$@"; }
    export -f docker
    docker info >/dev/null 2>&1 || ui_die "docker не отвечает даже через sudo"
    ui_ok "docker работает через sudo"
    return 0
  fi
  ui_die "docker не отвечает: ${err##*$'\n'}"
}

# ui_docker_reauth — перед командами в конце работы (остановка контейнера): если docker идёт
# через sudo, обновляет его пароль-таймаут, чтобы запрос не потерялся под спиннером.
ui_docker_reauth() { [[ "$(type -t docker)" == "function" ]] && sudo -v 2>/dev/null || true; }

# ui_db_row "SQLite" "egen.db" "412 KB, 18 таблиц" — строка о базе в панели.
ui_panel() { # ui_panel заголовок; затем вызывать ui_kv
  printf '\n%s%s%s\n' "$_C_BOLD" "$1" "$_C_RST"
}
