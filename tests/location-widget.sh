#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
task_dir="$(mktemp -d)"
trap 'rm -r -- "$task_dir"' EXIT
mkdir -p "$task_dir/bin"
printf '#!/bin/sh\nprintf "%%s\\n" "$*" >> "$REQUEST_LOG"\nprintf "{}\\n"\n' >"$task_dir/bin/curl"
chmod +x "$task_dir/bin/curl"
if ! REQUEST_LOG="$task_dir/requests" PATH="$task_dir/bin:$PATH" HOME="$task_dir/home" XDG_CONFIG_HOME="$task_dir/config" \
 XDG_CACHE_HOME="$task_dir/cache" XDG_STATE_HOME="$task_dir/state" GDK_BACKEND=wayland HYPRLAND_INSTANCE_SIGNATURE=isolated-test \
 timeout 15 ags run --gtk 3 "$root/tests/location-widget.ts" >"$task_dir/widget.log" 2>&1; then cat "$task_dir/widget.log"; exit 1; fi
cat "$task_dir/widget.log"
grep -q 'PASS: fresh side-panel' "$task_dir/widget.log"
if [[ -e "$task_dir/requests" ]]; then printf 'FAIL: unset widget fetched a provider\n'; exit 1; fi
[[ ! -e "$task_dir/config/cyberarch/city.json" ]]
