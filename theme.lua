local cyberpunk = os.getenv("HOME") .. "/.config/hypr/themes/cyberpunk"

local once = function(cmd)
    hl.on("hyprland.start", function()
        hl.exec_cmd(cmd)
    end)
end

hl.exec_cmd("dbus-update-activation-environment --systemd --all")
hl.exec_cmd("sh -c 'sleep 3; hyprctl dispatch exec \"dbus-update-activation-environment --systemd DISPLAY WAYLAND_DISPLAY XAUTHORITY XCURSOR_THEME XCURSOR_SIZE\"' &")
hl.exec_cmd("killall -9 waybar mako dunst swaync 2>/dev/null; systemctl --user stop waybar mako dunst swaync 2>/dev/null || true")
hl.exec_cmd("sh -c 'pgrep -x gjs >/dev/null 2>&1 || { " .. os.getenv("HOME") .. "/.local/bin/ags quit -i cyberpunk 2>/dev/null; sleep 1; " .. cyberpunk .. "/scripts/launch-theme; }'")
hl.exec_cmd(cyberpunk .. "/scripts/ws pin")
local user_dir = (os.getenv("XDG_CONFIG_HOME") or (os.getenv("HOME") .. "/.config")) .. "/cyberarch"
local ucfg = {}
local cfgf = loadfile(user_dir .. "/user_config.lua")
if cfgf then
    local ok, res = pcall(cfgf)
    if ok and type(res) == "table" then
        ucfg = res
    end
end
local anim_master = ucfg["anim"] ~= false
local anim_workspace = anim_master and ucfg["animWorkspace"] == true
local wallpapers_path = os.getenv("HOME") .. "/Pictures/Wallpapers"
local set_wallpaper = wallpapers_path .. "/lucy.png"
local wf = loadfile(user_dir .. "/wallpaper.lua")
if wf then
    local ok, res = pcall(wf)
    if ok and type(res) == "string" and res ~= "" then
        set_wallpaper = res
    end
end
once("bash " .. cyberpunk .. "/scripts/set-wallpaper '" .. set_wallpaper .. "'")

local accent = { 255, 45, 61 }
local acc2 = { 255, 102, 119 }
local barhex = "160409"
local h2rgb = function(h)
    if type(h) == "string" and #h == 6 then
        local r = { tonumber(h:sub(1, 2), 16), tonumber(h:sub(3, 4), 16), tonumber(h:sub(5, 6), 16) }
        if r[1] and r[2] and r[3] then return r end
    end
    return nil
end
local rounding = 0
local power = 2.0
local border_size = 2
local glow = true
local glow_range = 12
local glow_alpha = "38"
local glow_rp = 2
local scf = loadfile(user_dir .. "/shell_colors.lua")
if scf then
    local ok, res = pcall(scf)
    if ok and type(res) == "table" then
        local a1 = h2rgb(res.accent)
        local a2 = h2rgb(res.accent2)
        if a1 and a2 then accent, acc2 = a1, a2 end
        if type(res.bar) == "string" and #res.bar == 6 then barhex = res.bar end
        if type(res.rounding) == "number" then rounding = res.rounding end
        if type(res.rounding_power) == "number" then power = res.rounding_power end
        if type(res.border) == "number" then border_size = res.border end
        if type(res.glow) == "boolean" then glow = res.glow end
        if type(res.glow_range) == "number" then glow_range = res.glow_range end
        if type(res.glow_alpha) == "string" then glow_alpha = res.glow_alpha end
        if type(res.glow_rp) == "number" then glow_rp = res.glow_rp end
    end
end
local wm = {}
local wmt = {}
local wmf = loadfile(user_dir .. "/wm_config.lua")
if wmf then
    local ok, res = pcall(wmf)
    if ok and type(res) == "table" then
        wm = type(res.wm) == "table" and res.wm or {}
        wmt = type(res.t) == "table" and res.t or {}
    end
end
local shadow_color = nil
local border_override = nil
if wmt.wmBorderSize and type(wm.wmBorderSize) == "number" then border_size = wm.wmBorderSize end
if wmt.wmBorders and wm.wmBorders == false then border_size = 0 end
if type(wm.wmBorderColor) == "string" then border_override = h2rgb(wm.wmBorderColor) end
if type(wm.wmShadowColor) == "string" and wm.wmShadowColor ~= "" then shadow_color = h2rgb(wm.wmShadowColor) end
if wmt.wmGlow ~= nil then glow = wm.wmGlow == true end
if wmt.wmGlowRange and type(wm.wmGlowRange) == "number" then glow_range = wm.wmGlowRange end
if wmt.wmGlowRp and type(wm.wmGlowRp) == "number" then glow_rp = wm.wmGlowRp end
if wmt.wmRounding and type(wm.wmRounding) == "number" then rounding = math.floor(wm.wmRounding + 0.5) end
local corner_mode = type(wm.wmCorners) == "string" and wm.wmCorners or "round"
local corner_touched = wmt.wmRoundingTl or wmt.wmRoundingTr or wmt.wmRoundingBl or wmt.wmRoundingBr
if wmt.wmCorners then
    if corner_mode == "sharp" then
        rounding = 0
        power = 2
    elseif corner_mode == "bevel" then
        power = 1
    else
        power = 2
    end
end
if corner_mode ~= "sharp" and corner_touched then
    local cr = { wm.wmRoundingTl, wm.wmRoundingTr, wm.wmRoundingBl, wm.wmRoundingBr }
    local sum, n = 0, 0
    for i = 1, 4 do
        if type(cr[i]) == "number" then sum = sum + cr[i]; n = n + 1 end
    end
    if n > 0 then rounding = math.floor(sum / n + 0.5) end
end
if rounding > 40 then rounding = 40 end
local shadow_on = true
if wmt.wmShadow ~= nil then shadow_on = wm.wmShadow == true end
local shadow_range = glow_range
if wmt.wmShadowRange and type(wm.wmShadowRange) == "number" then shadow_range = wm.wmShadowRange end
local shadow_alpha = glow_alpha
if wmt.wmShadowAlpha and type(wm.wmShadowAlpha) == "number" then
    shadow_alpha = string.format("%02x", math.floor(wm.wmShadowAlpha * 2.55 + 0.5))
end
local opacity = 1
if wm.wmOpacity == true and type(wm.wmOpacityVal) == "number" then opacity = wm.wmOpacityVal end
local hex = function(v) return string.format("%02x", math.floor(v + 0.5)) end
local rgba = function(c, a) return "rgba(" .. hex(c[1]) .. hex(c[2]) .. hex(c[3]) .. a .. ")" end
local rgb = function(c) return "rgb(" .. hex(c[1]) .. hex(c[2]) .. hex(c[3]) .. ")" end

hl.exec_cmd("mkdir -p " .. os.getenv("HOME") .. "/.config/kitty && ln -sfn " .. cyberpunk .. "/assets/kitty/kitty.conf " .. os.getenv("HOME") .. "/.config/kitty/kitty.conf")
hl.exec_cmd("mkdir -p " .. os.getenv("HOME") .. "/.local/share/icons && ln -sfn " .. cyberpunk .. "/assets/gtk/iconpack " .. os.getenv("HOME") .. "/.local/share/icons/iconpack")
hl.exec_cmd("gsettings set org.gnome.desktop.interface icon-theme 'iconpack'")
hl.exec_cmd("ln -sfn " .. cyberpunk .. "/assets/cursor " .. os.getenv("HOME") .. "/.local/share/icons/neurodance")
hl.exec_cmd("gsettings set org.gnome.desktop.interface cursor-theme 'neurodance'")
hl.exec_cmd("hyprctl setcursor neurodance 48")
hl.env("XCURSOR_THEME", "neurodance")
hl.env("XCURSOR_SIZE", "48")
hl.env("QT_STYLE_OVERRIDE", "kvantum")
once("bash " .. cyberpunk .. "/scripts/apply_theme")

dofile(cyberpunk .. "/config/keybinds.lua")

hl.config({
    misc = {
        allow_session_lock_restore = true,
        force_default_wallpaper = 0,
        -- hyprland reloads itself whenever these files change, and the modal writes
        -- user.lua every time u save. leave this true unless u want a full reload each
        -- time someone edits a keybind, theres a button in the modal for that
        disable_autoreload = true,
    },
    general = {
        border_size = border_size,
        gaps_in  = 12,
        gaps_out = 24,
        col = {
            active_border   = border_override
                and { colors = { rgba(border_override, "ff"), rgba(border_override, "ff") }, angle = 45 }
                or  { colors = { rgba(accent, "ff"), rgba(acc2, "ff") }, angle = 45 },
            inactive_border = rgba(border_override or accent, "44"),
        },
    },
    decoration = {
        rounding = rounding,
        rounding_power = power,
        active_opacity = opacity,
        inactive_opacity = math.max(0.5, opacity - 0.08),
        glow = {
            enabled = glow and border_size > 0,
            color = rgba(border_override or accent, "ff"),
            range = glow_range,
            render_power = glow_rp,
        },
        shadow = {
            enabled = shadow_on,
            range = shadow_range,
            render_power = glow_rp,
            color = rgba(shadow_color or accent, shadow_alpha),
            color_inactive = rgba(shadow_color or border_override or accent, "18"),
            offset = { 0, 0 },
        },
        blur = {
            enabled = true,
            size = 3,
            passes = 1,
            noise = 0.04,
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
                bar_color = string.format("rgba(%sf2)", barhex),
                col = { text = rgba(accent, "ff") },
                bar_text_size = 12,
                bar_text_font = "FiraCode Nerd Font",
                bar_part_of_window = true,
                bar_precedence_over_border = false,
                bar_padding = 12,
                bar_button_padding = 10,
                ["hyprbars-button"] = {
                    rgb(accent) .. ", 15, \xEE\xAE\x8B, hyprctl dispatch killactive",
                    rgb(accent) .. ", 14, \xEE\xAA\xB9, hyprctl dispatch fullscreen 1",
                    rgb(accent) .. ", 14, \xEE\xAA\xB7, hyprctl dispatch movetoworkspacesilent special:minimized",
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
    decorate    = false,
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

if wm.wmOpacity == true and type(wm.wmOpacityMode) == "string" and wm.wmOpacityMode ~= "off"
    and type(wm.wmOpacityApps) == "string" and wm.wmOpacityApps ~= ""
    and type(wm.wmOpacityVal) == "number" then
    for app in string.gmatch(wm.wmOpacityApps, "[^,]+") do
        local c = app:gsub("^%s+", ""):gsub("%s+$", "")
        if c ~= "" then
            local cls = wm.wmOpacityMode == "only" and ("(?i)^" .. c .. "$") or ("(?i)^((?!" .. c .. ").)*$")
            hl.window_rule({ name = "cyberarch-wm", match = { class = cls }, opacity = wm.wmOpacityVal })
        end
    end
end

hl.config({ animations = { enabled = anim_master } })
hl.curve("swiftOut", { type = "bezier", points = { {0.05, 0.7}, {0.1, 1.0} } })
hl.animation({ leaf = "windows",     enabled = true, speed = 4, bezier = "swiftOut", style = "slide" })
hl.animation({ leaf = "windowsIn",   enabled = true, speed = 4, bezier = "swiftOut", style = "slide left" })
hl.animation({ leaf = "windowsOut",  enabled = true, speed = 3, bezier = "swiftOut", style = "slide right" })
hl.animation({ leaf = "windowsMove", enabled = true, speed = 4, bezier = "swiftOut", style = "slide" })
hl.animation({ leaf = "fade",        enabled = true, speed = 4, bezier = "swiftOut" })
hl.animation({ leaf = "workspaces",  enabled = anim_workspace, speed = 4, bezier = "swiftOut", style = "slide" })
hl.animation({ leaf = "layers",      enabled = true, speed = 3, bezier = "swiftOut", style = "fade" })
