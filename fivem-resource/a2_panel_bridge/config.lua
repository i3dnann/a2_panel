Config = {}

Config.BackendUrl = "http://127.0.0.1:3001"
Config.SharedSecret = "change_this_bridge_secret"
Config.Framework = "qbcore" -- qbcore, esx, qbox, custom
Config.HeartbeatInterval = 5000
Config.CommandPollInterval = 1500
Config.MaxPlayers = 64

Config.AdminBringCoords = vector3(215.76, -810.12, 30.73)

Config.ReviveEvents = {
  qbcore = "hospital:client:Revive",
  esx = "esx_ambulancejob:revive"
}

Config.HealEvent = "a2_panel_bridge:client:heal"
Config.FreezeEvent = "a2_panel_bridge:client:freeze"
Config.TeleportEvent = "a2_panel_bridge:client:teleport"
Config.MessageEvent = "a2_panel_bridge:client:message"
Config.AnnounceEvent = "a2_panel_bridge:client:announce"
Config.ScreenshotEvent = "a2_panel_bridge:client:screenshot"
