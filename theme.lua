local cyberpunk = os.getenv("HOME") .. "/.config/hypr/themes/cyberpunk"

local once = function(cmd)
    hl.on("hyprland.start", function()
        hl.exec_cmd(cmd)
    end)
end

hl.exec_cmd("dbus-update-activation-environment --systemd --all")
hl.exec_cmd("sh -c 'sleep 3; hyprctl dispatch exec \"dbus-update-activation-environment --systemd DISPLAY WAYLAND_DISPLAY XAUTHORITY XCURSOR_THEME XCURSOR_SIZE\"' &")
hl.exec_cmd("killall -9 waybar mako dunst swaync 2>/dev/null; systemctl --user stop waybar mako dunst swaync 2>/dev/null || true")
hl.exec_cmd(os.getenv("HOME") .. "/.local/bin/ags quit -i cyberpunk 2>/dev/null")
hl.exec_cmd("sleep 1 && " .. cyberpunk .. "/scripts/launch-theme")
hl.exec_cmd(cyberpunk .. "/scripts/ws pin")
once("bash " .. cyberpunk .. "/scripts/set-wallpaper")

hl.exec_cmd("mkdir -p " .. os.getenv("HOME") .. "/.config/kitty && ln -sfn " .. cyberpunk .. "/assets/kitty/kitty.conf " .. os.getenv("HOME") .. "/.config/kitty/kitty.conf")
hl.exec_cmd("mkdir -p " .. os.getenv("HOME") .. "/.local/share/icons && ln -sfn " .. cyberpunk .. "/assets/gtk/iconpack " .. os.getenv("HOME") .. "/.local/share/icons/iconpack")
hl.exec_cmd("gsettings set org.gnome.desktop.interface icon-theme 'iconpack'")
hl.exec_cmd("ln -sfn " .. cyberpunk .. "/assets/cursor " .. os.getenv("HOME") .. "/.local/share/icons/neurodance")
hl.exec_cmd("gsettings set org.gnome.desktop.interface cursor-theme 'neurodance'")
hl.exec_cmd("hyprctl setcursor neurodance 48")
hl.env("XCURSOR_THEME", "neurodance")
hl.env("XCURSOR_SIZE", "48")
hl.env("QT_STYLE_OVERRIDE", "kvantum")
once(cyberpunk .. "/scripts/apply_theme")
once("mkdir -p " .. os.getenv("HOME") .. "/.config/Kvantum/Daemon && cp -f " .. cyberpunk .. "/assets/gtk/DaemonKvantum/Daemon.kvconfig " .. os.getenv("HOME") .. "/.config/Kvantum/Daemon/Daemon.kvconfig && cp -f " .. cyberpunk .. "/assets/gtk/DaemonKvantum/Daemon.svg " .. os.getenv("HOME") .. "/.config/Kvantum/Daemon/Daemon.svg && echo '[General]' > " .. os.getenv("HOME") .. "/.config/Kvantum/kvantum.kvconfig && echo 'theme=Daemon' >> " .. os.getenv("HOME") .. "/.config/Kvantum/kvantum.kvconfig")

dofile(cyberpunk .. "/config/keybinds.lua")

hl.config({
    misc = {
        allow_session_lock_restore = true,
        force_default_wallpaper = 0,
    },
    general = {
        border_size = 2,
        gaps_in  = 12,
        gaps_out = 24,
        col = {
            active_border   = { colors = { "rgba(ff2d3dff)", "rgba(ff6677ff)" }, angle = 45 },
            inactive_border = "rgba(ff2d3d44)",
        },
    },
    decoration = {
        rounding = 0,
        blur = {
            enabled = true,
            size = 3,
            passes = 1,
            noise = 0.04,
        },
        shadow = {
            enabled = true,
            range = 8,
            render_power = 2,
            color = "rgba(ff2d3d55)",
            color_inactive = "rgba(ff2d3d22)",
            offset = { 0, 0 },
        },
        screen_shader = "",
    },
})

local barsfile = cyberpunk .. "/assets/cyberbars/hyprbars.so"
local barsfh = io.open(barsfile, "rb")
if barsfh then
    barsfh:close()
    hl.plugin.load(barsfile)
    hl.config({
        plugin = {
            hyprbars = {
                bar_height = 28,
                bar_color = "rgba(160409f2)",
                col = { text = "rgba(ff2d3dff)" },
                bar_text_size = 12,
                bar_text_font = "FiraCode Nerd Font",
                bar_part_of_window = true,
                bar_precedence_over_border = false,
                bar_padding = 12,
                bar_button_padding = 10,
                ["hyprbars-button"] = {
                    "rgb(ff2d3d), 15, \xEE\xAE\x8B, hyprctl dispatch killactive",
                    "rgb(ff2d3d), 14, \xEE\xAA\xB9, hyprctl dispatch fullscreen 1",
                    "rgb(ff2d3d), 14, \xEE\xAA\xB7, hyprctl dispatch movetoworkspacesilent special:minimized",
                },
            },
        },
    })
end

hl.layer_rule({ match = { namespace = "modal_.*" }, blur = true })

hl.window_rule({
    name        = "rio-terminal",
    match       = { class = "^(rio)$" },
    border_size = 0,
    no_shadow   = true,
    float       = true,
    size        = "1238 766",
    center      = true,
})

hl.window_rule({ match = { class = "^cool-retro-term$" },          float = true })
hl.window_rule({ match = { class = "^cool-retro-term$" },          center = true })
hl.window_rule({ match = { class = "^cool-retro-term$" },          size  = "60% 65%" })
hl.window_rule({ match = { class = "^xdg-desktop-portal-gtk$" },   float = true })
hl.window_rule({ match = { class = "^xdg-desktop-portal-gtk$" },   center = true })
hl.window_rule({ match = { class = "^xdg-desktop-portal-gtk$" },   size  = "60% 65%" })

local filewin = "^(File Upload|Save As|Save File|Save Image|Enter name of file|Open File|Open Files|Select File|Select Files|Choose.*[Ff]ile|Upload File).*$"
hl.window_rule({ match = { title = filewin }, float = true })
hl.window_rule({ match = { title = filewin }, center = true })
hl.window_rule({ match = { title = filewin }, size  = "60% 65%" })

local opwin = "^(Rename.*|Create New Folder|Create Folder|Create Document|Bulk Rename.*|Properties.*|Confirm to replace.*|File Operation.*|Permissions.*|Delete|Trash|Empty Trash)$"
hl.window_rule({ match = { title = opwin }, float = true })
hl.window_rule({ match = { title = opwin }, center = true })

hl.config({ animations = { enabled = true } })
hl.curve("swiftOut", { type = "bezier", points = { {0.05, 0.7}, {0.1, 1.0} } })
hl.animation({ leaf = "windows",     enabled = true, speed = 4, bezier = "swiftOut", style = "slide" })
hl.animation({ leaf = "windowsIn",   enabled = true, speed = 4, bezier = "swiftOut", style = "slide left" })
hl.animation({ leaf = "windowsOut",  enabled = true, speed = 3, bezier = "swiftOut", style = "slide right" })
hl.animation({ leaf = "windowsMove", enabled = true, speed = 4, bezier = "swiftOut", style = "slide" })
hl.animation({ leaf = "fade",        enabled = true, speed = 4, bezier = "swiftOut" })
hl.animation({ leaf = "workspaces",  enabled = false })
hl.animation({ leaf = "layers",      enabled = true, speed = 3, bezier = "swiftOut", style = "fade" })
