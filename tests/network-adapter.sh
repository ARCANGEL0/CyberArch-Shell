#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
task_dir="$(mktemp -d)"
trap 'rm -r -- "$task_dir"' EXIT
mkdir -p "$task_dir/bin" "$task_dir/runtime"
printf '#!/bin/sh\ncase "$*" in\n *DEVICE,TYPE,STATE*) printf "wlp-fixture:wifi:connected\\n";;\n *CONNECTIVITY*) printf "limited\\n";;\n *IN-USE,SSID,SIGNAL*) printf "*:Fixture: Café:67\\n";;\n *) exit 1;;\nesac\n' >"$task_dir/bin/nmcli"
chmod +x "$task_dir/bin/nmcli"
ags bundle --gtk 3 "$root/tests/network-adapter.ts" "$task_dir/adapter.mjs"
DBUS_SYSTEM_BUS_ADDRESS=unix:path=/nonexistent XDG_RUNTIME_DIR="$task_dir/runtime" PATH="$task_dir/bin:$PATH" timeout 15 "$task_dir/adapter.mjs"
