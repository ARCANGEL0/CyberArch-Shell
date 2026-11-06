#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
task_dir="$(mktemp -d)"
trap 'rm -r -- "$task_dir"' EXIT
HOME="$task_dir/home" XDG_CONFIG_HOME="$task_dir/config" XDG_CACHE_HOME="$task_dir/cache" XDG_STATE_HOME="$task_dir/state" \
 GDK_BACKEND=wayland HYPRLAND_INSTANCE_SIGNATURE=isolated-test timeout 20 ags run --gtk 3 "$root/tests/hud-layout-widget.ts"
