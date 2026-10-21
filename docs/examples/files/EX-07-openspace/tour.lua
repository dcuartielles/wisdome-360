-- =====================================================================
-- EX-07b  tour.lua   --   OpenSpace
-- =====================================================================
-- A timed journey: Malmo -> Earth -> the Solar System -> the Milky Way.
-- Four minutes, entirely scripted, entirely reproducible.
--
-- Here you are not sending pixels to the dome, you are driving software
-- the dome already runs. With a dataset and some scripting confidence, it
-- is one of the strongest kinds of piece you can make.
--
-- Run it
--   Script Log / console:   openspace.scriptScheduler.loadFile("tour.lua")
--   or bind it to a key in your profile.
--
-- API NOTE: verify these call names against the OpenSpace build installed at
-- the venue -- see https://docs.openspaceproject.com. The STRUCTURE (a list
-- of timed steps, each a small script) is what this example is teaching.
-- =====================================================================

-- ---------------------------------------------------------------- helpers
local function goTo(node, seconds)
    return string.format(
        "openspace.navigation.retargetAnchor();" ..
        "openspace.setPropertyValueSingle('NavigationHandler.OrbitalNavigator.Anchor', '%s');" ..
        "openspace.navigation.flyTo('%s', %f);", node, node, seconds)
end

local function fade(property, value, seconds)
    return string.format("openspace.setPropertyValueSingle('%s', %f, %f);",
                         property, value, seconds)
end

-- ------------------------------------------------------------- the script
-- Each entry is { at = seconds from start, do = "lua to run" }.
-- Keep the gaps LONG. In a dome, a cut every four seconds is exhausting and
-- fast camera moves make people ill. Nothing here moves in under 12 seconds.
local TOUR = {
    {  0, goTo("Earth", 14) },
    {  2, fade("Scene.Earth.Renderable.Layers.ColorLayers.ESRI_VIIRS_Combo.Opacity", 1.0, 6) },

    { 20, "openspace.time.setDeltaTime(1);" },
    { 22, fade("Scene.EarthAtmosphere.Renderable.Opacity", 1.0, 8) },

    -- pull back until the whole planet sits in the comfortable zone in front, then hold. HOLD.
    -- A held shot in a dome is not dead time; it is when the audience
    -- actually looks around.
    { 40, goTo("Earth", 18) },
    { 62, fade("Scene.MilkyWay.Renderable.Opacity", 0.0, 6) },

    { 75, goTo("Sun", 22) },
    { 80, "openspace.time.setDeltaTime(86400);" },   -- one day per second

    {110, goTo("SolarSystemBarycenter", 26) },
    {140, fade("Scene.MilkyWay.Renderable.Opacity", 1.0, 20) },

    {170, goTo("MilkyWay", 40) },
    {215, "openspace.time.setDeltaTime(1);" },
    {230, "openspace.printInfo('Tour complete');" },
}

-- ------------------------------------------------------------- scheduling
for _, step in ipairs(TOUR) do
    openspace.scriptScheduler.loadScheduledScript(
        openspace.time.currentWallTime(),   -- placeholder; see note below
        step[2]
    )
end

-- NOTE ON TIMING
-- scriptScheduler works in SIMULATION time, which is not what you want for a
-- performance. For a timed show, drive it from outside instead: OpenSpace
-- exposes a WebSocket/HTTP API, so a 30-line Python script can sleep and send
-- each step at the right wall-clock second. That also lets you trigger steps
-- live from a key press, which is what you actually want on the day when the
-- audience is slower than your rehearsal.
--
--   pip install websocket-client
--   ws = websocket.create_connection("ws://localhost:4682")
--   ws.send(json.dumps({"topic": 1, "type": "luascript",
--                       "payload": {"script": step_lua}}))
