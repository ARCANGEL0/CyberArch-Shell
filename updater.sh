#!/usr/bin/env bash
#### Check for updates from remote repo and installs
set -uo pipefail
THEME="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="ARCANGEL0/CyberArch-Shell"
API="https://api.github.com/repos/$REPO/releases/latest"
USER_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/cyberarch"
CACHE="$USER_DIR/update.json"
APPLIED="$USER_DIR/applied-version"
STAMP="$USER_DIR/update-done"

R=$'\033[0m'; B=$'\033[1m'; DIM=$'\033[2m'
RED=$'\033[38;2;255;45;61m'; CYAN=$'\033[38;2;119;226;242m'
YEL=$'\033[38;2;255;214;31m'; GRN=$'\033[38;2;90;230;130m'; GREY=$'\033[38;2;120;120;130m'
line()  { printf "${RED}%s${R}\n" "────────────────────────────────────────────────────────────"; }
hdr()   { printf "\n${CYAN}${B}▓▒░ %s ░▒▓${R}\n" "$1"; }
step()  { printf "${CYAN}▸${R} %s\n" "$1"; }
ok()    { printf "  ${GRN}✓${R} %s\n" "$1"; }
warn()  { printf "  ${YEL}⚠${R} %s\n" "$1"; }
err()   { printf "  ${RED}✗${R} %s\n" "$1"; }
banner() {
  printf "${RED}${B}"
  cat <<'EOF'
   █▀▀ █▄█ █▄▄ █▀▀ █▀█ ▄▀█ █▀█ █▀▀ █_█    █░█ █▀█ █▀▄ ▄▀█ ▀█▀ █▀▀
   █▄▄ ░█░ █▄█ ██▄ █▀▄ █▀█ █▀▄ █▄▄ █░█    █▄█ █▀▀ █▄▀ █▀█ ░█░ ██▄
EOF
  printf "${R}${CYAN}   ░▒▓ N E T R U N N E R * Updater ▓▒░${R}\n"
  line
}

norm() { printf '%s' "${1#[vV]}" | tr -d '[:space:]'; }

vlt() {
    awk -v a="$(norm "${1:-0}")" -v b="$(norm "${2:-0}")" '
        function seg(s, i,   n, p, v) {
            n = split(s, p, ".")
            v = (i <= n) ? p[i] : "0"
            gsub(/[^0-9]/, "", v)
            return (v == "") ? 0 : v + 0
        }
        BEGIN {
            for (i = 1; i <= 4; i++) {
                x = seg(a, i); y = seg(b, i)
                if (x < y) exit 0
                if (x > y) exit 1
            }
            exit 1
        }'
}

local_ver() {
    v=""
    [ -r "$THEME/VERSION" ] && read -r v < "$THEME/VERSION"
    v="$(norm "${v:-0.0.0}")"
    [ -n "$v" ] || v="0.0.0"
    if [ -r "$APPLIED" ]; then
        a=""
        read -r a < "$APPLIED"
        a="$(norm "${a:-}")"
        [ -n "$a" ] && vlt "$v" "$a" && v="$a"
    fi
    printf '%s\n' "$v"
}
remote_tag() { jq -r '.tag_name // empty' "$CACHE" 2>/dev/null; }
  fetch_release() {
     command -v curl >/dev/null 2>&1 || return 1
  command -v jq   >/dev/null 2>&1 || return 1
  j="$(curl -fsSL --max-time 8 -H 'Accept: application/vnd.github+json' "$API" 2>/dev/null)" || return 1
   [ -n "$j" ] || return 1
  printf '%s' "$j" | jq -e '.tag_name' >/dev/null 2>&1 || return 1
     mkdir -p "$USER_DIR"
                printf '%s' "$j" > "$CACHE"
}

cmd_check() {    lv="$(local_ver)"
    if [ "${1:-}" = "--cached" ]; then
  [ -r "$CACHE" ] || { printf '0\n%s\n%s\n' "$lv" "$lv"; return 0; }
    else
  fetch_release || { printf '0\n%s\n%s\n' "$lv" "$lv"; return 0; }
    fi
     rv="$(norm "$(remote_tag)")"
      [ -n "$rv" ] || { printf '0\n%s\n%s\n' "$lv" "$lv"; return 0; }
    if vlt "$lv" "$rv"; then
        printf '1\n%s\n%s\n' "$lv" "$rv"
        jq -r '.body // empty' "$CACHE" 2>/dev/null | tr -d '\r'
    else
        printf '0\n%s\n%s\n' "$lv" "$rv"
    fi }

cmd_spawn() {


    run="'$THEME/updater.sh'; ec=\$?; echo; printf '\033[1;36m>> update finished (exit %s). press ENTER to close.\033[0m ' \"\$ec\"; read _"
      if command -v rio >/dev/null 2>&1; then
       setsid rio --title-placeholder "CYBERARCH UPDATE" -e sh -c "$run" >/dev/null 2>&1 &
       return 0
        fi
     term=""
    for t in "${TERMINAL:-}" cool-retro-term kitty foot wezterm alacritty konsole gnome-terminal xterm; do
      [ -n "$t" ] && command -v "$t" >/dev/null 2>&1 && { term="$t"; break; }
    done
    [ -z "$term" ] && { notify-send "CyberArch update" "No terminal emulator found" 2>/dev/null; exit 1; }
    case "$term" in
        kitty|foot)     setsid "$term" sh -c "$run" >/dev/null 2>&1 & ;;
        wezterm)        setsid "$term" start -- sh -c "$run" >/dev/null 2>&1 & ;;
        gnome-terminal) setsid "$term" -- sh -c "$run" >/dev/null 2>&1 & ;;
        *)              setsid "$term" -e sh -c "$run" >/dev/null 2>&1 & ;;

    esac
}

cmd_apply() {
    clear; banner

    command -v git >/dev/null 2>&1 || { err "git not found |::| install it and re-run"; exit 1; }
    if [ ! -d "$THEME/.git" ]; then
        err "$THEME is not a git clone |::| nothing to fast-forward"
        printf "  ${DIM}re-clone it instead:${R}\n"
        printf "    ${CYAN}git clone https://github.com/%s.git${R}\n" "$REPO"
        printf "    ${CYAN}cd %s && ./install.sh${R}\n" "${REPO#*/}"
        exit 1
    fi
    cd "$THEME" || exit 1

    hdr "VERSION"
    lv="$(local_ver)"
    step "installed  ${B}v$lv${R}"
    tag=""; rv=""
    if fetch_release; then
        tag="$(remote_tag)"; rv="$(norm "$tag")"
        step "latest     ${B}v$rv${R}"
    else
        warn "Script flatined |::| Failed to jack in to github servers, falling back to the trac branch"
    fi
    if [ -n "$rv" ] && ! vlt "$lv" "$rv"; then
        line
        ok "CyberArch is already up to date"
        exit 0
    fi

    hdr "WORKING TREE"
    if ! git diff --quiet -- components/style/cyber.css 2>/dev/null; then
        git checkout -- components/style/cyber.css 2>/dev/null &&  ok "reverted components/style/cyber.css |::| Rebuilt on every boot"
    fi
    if [ -n "$(git status --porcelain --untracked-files=no)" ]; then
        step "local changes found:"
        git status --porcelain --untracked-files=no | sed 's/^/      /'
        if git stash push -m "cyberarch-update $(date +%F-%H%M)" >/dev/null 2>&1; then
            ref="$(git stash list | head -1 | cut -d: -f1)"
            [ -n "$ref" ] || ref="the newest stash"
            ok "Stashed as $ref |::| get 'em back with: git -C $THEME stash pop"
        else
            err "Could not stash |::| resolve those changes yourself and re-run"
            exit 1
        fi
    else
        ok "tree clean"
    fi

    hdr "PULL"
    OLD="$(git rev-parse HEAD)"
    if ! git fetch --tags --prune origin; then
        err "Failed to jack in onto remote |::| check your net and re-run, choom"
        exit 1
    fi
    target=""
    if [ -n "$tag" ] && git rev-parse -q --verify "refs/tags/$tag" >/dev/null 2>&1; then
        target="refs/tags/$tag"
        ok "target $tag"
    else
        br="$(git symbolic-ref --quiet --short HEAD 2>/dev/null)"
        [ -n "$br" ] || br="master"
        target="origin/$br"
        ok "target $target"
    fi
    if ! git merge --ff-only "$target"; then
        err "fast-forward refused"
        printf "  ${GREY}Installer just delta'd. It appears you have local commits, or an incoming file collides with an untracked one.${R}\n"
        printf "  ${DIM}inspect with: git -C %s log --oneline HEAD..%s${R}\n" "$THEME" "$target"
        exit 1
    fi
    NEW="$(git rev-parse HEAD)"
    if [ "$OLD" = "$NEW" ]; then
        warn "Netrunner deck already up to date |::| the release tag points to current ver."
    else
        ok "$(git rev-list --count "$OLD..$NEW") commit(s) applied"
    fi

    nv="$rv"
    [ -n "$nv" ] || { nv=""; read -r nv < "$THEME/VERSION" 2>/dev/null; nv="$(norm "${nv:-$lv}")"; }
    mkdir -p "$USER_DIR"
    printf '%s\n' "$nv" > "$APPLIED"

    hdr "POST-UPDATE"
    if [ "$OLD" = "$NEW" ]; then
        ok "no new chrome to flash |::| deck already runs this code, skipping the restart"
        line
        exit 0
    fi
    printf '%s\n' "$nv" > "$STAMP"
    if ! git diff --quiet "$OLD" "$NEW" -- install.sh; then
        warn "Your install.sh seems rusted, choom |::| Installer has new chrome appended, likely new dependencies."
        printf "  ${CYAN}?${R} re-run the installer now? (y/N) "
        ans=""
        read -r ans </dev/tty 2>/dev/null || ans=""
        case "$ans" in
            [yY]*) exec "$THEME/install.sh" ;;
        esac
        warn "S K I P P E D |::| run ./install.sh yourself if theme suddenly flatlines."
    fi
    if command -v hyprctl >/dev/null 2>&1 && [ -n "${HYPRLAND_INSTANCE_SIGNATURE:-}" ]; then
        hyprctl reload >/dev/null 2>&1 && ok "hyprland config reloaded"
    fi
    line
    printf "${GRN}${B}        ░▒▓  CYBERARCH IS NOW ON V%s  ▓▒░${R}\n" "$nv"
    line
    step "Theme fully chromed. Restarting AGS …"
    setsid "$THEME/scripts/restart" >/dev/null 2>&1 &
    sleep 1
}

case "${1:-}" in
    check)      shift; cmd_check "${1:-}" ;;
    --spawn)    cmd_spawn ;;
    ""|apply)   cmd_apply ;;
    *)          printf 'usage: updater.sh [check [--cached] | --spawn | apply]\n' >&2; exit 2 ;;
esac
exit

