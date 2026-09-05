local cyberpunk = os.getenv("HOME") .. "/.config/hypr/themes/cyberpunk"
local augSock   = os.getenv("XDG_RUNTIME_DIR") .. "/astal/cyberpunk.sock"

local USER_LUA = os.getenv("HOME") .. "/.config/hypr/user.lua"

CD = CD or {}
CD.defaultMod = "SUPER + SHIFT"
CD.mod        = CD.defaultMod
CD.reserved   = {}

local once = function(cmd)
    hl.on("hyprland.start", function() hl.exec_cmd(cmd) end)
end

local function sock(msg)
    return hl.dsp.exec_cmd('echo "' .. msg .. '" | socat - UNIX-CONNECT:' .. augSock)
end

local function app(path)
    return hl.dsp.exec_cmd(cyberpunk .. "/" .. path)
end

CD.sock = sock
CD.app  = app

local function rawbind(combo, run, opts)
    if opts then hl.bind(combo, run, opts) else hl.bind(combo, run) end
end

local function normCombo(c)
    if not c then return "" end
    local parts = {}
    for p in string.gmatch(c, "[^%+]+") do
        local s = p:gsub("^%s+", ""):gsub("%s+$", ""):upper()
        if s ~= "" then parts[#parts + 1] = s end
    end
    local function ord(p)
        if p == "SUPER"  then return 1 end
        if p == "CTRL"   then return 2 end
        if p == "ALT"    then return 3 end
        if p == "SHIFT"  then return 4 end
        return 5
    end
    table.sort(parts, function(a, b)
        local oa, ob = ord(a), ord(b)
        if oa == ob then return a < b end
        return oa < ob
    end)
    return table.concat(parts, "+")
end

local Scan = {}
Scan.themeMod   = nil
Scan.rebinds    = {}
Scan.adds       = {}
Scan.claimed    = {}
Scan.reserved   = {}

local function scanBind(combo, _run, _opts)
    local key = normCombo(combo)
    if key ~= "" then Scan.claimed[key] = true end
end

local function scanNoop() return function() end end

function CD.themeMod(m)
    if type(m) == "string" and m ~= "" then Scan.themeMod = m end
end

function CD.rebind(id, combo_or_key, _extra)
    local idStr = tostring(id)
    if combo_or_key == nil then
        Scan.rebinds[idStr] = nil
    else
        Scan.rebinds[idStr] = tostring(combo_or_key)
    end
end

function CD.add(...)
    local args = { ... }
    Scan.adds[#Scan.adds + 1] = {
        label = tostring(args[1] or "CUSTOM"),
        mod   = tostring(args[2] or ""),
        key   = tostring(args[3] or ""),
        kind  = tostring(args[4] or "app"),
        value = tostring(args[5] or args[1] or ""),
    }
end

-- how the binds actually settle:
-- user.lua loads after the theme so its binds win anyway. thing is the theme
-- already bound its own default by then, so u end up wiht two binds on the same
-- combo.. rio opening twice, that kinda thing.
-- so before anyhting gets bound it runs trough user.lua first with all the hl.*
-- functions swapped for empty ones, just to see what combos it takes + any
-- CD.rebind / CD.themeMod. then the theme skips whatever is already taken.
-- the empty funcs matter or their autostarts and gestures all run twice.
-- one catch: user.lua returns early if __cyberpunk_user_scan is set, so it cant
-- set the loaded flag during the scan or the real load after does nothing
local function doScan()
    Scan.themeMod = nil
    Scan.rebinds  = {}
    Scan.adds     = {}
    Scan.claimed  = {}

    local real = {
        bind         = hl.bind,
        on           = hl.on,
        gesture      = hl.gesture,
        window_rule  = hl.window_rule,
        workspace_rule = hl.workspace_rule,
        layer_rule   = hl.layer_rule,
        exec_cmd     = hl.exec_cmd,
        config       = hl.config,
        plugin       = { load = hl.plugin and hl.plugin.load },
        env          = hl.env,
        define_submap = hl.define_submap,
        submap       = hl.submap,
    }

    hl.bind         = scanBind
    hl.on           = scanNoop()
    hl.gesture      = scanNoop()
    hl.window_rule  = scanNoop()
    hl.workspace_rule = scanNoop()
    hl.layer_rule   = scanNoop()
    hl.exec_cmd     = scanNoop()
    hl.config       = scanNoop()
    if hl.plugin then hl.plugin.load = scanNoop() end
    hl.env          = scanNoop()
    hl.define_submap = scanNoop()
    hl.submap       = function() end

    _G.__cyberpunk_user_scan = true
    local f = loadfile(USER_LUA)
    if f then pcall(f) end
    _G.__cyberpunk_user_scan = nil

    hl.bind         = real.bind
    hl.on           = real.on
    hl.gesture      = real.gesture
    hl.window_rule  = real.window_rule
    hl.workspace_rule = real.workspace_rule
    hl.layer_rule   = real.layer_rule
    hl.exec_cmd     = real.exec_cmd
    hl.config       = real.config
    if hl.plugin then hl.plugin.load = real.plugin.load end
    hl.env          = real.env
    hl.define_submap = real.define_submap
    hl.submap       = real.submap
end

doScan()

CD.actions = {}

function CD.bind(combo, run, label, opts)
    CD.reserved[#CD.reserved + 1] = { combo = combo, label = label or "SYSTEM" }
    local key = normCombo(combo)
    if Scan.claimed[key] then return end
    Scan.reserved[key] = true
    rawbind(combo, run, opts)
end

local function resolveCombo(action, mod)
    local rb = Scan.rebinds[action.id]
    local m, k
    if rb then
        if rb:find("%+") then
            local parts = {}
            for p in string.gmatch(rb, "[^%+]+") do
                parts[#parts + 1] = p:gsub("^%s+", ""):gsub("%s+$", "")
            end
            k = parts[#parts]
            if #parts > 1 then
                m = table.concat(parts, " + ", 1, #parts - 1)
            else
                m = mod
            end
        else
            m = mod
            k = rb
        end
    else
        m = (action.mod == "@themeMod") and mod or action.mod
        k = action.key
    end
    return m .. " + " .. k
end

local function applyDefaults(mod)
    for _, a in ipairs(CD.actions) do
        local combo = resolveCombo(a, mod)
        local key = normCombo(combo)
        if (Scan.claimed[key] or Scan.reserved[key]) and not Scan.rebinds[a.id] then
        else
            rawbind(combo, a.run)
        end
    end
    for _, c in ipairs(Scan.adds) do
        local m = (c.mod == "@themeMod") and mod or c.mod
        rawbind(m .. " + " .. c.key, hl.dsp.exec_cmd(c.value))
    end
end

CD.bind("SUPER + TAB", app("scripts/launcher"), "LAUNCHER")
CD.bind("SUPER + T", hl.dsp.exec_cmd("rio"), "RIO TERMINAL")
CD.bind("SUPER + SHIFT + T", hl.dsp.exec_cmd("cool-retro-term"), "RETRO TERMINAL")
CD.bind("SUPER + ALT + D", hl.dsp.exec_cmd("discord"), "DISCORD")
CD.bind("SUPER + E", hl.dsp.exec_cmd("thunar"), "FILES")
CD.bind("SUPER + D", app("scripts/peek"), "PEEK")
CD.bind("CTRL + SHIFT + ALT + r", app("scripts/restart"), "RESTART THEME")
CD.bind("SUPER + CTRL + Delete", hl.dsp.exec_cmd("hyprctl reload"), "RELOAD HYPRLAND")
CD.bind("SUPER + mouse:272", hl.dsp.window.drag(), "DRAG WINDOW", { mouse = true })
CD.bind("SUPER + mouse:273", hl.dsp.window.resize(), "MOUSE RESIZE", { mouse = true })

once(cyberpunk .. "/scripts/overkill prewarm")

hl.define_submap("kill", function()
    hl.bind("mouse:272", app("scripts/overkill kill"))
    hl.bind("escape",    app("scripts/overkill exit"))
end)

for i = 1, 10 do
    local key = i % 10
    CD.bind("ALT + SHIFT + " .. key, app("scripts/ws move " .. i), "MOVE TO WS " .. i)
    CD.bind("SUPER + " .. key,       app("scripts/ws go " .. i),   "WORKSPACE " .. i)
end

CD.actions = {
    { id="hud.toggle",   label="TOGGLE HUD",          mod="@themeMod", key="Z",         group="deck", run=sock("toggle-hud") },
    { id="hud.vol",      label="VOLUME",              mod="@themeMod", key="V",         group="deck", run=sock("modal vol") },
    { id="hud.brt",      label="BRIGHTNESS",          mod="@themeMod", key="I",         group="deck", run=sock("modal brt") },
    { id="hud.aur",      label="UPDATES",             mod="@themeMod", key="U",         group="deck", run=sock("modal aur") },
    { id="hud.aurdis",   label="DISMISS UPDATES",     mod="@themeMod", key="J",         group="deck", run=sock("aur-dismiss") },
    { id="hud.update",   label="CYBERARCH UPDATE",    mod="@themeMod", key="Q",         group="deck", run=sock("cyber-update") },
    { id="hud.notif",    label="NOTIFICATIONS",       mod="@themeMod", key="M",         group="deck", run=sock("notif-hud") },
    { id="hud.player",   label="MUSIC PLAYER",        mod="@themeMod", key="O",         group="deck", run=sock("player") },
    { id="hud.wifi",     label="NETWORKS",            mod="@themeMod", key="N",         group="deck", run=sock("modal wifi") },
    { id="hud.bt",       label="BLUETOOTH",           mod="@themeMod", key="B",         group="deck", run=sock("modal bt") },
    { id="hud.pwr",      label="POWER",               mod="@themeMod", key="P",         group="deck", run=sock("modal pwr") },
    { id="hud.forecast", label="FORECAST",            mod="@themeMod", key="W",         group="deck", run=sock("forecast") },
    { id="hud.clock",    label="CLOCK",               mod="@themeMod", key="minus",     group="deck", run=sock("clock") },
    { id="hud.markets",  label="MARKETS",             mod="@themeMod", key="G",         group="deck", run=sock("markets") },
    { id="hud.bat",      label="BATTERY",             mod="@themeMod", key="Y",         group="deck", run=sock("modal bat") },
    { id="hud.sys",      label="SYSTEM",              mod="@themeMod", key="C",         group="deck", run=sock("modal sys") },
    { id="hud.keys",     label="KEYBINDS",            mod="@themeMod", key="H",         group="deck", run=sock("modal keys") },
    { id="hud.settings", label="THEME SETTINGS",      mod="@themeMod", key="backspace", group="deck", run=sock("modal themesettings") },
    { id="hud.notifrd",  label="READ NOTIFICATION",   mod="@themeMod", key="E",         group="deck", run=sock("notif-read") },
    { id="hud.notifdis", label="DISMISS NOTIFICATION",mod="@themeMod", key="X",         group="deck", run=sock("notif-dismiss") },
    { id="tool.rec",     label="SCREEN RECORD",       mod="@themeMod", key="R",         group="deck", run=app("scripts/screenrecord") },
    { id="tool.term",    label="TERMINAL",            mod="@themeMod", key="T",         group="deck", run=app("scripts/terminal") },
    { id="tool.shot",    label="SCREENSHOT",          mod="@themeMod", key="S",         group="deck", run=app("scripts/screenshot") },
    { id="tool.kill",    label="FORCE KILL",          mod="@themeMod", key="K",         group="deck", run=app("scripts/overkill") },
    { id="tool.lock",    label="LOCK SCREEN",         mod="@themeMod", key="L",         group="deck", run=app("components/login/lock.sh") },

    { id="win.full",     label="FULL SCREEN",   mod="SUPER + SHIFT", key="F",     group="win", run=hl.dsp.window.fullscreen({ mode = "fullscreen" }) },
    { id="win.float",    label="TOGGLE FLOAT",  mod="SUPER",         key="F",     group="win", run=hl.dsp.window.float({ action = "toggle" }) },
    { id="win.close",    label="CLOSE WINDOW",  mod="SUPER",         key="Q",     group="win", run=hl.dsp.window.close() },
    { id="win.fleft",    label="FOCUS LEFT",    mod="SUPER",         key="left",  group="win", run=hl.dsp.focus({ direction = "left" }) },
    { id="win.fright",   label="FOCUS RIGHT",   mod="SUPER",         key="right", group="win", run=hl.dsp.focus({ direction = "right" }) },
    { id="win.fup",      label="FOCUS UP",      mod="SUPER",         key="up",    group="win", run=hl.dsp.focus({ direction = "up" }) },
    { id="win.fdown",    label="FOCUS DOWN",    mod="SUPER",         key="down",  group="win", run=hl.dsp.focus({ direction = "down" }) },
    { id="win.mleft",    label="MOVE LEFT",     mod="SUPER + SHIFT", key="left",  group="win", run=hl.dsp.window.move({ direction = "left" }) },
    { id="win.mright",   label="MOVE RIGHT",    mod="SUPER + SHIFT", key="right", group="win", run=hl.dsp.window.move({ direction = "right" }) },
    { id="win.mup",      label="MOVE UP",       mod="SUPER + SHIFT", key="up",    group="win", run=hl.dsp.window.move({ direction = "up" }) },
    { id="win.mdown",    label="MOVE DOWN",     mod="SUPER + SHIFT", key="down",  group="win", run=hl.dsp.window.move({ direction = "down" }) },
    { id="win.rleft",    label="RESIZE LEFT",   mod="CTRL + SHIFT",  key="left",  group="win", run=hl.dsp.window.resize({ x = -40, y = 0, relative = true }) },
    { id="win.rright",   label="RESIZE RIGHT",  mod="CTRL + SHIFT",  key="right", group="win", run=hl.dsp.window.resize({ x = 40,  y = 0, relative = true }) },
    { id="win.rup",     label="RESIZE UP",     mod="CTRL + SHIFT",  key="up",    group="win", run=hl.dsp.window.resize({ x = 0,   y = -40, relative = true }) },
    { id="win.rdown",   label="RESIZE DOWN",   mod="CTRL + SHIFT",  key="down",  group="win", run=hl.dsp.window.resize({ x = 0,   y = 40, relative = true }) },
}

doScan()
local mod = Scan.themeMod or CD.defaultMod
CD.mod = mod
applyDefaults(mod)

local f = loadfile(USER_LUA)
if f then pcall(f) end
hl.define_submap("cyberdeck_capture", function()
    hl.bind("SUPER + CTRL + ALT + SHIFT + Escape", hl.dsp.submap("reset"))
end)
