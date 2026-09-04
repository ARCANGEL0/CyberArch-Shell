CFG_FILE="${XDG_CONFIG_HOME:-$HOME/.config}/cyberarch/user_config.lua"
cfg_get() {
    [ -f "$CFG_FILE" ] || return 1
    sed -n "s/^cfg\[\"$1\"\] = \(.*\)\$/\1/p" "$CFG_FILE" | tail -n1
}
cfg_bool() { [ "$(cfg_get "$1")" = "false" ] && return 1; return 0; }
snd_on() {
    cfg_bool snd || return 1
    cfg_bool "$1" || return 1
    return 0
}
snd_path() {
    v=$(cfg_get "$1"); v=${v#\"}; v=${v%\"}
    if [ -n "$v" ] && [ -f "$v" ]; then printf '%s\n' "$v"; else printf '%s\n' "$2"; fi
}
snd_pat() {
    b=${1##*/}
    case "$b" in
        *.*) printf '%s[.]%s\n' "${b%.*}" "${b##*.}" ;;
        *) printf '%s\n' "$b" ;;
    esac
}
