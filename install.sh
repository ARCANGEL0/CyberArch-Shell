#!/usr/bin/env bash
set -uo pipefail
THEME="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
R=$'\033[0m'; B=$'\033[1m'; DIM=$'\033[2m'
RED=$'\033[38;2;255;45;61m'; CYAN=$'\033[38;2;119;226;242m'
YEL=$'\033[38;2;255;214;31m'; GRN=$'\033[38;2;90;230;130m'; GREY=$'\033[38;2;120;120;130m'
line()  { printf "${RED}%s${R}\n" "────────────────────────────────────────────────────────────"; }
hdr()   { printf "\n${CYAN}${B}▓▒░ %s ░▒▓${R}\n" "$1"; }
step()  { printf "${CYAN}▸${R} %s\n" "$1"; }
ok()    { printf "  ${GRN}✓${R} %s\n" "$1"; }
warn()  { printf "  ${YEL}⚠${R} %s\n" "$1"; }
err()   { printf "  ${RED}✗${R} %s\n" "$1"; }
fatal() {
  printf "\n${RED}${B}"
  cat <<'EOF'
  ╔═══════════════════════════════════════════════════════════╗
  ║   ▓▒░  I N S T A L L   A B O R T E D  ░▒▓                 ║
  ╚═══════════════════════════════════════════════════════════╝
EOF
  printf "${R}\n  ${RED}${B}✗ %s${R}\n\n" "$1"; shift
  for l in "$@"; do printf "  ${CYAN}→${R} %s\n" "$l"; done
  printf "\n  ${YEL}Nothing further was changed. Fix the above, then re-run ./install.sh${R}\n"
  line
  exit 1
}
banner() {
  printf "${RED}${B}"
  cat <<'EOF'
   █▀▀ █▄█ █▄▄ █▀▀ █▀█ █▀█ █░█ █▄░█ █▄▀   ▀█ █▀█ ▀▀█ ▀▀█
   █▄▄ ░█░ █▄█ ██▄ █▀▄ █▀▀ █▄█ █░▀█ █░█   █▄ █▄█ ░░█ ░░█
EOF
  printf "${R}${CYAN}   ░▒▓ NIGHT CITY RICE · Installer ▓▒░${R}\nMade by: @arcxlo\n"
  line
}
SUDO_KEEP=""
sudo_cleanup() { [ -n "$SUDO_KEEP" ] && kill "$SUDO_KEEP" 2>/dev/null; return 0; }
sudo_prime() {
  if sudo -n true 2>/dev/null; then
    ok "root ticket already cached"
  else
    printf "\n${CYAN}${B}▓▒░ ROOT ACCESS ░▒▓${R}\n"
    printf "  ${DIM}This deck writes to /etc and /usr/share and flips systemd units.${R}\n"
    printf "  ${DIM}Drop your sudo password once — it stays cached for the whole run.${R}\n"
    local n
    for n in 1 2 3; do
      sudo -v </dev/tty && break
      warn "auth rejected |::| attempt $n of 3"
      if [ "$n" = 3 ]; then
        fatal "sudo authentication failed three times — no root, no install." \
          "Every step past this point writes outside your home dir." \
          "Check you are in the wheel group:  groups | grep wheel" \
          "Then re-run:  ./install.sh"
      fi
    done
    ok "root ticket acquired"
  fi
  ( while kill -0 "$$" 2>/dev/null; do sudo -n true 2>/dev/null || exit 0; sleep 45; done ) &
  SUDO_KEEP=$!
  trap 'sudo_cleanup' EXIT
}
pac_install() {
  local label="$1"; shift
  [ "$#" -eq 0 ] && return 0
  if sudo pacman -S --needed "$@"; then ok "$label installed"; return 0; fi
  warn "batch transaction flatlined |::| retrying $label one chip at a time"
  local failed=() p
  for p in "$@"; do
    sudo pacman -S --needed --noconfirm "$p" >/dev/null 2>&1 || failed+=("$p")
  done
  if [ "${#failed[@]}" -eq 0 ]; then ok "$label installed (one at a time)"; return 0; fi
  fatal "$label — pacman flatlined on ${#failed[@]} package(s)." \
    "Dead chips: ${failed[*]}" \
    "Run it raw so you can read what pacman actually screams:" \
    "  sudo pacman -Syu && sudo pacman -S --needed ${failed[*]}" \
    "'target not found' means the chip drifted to the AUR:  paru -S ${failed[*]}" \
    "Choking on a lib32-* chip? Uncomment [multilib] in /etc/pacman.conf, then pacman -Syu." \
    "One bad name kills the whole transaction, which is why the rest went dark too."
}
aur_install() {
  local label="$1"; shift
  local helper; helper="$(command -v paru || command -v yay || true)"
  if [ -z "$helper" ]; then
    fatal "$label needs an AUR helper and this deck has none." \
      "paru or yay has to build:  $*" \
      "Bootstrap it:  sudo pacman -S --needed base-devel git && git clone https://aur.archlinux.org/paru.git && cd paru && makepkg -si" \
      "Then re-run:  ./install.sh"
  fi
  if "$helper" -S --needed "$@"; then ok "$label installed"; return 0; fi
  local failed=() p
  for p in "$@"; do pacman -Qq "$p" >/dev/null 2>&1 || failed+=("$p"); done
  if [ "${#failed[@]}" -eq 0 ]; then ok "$label installed"; return 0; fi
  fatal "$label — the AUR build flatlined on: ${failed[*]}" \
    "Build it by hand so the compiler can tell you why:" \
    "  $(basename "$helper") -S ${failed[*]}" \
    "Most AUR flatlines are a half-synced system — run sudo pacman -Syu first, then reboot." \
    "Then re-run:  ./install.sh"
}
dm_current() {
  local l u
  l="$(readlink -f /etc/systemd/system/display-manager.service 2>/dev/null || true)"
  if [ -n "$l" ] && [ -e "$l" ]; then basename "$l" .service; return 0; fi
  for u in sddm gdm lightdm ly greetd lxdm cosmic-greeter plasma-login; do
    if systemctl is-enabled --quiet "$u.service" 2>/dev/null; then printf '%s' "$u"; return 0; fi
  done
  printf ''
}
MESA_PKGS="mesa mesa-utils libdrm lib32-libdrm lib32-mesa"
HYP_PKGS="hyprland hyprgraphics hyprland-guiutils hyprlock hyprtoolkit hyprwire xdg-desktop-portal-hyprland lua lua54 gcc gcc-libs hyprlang ffmpeg ffmpeg4.4 chromaprint"
REPO=(
  gjs grim wf-recorder wl-clipboard networkmanager bluez-utils curl
  wireplumber playerctl brightnessctl power-profiles-daemon upower
  hypridle socat jq rofi libnotify sassc kitty kvantum kvantum-qt5 wget fuse2 sqlite3 pacman-contrib awww
  base-devel pkgconf cmake cpio gcc lib32-libelf lib32-glibc glibc
  python python-pillow imagemagick $MESA_PKGS
  pipewire pipewire-audio pipewire-pulse libpulse mpv ffmpeg sox
  ttf-jetbrains-mono ttf-firacode-nerd ttf-nerd-fonts-symbols ttf-nerd-fonts-symbols-mono
  lib32-gnutls dnsmasq pipewire-alsa ffmpeg4.4 gst-plugin-pipewire lib32-nettle
  openconnect pipewire-jack pipewire-v4l2 pipewire-x11-bell pipewire-zeroconf
)
AUR=(
  aylurs-gtk-shell
  libastal-gjs-git libastal-notifd-git libastal-wireplumber-git libastal-mpris-git
  pamtester
)

clear; banner

command -v pacman >/dev/null || { err "pacman not found |::| this installer targets Arch Linux."; exit 1; }
command -v hyprctl >/dev/null || warn "Hyprland not detected on PATH |::| install/run Hyprland for the rice to work."

DRYRUN=0
if [ "${1:-}" = "--dry-run" ] || [ -n "${AUG_DRYRUN:-}" ]; then DRYRUN=1; fi
[ "$DRYRUN" = 1 ] || sudo_prime

hdr "SYSTEM UPGRADE"
printf "[!] Run a full system upgrade before installing theme? (y/N) "
read -r ans </dev/tty
if [ "$ans" = "y" ] || [ "$ans" = "Y" ]; then
  if sudo pacman -Syu; then
    ok "system upgraded"
  else
    fatal "the full system upgrade flatlined halfway." \
      "A half-synced deck is the #1 cause of qt6, quickshell and astal breaking later." \
      "Finish it by hand and read the error:" \
      "  sudo pacman -Syu" \
      "If pacman talks about keys:  sudo pacman -Sy archlinux-keyring && sudo pacman -Syu" \
      "If it talks about a file conflict, delete the file it names, then re-run the upgrade." \
      "Reboot after it lands, then re-run:  ./install.sh"
  fi
else
  ok "skipped |::| continuing to the installer."
fi

hdr "HYPRLAND CORE"
sudo pacman -Sy >/dev/null 2>&1 || true
CUR="$(pacman -Q hyprland 2>/dev/null | cut -d' ' -f2)"
AVAIL="$(pacman -Si hyprland 2>/dev/null | sed -n 's/^Version[[:space:]]*:[[:space:]]*//p')"
if [ -z "$CUR" ]; then
  step "install latest Hyprland + lua tooling"
  pac_install "Hyprland core" $HYP_PKGS
elif [ -z "$AVAIL" ] || [ "$AVAIL" != "$CUR" ]; then
  step "Hyprland is currently $CUR${AVAIL:+ — latest is $AVAIL}"
  printf "[!] Update Hyprland + lua tooling to the latest version? (y/N) "
  read -r ans </dev/tty
  if [ "$ans" = "y" ] || [ "$ans" = "Y" ]; then
    pac_install "Hyprland core" $HYP_PKGS
    VER="$(hyprctl version 2>/dev/null | head -1)"
    [ -n "$VER" ] && ok "Hyprland now |::| $VER"
  else
    warn "skipped |::| keeping Hyprland $CUR."
  fi
else
  ok "Hyprland $CUR already up to date."
fi

hdr "DEPENDENCY SCAN"
declare -a miss_repo=() miss_aur=()
pkg_has() { pacman -Qq "$1" &>/dev/null || pacman -Qg "$1" &>/dev/null; }
for p in "${REPO[@]}"; do
  if pkg_has "$p"; then printf "  ${GRN}✓${R} %s\n" "$p"
  else printf "  ${RED}✗${R} %-22s ${GREY}→ install${R}\n" "$p"; miss_repo+=("$p"); fi
done
for p in "${AUR[@]}"; do
  if pkg_has "$p"; then printf "  ${GRN}✓${R} %s\n" "$p"
  else printf "  ${RED}✗${R} %-22s ${GREY}→ install (AUR)${R}\n" "$p"; miss_aur+=("$p"); fi
done
mapfile -t miss_repo < <(printf '%s\n' "${miss_repo[@]}" | awk 'NF' | sort -u)
mapfile -t miss_aur  < <(printf '%s\n' "${miss_aur[@]}"  | awk 'NF' | sort -u)
if [ "${1:-}" = "--dry-run" ] || [ -n "${AUG_DRYRUN:-}" ]; then
  hdr "DRY RUN |::| no changes will be made"
  printf "  ${CYAN}repo:${R} %s\n  ${CYAN}aur :${R} %s\n" "${miss_repo[*]:-none}" "${miss_aur[*]:-none}"
  line; exit 0
fi

CANON="$HOME/.config/hypr/themes/cyberpunk"
if [ "$THEME" != "$CANON" ]; then
  hdr "THEME LOCATION"
  if [ -e "$CANON" ] && [ ! -L "$CANON" ]; then
    warn "$CANON already exists |::| the theme will run from THERE, not this clone."
  else
    mkdir -p "$(dirname "$CANON")"
    if ln -sfn "$THEME" "$CANON"; then ok "linked $CANON → $THEME"
    else err "could not link $CANON |::| move/clone this repo to $CANON manually."; fi
  fi
fi

if [ ${#miss_repo[@]} -gt 0 ] || [ ${#miss_aur[@]} -gt 0 ]; then
  hdr "MISSING PACKAGES"
  if [ ${#miss_repo[@]} -gt 0 ]; then
    printf "${CYAN}PACKAGES REQUIRED:${R} ${B}%s${R}\n" "${miss_repo[*]}"
    printf "[!] Install missing repo deps? (y/N) "
    read -r ans </dev/tty
    if [ "$ans" = "y" ] || [ "$ans" = "Y" ]; then
      pac_install "repo packages" lib32-libelf "${miss_repo[@]}"
    else warn "skipped repo deps — the rice may not work fully."
    fi
  fi
  if [ ${#miss_aur[@]} -gt 0 ]; then
    helper="$(command -v paru || command -v yay || true)"
    printf "\n${CYAN}AUR PACKAGES REQUIRED:${R} ${B}%s${R}\n" "${miss_aur[*]}"
    if [ -z "$helper" ]; then
      warn "no AUR helper (paru/yay) found. Install these manually."
    else
      printf "[!] Install missing AUR deps via %s? (y/N) " "$(basename "$helper")"
      read -r ans </dev/tty
      if [ "$ans" = "y" ] || [ "$ans" = "Y" ]; then
        aur_install "AUR packages" "${miss_aur[@]}"
      else
        warn "skipped AUR deps."
      fi
    fi
  fi
else
  hdr "DEPENDENCY SCAN"; ok "all dependencies already present."
fi

hdr "AGS RUNTIME"
mkdir -p "$HOME/.local/bin"
if [ ! -x "$HOME/.local/bin/ags" ] && command -v ags >/dev/null 2>&1; then
  ln -sfn "$(command -v ags)" "$HOME/.local/bin/ags"; ok "linked ~/.local/bin/ags → $(command -v ags)"
elif [ -x "$HOME/.local/bin/ags" ]; then ok "~/.local/bin/ags present"
else fatal "ags not found — the CyberArch HUD has no runtime to run on." \
  "AGS v2 (aylurs-gtk-shell) is the process that draws the entire shell." \
  "Install it:  paru -S aylurs-gtk-shell   (or yay -S aylurs-gtk-shell)" \
  "Then re-run this installer."
fi
NM="$THEME/node_modules"; mkdir -p "$NM"
link_first() { local name="$1"; shift; for c in "$@"; do [ -d "$c" ] && { ln -sfn "$c" "$NM/$name"; return 0; }; done; return 1; }
link_first ags   /usr/share/ags/js || fatal "ags js library not found at /usr/share/ags/js" \
  "core.ts imports this on every start; without it the shell cannot load." \
  "Your AGS install is incomplete or is AGS v1, not v2." \
  "Reinstall:  paru -S aylurs-gtk-shell"
link_first astal /usr/share/astal/gjs /usr/share/astal-io/gjs /usr/lib/astal/gjs || true
link_first gnim  /usr/share/ags/js/node_modules/gnim /usr/share/astal/gjs/node_modules/gnim || warn "gnim not found"
if [ -d "$NM/astal" ]; then
  ok "astal imports resolved ($NM/astal → $(readlink "$NM/astal"))"
else
  fatal "astal NOT resolved — the astal GJS library is missing." \
    "24 modules under components/ import astal directly; nothing will start." \
    "Looked in: /usr/share/astal/gjs, /usr/share/astal-io/gjs, /usr/lib/astal/gjs" \
    "Install:  paru -S libastal-gjs-git libastal-notifd-git libastal-wireplumber-git libastal-mpris-git"
fi

hdr "UI FONTS"
FONTSRC="$THEME/assets/fonts"
FONTDST="/usr/local/share/fonts/cyberpunk"
if [ -d "$FONTSRC" ]; then
  mapfile -t FONTFILES < <(find "$FONTSRC" -maxdepth 1 -type f \( -iname '*.ttf' -o -iname '*.otf' \) | sort)
else
  FONTFILES=()
fi
if [ "${#FONTFILES[@]}" -gt 0 ]; then
  sudo install -d -m 755 "$FONTDST"
  for f in "${FONTFILES[@]}"; do sudo install -m 644 "$f" "$FONTDST/"; done
  ok "installed ${#FONTFILES[@]} font files → $FONTDST"
  fc-cache -f "$FONTDST" >/dev/null 2>&1 && ok "font cache refreshed (systemwide cyberpunk fonts)" || warn "fc-cache not run (install fontconfig)"
else
  warn "bundled fonts missing at $FONTSRC |::| theme text will fall back to sans-serif."
fi

hdr "GREETER CHECK"
LOCK_STACK=1
DM_OLD=""
CUR_DM="$(dm_current)"
if [ -z "$CUR_DM" ]; then
  ok "no display manager enabled |::| sddm + theme lock are clear to land"
elif [ "$CUR_DM" = "sddm" ]; then
  ok "sddm is already your greeter |::| it just gets re-skinned"
else
  warn "$CUR_DM is currently driving your login screen"
  printf "  ${DIM}Taking the CyberArch lock stack means:${R}\n"
  printf "  ${CYAN}→${R} sddm becomes the greeter and %s gets switched off\n" "$CUR_DM"
  printf "  ${CYAN}→${R} quickshell + the netwatch shell take over hypridle's lock_cmd\n"
  printf "  ${CYAN}→${R} if any piece of it flatlines the installer aborts instead of leaving you locked out\n"
  printf "  ${YEL}Answer N to keep %s untouched — sddm setup and the lock binding get skipped whole.${R}\n" "$CUR_DM"
  printf "[!] Replace %s with SDDM + CyberArch Theme Lock? (y/N) " "$CUR_DM"
  read -r ans </dev/tty
  case "$ans" in
    [yY]*) DM_OLD="$CUR_DM"; ok "greeter swap authorized |::| $CUR_DM → sddm" ;;
    *) LOCK_STACK=0; warn "keeping $CUR_DM |::| no sddm config, no lock binding, no lockout risk" ;;
  esac
fi

hdr "LOGIN SCREEN"
LOGINSRC="$THEME/components/login"
LOGINDST="$CANON/components/login"
if [ "$THEME" != "$CANON" ]; then
  mkdir -p "$LOGINDST"
  cp -rf "$LOGINSRC"/* "$LOGINDST"/
  ok "login theme copied → $LOGINDST"
else
  LOGINDST="$LOGINSRC"
fi
if [ -f "$THEME/assets/img/lucy_lock.mp4" ]; then
  cp -f "$THEME/assets/img/lucy_lock.mp4" "$LOGINDST/themes/netwatch/bg.mp4"
fi
USER_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/cyberarch"
WALLPAPERS_PATH="$HOME/Pictures/Wallpapers"
mkdir -p "$USER_DIR" "$WALLPAPERS_PATH"
if [ -d "$HOME/.local/share/cyberdeck" ]; then
  for f in city.json markets.json user_colors.lua; do
    if [ -f "$HOME/.local/share/cyberdeck/$f" ] && [ ! -f "$USER_DIR/$f" ]; then
      cp -f "$HOME/.local/share/cyberdeck/$f" "$USER_DIR/$f"
      ok "migrated $f → $USER_DIR/$f"
    fi
  done
fi
if [ -f "$THEME/assets/img/lucy_wallpaper.png" ]; then
  mkdir -p "$CANON/assets/img"
  cp -f "$THEME/assets/img/lucy_wallpaper.png" "$CANON/assets/img/lucy_wallpaper.png"
  ok "wallpaper deployed → $CANON/assets/img/lucy_wallpaper.png"
  if [ ! -f "$WALLPAPERS_PATH/lucy.png" ]; then
    cp -f "$THEME/assets/img/lucy_wallpaper.png" "$WALLPAPERS_PATH/lucy.png"
    ok "wallpaper copied → $WALLPAPERS_PATH/lucy.png"
  else
    ok "wallpaper kept → $WALLPAPERS_PATH/lucy.png"
  fi
fi
if [ ! -f "$USER_DIR/wallpaper.lua" ]; then
  DEFAULT_WP="$WALLPAPERS_PATH/lucy.png"
  OLD_WP="$HOME/.local/share/cyberdeck/wallpaper"
  if [ -r "$OLD_WP" ]; then
    read -r prev_wp <"$OLD_WP" || prev_wp=""
    if [ -n "${prev_wp:-}" ] && [ -r "$prev_wp" ]; then
      DEFAULT_WP="$prev_wp"
    fi
  fi
  printf 'wallpaper = "%s"\nreturn wallpaper\n' "$DEFAULT_WP" > "$USER_DIR/wallpaper.lua"
  ok "wallpaper.lua created → $USER_DIR/wallpaper.lua"
else
  ok "wallpaper.lua kept → $USER_DIR/wallpaper.lua"
fi
chmod +x "$LOGINDST/lock.sh" 2>/dev/null
IDLECONF="$HOME/.config/hypr/hypridle.conf"
if [ "$LOCK_STACK" != 1 ]; then
  warn "hypridle lock_cmd left alone |::| $CUR_DM keeps owning the lock"
else
  mkdir -p "$HOME/.config/qylock"
  echo "netwatch" > "$HOME/.config/qylock/theme"
  if [ -f "$IDLECONF" ]; then
    if grep -q "lock_cmd" "$IDLECONF"; then
      sed -i "s#^\( *\)lock_cmd = .*#\1lock_cmd = $LOGINDST/lock.sh#" "$IDLECONF"
    else
      sed -i "/^general {/a\\  lock_cmd = $LOGINDST/lock.sh" "$IDLECONF"
    fi
    ok "hypridle lock_cmd → $LOGINDST/lock.sh"
  else
    mkdir -p "$(dirname "$IDLECONF")"
    printf 'general {\n  lock_cmd = %s/lock.sh\n  before_sleep_cmd = loginctl lock-session\n}\n' "$LOGINDST" > "$IDLECONF"
    ok "created $IDLECONF with lock_cmd → $LOGINDST/lock.sh"
  fi
fi

hdr "SDDM · display manager"
if [ "$LOCK_STACK" != 1 ]; then
  warn "sddm setup skipped by your call |::| $CUR_DM stays your greeter"
elif ! command -v sddm >/dev/null 2>&1 && ! pgrep -x sddm >/dev/null 2>&1; then
  step "installing sddm…"
  pac_install "sddm" sddm
fi

if [ "$LOCK_STACK" = 1 ] && command -v sddm >/dev/null 2>&1; then
  ok "sddm installed"
  SDDM_CONF="/etc/sddm.conf"
  step "configuring sddm → netwatch theme…"
  if [ ! -f "$SDDM_CONF" ]; then
    if sudo tee "$SDDM_CONF" >/dev/null <<'SDDMCNF'
[Theme]
Current=netwatch
SDDMCNF
    then ok "sddm configured → $SDDM_CONF"; else warn "could not write $SDDM_CONF"; fi
  elif sudo grep -qE '^\[Theme\][[:space:]]*$' "$SDDM_CONF"; then
    if sudo sed -i '/^\[Theme\][[:space:]]*$/,/^\[/ s/^Current[[:space:]]*=.*/Current=netwatch/' "$SDDM_CONF"; then
      if sudo awk '
        /^\[Theme\][[:space:]]*$/ { in_theme=1; next }
        /^\[/ { in_theme=0 }
        in_theme && /^Current[[:space:]]*=/ { found=1 }
        END { exit found ? 0 : 1 }
      ' "$SDDM_CONF"; then
        ok "sddm theme set → netwatch"
      elif sudo sed -i '/^\[Theme\][[:space:]]*$/a Current=netwatch' "$SDDM_CONF"; then
        ok "sddm theme set → netwatch"
      else
        warn "could not set Current=netwatch in $SDDM_CONF"
      fi
    else
      warn "could not update $SDDM_CONF"
    fi
  elif printf '\n[Theme]\nCurrent=netwatch\n' | sudo tee -a "$SDDM_CONF" >/dev/null; then
    ok "sddm theme section appended → netwatch"
  else
    warn "could not append a [Theme] section to $SDDM_CONF"
  fi
  SDDM_THEME_DIR="/usr/share/sddm/themes/netwatch"
  if sudo install -d -m 755 "$SDDM_THEME_DIR" && sudo cp -rf "$LOGINSRC/sddm-theme"/. "$SDDM_THEME_DIR"/; then
    ok "sddm theme deployed → $SDDM_THEME_DIR"
  else
    fatal "the netwatch sddm theme could not be deployed." \
      "sddm.conf now points Current=netwatch at a theme dir that is not there." \
      "Booting that combo gives you a black greeter, so this stops here." \
      "Deploy it by hand:" \
      "  sudo install -d -m 755 $SDDM_THEME_DIR" \
      "  sudo cp -rf '$LOGINSRC/sddm-theme'/. $SDDM_THEME_DIR/" \
      "Your greeter was NOT switched yet, so nothing about your login changed."
  fi
  DMLINK="$(readlink -f /etc/systemd/system/display-manager.service 2>/dev/null || true)"
  case "$DMLINK" in
    */sddm.service) ok "sddm is already the default display manager" ;;
    *)
      if [ -n "$DM_OLD" ]; then
        step "switching off $DM_OLD…"
        DM_ERR="$(sudo systemctl disable "$DM_OLD.service" 2>&1)" \
          && ok "$DM_OLD disabled" \
          || warn "could not disable $DM_OLD |::| ${DM_ERR:-no output} |::| enable --force below overrides the alias anyway"
      fi
      step "enabling sddm as default display manager…"
      SDDM_ERR="$(sudo systemctl enable --force sddm 2>&1)"
      DMLINK="$(readlink -f /etc/systemd/system/display-manager.service 2>/dev/null || true)"
      case "$DMLINK" in
        */sddm.service) ok "sddm enabled on boot |::| display-manager.service → sddm" ;;
        *)
          fatal "sddm could not be made the default display manager." \
            "systemd said: ${SDDM_ERR:-nothing at all}" \
            "sddm.service carries Alias=display-manager.service, so plain 'enable' bails out when another greeter already owns that name." \
            "Do it raw:" \
            "  sudo systemctl disable ${DM_OLD:-<your-current-greeter>}.service" \
            "  sudo systemctl enable --force sddm" \
            "Then verify:  systemctl status display-manager.service" \
            "Your existing greeter is still enabled, so you are not locked out."
          ;;
      esac
      ;;
  esac
else
  warn "sddm step skipped |::| no greeter or theme lock changes were made"
fi

step "installing news cache cron for sddm ticker…"
CACHE_SCRIPT="$LOGINSRC/sddm-theme/cache-news.sh"
if [ -f "$CACHE_SCRIPT" ]; then
  chmod +x "$CACHE_SCRIPT"
  CRON_LINE="*/10 * * * * $CACHE_SCRIPT"
  (crontab -l 2>/dev/null | grep -v "cache-news.sh"; echo "$CRON_LINE") | crontab - 2>/dev/null
  ok "news cache cron installed (every 10 min)"
else
  warn "cache-news.sh missing |::| skipping cron install"
fi

hdr "PACMAN HOOK"
HOOKSRC="$THEME/assets/pacman/cyberpunk-pkg-notify.hook"
HOOKDST="/etc/pacman.d/hooks/cyberpunk-pkg-notify.hook"
if [ -f "$HOOKSRC" ]; then
  printf "${CYAN}▸ Installing pacman hook :: sudo password required${R}\n"
  printf "${DIM}  This will toggle the Streetcred reputation animation when installing packages or AUR updates available${R}\n"
  if sed "s|__THEME__|$CANON|g" "$HOOKSRC" | sudo tee "$HOOKDST" >/dev/null; then
    ok "install-notification hook → $HOOKDST"
  else
    warn "hook not installed (needs root) |::| run: sed \"s|__THEME__|$CANON|g\" \"$HOOKSRC\" | sudo tee \"$HOOKDST\""
  fi
else
  warn "hook template missing at $HOOKSRC"
fi

hdr "QUICKSHELL · login"
QS_LOGIN_OK=1
qs_ok() { command -v qs >/dev/null 2>&1 && qs --version >/dev/null 2>&1; }
lock_proto_state() {
  if [ -n "${WAYLAND_DISPLAY:-}" ] && command -v wayland-info >/dev/null 2>&1; then
    if wayland-info 2>/dev/null | grep -q "ext_session_lock_manager_v1"; then printf 'yes'; return 0; fi
    if wayland-info >/dev/null 2>&1; then printf 'no'; return 0; fi
  fi
  if command -v hyprctl >/dev/null 2>&1; then
    local hv maj min
    hv="$(hyprctl version 2>/dev/null | head -1 | grep -oE '[0-9]+\.[0-9]+' | head -1 || true)"
    if [ -n "$hv" ]; then
      maj="$((10#${hv%%.*}))"; min="$((10#${hv#*.}))"
      if [ "$maj" -gt 0 ] || [ "$min" -ge 35 ]; then printf 'yes'; else printf 'no'; fi
      return 0
    fi
  fi
  printf 'unknown'
}
if [ "$LOCK_STACK" != 1 ]; then
  QS_LOGIN_OK=0
  warn "theme lock skipped |::| no quickshell, no PAM rewrite, $CUR_DM untouched"
else
  QT6="glibc lib32-glibc qt6-multimedia-ffmpeg qt6-base qt6-declarative qt6-svg qt6-wayland qt6-5compat"
  pac_install "qt6 runtime" $QT6
  if ! qs_ok; then
    step "installing quickshell"
    sudo pacman -S --needed quickshell || warn "repo quickshell flatlined |::| dropping to the AUR build"
  fi
  if ! qs_ok; then
    helper="$(command -v paru || command -v yay || true)"
    if [ -n "$helper" ]; then
      step "trying quickshell-git (may fail if qt6 is misaligned)"
      "$helper" -S --needed quickshell-git || warn "quickshell-git build failed."
    else
      warn "no AUR helper (paru/yay) |::| cannot build quickshell-git"
    fi
  fi
  if qs_ok; then
    ok "quickshell ready ($(qs --version 2>/dev/null | head -1 | cut -d' ' -f1-2))"
  else
    fatal "quickshell could NOT be installed — the lock screen has no runtime." \
      "Every path was tried: repo quickshell, then quickshell-git from the AUR." \
      "That combo only fails on a half-synced deck where qt6 versions disagree." \
      "Sync the whole system first:  sudo pacman -Syu   then reboot" \
      "Then build it:  paru -S quickshell-git" \
      "Your greeter and lock config were left alone, so nothing is broken yet." \
      "Re-run ./install.sh when qs --version answers."
  fi

  PAMFILE="/etc/pam.d/qs-lock"
  if [ -f "$PAMFILE" ]; then
    ok "PAM service present ($PAMFILE)"
  else
    step "creating $PAMFILE (auth → system-auth)…"
    if sudo tee "$PAMFILE" >/dev/null <<'PAMEOF'
auth      include   system-auth
account   include   system-auth
password  include   system-auth
session   include   system-auth
PAMEOF
    then ok "lockscreen auth wired (qs-lock → system-auth)"
    else
      fatal "could not write $PAMFILE — the lock screen would reject your own password." \
        "No PAM stack means every unlock attempt fails and you get stuck on the lock surface." \
        "Write it yourself:" \
        "  printf 'auth      include   system-auth\\naccount   include   system-auth\\npassword  include   system-auth\\nsession   include   system-auth\\n' | sudo tee $PAMFILE" \
        "Then re-run:  ./install.sh"
    fi
  fi

  case "$(lock_proto_state)" in
    yes) ok "compositor exposes ext-session-lock-v1" ;;
    no)
      if [ -f "$IDLECONF" ] && grep -q "lock.sh" "$IDLECONF"; then
        sed -i "\#lock_cmd = $LOGINDST/lock.sh#d" "$IDLECONF"
        warn "pulled the theme lock_cmd back out of $IDLECONF so idle cannot black your screen"
      fi
      fatal "your compositor does not expose ext-session-lock-v1 — the lock would come up black." \
        "quickshell grabs that protocol to paint the lock surface. Without it you get a dead screen you cannot type into." \
        "On Hyprland:  sudo pacman -S hyprland   (0.35+ carries it), then log out and back in." \
        "On any other compositor: keep its own locker and answer N at the greeter prompt next run." \
        "The theme lock_cmd was already removed above, so your idle behaviour is back to stock."
      ;;
    *) warn "could not ask the compositor about ext-session-lock-v1 |::| check inside Hyprland with: wayland-info | grep ext_session_lock" ;;
  esac

  if qs_ok; then
    # fixed issue of hyprlock crashes cus qs lock grabs a WlSessionLocks which crashes hyprland
    if [ -z "${WAYLAND_DISPLAY:-}" ] && [ -z "${DISPLAY:-}" ]; then
      step "smoke testing quickshell login…"
      QS_LOG=$(mktemp)
      QS_LOGIN_DIR="$LOGINDST"
      timeout 4 env QS_TESTING=1 QS_THEME="netwatch" QS_THEME_PATH="$QS_LOGIN_DIR/themes/netwatch" QT_MEDIA_BACKEND=ffmpeg qs -p "$QS_LOGIN_DIR/lock_shell.qml" >"$QS_LOG" 2>&1 &
      QS_PID=$!
      sleep 3
      kill "$QS_PID" 2>/dev/null; wait "$QS_PID" 2>/dev/null
      QS_ERRORS=$(grep -iE "error|cannot|missing|not found|module.*not" "$QS_LOG" 2>/dev/null || true)
      rm -f "$QS_LOG"
      if [ -n "$QS_ERRORS" ]; then
        mapfile -t QS_ERRLINES < <(printf "%s\n" "$QS_ERRORS" | head -5)
        fatal "quickshell login shell failed its smoke test — the lock screen would crash." \
          "Shell: $QS_LOGIN_DIR/lock_shell.qml   theme: netwatch" \
          "${QS_ERRLINES[@]}" \
          "A lock screen that errors out can wedge the session, so this is a hard stop."
      else
        ok "quickshell login verified"
      fi
    else
      ok "quickshell present |::| skipping live QML smoke test (inside a running compositor)"
    fi
  fi
fi

if [ "$LOCK_STACK" != 1 ]; then
  warn "login screen untouched |::| $CUR_DM and its own locker stay in charge"
elif [ "$QS_LOGIN_OK" -eq 0 ]; then
  err "login screen may not work |::| check the errors above"
else
  ok "login screen ready"
fi

hdr "COOL-RETRO-TERM · netrunner profile"
CRT_BIN="$HOME/.local/bin/cool-retro-term"
CRT_URL="https://github.com/Swordfish90/cool-retro-term/releases/download/2.0.0-beta2/cool-retro-term-2.0.0-beta2.AppImage"
if [ -x "$CRT_BIN" ]; then
  ok "cool-retro-term AppImage already present ($CRT_BIN)"
elif command -v wget >/dev/null 2>&1; then
  mkdir -p "$HOME/.local/bin"
  step "downloading cool-retro-term AppImage…"
  if wget -q --show-progress -O "$CRT_BIN" "$CRT_URL"; then chmod +x "$CRT_BIN"; ok "installed cool-retro-term → $CRT_BIN"
  else rm -f "$CRT_BIN"; warn "download failed |::| grab it manually: $CRT_URL"; fi
else
  warn "wget not found |::| install wget or download manually to $CRT_BIN: $CRT_URL"
fi
CRT_DESKTOP="$HOME/.local/share/applications/cool-retro-term.desktop"
mkdir -p "$(dirname "$CRT_DESKTOP")"
cat > "$CRT_DESKTOP" <<EOF
[Desktop Entry]
Type=Application
Name=cool-retro-term
Exec=$CRT_BIN
Icon=utilities-terminal
Categories=System;TerminalEmulator;
Terminal=false
EOF
ok "desktop entry → $CRT_DESKTOP"
CRTJSON="$THEME/assets/cool-retro-term/netrunner.json"
if command -v jq >/dev/null 2>&1 && [ -f "$CRTJSON" ]; then
  CRTDIR="$HOME/.config/cool-retro-term"; CRTCONF="$CRTDIR/cool-retro-term.conf"
  pgrep -x cool-retro-term >/dev/null && warn "cool-retro-term is running |::| close it so settings stick."
  mkdir -p "$CRTDIR"
  [ -f "$CRTCONF" ] && cp -f "$CRTCONF" "$CRTCONF.bak.$(date +%s)" && ok "backed up existing conf"
  { echo "[General]"
    jq -r 'to_entries[] | select(.key!="name" and .key!="version") | "\(.key)=\(.value)"' "$CRTJSON"
  } > "$CRTCONF"
  ok "netrunner set as the default cool-retro-term appearance"
else
  warn "skipped (need cool-retro-term + jq + netrunner.json). Import it via the app's Load button if needed."
fi

hdr "COOL-RETRO-TERM · netrunner profile install"
if [ -x "$CRT_BIN" ] && [ -f "$THEME/scripts/netrunner-terminal" ]; then
  if [ ! -d "$HOME/.local/share/cool-retro-term" ]; then
    step "first-run cool-retro-term to generate its profile database"
    "$CRT_BIN" >/dev/null 2>&1 & CRTPID=$!
    sleep 6
    kill "$CRTPID" 2>/dev/null; pkill -x cool-retro-term 2>/dev/null
  fi
  bash "$THEME/scripts/netrunner-terminal" && ok "netrunner profile installed" || warn "netrunner-terminal failed |::| run cool-retro-term once, then: scripts/netrunner-terminal"
fi

hdr "DEFAULT SHELL · fish"
printf "[!] Set default shell to fish with custom themes? (y/N) "
read -r ans </dev/tty
if [ "$ans" = "y" ] || [ "$ans" = "Y" ]; then
  if ! sudo pacman -S --needed --noconfirm fish git; then
    echo "ERROR: Package installation failed."
    exit 1
  fi
  CFG="$HOME/.config/fish/config.fish"
  mkdir -p "$(dirname "$CFG")"
  touch "$CFG"
  if command -v fish >/dev/null 2>&1; then
    rm -rf "$HOME/.local/share/omf" 2>/dev/null
    if ! fish -c "type -q omf" 2>/dev/null; then
      echo "Cloning Oh My Fish installer..."
      rm -rf /tmp/omf_installer
      git clone https://github.com/oh-my-fish/oh-my-fish /tmp/omf_installer
      echo "Running Oh My Fish installation..."
      fish /tmp/omf_installer/bin/install --noninteractive
      rm -rf /tmp/omf_installer
    fi
    echo "Installing dangerous theme..."
    fish -c "omf install dangerous" || true
    fish -c "set -U fish_key_bindings fish_vi_key_bindings" 2>/dev/null || true
    fish -c "set -U dangerous_nogreeting" 2>/dev/null || true
  fi
  grep -q 'set -U fish_key_bindings fish_vi_key_bindings' "$CFG" 2>/dev/null || sed -i '1i set -U fish_key_bindings fish_vi_key_bindings' "$CFG" || true
  grep -q dangerous_nogreeting "$CFG" 2>/dev/null || sed -i '2i set -U dangerous_nogreeting' "$CFG" || true
  sed -i 's|^[[:space:]]*starship init.*|#&|' "$CFG" 2>/dev/null || true
  if ! grep -q samurai.png "$CFG" 2>/dev/null; then
    printf '\nif status is-interactive\n    if type -q kitten\n        kitten icat --align left $HOME/.config/hypr/themes/cyberpunk/assets/cool-retro-term/samurai.png\n    end\nend\n' >> "$CFG"
  fi
  FISH_PATH="/usr/bin/fish"
  if ! grep -q "$FISH_PATH" /etc/shells 2>/dev/null; then
    echo "Adding $FISH_PATH to /etc/shells..."
    echo "$FISH_PATH" | sudo tee -a /etc/shells
  fi
  echo "Changing default shell to fish..."
  TARGET_USER=$(logname 2>/dev/null || echo "$USER")
  if sudo chsh -s "$FISH_PATH" "$TARGET_USER"; then
    echo "Shell changed to fish for $TARGET_USER"
    export SHELL="$FISH_PATH"
    if ! grep -q 'export SHELL=/usr/bin/fish' "$HOME/.profile" 2>/dev/null; then
      echo 'export SHELL=/usr/bin/fish' >> "$HOME/.profile"
    fi
    if ! grep -q '^SHELL=/usr/bin/fish$' /etc/environment 2>/dev/null; then
      echo 'SHELL=/usr/bin/fish' | sudo tee -a /etc/environment >/dev/null
    fi
    systemctl --user set-environment SHELL=/usr/bin/fish 2>/dev/null || true
    FISH_EXEC='if command -v fish >/dev/null 2>&1 && [ "$(ps -p $$ -o comm= 2>/dev/null)" != "fish" ]; then exec fish; fi'
    for rc in "$HOME/.bashrc" "$HOME/.zshrc"; do
      if [ -f "$rc" ] && ! grep -q "exec fish" "$rc" 2>/dev/null; then
        echo "$FISH_EXEC" >> "$rc"
      fi
    done
    echo "New terminal windows will now use fish as the default shell."
  else
    echo "ERROR: chsh failed."
  fi
fi

HYDIR="$HOME/.config/hypr"
HYLUA="$HYDIR/hyprland.lua"
mkdir -p "$HYDIR"

hdr "DESKTOP SHELL · takeover check"
detect_shell() {
  command -v caelestia >/dev/null 2>&1 && { echo "caelestia"; return 0; }
  [ -d "$HOME/.config/caelestia" ] && { echo "caelestia"; return 0; }
  command -v noctalia >/dev/null 2>&1 && { echo "noctalia"; return 0; }
  [ -d "$HOME/.config/noctalia" ] && { echo "noctalia"; return 0; }
  if [ -f "$HYLUA" ]; then
    grep -qi "require([\"']caelestia" "$HYLUA" && { echo "caelestia"; return 0; }
    grep -qi "require([\"']noctalia"  "$HYLUA" && { echo "noctalia"; return 0; }
  fi
  return 1
}
theme_lua_ok() {
  local lb
  lb="$(command -v lua5.4 || command -v lua || true)"
  [ -n "$lb" ] || return 0
  "$lb" - >/dev/null 2>&1 <<'LUACHK'
local node
node = function()
  return setmetatable({}, { __index = function() return node() end, __call = function() return {} end })
end
hl = setmetatable({ dsp = node(), plugin = node() }, { __index = function() return function() end end })
local mod = os.getenv("HOME") .. "/.config/hypr/themes/cyberpunk"
local target = mod .. "/theme.lua"
local fh = io.open(target, "r")
if not fh then os.exit(1) end
fh:close()
package.path = mod .. "/?.lua;" .. package.path
local ok = pcall(dofile, target)
os.exit(ok and 0 or 1)
LUACHK
}
dm_active() {
  systemctl is-active --quiet display-manager 2>/dev/null && return 0
  pgrep -x sddm >/dev/null 2>&1 || pgrep -x gdm >/dev/null 2>&1 || pgrep -x greetd >/dev/null 2>&1 \
    || pgrep -x ly >/dev/null 2>&1 || pgrep -x lightdm >/dev/null 2>&1
}
SHELL_NAME="$(detect_shell || true)"
if [ -n "$SHELL_NAME" ]; then
  printf "${YEL}${B}[!] %s has been detected as your current desktop shell.${R}\n" "$SHELL_NAME"
  printf "${YEL}${B}    This theme will override hyprland.lua configurations and replace %s.${R}\n" "$SHELL_NAME"
  printf "[!] Do you wish to continue? (y/N) "
  read -r ans </dev/tty
  if [ "$ans" = "y" ] || [ "$ans" = "Y" ]; then
    HYBAK=""
    if [ -f "$HYLUA" ]; then
      HYBAK="$HYLUA.bak.$(date +%s)"
      cp -f "$HYLUA" "$HYBAK" && ok "backed up $HYLUA → $HYBAK"
    fi
    if ! theme_lua_ok; then
      err "theme.lua does not load on this machine |::| refusing to replace $HYLUA."
      warn "that would leave Hyprland with no working config (black screen on next login)."
      exit 1
    fi
    printf 'package.path = os.getenv("HOME") .. "/.config/hypr/themes/cyberpunk/?.lua;" .. (package.path or "")\nrequire("theme")\n' > "$HYLUA"
    ok "hyprland.lua now loads the cyberpunk theme in place of $SHELL_NAME"
    [ -n "$HYBAK" ] && warn "your previous config is at $HYBAK |::| monitors/input settings live there, port what you need."
  else
    warn "aborted |::| no files were changed. Nothing was replaced."
    exit 0
  fi
else
  ok "no other desktop shell detected."
fi

hdr "HYPRLAND · load the theme"
if [ ! -f "$HYLUA" ] && [ -f "$HYDIR/hyprland.conf" ]; then
  warn "hyprland.conf exists but hyprland.lua takes precedence — once the .lua exists, the .conf is ignored."
  warn "Migrate your old .conf settings into the .lua (or keep them; the theme ships in the .lua)."
fi
WRAPLUA='package.path = os.getenv("HOME") .. "/.config/hypr/themes/cyberpunk/?.lua;" .. os.getenv("HOME") .. "/.config/hypr/?.lua;" .. (package.path or "")
require("theme")
require("user")
'
if [ -f "$HYLUA" ] && grep -q 'themes/cyberpunk/theme.lua' "$HYLUA"; then
  ok "theme already loads from $HYLUA"
else
  [ -f "$HYLUA" ] && cp -f "$HYLUA" "$HYLUA.bak.$(date +%s)" && ok "backed up existing hyprland.lua"
  printf "[!] Load the cyberpunk theme in %s? (y/N) " "$HYLUA"
  read -r ans </dev/tty
  if [ "$ans" = "y" ] || [ "$ans" = "Y" ]; then
    if [ -f "$HYLUA" ]; then
      TMP="$(mktemp)"
      { cat "$HYLUA"; printf '\n%s' "$WRAPLUA"; } > "$TMP" && mv "$TMP" "$HYLUA"
      ok "appended the theme require at the end of $HYLUA (theme wins any config conflicts)"
    else
      printf '%s' "$WRAPLUA" > "$HYLUA"
      ok "created $HYLUA"
    fi
  else
    warn "add these lines to $HYLUA yourself:"
    printf "    ${B}package.path = os.getenv(\"HOME\") .. \"/.config/hypr/themes/cyberpunk/?.lua;\" .. (package.path or \"\")${R}\n"
    printf "    ${B}require(\"theme\")${R}\n"
    printf "    ${B}require(\"user\")${R}\n"
  fi
fi

hdr "HYPRLAND · user.lua template"
USERLUA="$HYDIR/user.lua"
if [ -f "$USERLUA" ]; then
  ok "user.lua already present at $USERLUA"
else
  printf "[!] Create %s from the cyberpunk template? (y/N) " "$USERLUA"
  read -r ans </dev/tty
  if [ "$ans" = "y" ] || [ "$ans" = "Y" ]; then
    cat > "$USERLUA" <<'USEREOF'
if _G.__cyberpunk_user_loaded then return end
if not _G.__cyberpunk_user_scan then _G.__cyberpunk_user_loaded = true end

local cyberpunk = os.getenv("HOME") .. "/.config/hypr/themes/cyberpunk"
local augSock   = os.getenv("XDG_RUNTIME_DIR") .. "/astal/cyberpunk.sock"

local once = function(cmd)
    hl.on("hyprland.start", function() hl.exec_cmd(cmd) end)
end

local function sock(msg)
    return hl.dsp.exec_cmd('echo "' .. msg .. '" | socat - UNIX-CONNECT:' .. augSock)
end

local function app(path)
    return hl.dsp.exec_cmd(cyberpunk .. "/" .. path)
end

local function rawbind(combo, run, opts)
    if opts then hl.bind(combo, run, opts) else hl.bind(combo, run) end
end

CD = CD or {}
CD.sock = sock
CD.app  = app

once("pgrep hypridle >/dev/null 2>&1 || hypridle")
once("copyq --start-server")
once("/usr/lib/polkit-gnome/polkit-gnome-authentication-agent-1")
once("nm-applet --indicator")
once("blueman-applet")
once(cyberpunk .. "/scripts/overkill prewarm")

hl.define_submap("kill", function()
    hl.bind("mouse:272", app("scripts/overkill kill"))
    hl.bind("escape",    app("scripts/overkill exit"))
end)

if type(hl.gesture) == "function" then
    hl.gesture({ fingers = 3, direction = "left", action = function()
        hl.exec_cmd(cyberpunk .. "/scripts/ws -1")
    end })
    hl.gesture({ fingers = 3, direction = "right", action = function()
        hl.exec_cmd(cyberpunk .. "/scripts/ws +1")
    end })
    hl.gesture({ fingers = 3, direction = "up", action = function()
        hl.exec_cmd(os.getenv("HOME") .. "/.config/hypr/scripts/zoom-step in")
    end })
    hl.gesture({ fingers = 3, direction = "down", action = function()
        hl.exec_cmd(os.getenv("HOME") .. "/.config/hypr/scripts/zoom-step out")
    end })
end

USEREOF
    ok "created user.lua template at $USERLUA"
    warn "edit $USERLUA to add your own hl.bind, CD.rebind, or CD.add calls."
  else
    warn "user.lua not created |::| theme's keybinds.lua will skip CD.rebind/CD.add until it exists."
  fi
fi

hdr "HYPRLAND · legacy hyprland.conf cleanup"
if [ -f "$HYDIR/hyprland.conf" ]; then
  warn "hyprland.conf personal keybinds are superseded once the Lua config loads — port any binds into hyprland.lua or the theme."
  OLDCNT="$(grep -Ec '^[[:space:]]*source[[:space:]]*=.*theme\.conf' "$HYDIR/hyprland.conf" 2>/dev/null)"
  [ -n "$OLDCNT" ] || OLDCNT=0
  if [ "$OLDCNT" -gt 0 ]; then
    cp -f "$HYDIR/hyprland.conf" "$HYDIR/hyprland.conf.bak.$(date +%s)" 2>/dev/null && ok "backed up hyprland.conf" || warn "couldn't back up hyprland.conf (continuing)"
    if sed -i -E 's/^(\s*source\s*=.*theme\.conf)/#\1/' "$HYDIR/hyprland.conf"; then
      ok "commented $OLDCNT stale source line(s) pointing at the deleted theme.conf (fixes the 'source globbing error' until restart)"
    else
      warn "couldn't patch hyprland.conf |::| comment the old 'source = .../theme.conf' line manually."
    fi
  fi
fi

hdr "KEYBIND CONFLICTS"
LUA_BIN="$(command -v lua5.4 || command -v lua || true)"
THEME_KEYS=""
if [ -n "$LUA_BIN" ] && [ -f "$THEME/theme.lua" ]; then
  THEME_KEYS="$("$LUA_BIN" - 2>/dev/null <<'LUAE'
local combos = {}
local node
node = function()
  return setmetatable({}, {
    __index = function() return node() end,
    __call  = function() return {} end,
  })
end
hl = {
  dsp = node(),
  exec_cmd = function() end, exec = function() end, exec_once = function() end,
  on = function() end, env = function() end, config = function() end,
  curve = function() end, animation = function() end,
  window_rule = function() end, layer_rule = function() end, plugin = node(),
  gesture = function() end, workspace_rule = function() end, submap = function() end,
  bind = function(mods)
    local d = ""
    local info = debug.getinfo(2, "Sl")
    if info and info.short_src and info.currentline then
      local fh = io.open(info.short_src, "r")
      if fh then
        local i = 0
        for line in fh:lines() do
          i = i + 1
          if i == info.currentline then d = line break end
        end
        fh:close()
      end
    end
    combos[#combos + 1] = tostring(mods) .. "\t" .. d
  end,
  define_submap = function(_, fn) if type(fn) == "function" then fn() end end,
}
local mod = os.getenv("HOME") .. "/.config/hypr/themes/cyberpunk"
package.path = mod .. "/?.lua;" .. package.path
local ok, err = pcall(require, "theme")
if not ok then print("__ERROR__ " .. tostring(err)) end
for i = 1, #combos do print(combos[i]) end
LUAE
)"
fi
mapfile -t THEME_RAW <<< "$THEME_KEYS"
canon() {
  local combo="$1" t key="" n
  combo="$(printf '%s' "$combo" | tr '[:lower:]' '[:upper:]')"
  local -a parts=()
  read -ra parts <<< "${combo//+ / }"
  n="${#parts[@]}"; [ "$n" -eq 0 ] && return 0
  key="${parts[n-1]}"
  unset 'parts[n-1]'
  if [ "${#parts[@]}" -gt 0 ]; then
    t="$(printf '%s\n' "${parts[@]}" | sort | tr '\n' ' ')"
    printf '%s%s' "${t// /+}" "$key"
  else
    printf '%s' "$key"
  fi
}
kb_pretty() {
  case "$1" in
    vol)            printf 'volume' ;;
    brt)            printf 'brightness' ;;
    pwr)            printf 'power menu' ;;
    bt)             printf 'bluetooth' ;;
    bat)            printf 'battery' ;;
    sys)            printf 'system monitor' ;;
    keys)           printf 'keybind help' ;;
    aur)            printf 'system upgrade' ;;
    wifi)           printf 'wifi' ;;
    mic)            printf 'microphone' ;;
    toggle-hud)     printf 'toggle HUD' ;;
    player)         printf 'music player' ;;
    forecast)       printf 'weather forecast' ;;
    clock)          printf 'system time' ;;
    weather)        printf 'city picker' ;;
    aur-dismiss)    printf 'dismiss update bar' ;;
    notif-hud)      printf 'notification center' ;;
    notif-read)     printf 'open notification' ;;
    notif-dismiss)  printf 'dismiss notification' ;;
    overkill)       printf 'kill mode' ;;
    screenrecord)   printf 'screen record' ;;
    screenshot)     printf 'screenshot' ;;
    launcher)       printf 'app launcher' ;;
    terminal)       printf 'netrunner terminal' ;;
    peek)           printf 'peek desktop' ;;
    ws)             printf 'workspace switch' ;;
    TERM)           printf 'terminal' ;;
    *)              printf '%s' "${1//-/ }" ;;
  esac
}
kb_desc() {
  local l="$1" m
  m="$(printf '%s' "$l" | sed -n 's/.*sock("\([^"]*\)").*/\1/p')"
  if [ -n "$m" ]; then
    case "$m" in
      "modal "*) kb_pretty "${m#modal }" ;;
      *)         kb_pretty "$m" ;;
    esac
    return 0
  fi
  m="$(printf '%s' "$l" | sed -n 's|.*/scripts/\([A-Za-z0-9_-]*\).*|\1|p')"
  [ -n "$m" ] && { kb_pretty "$m"; return 0; }
  m="$(printf '%s' "$l" | sed -n 's/.*exec_cmd(\([A-Za-z0-9_]*\)).*/\1/p')"
  [ -n "$m" ] && { kb_pretty "$m"; return 0; }
  m="$(printf '%s' "$l" | sed -n 's/.*hl\.dsp\.\([A-Za-z0-9_.]*\).*/\1/p')"
  if [ -n "$m" ] && [ "$m" != "exec_cmd" ]; then printf '%s' "${m//./ }"; return 0; fi
  printf 'theme bind'
}
declare -a THEME_COMBOS=()
declare -A THEME_DESC=()
for c in "${THEME_RAW[@]}"; do
  [[ "$c" == __ERROR__* ]] && { warn "${c#__ERROR__ }"; continue; }
  [ -z "$c" ] && continue
  _combo="${c%%	*}"; _src="${c#*	}"
  [ "$_src" = "$c" ] && _src=""
  _cc="$(canon "$_combo")"
  THEME_COMBOS+=("$_cc")
  [ -n "$_src" ] && THEME_DESC["$_cc"]="$(kb_desc "$_src")"
done
THAS() {
  local want="$1" t
  for t in "${THEME_COMBOS[@]}"; do [ "$t" = "$want" ] && return 0; done
  return 1
}
declare -a CF_FILE=() CF_LINE=() CF_TEXT=() CF_COMBO=() CF_DESC=() CF_MARK=()
cf_add() {
  CF_FILE+=("$1"); CF_LINE+=("$2"); CF_TEXT+=("$3"); CF_COMBO+=("$4")
  CF_DESC+=("${THEME_DESC[$4]:-theme bind}"); CF_MARK+=(1)
}
cf_comment() {
  local f="$1" n="$2"
  if [[ "$f" == *.lua ]]; then sed -i "${n}s|^|-- |" "$f"; else sed -i "${n}s|^|#|" "$f"; fi
}
lua_loadvars() {
  local f="$1" ln name val
  [ -f "$f" ] || return 0
  while IFS= read -r ln; do
    [[ "$ln" =~ ^[[:space:]]*local[[:space:]]+([A-Za-z_][A-Za-z0-9_]*)[[:space:]]*=[[:space:]]*["'\''"]([^"'\''"]*)["'\''"] ]] || continue
    val="${BASH_REMATCH[2]}"; val="$(printf '%s' "$val" | sed 's/[[:space:]]*$//')"
    LVARS["${BASH_REMATCH[1]}"]="$val"
  done < "$f"
}
lua_arg() {
  local s="$1" name pass
  for pass in 1 2 3; do for name in "${!LVARS[@]}"; do s="${s//$name/${LVARS[$name]}}"; done; done
  s="${s//\"/}"; s="${s//\'/}"; s="${s//../ }"
  s="$(printf '%s' "$s" | tr -s ' ' | sed 's/^ *//;s/ *$//')"
  printf '%s' "$s"
}
lua_scan() {
  local f="$1" n=0 ln c raw
  declare -A LVARS=()
  [ -f "$f" ] || return 0
  lua_loadvars "$f"
  while IFS= read -r ln; do
    n=$((n+1))
    [[ "$ln" =~ ^[[:space:]]*-- ]] && continue
    raw="$(printf '%s\n' "$ln" | sed -n 's/.*hl\.bind([[:space:]]*\([^,)]*\).*/\1/p')"
    [ -n "$raw" ] || continue
    c="$(canon "$(lua_arg "$raw")")"
    THAS "$c" || continue
    cf_add "$f" "$n" "$(printf '%s' "$ln" | sed 's/^[[:space:]]*//')" "$c"
  done < "$f"
  return 0
}
USERCONF="$HYDIR/user.conf"
declare -A HVARS=()
kb_loadvars() {
  local f="$1" ln name val
  [ -f "$f" ] || return 0
  while IFS= read -r ln; do
    [[ "$ln" =~ ^[[:space:]]*\$([A-Za-z_][A-Za-z0-9_]*)[[:space:]]*=[[:space:]]*(.*)$ ]] || continue
    name="${BASH_REMATCH[1]}"; val="${BASH_REMATCH[2]%%#*}"
    val="$(printf '%s' "$val" | sed 's/[[:space:]]*$//')"
    HVARS["$name"]="$val"
  done < "$f"
}
kb_expand() {
  local s="$1" name pass
  for pass in 1 2 3; do for name in "${!HVARS[@]}"; do s="${s//\$$name/${HVARS[$name]}}"; done; done
  printf '%s' "$s"
}
kb_combo() {
  local mods key
  mods="$(kb_expand "$1" | tr 'a-z' 'A-Z' | tr ', ' '\n\n' | grep -v '^$' | sort | tr '\n' '+')"
  key="$(kb_expand "$2" | tr 'a-z' 'A-Z' | tr -d ' ')"
  printf '%s%s' "$mods" "$key"
}
kb_fields() {
  local body="${1#*=}" rest
  KB_M="${body%%,*}"; rest="${body#*,}"; KB_K="${rest%%,*}"
}
kb_scan() {
  local f="$1" n=0 ln c
  [ -f "$f" ] || { warn "$(basename "$f") not found |::| skipped."; return 0; }
  while IFS= read -r ln; do
    n=$((n+1))
    [[ "$ln" =~ ^[[:space:]]*# ]] && continue
    [[ "$ln" =~ ^[[:space:]]*bind[a-zA-Z]*[[:space:]]*= ]] || continue
    kb_fields "$ln"
    [ -n "${KB_K// /}" ] || continue
    c="$(kb_combo "$KB_M" "$KB_K")"
    THAS "$c" || continue
    cf_add "$f" "$n" "$(printf '%s' "$ln" | sed 's/^[[:space:]]*//')" "$c"
  done < "$f"
  return 0
}
KB_KEY=""
kb_key() {
  local k rest
  IFS= read -rsn1 k </dev/tty || { KB_KEY="quit"; return 0; }
  if [ -z "$k" ]; then KB_KEY="enter"; return 0; fi
  if [ "$k" = $'\e' ]; then
    IFS= read -rsn2 -t 0.15 rest </dev/tty || rest=""
    case "$rest" in
      "[A") KB_KEY="up" ;;
      "[B") KB_KEY="down" ;;
      *)    KB_KEY="none" ;;
    esac
    return 0
  fi
  case "$k" in
    " ")  KB_KEY="space" ;;
    k|K)  KB_KEY="up" ;;
    j|J)  KB_KEY="down" ;;
    a|A)  KB_KEY="all" ;;
    q|Q)  KB_KEY="quit" ;;
    *)    KB_KEY="none" ;;
  esac
  return 0
}
kb_restore() { printf '\033[?25h\033[?1049l'; }
kb_size() {
  local sz
  sz="$(stty size </dev/tty 2>/dev/null)" || sz=""
  KB_ROWS="${sz%% *}"; KB_COLS="${sz##* }"
  [[ "$KB_ROWS" =~ ^[0-9]+$ ]] || KB_ROWS=24
  [[ "$KB_COLS" =~ ^[0-9]+$ ]] || KB_COLS=100
}
kb_picker() {
  local total="${#CF_FILE[@]}" cur=0 top=0 i vis avail mark ptr txt loc locp any n_on out row applied
  if [ "$total" -eq 0 ]; then ok "no theme keybind conflicts found."; return 0; fi
  trap 'kb_restore; sudo_cleanup' EXIT INT TERM
  printf '\033[?1049h\033[?25l'
  while :; do
    kb_size
    vis=$((KB_ROWS - 7)); [ "$vis" -lt 3 ] && vis=3
    [ "$vis" -gt "$total" ] && vis="$total"
    [ "$cur" -lt "$top" ] && top="$cur"
    [ "$cur" -ge $((top + vis)) ] && top=$((cur - vis + 1))
    [ "$top" -lt 0 ] && top=0
    avail=$((KB_COLS - 52)); [ "$avail" -lt 20 ] && avail=20
    n_on=0; for ((i=0;i<total;i++)); do [ "${CF_MARK[i]}" -eq 1 ] && n_on=$((n_on+1)); done
    out=$'\033[H\033[2J'
    out+="  ${RED}${B}KEYBIND CONFLICTS DETECTED${R}   ${GREY}${total} found · ${n_on} marked${R}"$'\n'
    out+="  ${GREY}these binds collide with the theme. marked ones get commented out.${R}"$'\n\n'
    for ((row=top; row<top+vis && row<total; row++)); do
      if [ "${CF_MARK[row]}" -eq 1 ]; then mark="${GRN}[x]${R}"; else mark="${GREY}[ ]${R}"; fi
      if [ "$row" -eq "$cur" ]; then ptr="${CYAN}${B}>${R}"; else ptr=" "; fi
      printf -v loc '%s:%s' "$(basename "${CF_FILE[row]}")" "${CF_LINE[row]}"
      printf -v locp '%-22s' "$loc"
      txt="${CF_TEXT[row]}"
      [ "${#txt}" -gt "$avail" ] && txt="${txt:0:avail}..."
      out+=" $ptr $mark ${YEL}${locp}${R} ${txt}  ${GREY}::${R} ${CYAN}${CF_COMBO[row]}${R} ${GREY}(${CF_DESC[row]})${R}"$'\n'
    done
    if [ "$total" -gt "$vis" ]; then
      out+=$'\n'"  ${GREY}showing $((top+1))-$((top+vis)) of ${total}${R}"$'\n'
    else
      out+=$'\n'
    fi
    out+=$'\n'"  ${GREY}up/down move · SPACE toggle · A all · ENTER apply · Q skip${R}"
    printf '%s' "$out"
    kb_key
    case "$KB_KEY" in
      up)    cur=$(( (cur - 1 + total) % total )) ;;
      down)  cur=$(( (cur + 1) % total )) ;;
      space) if [ "${CF_MARK[cur]}" -eq 1 ]; then CF_MARK[cur]=0; else CF_MARK[cur]=1; fi ;;
      all)   any=0; for ((i=0;i<total;i++)); do [ "${CF_MARK[i]}" -eq 0 ] && any=1; done
             for ((i=0;i<total;i++)); do CF_MARK[i]=$any; done ;;
      enter) break ;;
      quit)  kb_restore; trap 'sudo_cleanup' EXIT; trap - INT TERM; warn "skipped |::| no keybinds changed."; return 0 ;;
    esac
  done
  kb_restore; trap 'sudo_cleanup' EXIT; trap - INT TERM
  applied=0
  for ((i=0;i<total;i++)); do
    [ "${CF_MARK[i]}" -eq 1 ] || continue
    if cf_comment "${CF_FILE[i]}" "${CF_LINE[i]}"; then
      ok "commented $(basename "${CF_FILE[i]}"):${CF_LINE[i]}  ${CF_COMBO[i]}"
      applied=$((applied+1))
    else
      warn "could not patch $(basename "${CF_FILE[i]}"):${CF_LINE[i]}"
    fi
  done
  if [ "$applied" -eq 0 ]; then warn "nothing marked |::| the theme binds still load last and win."
  else ok "$applied conflicting bind(s) commented out."; fi
  return 0
}
kb_loadvars "$HYDIR/hyprland.conf"; kb_loadvars "$USERCONF"
lua_scan "$HYLUA"
lua_scan "$HYDIR/user.lua"
for _lf in "$HYDIR"/land/*.lua; do [ -f "$_lf" ] && lua_scan "$_lf"; done
kb_scan "$HYDIR/hyprland.conf"
kb_scan "$USERCONF"
kb_picker

hdr "HYPRLAND · stale options"
stale_scan() {
  local f="$1" n=0 found=0 ln
  [ -f "$f" ] || return 0
  while IFS= read -r ln; do
    n=$((n+1))
    [[ "$ln" =~ ^[[:space:]]*# ]] && continue
    printf '%s' "$ln" | grep -qiE 'pseudotile|togglesplit|pseudo|vfr|workspace_swipe' || continue
    found=1
    printf "\n${RED}${B}STALE OPTION · removed in Hyprland 0.56+ <!>${R}\n"
    printf "  ${YEL}%s:%s${R}  %s\n" "$(basename "$f")" "$n" "$(printf '%s' "$ln" | sed 's/^[[:space:]]*//')"
    if [[ "$f" == *.conf ]]; then
      sed -i "${n}s|^|#|" "$f" && ok "commented $(basename "$f"):$n"
    else
      warn "remove or migrate this line manually — Lua config can't be safely auto-commented."
    fi
  done < "$f"
  [ "$found" -eq 0 ] && ok "no stale options in $(basename "$f")"
  return 0
}
stale_scan "$HYDIR/hyprland.conf"
stale_scan "$USERCONF"
stale_scan "$HYLUA"

hdr "THEME OVERRIDES"
block_comment() {
  local f="$1" key
  [ -f "$f" ] || return 0
  for key in general decoration animations; do
    grep -qE "^[[:space:]]*$key[[:space:]]*\{" "$f" || continue
    awk -v k="$key" '$0 ~ "^[[:space:]]*"k"[[:space:]]*\\{" && !s {s=1; d=0} s {d+=gsub(/{/,"{"); d-=gsub(/}/,"}"); print "#"$0; if(d<=0)s=0; next} {print}' "$f" > "$f.tmp" && mv "$f.tmp" "$f" && ok "commented conflicting $key block in $(basename "$f")"
  done
}
block_comment "$HYDIR/hyprland.conf"
block_comment "$USERCONF"
# rust stuff and the new cybre terminal
# Cool retro term gives a cool 'Arasaka UI' but in leverage of alot of CPU
# Rio terminal uses GPU and has some nice 'glassy effects' for the theme without burning so much memory
# and also has image support unlike CRT.
hdr "CYBER TERMINAL"
GTSRC="$THEME/assets/rio"
GTCFG="$HOME/.config/rio"
GTBIN="${CARGO_HOME:-$HOME/.cargo}/bin/rio"
GTVER="0.4.5"
GTKEY="SUPER + T"
gt_has_gpu() { command -v strings >/dev/null 2>&1 || return 1; [ -x "$1" ] && strings -n 8 "$1" 2>/dev/null | grep -qi librashader; }
gt_runs() { [ -x "$1" ] && "$1" --version >/dev/null 2>&1; }
gt_rust_ok() { command -v cargo >/dev/null 2>&1 && command -v rustc >/dev/null 2>&1 && rustc -vV >/dev/null 2>&1 && cargo -V >/dev/null 2>&1; }
gt_rust_err() { rustc -vV 2>&1 | grep -v '^$' | head -1; }
gt_icd_present() { ls /usr/share/vulkan/icd.d/*.json >/dev/null 2>&1; }
gt_vendor_icd() {
  local d cls ven out=""
  for d in /sys/bus/pci/devices/*; do
    [ -r "$d/class" ] && [ -r "$d/vendor" ] || continue
    read -r cls < "$d/class"; read -r ven < "$d/vendor"
    case "$cls" in 0x03*) ;; *) continue ;; esac
    case "$ven" in
      0x1002) case " $out " in *" vulkan-radeon "*) ;; *) out="$out vulkan-radeon" ;; esac ;;
      0x8086) case " $out " in *" vulkan-intel "*) ;; *) out="$out vulkan-intel" ;; esac ;;
    esac
  done
  printf '%s' "$out"
}
if [ ! -d "$GTSRC" ]; then
  warn "GPU Terminal assets missing. |::| Skipping..."
else
    GT_OK=0
    GT_DEPS="rust llvm-libs cmake pkgconf binutils fontconfig freetype2 libxkbcommon wayland vulkan-icd-loader mesa glibc lib32-glibc"
    step "installing rust toolchain + build dependencies..."
    pac_install "rio build dependencies" $GT_DEPS
    if gt_icd_present; then
      ok "vulkan driver present |::| $(ls /usr/share/vulkan/icd.d/*.json 2>/dev/null | xargs -n1 basename 2>/dev/null | tr '\n' ' ')"
    else
      step "no vulkan driver on this deck |::| resolving one..."
      GT_VK="$(gt_vendor_icd)"
      [ -n "$GT_VK" ] && pac_install "vulkan driver" $GT_VK
      gt_icd_present || pac_install "vulkan software fallback" vulkan-swrast
      if ! gt_icd_present; then
        fatal "no Vulkan driver could be installed — rio renders through WebGPU and needs one." \
          "Without an ICD in /usr/share/vulkan/icd.d the terminal loads its palette and silently drops every shader." \
          "That is exactly the 'colours change but the CRT frame never shows up' bug." \
          "NVIDIA card?  sudo pacman -S nvidia-utils        (or nvidia-open + nvidia-utils)" \
          "AMD card?     sudo pacman -S vulkan-radeon" \
          "Intel chip?   sudo pacman -S vulkan-intel" \
          "In a VM?      sudo pacman -S vulkan-swrast" \
          "Confirm with:  vulkaninfo --summary   then re-run ./install.sh"
      fi
    fi
    if ! gt_rust_ok; then
      warn "rust present but not runnable |::| $(gt_rust_err)"
      step "repairing rust + llvm-libs..."
      sudo pacman -S --noconfirm rust llvm-libs || true
    fi
    if ! gt_rust_ok; then
      step "falling back to rustup..."
      sudo pacman -S --needed --noconfirm rustup || true
      rustup default stable || true
    fi
    if ! gt_rust_ok; then
      fatal "the rust toolchain on this deck is unusable — rio cannot be built." \
        "rustc said: $(gt_rust_err)" \
        "rio is the theme's terminal, bound to $GTKEY, so this is not optional chrome." \
        "Repair it:  sudo pacman -S rust llvm-libs" \
        "Or switch to rustup:  sudo pacman -S rustup && rustup default stable" \
        "Then re-run:  ./install.sh"
    else
      gt_runs "$GTBIN" && step "rebuilding GPU Terminal to match this theme..." || step "building GPU Terminal with GPU shader support..."
      cargo install rioterm --version "$GTVER" --force --locked --features wgpu || warn "cargo reported a build failure |::| checking for a usable binary anyway"
      GT_ALT="$(command -v rio 2>/dev/null || true)"
      GT_PICK=""
      if gt_runs "$GTBIN" && gt_has_gpu "$GTBIN"; then GT_PICK="$GTBIN"
      elif [ -n "$GT_ALT" ] && gt_runs "$GT_ALT" && gt_has_gpu "$GT_ALT"; then GT_PICK="$GT_ALT"
      fi
      if [ -n "$GT_PICK" ]; then
        GTBIN="$GT_PICK"; GT_OK=1
        ok "librashader linked into $GTBIN |::| the CRT shader chain will run"
      elif gt_runs "$GTBIN" || { [ -n "$GT_ALT" ] && gt_runs "$GT_ALT"; }; then
        gt_runs "$GTBIN" || GTBIN="$GT_ALT"
        fatal "the rio on this deck has no librashader — it would load the palette and silently drop every shader." \
          "Binary: $GTBIN" \
          "That is the 'theme switches colours but the CRT frame never appears' bug, so it stops here." \
          "The cargo build with shader support is the fix:" \
          "  cargo install rioterm --version $GTVER --force --locked --features wgpu" \
          "If cargo just failed, read its last error — it is nearly always a missing cmake, binutils or llvm-libs." \
          "A distro-packaged rio is built without the filter feature, so it can never run the chain." \
          "Then re-run:  ./install.sh"
      else
        fatal "no runnable rio binary was produced at $GTBIN." \
          "cargo finished but nothing executable came out, so the terminal bound to $GTKEY does not exist." \
          "Build it by hand and read the error:" \
          "  cargo install rioterm --version $GTVER --force --locked --features wgpu" \
          "Check your PATH picks up ~/.cargo/bin, then re-run ./install.sh"
      fi
    fi
    if [ "$GT_OK" = 1 ]; then
      step "deploying terminal styles and GPU shaders..."
      # rio stuff is split in 3 folders, styles/ is a full config.toml for each theme, themes/ is just
      # the colors and shaders/ has the .slangp chain per look. rio-style copies the style over
      # config.toml when u switch theme
      mkdir -p "$GTCFG/themes" "$GTCFG/shaders" "$GTCFG/styles" "$HOME/.local/share/applications" "$HOME/.local/share/icons/hicolor/scalable/apps"
      if [ -f "$GTCFG/config.toml" ] && [ ! -f "$GTCFG/config.toml.pre-cyberpunk" ]; then
        cp "$GTCFG/config.toml" "$GTCFG/config.toml.pre-cyberpunk" && ok "previous terminal config backed up"
      fi
      cp "$GTSRC/styles/"*.toml "$GTCFG/styles/"
      cp "$GTSRC/themes/"*.toml "$GTCFG/themes/"
      for d in "$GTSRC/shaders/"*/; do
        n="$(basename "$d")"
        rm -rf "$GTCFG/shaders/$n"
        cp -r "$d" "$GTCFG/shaders/"
      done
      sed -i "s|__RIO_SHADERS__|$GTCFG/shaders|g" "$GTCFG/styles/"*.toml
      for f in "$GTCFG/shaders/"*/*.slangp; do
        [ -f "$f" ] && sed -i "s|__RIO_IMAGES__|$GTSRC/images|g" "$f"
      done
      cp "$GTCFG/styles/cybercore.toml" "$GTCFG/config.toml"
      printf 'cybercore\n' > "$GTCFG/.rio-style"
      ok "terminal styles installed |::| cybercore active, the GHOST/KITTY/SYNTHWAVE/ARCTIC/BLOODMOON/DARK/JOHNNY palettes swap in their own"
      sed "s|__RIO_BIN__|$GTBIN|g" "$GTSRC/desktop/rio.desktop" > "$HOME/.local/share/applications/rio.desktop"
      cp "$GTSRC/desktop/rio.svg" "$HOME/.local/share/icons/hicolor/scalable/apps/rio.svg"
      mkdir -p "$HOME/.local/bin"
      ln -sfn "$GTBIN" "$HOME/.local/bin/rio" && ok "linked ~/.local/bin/rio -> $GTBIN"
      case ":$PATH:" in
        *":$HOME/.local/bin:"*) : ;;
        *) warn "add ~/.local/bin to your PATH to run 'rio' from a shell" ;;
      esac
      update-desktop-database "$HOME/.local/share/applications" 2>/dev/null || true
      gtk-update-icon-cache -f -t "$HOME/.local/share/icons/hicolor" 2>/dev/null || true
      ok "Cyber Terminal installed |::| use $GTKEY to open the Terminal."
    fi
fi

hdr "ACTIVATE THEMING"
[ -x "$THEME/scripts/apply_theme" ] && "$THEME/scripts/apply_theme" && ok "icon/cursor/kitty/kvantum theming applied" || warn "apply_theme not run"

hdr "REFRESH HYPRLAND + BUILD hyprbars"
NEED_RESTART=0
if command -v hyprctl >/dev/null 2>&1; then
  PROVIDER="$(hyprctl systeminfo 2>/dev/null | sed -n 's/.*configProvider:[[:space:]]*//p' | head -n1)"
  if [ -f "$HYLUA" ] && [ -n "$PROVIDER" ] && [ "$PROVIDER" != "lua" ]; then
    warn "running session registers the $PROVIDER config provider, not lua — the Lua theme loads on the next Hyprland start."
    NEED_RESTART=1
  fi
  step "hyprctl reload (apply the freshly-loaded theme to the running session)…"
  if hyprctl reload >/dev/null 2>&1; then ok "Hyprland reloaded with the theme"
  elif [ -f "$HYLUA" ]; then
    warn "hyprctl reload failed |::| the compositor may still be running hyprlang (0.54)."
    warn "hyprland.lua is present, so the next Hyprland start will be the Lua theme."
    NEED_RESTART=1
  else
    warn "hyprctl reload failed |::| is Hyprland running this session?"
  fi
fi

printf "[!] Install custom Hyprbars Plugin? (y/N) "
read -r ans </dev/tty
if [ "$ans" = "y" ] || [ "$ans" = "Y" ]; then
  if pkg-config --exists hyprland 2>/dev/null; then
    HVER="$(pkg-config --modversion hyprland 2>/dev/null)"
    step "building the cyberpunk titlebars against Hyprland $HVER…"
    if "$THEME/scripts/build-hyprbars"; then ok "hyprbars.so built + loaded"
    else
      warn "titlebars built but couldn't hot-load |::| they'll come up after Hyprland restarts."
      NEED_RESTART=1
    fi
  else
    warn "hyprland.pc not found |::| install Hyprland headers, then run scripts/build-hyprbars."
  fi
else
  warn "skipped custom Hyprbars plugin |::| run scripts/build-hyprbars later if you want it."
fi
hdr "MESA PACKAGES INSTALLATION"
step "installing/refreshing $MESA_PKGS before restart…"
sudo pacman -S --needed $MESA_PKGS

clear
printf "${RED}${B}"
cat <<'EOF'

   █▀▀ █▄█ █▄▄ █▀▀ █▀█ █▀█ █░█ █▄░█ █▄▀   ▀█ █▀█ ▀▀█ ▀▀█
   █▄▄ ░█░ █▄█ ██▄ █▀▄ █▀▀ █▄█ █░▀█ █░█   █▄ █▄█ ░░█ ░░█
EOF
printf "${R}"
printf "${GRN}${B}        ░▒▓  INSTALLED SUCCESSFULLY  ▓▒░${R}\n\n"
printf "${GREY}${B}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${R}\n\n"
printf "${YEL}${B}  ▸ KEYBINDS   |::|   ⧉ = SUPER + SHIFT${R}\n"
printf "    ${CYAN}${B}SUPER + TAB   App launcher${R}\n"
printf "    ${CYAN}${B}%-13s Cyber Terminal${R}\n" "$GTKEY"
printf "    ${CYAN}${B}⧉ + T        Terminal${R}\n"
printf "    ${CYAN}${B}⧉ + K        KILL MODE ${R}${GREY}(click a window to kill · ESC exits)${R}\n"
printf "    ${CYAN}${B}⧉ + Z        Toggles HUD${R}\n"
printf "    ${CYAN}${B}⧉ + S        Screenshot${R}\n"
printf "    ${CYAN}${B}⧉ + R        Start/Stop Recording Screen${R}\n"
printf "    ${CYAN}${B}⧉ + O        Music Player${R}\n"
printf "    ${CYAN}${B}⧉ + C        CPU/RAM Monitor // Process Manager${R}\n"
printf "    ${CYAN}${B}⧉ + G        Feeds // Stocks, Crypto, News${R}\n"
printf "    ${CYAN}${B}⧉ + L        Lock Screen${R}\n"
printf "    ${CYAN}${B}⧉ + V        Volume${R}\n"
printf "    ${CYAN}${B}⧉ + W        Weather Forecast ${R}${GREY}(7-day panel · double-click city to change)${R}\n"
printf "    ${CYAN}${B}⧉ + -        System Time ${R}${GREY}(timezone · NTP · manual set)${R}\n"
printf "    ${CYAN}${B}⧉ + H        Help Menu ${R}${GREY}(List all theme keybinds)${R}\n"
printf " "

line
if [ "$NEED_RESTART" = 1 ]; then
  printf "${YEL}${B}  A Hyprland restart is required to apply changes and bring up the titlebars.${R}\n"
else
  printf "${GRN}${B}  Cyberpunk Hyprland Installation is complete${R} ${GREY}|::| Welcome to Night City, choom.${R}\n"
  printf "${GREY}  Log out and back in so the theme config and autostart entries load cleanly.${R}\n"
fi

if dm_active; then
  printf "[!] Restart Hyprland now? (y/N) "
  read -r ans </dev/tty
else
  warn "no display manager detected |::| killing Hyprland here drops you to a black TTY with nothing to log back in with."
  printf "[!] Restart Hyprland anyway? (y/N) "
  read -r ans </dev/tty
fi
if [ "$ans" = "y" ] || [ "$ans" = "Y" ]; then
  printf "${CYAN}  ▸ restarting Hyprland…${R}\n"
  sudo pkill sddm
  pkill -x Hyprland 2>/dev/null || hyprctl dispatch exit >/dev/null 2>&1
else
  printf "${GREY}  Restart Hyprland yourself when ready (log out / back in, or: ${B}pkill Hyprland${R}${GREY}).${R}\n"
fi
line
