local QBCore = nil
local ESX = nil

local function safeFramework()
  if Config.Framework == "qbcore" or Config.Framework == "qbox" then
    if GetResourceState("qb-core") == "started" then
      local ok, object = pcall(function()
        return exports["qb-core"]:GetCoreObject()
      end)
      if ok then QBCore = object end
    end
  elseif Config.Framework == "esx" then
    if GetResourceState("es_extended") == "started" then
      local ok, object = pcall(function()
        return exports["es_extended"]:getSharedObject()
      end)
      if ok then ESX = object end
    end
  end
end

local function headers()
  return {
    ["Content-Type"] = "application/json",
    ["x-a2-bridge-secret"] = Config.SharedSecret
  }
end

local function request(method, path, payload, callback)
  local url = Config.BackendUrl .. path
  PerformHttpRequest(url, function(status, body)
    if callback then callback(status, body) end
  end, method, payload and json.encode(payload) or "", headers())
end

local function identifierMap(src)
  local mapped = {}
  for _, identifier in ipairs(GetPlayerIdentifiers(src)) do
    local key = identifier:match("^([^:]+):")
    if key then mapped[key] = identifier end
  end
  return mapped
end

local function qbPlayerData(src)
  if not QBCore then return nil end
  local ok, player = pcall(function()
    return QBCore.Functions.GetPlayer(tonumber(src))
  end)
  if not ok or not player then return nil end
  local data = player.PlayerData or {}
  local charinfo = data.charinfo or {}
  local job = data.job or {}
  local gang = data.gang or {}
  local money = data.money or {}
  return {
    characterName = ((charinfo.firstname or "") .. " " .. (charinfo.lastname or "")):gsub("^%s*(.-)%s*$", "%1"),
    citizenId = data.citizenid,
    job = job.name,
    jobGrade = job.grade and (job.grade.level or job.grade.name) or nil,
    gang = gang.name,
    gangGrade = gang.grade and (gang.grade.level or gang.grade.name) or nil,
    cash = money.cash,
    bank = money.bank
  }
end

local function esxPlayerData(src)
  if not ESX then return nil end
  local ok, player = pcall(function()
    return ESX.GetPlayerFromId(tonumber(src))
  end)
  if not ok or not player then return nil end
  return {
    characterName = player.getName and player.getName() or GetPlayerName(src),
    citizenId = player.identifier,
    job = player.job and player.job.name or nil,
    jobGrade = player.job and player.job.grade or nil,
    cash = player.getMoney and player.getMoney() or nil,
    bank = player.getAccount and player.getAccount("bank") and player.getAccount("bank").money or nil
  }
end

local function collectPlayer(src)
  local ped = GetPlayerPed(src)
  local coords = ped and GetEntityCoords(ped) or vector3(0, 0, 0)
  local ids = identifierMap(src)
  local frameworkData = qbPlayerData(src) or esxPlayerData(src) or {}
  local characterName = frameworkData.characterName
  if not characterName or characterName == "" then characterName = GetPlayerName(src) end

  return {
    serverId = tonumber(src),
    characterName = characterName,
    steamName = GetPlayerName(src),
    discordId = ids.discord,
    license = ids.license,
    steam = ids.steam,
    citizenId = frameworkData.citizenId,
    job = frameworkData.job,
    jobGrade = frameworkData.jobGrade,
    gang = frameworkData.gang,
    gangGrade = frameworkData.gangGrade,
    ping = GetPlayerPing(src),
    health = ped and GetEntityHealth(ped) or nil,
    armor = ped and GetPedArmour(ped) or nil,
    cash = frameworkData.cash,
    bank = frameworkData.bank,
    coords = { x = coords.x, y = coords.y, z = coords.z },
    identifiers = ids,
    lastUpdate = os.date("!%Y-%m-%dT%H:%M:%SZ"),
    status = "online"
  }
end

local function collectPlayers()
  local players = {}
  for _, src in ipairs(GetPlayers()) do
    players[#players + 1] = collectPlayer(src)
  end
  return players
end

local function sendPlayers()
  request("POST", "/api/bridge/players", { players = collectPlayers() })
end

local function commandResult(commandId, success, result)
  request("POST", "/api/bridge/command-result", {
    commandId = commandId,
    success = success,
    result = result or {}
  })
end

local function targetId(command)
  return tonumber(command.targetServerId or command.payload and command.payload.id)
end

local function runCommand(command)
  local commandId = command.id
  local action = command.type
  local payload = command.payload or {}
  local target = targetId(command)

  if action == "kick" then
    if target and GetPlayerName(target) then
      DropPlayer(target, payload.reason or "Kicked by A2 Panel")
      commandResult(commandId, true, { message = "Player kicked" })
    else
      commandResult(commandId, false, { message = "Player not online" })
    end
    return
  end

  if action == "ban" then
    if target and GetPlayerName(target) then
      DropPlayer(target, "Banned: " .. (payload.reason or "A2 Panel ban"))
      commandResult(commandId, true, { message = "Ban record created and player dropped" })
    else
      commandResult(commandId, true, { message = "Ban record created for offline player" })
    end
    return
  end

  if action == "revive" then
    if target and GetPlayerName(target) then
      TriggerClientEvent(Config.ReviveEvents[Config.Framework] or "a2_panel_bridge:client:revive", target)
      commandResult(commandId, true, { message = "Revive event triggered" })
    else
      commandResult(commandId, false, { message = "Player not online" })
    end
    return
  end

  if action == "heal" then
    TriggerClientEvent(Config.HealEvent, target)
    commandResult(commandId, target ~= nil, { message = "Heal event triggered" })
    return
  end

  if action == "freeze" then
    TriggerClientEvent(Config.FreezeEvent, target, payload.frozen == true)
    commandResult(commandId, target ~= nil, { frozen = payload.frozen == true })
    return
  end

  if action == "bring" then
    TriggerClientEvent(Config.TeleportEvent, target, { x = Config.AdminBringCoords.x, y = Config.AdminBringCoords.y, z = Config.AdminBringCoords.z })
    commandResult(commandId, target ~= nil, { message = "Player moved to configured admin bring coordinates" })
    return
  end

  if action == "goto" then
    commandResult(commandId, false, { message = "Go to player requires an in-game staff source. Use bring from web panel or implement staff source mapping." })
    return
  end

  if action == "message" then
    TriggerClientEvent(Config.MessageEvent, target, payload.message or "")
    commandResult(commandId, target ~= nil, { message = "Private message sent" })
    return
  end

  if action == "screenshot" then
    if GetResourceState("screenshot-basic") == "started" then
      TriggerClientEvent(Config.ScreenshotEvent, target, commandId)
      commandResult(commandId, target ~= nil, { message = "Screenshot requested through screenshot-basic client hook" })
    else
      commandResult(commandId, false, { message = "screenshot-basic is not started" })
    end
    return
  end

  if action == "console.command" then
    local consoleCommand = tostring(payload.command or "")
    if consoleCommand ~= "" then
      ExecuteCommand(consoleCommand)
      commandResult(commandId, true, { message = "FiveM command executed", command = consoleCommand })
    else
      commandResult(commandId, false, { message = "Empty command" })
    end
    return
  end

  if action == "inventory.give" or action == "inventory.remove" or action == "money.add" or action == "money.remove" or action == "money.set" or action == "players.job.set" or action == "players.gang.set" then
    commandResult(commandId, false, { message = "Framework mutation hook not configured in a2_panel_bridge for " .. action })
    return
  end

  commandResult(commandId, false, { message = "Unknown A2 Panel command: " .. tostring(action) })
end

CreateThread(function()
  safeFramework()
  while true do
    request("POST", "/api/bridge/heartbeat", {
      maxPlayers = Config.MaxPlayers,
      resources = GetNumResources(),
      framework = Config.Framework
    })
    sendPlayers()
    Wait(Config.HeartbeatInterval)
  end
end)

CreateThread(function()
  while true do
    request("GET", "/api/bridge/commands", nil, function(status, body)
      if status == 200 and body then
        local decoded = json.decode(body)
        if decoded and decoded.commands then
          for _, command in ipairs(decoded.commands) do
            runCommand(command)
          end
        end
      end
    end)
    Wait(Config.CommandPollInterval)
  end
end)

RegisterCommand("report", function(source, args)
  local message = table.concat(args, " ")
  if source == 0 then return end
  if message == "" then
    TriggerClientEvent(Config.MessageEvent, source, "Usage: /report your message")
    return
  end
  local player = collectPlayer(source)
  request("POST", "/api/bridge/event", {
    event = "report.created",
    payload = {
      reporterName = player.characterName or GetPlayerName(source),
      reporterServerId = source,
      reporterCitizenId = player.citizenId,
      message = message
    }
  })
  TriggerClientEvent(Config.MessageEvent, source, "Report sent to A2 Panel staff.")
end, false)

RegisterCommand("a2announce", function(source, args)
  if source ~= 0 then return end
  local style = args[1] or "info"
  local duration = tonumber(args[2]) or 8000
  table.remove(args, 1)
  table.remove(args, 1)
  local message = table.concat(args, " ")
  TriggerClientEvent(Config.AnnounceEvent, -1, style, duration, message)
end, true)

AddEventHandler("playerDropped", function(reason)
  request("POST", "/api/bridge/event", {
    event = "player.left",
    payload = { serverId = source, reason = reason }
  })
end)
