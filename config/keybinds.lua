local cyberpunk = os.getenv("HOME") .. "/.config/hypr/themes/cyberpunk"
local themeMod  = "SUPER + SHIFT"
local augSock   = os.getenv("XDG_RUNTIME_DIR") .. "/astal/cyberpunk.sock"

-- Startup helper used by the prewarm command below.  This must be local to
-- this file: theme.lua's helper has local scope and is not visible to dofile.
--- all your custom binds will be here

local once = function(cmd)
    hl.on("hyprland.start", function()
        hl.exec_cmd(cmd)
    end)
end

-- /////////////////////////////
-- CONNECT TO SOKCET
local function sock(msg)
    return hl.dsp.exec_cmd('echo "' .. msg .. '" | socat - UNIX-CONNECT:' .. augSock)
end

local function app(path)
    return hl.dsp.exec_cmd(cyberpunk .. "/" .. path)
end


-- ==========================
-- ||         Apps         ||
-- ==========================
hl.bind("SUPER + TAB", app("scripts/launcher"))
hl.bind("SUPER + T", hl.dsp.exec_cmd("rio"))
hl.bind("SUPER + SHIFT +  T", hl.dsp.exec_cmd("cool-retro-term"))
hl.bind("SUPER + ALT + D", hl.dsp.exec_cmd("discord")) -- for vesktop users, just swap to 'vesktop'
hl.bind("SUPER + E", hl.dsp.exec_cmd("thunar")) -- change as you wish
---- add more as you wish

-- ==========================
-- ||    HUD KEYBINDS !!   || 
-- ==========================
hl.bind(themeMod .. " + Z", sock("toggle-hud"))
hl.bind(themeMod .. " + V",  sock("modal vol"))
hl.bind(themeMod .. " + I",  sock("modal brt"))
hl.bind(themeMod .. " + U", sock("modal aur"))
hl.bind(themeMod .. " + J",  sock("aur-dismiss"))
hl.bind(themeMod .. " + M", sock("notif-hud"))
hl.bind(themeMod .. " + O",  sock("player"))
hl.bind(themeMod .. " + N", sock("modal wifi"))
hl.bind(themeMod .. " + B",  sock("modal bt"))
hl.bind(themeMod .. " + P", sock("modal pwr"))
hl.bind(themeMod .. " + W",  sock("forecast"))
hl.bind(themeMod .. " + minus", sock("clock"))
hl.bind(themeMod .. " + G",  sock("markets"))
hl.bind(themeMod .. " + Y", sock("modal bat"))
hl.bind(themeMod .. " + C",  sock("modal sys"))
hl.bind(themeMod .. " + H", sock("modal keys"))
hl.bind(themeMod .. " + backspace", sock("modal themesettings"))
hl.bind(themeMod .. " + E",  sock("notif-read"))
hl.bind(themeMod .. " + X", sock("notif-dismiss"))


-- ==========================
-- ||   tools & Desktop    ||
-- ==========================
hl.bind("SUPER + D",  app("scripts/peek"))
hl.bind(themeMod .. " + R", app("scripts/screenrecord"))
hl.bind(themeMod .. " + T", app("scripts/terminal"))
hl.bind(themeMod .. " + S",  app("scripts/screenshot"))
once(cyberpunk .. "/scripts/overkill prewarm") -- Force kill app
hl.bind(themeMod .. " + K", app("scripts/overkill"))
hl.define_submap("kill", function()
    hl.bind("mouse:272", app("scripts/overkill kill"))
    hl.bind("escape",    app("scripts/overkill exit"))
end)


-- ==========================
-- ||  session & hyprland  ||
-- ==========================
hl.bind(themeMod .. " + L", app("components/login/lock.sh"))
hl.bind("CTRL + SHIFT + ALT + r", app("scripts/restart"))
hl.bind("SUPER + CTRL + Delete", hl.dsp.exec_cmd("hyprctl reload"))


-- ==========================
-- ||       Windows        ||
-- ==========================
hl.bind("SUPER + SHIFT + F", hl.dsp.window.fullscreen({ mode = "fullscreen" }))
hl.bind("SUPER + F", hl.dsp.window.float({ action = "toggle" }))
hl.bind("SUPER + Q", hl.dsp.window.close())
-- switch active/focused tiled window
hl.bind("SUPER + left",  hl.dsp.focus({ direction = "left" }))
hl.bind("SUPER + right", hl.dsp.focus({ direction = "right" }))
hl.bind("SUPER + up",    hl.dsp.focus({ direction = "up" }))
hl.bind("SUPER + down",  hl.dsp.focus({ direction = "down" }))
-- move window
hl.bind("SUPER + SHIFT + left",  hl.dsp.window.move({ direction = "left" }))
hl.bind("SUPER + SHIFT + right", hl.dsp.window.move({ direction = "right" }))
hl.bind("SUPER + SHIFT + up",    hl.dsp.window.move({ direction = "up" }))
hl.bind("SUPER + SHIFT + down",  hl.dsp.window.move({ direction = "down" }))
-- resize window
hl.bind("CTRL + SHIFT + left",  hl.dsp.window.resize({ x = -40, y = 0, relative = true }))
hl.bind("CTRL + SHIFT + right", hl.dsp.window.resize({ x = 40,  y = 0, relative = true }))
hl.bind("CTRL + SHIFT + up",    hl.dsp.window.resize({ x = 0,   y = -40, relative = true }))
hl.bind("CTRL + SHIFT + down",  hl.dsp.window.resize({ x = 0,   y = 40, relative = true }))
-- Touchpad features 
hl.bind("SUPER + mouse:272", hl.dsp.window.drag(), { mouse = true })
hl.bind("SUPER + mouse:273", hl.dsp.window.resize(), { mouse = true })


-- workspaces switch
for i = 1, 10 do
  local key = i % 10
     hl.bind("ALT + SHIFT + " .. key, app("scripts/ws move " .. i))
      hl.bind("SUPER + " .. key,       app("scripts/ws go " .. i))
end
