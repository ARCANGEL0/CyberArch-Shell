#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
task_dir="$(mktemp -d)"
trap 'rm -r -- "$task_dir"' EXIT
mkdir -p "$task_dir/runtime"
printf '#!/bin/sh\nwhile [ "$#" -gt 0 ]; do case "$1" in -D) header="$2"; shift;; -o) body="$2"; shift;; esac; shift; done\nprintf "request\\n" >> "$PROVIDER_REQUEST_LOG"\nif [ "${PROVIDER_FIXTURE_MODE:-}" = limited ]; then printf "HTTP/1.1 429\\r\\nRetry-After: 120\\r\\n" > "$header"; printf "{}" > "$body"; printf "429"; else printf "HTTP/1.1 200\\r\\n" > "$header"; printf "{\\"price\\":42}" > "$body"; printf "200"; fi\n' >"$task_dir/http"
chmod +x "$task_dir/http"
ags bundle --gtk 3 "$root/tests/provider-adapter.ts" "$task_dir/adapter"
XDG_RUNTIME_DIR="$task_dir/runtime" XDG_CACHE_HOME="$task_dir/cache" CYBERARCH_HTTP_CLIENT="$task_dir/http" PROVIDER_REQUEST_LOG="$task_dir/requests" timeout 15 "$task_dir/adapter"
XDG_RUNTIME_DIR="$task_dir/runtime" XDG_CACHE_HOME="$task_dir/cache" CYBERARCH_HTTP_CLIENT="$task_dir/http" PROVIDER_REQUEST_LOG="$task_dir/requests" PROVIDER_RESTART_TEST=1 timeout 15 "$task_dir/adapter"
[[ "$(wc -l <"$task_dir/requests")" == 2 ]]
