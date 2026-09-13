#!/usr/bin/env bash
set -u
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
mkdir -p "$WORK/bin" "$WORK/users" "$WORK/etc/systemd/system"
PASS=0
FAIL=0
check() {
  local name="$1" cond="$2"
  if eval "$cond"; then
    PASS=$((PASS + 1))
    printf '  ✓ %s\n' "$name"
  else
    FAIL=$((FAIL + 1))
    printf '  ✗ %s\n' "$name"
  fi
}
section() { printf '\n▸ %s\n' "$1"; }

cat > "$WORK/bin/systemctl" <<'STUB'
#!/usr/bin/env bash
STATE="${SYSTEMD_STATE:?}"
LOG="${SYSTEMD_LOG:?}"
cmd="$1"
shift
unit=""
for a in "$@"; do
  case "$a" in
    --*) ;;
    *) unit="${a%.service}" ;;
  esac
done
case "$cmd" in
  is-active)
    grep -qx "active:$unit" "$STATE" 2>/dev/null && exit 0
    exit 1
    ;;
  is-enabled)
    grep -qx "enabled:$unit" "$STATE" 2>/dev/null && exit 0
    exit 1
    ;;
  stop)
    sed -i "/^active:$unit$/d" "$STATE"
    echo "stop:$unit" >> "$LOG"
    ;;
  start)
    grep -qx "active:$unit" "$STATE" || echo "active:$unit" >> "$STATE"
    echo "start:$unit" >> "$LOG"
    ;;
  disable)
    sed -i "/^enabled:$unit$/d" "$STATE"
    echo "disable:$unit" >> "$LOG"
    ;;
  reset-failed)
    echo "reset-failed:$unit" >> "$LOG"
    ;;
  *)
    exit 1
    ;;
esac
STUB
cat > "$WORK/bin/sudo" <<'STUB'
#!/usr/bin/env bash
exec "$@"
STUB
cat > "$WORK/bin/readlink" <<'STUB'
#!/usr/bin/env bash
p="${@: -1}"
if [ "$p" = "/etc/systemd/system/display-manager.service" ]; then
  if [ -n "${ALIAS_TARGET:-}" ]; then
    echo "$ALIAS_TARGET"
    exit 0
  fi
  exit 1
fi
exec /usr/bin/readlink "$@"
STUB
cat > "$WORK/bin/getent" <<'STUB'
#!/usr/bin/env bash
if [ "$1" = passwd ]; then
  grep -qx "$2" "${PASSWD_FILE:?}" 2>/dev/null && echo "$2:x:1:1::/:/bin/false" && exit 0
  exit 1
fi
if [ "$1" = group ]; then
  grep -qx "$2" "${GROUP_FILE:?}" 2>/dev/null && echo "$2:x:1:" && exit 0
  exit 1
fi
exit 1
STUB
cat > "$WORK/bin/id" <<'STUB'
#!/usr/bin/env bash
if [ "${1:-}" = "-nG" ]; then
  cat "${USER_GROUPS_DIR:?}/${2:?}" 2>/dev/null || echo "$2"
  exit 0
fi
exec /usr/bin/id "$@"
STUB
cat > "$WORK/bin/usermod" <<'STUB'
#!/usr/bin/env bash
if [ "${USERMOD_FAIL:-}" = 1 ]; then exit 1; fi
if [ "${1:-}" = "-aG" ]; then
  echo "$2" >> "${USER_GROUPS_DIR:?}/${3:?}"
  echo "usermod:-aG $2 $3" >> "${SYSTEMD_LOG:?}"
  exit 0
fi
exit 1
STUB
cat > "$WORK/bin/loginctl" <<'STUB'
#!/usr/bin/env bash
case "${1:-}" in
  list-sessions)
    [ -n "${SESSIONS_FILE:-}" ] && cat "$SESSIONS_FILE" 2>/dev/null
    ;;
  show-session)
    if [ -n "${SESSION_TYPES_DIR:-}" ] && [ -f "$SESSION_TYPES_DIR/$2.$4" ]; then
      cat "$SESSION_TYPES_DIR/$2.$4"
    elif [ -n "${SESSION_TYPES_DIR:-}" ] && [ -f "$SESSION_TYPES_DIR/$2" ]; then
      cat "$SESSION_TYPES_DIR/$2"
    else
      echo "${SESSION_TYPE:-tty}"
    fi
    ;;
  terminate-session)
    [ "${GREETER_IMMORTAL:-}" != 1 ] && [ -n "${SESSIONS_FILE:-}" ] && sed -i "/^$2 /d" "$SESSIONS_FILE" 2>/dev/null
    echo "loginctl:terminate-session:$2" >> "${SYSTEMD_LOG:?}"
    ;;
  terminate-user)
    [ "${GREETER_IMMORTAL:-}" != 1 ] && [ -n "${SESSIONS_FILE:-}" ] && sed -i "/^[^ ]* [^ ]* $2 /d" "$SESSIONS_FILE" 2>/dev/null
    echo "loginctl:terminate-user:$2" >> "${SYSTEMD_LOG:?}"
    ;;
esac
STUB
cat > "$WORK/bin/pgrep" <<'STUB'
#!/usr/bin/env bash
[ "${GREETER_ALIVE:-}" = 1 ] && exit 0
exit 1
STUB
cat > "$WORK/bin/pkill" <<'STUB'
#!/usr/bin/env bash
echo "pkill:$*" >> "${SYSTEMD_LOG:?}"
exit 0
STUB
cat > "$WORK/bin/sleep" <<'STUB'
#!/usr/bin/env bash
exit 0
STUB
chmod +x "$WORK"/bin/*
export PATH="$WORK/bin:$PATH"
ok()   { :; }
err()  { :; }
export SYSTEMD_STATE="$WORK/state"
export SYSTEMD_LOG="$WORK/log"
export PASSWD_FILE="$WORK/passwd"
export GROUP_FILE="$WORK/groups"
export USER_GROUPS_DIR="$WORK/users"

awk '/^DM_UNITS=/{f=1} f{print} f && /^return \$rc$/{exit}' "$ROOT/install.sh" > "$WORK/helpers.sh"
echo '}' >> "$WORK/helpers.sh"
bash -n "$WORK/helpers.sh" || { echo "helpers extraction broke"; exit 1; }

section "discovery"
: > "$SYSTEMD_STATE"
printf 'plasma-login-manager\n' > "$PASSWD_FILE"
printf 'video\nrender\n' > "$GROUP_FILE"
echo "active:plasma-login-manager" >> "$SYSTEMD_STATE"
echo "enabled:gdm" >> "$SYSTEMD_STATE"
unset ALIAS_TARGET
. "$WORK/helpers.sh"
check "active disabled competitor is found" '[ "$(dm_active_list)" = "plasma-login-manager" ]'
check "enabled competitor is found" '[ "$(dm_enabled_list)" = "gdm" ]'
check "enabled fallback order picks gdm with no alias" '[ "$(dm_current)" = "gdm" ]'
touch "$WORK/fake.service"
ALIAS_TARGET="$WORK/fake.service" bash -c '. "$1/helpers.sh"; dm_current' _ "$WORK" > "$WORK/out" 2>/dev/null
check "alias beats enabled scan" '[ "$(cat "$WORK/out")" = "fake" ]'
ALIAS_TARGET="/usr/lib/systemd/system/plasma-login-manager.service" bash -c '. "$1/helpers.sh"; dm_active_list' _ "$WORK" > "$WORK/out" 2>/dev/null
check "alias target merged without duplicates" '[ "$(cat "$WORK/out")" = "plasma-login-manager" ]'

section "drm groups"
rm -f "$WORK"/users/*
printf 'sddm\ngdm\n' > "$PASSWD_FILE"
printf 'video\n' > "$GROUP_FILE"
echo "sddm" > "$WORK/users/sddm"
echo "gdm video" > "$WORK/users/gdm"
: > "$SYSTEMD_LOG"
drm_groups_fix >/dev/null 2>&1
check "sddm got video" 'grep -qx "video" "$WORK/users/sddm"'
check "gdm already had video, no double add" '[ "$(tr " " "\n" < "$WORK/users/gdm" | grep -cx "video")" = "1" ]'
check "missing render group is skipped" '! grep -q "usermod:-aG render" "$SYSTEMD_LOG"'
check "absent users are skipped" '! grep -q "plasmalogin" "$SYSTEMD_LOG" && ! grep -q "usermod.*gdm" "$SYSTEMD_LOG"'
printf 'video\nrender\n' > "$GROUP_FILE"
rm -f "$WORK"/users/*
echo "sddm" > "$WORK/users/sddm"
: > "$SYSTEMD_LOG"
drm_groups_fix >/dev/null 2>&1
check "both groups added when present" 'grep -qx "video" "$WORK/users/sddm" && grep -qx "render" "$WORK/users/sddm"'
rm -f "$WORK"/users/*
echo "sddm" > "$WORK/users/sddm"
USERMOD_FAIL=1 bash -c '. "$1/helpers.sh"; drm_groups_fix >/dev/null 2>&1; echo $?' _ "$WORK" > "$WORK/out"
check "failed usermod fails the preflight" '[ "$(cat "$WORK/out")" != "0" ]'

section "graphical sessions"
export XDG_SESSION_ID="7"
mkdir -p "$WORK/sess"
echo "wayland" > "$WORK/sess/3.Type"
echo "x11" > "$WORK/sess/9.Type"
echo "tty" > "$WORK/sess/7.Type"
cat > "$WORK/sessions" <<'EOT'
3 1000 arcxlo seat0
7 1000 arcxlo seat0 tty2
9 1001 other seat0 -
EOT
SESSIONS_FILE="$WORK/sessions"
SESSION_TYPES_DIR="$WORK/sess"
export SESSIONS_FILE SESSION_TYPES_DIR
check "other graphical sessions detected" '[ "$(graphical_sessions_other | sort | tr "\n" " ")" = "3 9 " ]'
printf '7 1000 arcxlo seat0 tty2\n' > "$WORK/sessions"
check "tty-only machine reports none" '[ -z "$(graphical_sessions_other)" ]'

section "greeter sessions"
echo "greeter" > "$WORK/sess/c6.Class"
echo "greeter" > "$WORK/sess/c9.Class"
cat > "$WORK/sessions" <<'EOT'
3 1000 arcxlo seat0
c6 987 plasmalogin seat0 tty1
c9 988 sddm seat0 tty1
7 1000 arcxlo seat0 tty2
EOT
check "unit-less greeter session detected" '[ "$(greeter_sessions_other)" = "c6 plasmalogin" ]'
check "greeter-class session skipped in graphical sessions" '[ "$(graphical_sessions_other | sort | tr "\n" " ")" = "3 " ]'
check "greeter units resolve empty without a live cgroup" '[ -z "$(greeter_units)" ]'
: > "$SYSTEMD_LOG"
greeter_kill >/dev/null 2>&1
check "greeter kill terminates session and user" 'grep -q "loginctl:terminate-session:c6" "$SYSTEMD_LOG" && grep -q "loginctl:terminate-user:plasmalogin" "$SYSTEMD_LOG"'
check "greeter kill cleared the seat" '[ -z "$(greeter_sessions_other)" ]'
printf 'c6 987 plasmalogin seat0 tty1\n' > "$WORK/sessions"
: > "$SYSTEMD_LOG"
GREETER_IMMORTAL=1 bash -c '. "$1/helpers.sh"; greeter_kill >/dev/null 2>&1' _ "$WORK"
check "stubborn greeter eats a pkill" 'grep -q "pkill:-KILL -u plasmalogin" "$SYSTEMD_LOG"'
unset GREETER_IMMORTAL XDG_SESSION_ID SESSIONS_FILE SESSION_TYPES_DIR

section "release seat"
: > "$SYSTEMD_STATE"
echo "enabled:gdm" >> "$SYSTEMD_STATE"
echo "active:plasma-login-manager" >> "$SYSTEMD_STATE"
: > "$SYSTEMD_LOG"
printf 'c6 987 plasmalogin seat0 tty1\n' > "$WORK/sessions"
SESSIONS_FILE="$WORK/sessions" SESSION_TYPES_DIR="$WORK/sess" bash -c '. "$1/helpers.sh"; release_seat >/dev/null 2>&1; echo $?' _ "$WORK" > "$WORK/out"
check "release_seat ghosts the old greeter for next boot" 'grep -qx "disable:gdm" "$SYSTEMD_LOG"'
check "release_seat leaves the live session alone" '! grep -q "^stop:" "$SYSTEMD_LOG" && ! grep -q "loginctl:terminate" "$SYSTEMD_LOG" && ! grep -q "pkill:" "$SYSTEMD_LOG"'
check "release_seat exits clean" '[ "$(cat "$WORK/out")" = "0" ]'
: > "$SYSTEMD_STATE"
echo "enabled:sddm" >> "$SYSTEMD_STATE"
echo "active:sddm" >> "$SYSTEMD_STATE"
: > "$SYSTEMD_LOG"
printf 'c9 988 sddm seat0 tty1\n' > "$WORK/sessions"
SESSIONS_FILE="$WORK/sessions" SESSION_TYPES_DIR="$WORK/sess" release_seat >/dev/null 2>&1
check "sddm-only machine untouched" '! grep -q "disable:" "$SYSTEMD_LOG" && ! grep -q "stop:" "$SYSTEMD_LOG" && ! grep -q "loginctl:" "$SYSTEMD_LOG"'
unset SESSIONS_FILE SESSION_TYPES_DIR

section "handoff unit"
extract_handoff() {
  awk '/<<.HANDOFFSH.$/{f=1;next} /^HANDOFFSH$/{f=0} f' "$ROOT/install.sh" > "$WORK/handoff.sh"
  chmod +x "$WORK/handoff.sh"
}
extract_handoff
bash -n "$WORK/handoff.sh" || { echo "handoff extraction broke"; exit 1; }
: > "$SYSTEMD_STATE"
echo "active:plasma-login-manager" >> "$SYSTEMD_STATE"
echo "active:ly" >> "$SYSTEMD_STATE"
: > "$SYSTEMD_LOG"
: > "$WORK/sessions"
SESSIONS_FILE="$WORK/sessions" GREETER_ALIVE=1 "$WORK/handoff.sh" 7 >/dev/null 2>&1
rc=$?
check "session gone: competitors stopped" '[ "$(grep -c "^stop:" "$SYSTEMD_LOG")" = "2" ] && grep -q "stop:plasma-login-manager" "$SYSTEMD_LOG" && grep -q "stop:ly" "$SYSTEMD_LOG"'
check "session gone: sddm started after reset" '[ "$(grep "^start:" "$SYSTEMD_LOG")" = "start:sddm" ] && grep -q "reset-failed:sddm" "$SYSTEMD_LOG"'
check "session gone: healthy greeter exits clean" '[ "$rc" = "0" ] && grep -qx "active:sddm" "$SYSTEMD_STATE"'
extract_handoff
: > "$SYSTEMD_STATE"
echo "active:plasma-login-manager" >> "$SYSTEMD_STATE"
: > "$SYSTEMD_LOG"
SESSIONS_FILE="$WORK/sessions" GREETER_ALIVE=0 "$WORK/handoff.sh" 7 >/dev/null 2>&1
rc=$?
check "dead greeter: sddm stopped and competitor restored" 'grep -q "stop:sddm" "$SYSTEMD_LOG" && grep -q "start:plasma-login-manager" "$SYSTEMD_LOG"'
check "dead greeter: exits failed" '[ "$rc" = "1" ]'
extract_handoff
: > "$SYSTEMD_STATE"
echo "active:plasma-login-manager" >> "$SYSTEMD_STATE"
: > "$SYSTEMD_LOG"
printf '7 1000 arcxlo seat0 tty2\n' > "$WORK/sessions"
SESSIONS_FILE="$WORK/sessions" GREETER_ALIVE=1 "$WORK/handoff.sh" 7 >/dev/null 2>&1
rc=$?
check "session stuck around: nothing gets stopped" '[ "$(grep -c "^stop:" "$SYSTEMD_LOG")" = "0" ]'
check "session stuck around: sddm never started" '! grep -q "^start:sddm" "$SYSTEMD_LOG"'
check "session stuck around: exits failed" '[ "$rc" = "1" ]'
extract_handoff
: > "$SYSTEMD_STATE"
echo "active:plasma-login-manager" >> "$SYSTEMD_STATE"
: > "$SYSTEMD_LOG"
printf 'c6 987 plasmalogin seat0 tty1\n' > "$WORK/sessions"
SESSIONS_FILE="$WORK/sessions" SESSION_TYPES_DIR="$WORK/sess" GREETER_ALIVE=1 "$WORK/handoff.sh" 7 arcxlo >/dev/null 2>&1
rc=$?
check "unit-less greeter: session and user terminated" 'grep -q "loginctl:terminate-session:c6" "$SYSTEMD_LOG" && grep -q "loginctl:terminate-user:plasmalogin" "$SYSTEMD_LOG"'
check "unit-less greeter: competitor unit still stopped" 'grep -q "stop:plasma-login-manager" "$SYSTEMD_LOG"'
check "unit-less greeter: sddm takes the seat" '[ "$rc" = "0" ] && grep -qx "active:sddm" "$SYSTEMD_STATE"'

printf '\n%s passed, %s failed\n' "$PASS" "$FAIL"
[ "$FAIL" -eq 0 ]
