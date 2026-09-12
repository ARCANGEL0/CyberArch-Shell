#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
INSTALLER="$ROOT/install.sh"

fail() {
  printf 'FAIL: %s\n' "$1" >&2
  exit 1
}

line_of() {
  local pattern="$1"
  local line
  line="$(grep -nEm1 "$pattern" "$INSTALLER" | cut -d: -f1 || true)"
  [ -n "$line" ] || fail "missing installer marker: $pattern"
  printf '%s\n' "$line"
}

assert_before() {
  local earlier="$1" later="$2" message="$3"
  [ "$earlier" -lt "$later" ] || fail "$message"
}

bash -n "$INSTALLER"

dry_run_exit="$(line_of 'DRY RUN \|::\| no changes will be made')"
upgrade_prompt="$(line_of '^hdr "SYSTEM UPGRADE"$')"
pacman_sync="$(line_of '^[[:space:]]*sudo pacman -Sy([[:space:]]|$)')"

assert_before "$dry_run_exit" "$upgrade_prompt" \
  "dry-run must exit before the system-upgrade prompt"
assert_before "$dry_run_exit" "$pacman_sync" \
  "dry-run must exit before refreshing pacman databases"

# The dollar signs are intentionally literal because this searches installer source.
# shellcheck disable=SC2016
theme_deploy="$(line_of 'sudo cp -rf "\$LOGINSRC/sddm-theme"/\. "\$SDDM_THEME_DIR"/')"
sddm_current="$(line_of '^Current=netwatch$')"
sddm_backup="$(line_of '^  SDDM_CONF_BACKUP=')"

assert_before "$theme_deploy" "$sddm_current" \
  "deploy the SDDM theme before selecting it in sddm.conf"
assert_before "$sddm_backup" "$sddm_current" \
  "back up sddm.conf before changing the selected theme"

grep -q 'sddm.conf.pre-cyberarch' "$INSTALLER" || \
  fail "installer must print the SDDM backup path for recovery"

rollback_call="$(grep -nE '^[[:space:]]*restore_sddm_state$' "$INSTALLER" | cut -d: -f1 | head -n 1 || true)"
[ -n "$rollback_call" ] || fail "failed SDDM activation must call restore_sddm_state"
activation_failure="$(line_of 'fatal "sddm could not be made the default display manager')"
assert_before "$rollback_call" "$activation_failure" \
  "restore the previous display manager before aborting"
rollback_calls="$(grep -Ec '^[[:space:]]*restore_sddm_state$' "$INSTALLER" || true)"
[ "$rollback_calls" -ge 5 ] || \
  fail "every SDDM activation/start failure must restore the previous state"
grep -qF 'if [ "$CUR_DM" != "sddm" ]; then' "$INSTALLER" || \
  fail "rollback must disable a newly introduced SDDM service"

printf 'PASS: installer safety ordering\n'
