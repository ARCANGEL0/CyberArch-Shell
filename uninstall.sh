#!/usr/bin/env bash
set -uo pipefail

THEME="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
CONFIG="$HOME/.config"
THEME_CONFIG="${XDG_CONFIG_HOME:-$CONFIG}"
CANON="$CONFIG/hypr/themes/cyberpunk"
STATE_FILE="${XDG_STATE_HOME:-$HOME/.local/state}/cyberarch/install-state"
IDLECONF="$CONFIG/hypr/hypridle.conf"
HYPRLUA="$CONFIG/hypr/hyprland.lua"
SDDM_THEME="/usr/share/sddm/themes/netwatch"
CRON_LINE="*/10 * * * * $CANON/components/login/sddm-theme/cache-news.sh"
confirmed=0
wait_on_exit=0

for arg in "$@"; do
    case "$arg" in
        --confirmed) confirmed=1 ;;
        --terminal) wait_on_exit=1 ;;
    esac
done

if [ "$(id -u)" = 0 ]; then
    if [ -n "${SUDO_USER:-}" ]; then
        exec runuser -u "$SUDO_USER" -- env -u SUDO_USER bash "$THEME/uninstall.sh" "$@"
    fi
    printf 'Run this as your user, not from a root shell.\n'
    exit 1
fi

if [ "$confirmed" != 1 ]; then
    printf 'This removes CyberArch startup files and hooks. Your files and packages stay.\n'
    printf 'Continue? [y/N] '
    read -r answer </dev/tty || exit 1
    case "$answer" in y|Y) ;; *) printf 'Uninstall cancelled.\n'; exit 0 ;; esac
fi

printf '\nCyberArch uninstall\n\n'
if ! sudo -v; then
    printf 'Could not get sudo access; nothing was removed.\n'
    exit 1
fi

remove_home_file() {
    local path="$1"
    if [ -e "$path" ] || [ -L "$path" ]; then
        rm -f -- "$path" && printf 'Removed %s\n' "$path"
    fi
}

if [ -L "$CANON" ] && [ "$(readlink -f "$CANON" 2>/dev/null || true)" = "$THEME" ]; then
    rm -- "$CANON" && printf 'Removed theme link %s\n' "$CANON"
else
    printf 'Kept %s; it is not a link to this checkout.\n' "$CANON"
fi

# Strip only the CyberArch bootstrap lines and leave the rest of their Hyprland config intact.
if [ -f "$HYPRLUA" ] && grep -Fq '/.config/hypr/themes/cyberpunk/?.lua;' "$HYPRLUA"; then
    clean_lua="$(mktemp)"
    awk '
        index($0, "/.config/hypr/themes/cyberpunk/?.lua;") { skip=2; next }
        skip == 2 && $0 == "require(\"theme\")" { skip=1; next }
        skip == 1 && $0 == "require(\"user\")" { skip=0; next }
        skip > 0 { skip=0 }
        $0 ~ /^hl\.env\("DISPLAY", ":[0-9]+"\)$/ { next }
        { print }
    ' "$HYPRLUA" > "$clean_lua"
    if grep -q '[^[:space:]]' "$clean_lua"; then
        chmod --reference="$HYPRLUA" "$clean_lua"
        mv -- "$clean_lua" "$HYPRLUA"
        printf 'Removed CyberArch startup lines from %s\n' "$HYPRLUA"
    else
        rm -f -- "$clean_lua"
        backups=()
        while IFS= read -r file; do backups+=("$file"); done < <(printf '%s\n' "$CONFIG/hypr"/hyprland.lua.bak.* | sort -rV)
        if [ "${#backups[@]}" -gt 0 ] && [ -f "${backups[0]}" ]; then
            printf 'The config only contained the CyberArch loader. Restore %s? [Y/n] ' "${backups[0]}"
            read -r answer </dev/tty || answer=n
            if [ "$answer" != n ] && [ "$answer" != N ]; then
                cp -f -- "${backups[0]}" "$HYPRLUA"
                printf 'Restored the saved Hyprland config.\n'
            else
                remove_home_file "$HYPRLUA"
                printf 'Hyprland will use its other config or start with its defaults.\n'
            fi
        else
            remove_home_file "$HYPRLUA"
            printf 'No saved Lua config was found; Hyprland will use its other config or defaults.\n'
        fi
    fi
fi

if [ -f "$IDLECONF" ]; then
    clean_idle="$(mktemp)"
    awk -v canon="$CANON/components/login/lock.sh" -v theme="$THEME/components/login/lock.sh" '
        /^[[:space:]]*lock_cmd[[:space:]]*=/ && (index($0, canon) || index($0, theme)) { next }
        { print }
    ' "$IDLECONF" > "$clean_idle"
    if ! cmp -s "$IDLECONF" "$clean_idle"; then
        if grep -q '[^[:space:]]' "$clean_idle"; then chmod --reference="$IDLECONF" "$clean_idle"; mv -- "$clean_idle" "$IDLECONF"
        else rm -f -- "$clean_idle" "$IDLECONF"
        fi
        printf 'Removed the CyberArch hypridle lock command.\n'
    else
        rm -f -- "$clean_idle"
    fi
fi

if command -v crontab >/dev/null 2>&1; then
    current_cron="$(crontab -l 2>/dev/null || true)"
    if printf '%s\n' "$current_cron" | grep -Fqx "$CRON_LINE"; then
        printf '%s\n' "$current_cron" | awk -v line="$CRON_LINE" '$0 != line' | crontab - && printf 'Removed the CyberArch news-cache cron entry.\n'
    fi
fi

if [ -f "$CONFIG/qylock/theme" ] && [ "$(cat "$CONFIG/qylock/theme")" = "netwatch" ]; then
    remove_home_file "$CONFIG/qylock/theme"
    rmdir "$CONFIG/qylock" 2>/dev/null || true
fi

remove_system_file_if_equal() {
    local path="$1" content="$2" expected
    expected="$(mktemp)"
    printf '%s' "$content" > "$expected"
    if sudo cmp -s -- "$path" "$expected" 2>/dev/null; then
        sudo rm -- "$path" && printf 'Removed %s\n' "$path"
    fi
    rm -f -- "$expected"
}

remove_system_file_if_equal /etc/sddm.conf.d/10-netwatch.conf $'[Theme]\nCurrent=netwatch\n'
remove_system_file_if_equal /etc/sddm.conf.d/20-greeter-x11.conf $'[General]\nDisplayServer=x11\n'
remove_system_file_if_equal /etc/pam.d/qs-lock $'auth      include   system-auth\naccount   include   system-auth\npassword  include   system-auth\nsession   include   system-auth\n'

if [ -f "$THEME/scripts/x11-env" ] && sudo cmp -s /etc/profile.d/cyberarch-x11-env.sh "$THEME/scripts/x11-env" 2>/dev/null; then
    sudo rm -- /etc/profile.d/cyberarch-x11-env.sh && printf 'Removed /etc/profile.d/cyberarch-x11-env.sh\n'
fi

hook_src="$THEME/assets/pacman/cyberpunk-pkg-notify.hook"
if [ -f "$hook_src" ]; then
    expected_hook="$(mktemp)"
    sed "s|__THEME__|$CANON|g" "$hook_src" > "$expected_hook"
    if sudo cmp -s /etc/pacman.d/hooks/cyberpunk-pkg-notify.hook "$expected_hook" 2>/dev/null; then
        sudo rm -- /etc/pacman.d/hooks/cyberpunk-pkg-notify.hook && printf 'Removed the CyberArch pacman hook.\n'
    fi
    rm -f -- "$expected_hook"
fi

if [ -d "$SDDM_THEME" ] && [ -d "$THEME/components/login/sddm-theme" ]; then
    if [ -d "$SDDM_THEME/current" ] && find "$SDDM_THEME/current" -mindepth 1 -print -quit | grep -q .; then
        printf 'Kept %s/current because it contains wallpaper files.\n' "$SDDM_THEME"
    elif sudo diff -qr "$THEME/components/login/sddm-theme" "$SDDM_THEME" >/dev/null 2>&1; then
        sudo rm -r -- "$SDDM_THEME" && printf 'Removed the unchanged Netwatch SDDM theme.\n'
    else
        printf 'Kept %s because it has files that differ from the bundled theme.\n' "$SDDM_THEME"
    fi
fi

fonts_src="$THEME/assets/fonts"
fonts_dst="/usr/local/share/fonts/cyberpunk"
if [ -d "$fonts_src" ] && [ -d "$fonts_dst" ]; then
    while IFS= read -r -d '' font; do
        installed="$fonts_dst/$(basename "$font")"
        if sudo cmp -s -- "$font" "$installed" 2>/dev/null; then sudo rm -- "$installed"; fi
    done < <(find "$fonts_src" -maxdepth 1 -type f \( -iname '*.ttf' -o -iname '*.otf' \) -print0)
    sudo rmdir "$fonts_dst" 2>/dev/null || true
    sudo fc-cache -f "$fonts_dst" >/dev/null 2>&1 || true
fi

source "$THEME/scripts/theme-state"
cyber_restore_path iconpack "$HOME/.local/share/icons/iconpack"
cyber_restore_path gtk-3.0-settings "$HOME/.config/gtk-3.0/settings.ini"
cyber_restore_path gtk-4.0-settings "$HOME/.config/gtk-4.0/settings.ini"
cyber_restore_path gtk-3.0-css "$THEME_CONFIG/gtk-3.0/gtk.css"
cyber_restore_path gtk-4.0-css "$THEME_CONFIG/gtk-4.0/gtk.css"
cyber_restore_path kitty "$HOME/.config/kitty/kitty.conf"
cyber_restore_path kvantum-old-daemon "$HOME/.config/Kvantum/daemon-2.0"
cyber_restore_path kvantum-daemon "$THEME_CONFIG/Kvantum/Daemon"
cyber_restore_path kvantum-config "$THEME_CONFIG/Kvantum/kvantum.kvconfig"
cyber_restore_setting gsettings-icon org.gnome.desktop.interface icon-theme
cyber_restore_setting gsettings-gtk org.gnome.desktop.interface gtk-theme
cyber_restore_setting gsettings-scheme org.gnome.desktop.interface color-scheme
cyber_restore_setting gsettings-cursor org.gnome.desktop.interface cursor-theme

dm_changed="$(sed -n 's/^display_manager_changed=//p' "$STATE_FILE" 2>/dev/null | head -n 1)"
dm_before="$(sed -n 's/^display_manager_before=//p' "$STATE_FILE" 2>/dev/null | head -n 1)"
keep_install_state=0
if [ "$dm_changed" = yes ]; then
    if [ "$dm_before" = none ]; then
        if sudo systemctl disable sddm.service; then
            printf 'Restored the original no-display-manager setup.\n'
        else
            printf 'Could not disable SDDM; it remains enabled.\n'
            keep_install_state=1
        fi
    elif [[ "$dm_before" =~ ^[a-zA-Z0-9_.@-]+$ ]] && systemctl cat "$dm_before.service" >/dev/null 2>&1; then
        if sudo systemctl enable --force "$dm_before.service"; then
            sudo systemctl disable sddm.service >/dev/null 2>&1 || true
            printf 'Restored %s as the display manager for the next login.\n' "$dm_before"
        else
            printf 'Could not restore %s; SDDM remains enabled.\n' "$dm_before"
            keep_install_state=1
        fi
    else
        printf 'Could not verify the saved display manager; SDDM remains enabled.\n'
        keep_install_state=1
    fi
fi

if [ "$keep_install_state" = 0 ]; then
    rm -f -- "$STATE_FILE"
    rmdir "$(dirname "$STATE_FILE")" 2>/dev/null || true
else
    printf 'Kept the saved display-manager choice at %s so you can retry it later.\n' "$STATE_FILE"
fi
printf '\nUninstall cleanup finished. Installed packages and personal files were left in place.\n'
printf 'Log out and start a Hyprland session to use the remaining desktop config.\n'

if [ "$wait_on_exit" = 1 ]; then
    printf '\nPress ENTER to close this window. '
    read -r _ </dev/tty || true
fi
