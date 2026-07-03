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
  mapped.ip = GetPlayerEndpoint(src)
  mapped.hwid = GetPlayerToken(src, 0)
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
  safeFramework()
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
    fivem = ids.fivem,
    ip = ids.ip,
    hwid = ids.hwid,
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

local function checkBanForSource(src, callback)
  local ids = identifierMap(src)
  request("POST", "/api/bridge/ban-check", {
    identifiers = ids,
    license = ids.license,
    discord = ids.discord,
    steam = ids.steam,
    fivem = ids.fivem,
    ip = ids.ip,
    hwid = ids.hwid
  }, function(status, body)
    if status ~= 200 or not body then
      callback(false, nil)
      return
    end
    local decoded = json.decode(body)
    if decoded and decoded.banned then
      callback(true, decoded)
      return
    end
    callback(false, decoded)
  end)
end

local function commandResult(commandId, success, result)
  request("POST", "/api/bridge/command-result", {
    commandId = commandId,
    success = success,
    result = result or {}
  })
end

local function notifyPlayer(target, message)
  if target and GetPlayerName(target) then
    TriggerClientEvent(Config.MessageEvent, target, message)
  end
end

local function qbPlayer(target)
  safeFramework()
  if not QBCore then return nil end
  local ok, player = pcall(function()
    return QBCore.Functions.GetPlayer(tonumber(target))
  end)
  if ok then return player end
  return nil
end

local function qbSharedItem(item)
  if not QBCore or not QBCore.Shared or not QBCore.Shared.Items then return nil end
  return QBCore.Shared.Items[item]
end

local function requireOnlineTarget(commandId, target)
  if target and GetPlayerName(target) then return true end
  commandResult(commandId, false, { message = "Player not online" })
  return false
end

local function setQbNeeds(target, hunger, thirst)
  local player = qbPlayer(target)
  if not player then return false, "QBCore player not found" end
  if hunger ~= nil then player.Functions.SetMetaData("hunger", tonumber(hunger) or 100) end
  if thirst ~= nil then player.Functions.SetMetaData("thirst", tonumber(thirst) or 100) end
  TriggerClientEvent(Config.HudNeedsEvent, target, player.PlayerData.metadata.hunger or hunger or 100, player.PlayerData.metadata.thirst or thirst or 100)
  return true, "Needs updated"
end

local function setQbJail(target, minutes)
  local player = qbPlayer(target)
  if not player then return false, "QBCore player not found" end
  local jailTime = tonumber(minutes) or 0
  player.Functions.SetMetaData("injail", jailTime)
  if jailTime > 0 then
    TriggerClientEvent(Config.JailEvent, target, jailTime)
  else
    TriggerClientEvent(Config.UnjailEvent, target)
  end
  return true, jailTime > 0 and "Player jailed" or "Player unjailed"
end

local function targetId(command)
  local payload = command.payload or {}
  local direct = tonumber(command.targetServerId or payload.id)
  if direct and GetPlayerName(direct) then return direct end

  local raw = tostring(command.targetServerId or payload.id or "")
  if raw == "" then return direct end
  safeFramework()

  for _, src in ipairs(GetPlayers()) do
    local numericSource = tonumber(src)
    if tostring(src) == raw then return numericSource end

    local ids = identifierMap(src)
    if ids.license == raw or ids.steam == raw or ids.fivem == raw or ids.discord == raw or ids.discord == ("discord:" .. raw) then
      return numericSource
    end

    local frameworkData = qbPlayerData(src) or esxPlayerData(src) or {}
    if frameworkData.citizenId and tostring(frameworkData.citizenId) == raw then
      return numericSource
    end
  end

  return direct
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
    if not requireOnlineTarget(commandId, target) then return end
    TriggerClientEvent(Config.HealEvent, target)
    commandResult(commandId, true, { message = "Heal event triggered" })
    return
  end

  if action == "armor" then
    if not requireOnlineTarget(commandId, target) then return end
    TriggerClientEvent(Config.ArmorEvent, target, payload.amount or 100)
    commandResult(commandId, true, { message = "Armor set", amount = payload.amount or 100 })
    return
  end

  if action == "feed" then
    if not requireOnlineTarget(commandId, target) then return end
    local ok, message = setQbNeeds(target, payload.amount or 100, nil)
    commandResult(commandId, ok, { message = message, hunger = payload.amount or 100 })
    return
  end

  if action == "drink" then
    if not requireOnlineTarget(commandId, target) then return end
    local ok, message = setQbNeeds(target, nil, payload.amount or 100)
    commandResult(commandId, ok, { message = message, thirst = payload.amount or 100 })
    return
  end

  if action == "jail" then
    if not requireOnlineTarget(commandId, target) then return end
    local ok, message = setQbJail(target, payload.minutes or 10)
    commandResult(commandId, ok, { message = message, minutes = payload.minutes or 10 })
    return
  end

  if action == "unjail" then
    if not requireOnlineTarget(commandId, target) then return end
    local ok, message = setQbJail(target, 0)
    commandResult(commandId, ok, { message = message })
    return
  end

  if action == "clothing" then
    if not requireOnlineTarget(commandId, target) then return end
    TriggerClientEvent(Config.ClothingEvent, target)
    commandResult(commandId, true, { message = "Clothing menu opened" })
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
      TriggerClientEvent(Config.ScreenshotEvent, target, commandId, { quality = payload.quality or 0.55, watch = payload.watch == true })
      commandResult(commandId, target ~= nil, { message = "Screenshot requested through screenshot-basic client hook" })
    else
      commandResult(commandId, false, { message = "screenshot-basic is not started" })
    end
    return
  end

  if action == "announcement.txadmin" then
    TriggerClientEvent(Config.AnnounceEvent, -1, payload.style or "info", payload.duration or 8000, payload.message or "")
    commandResult(commandId, true, { message = "txAdmin-style announcement sent" })
    return
  end

  if action == "inventory.give" or action == "inventory.remove" then
    if not requireOnlineTarget(commandId, target) then return end
    local player = qbPlayer(target)
    if not player then
      commandResult(commandId, false, { message = "QBCore player not found" })
      return
    end
    local item = tostring(payload.item or "")
    local amount = tonumber(payload.amount or 1) or 1
    local slot = tonumber(payload.slot or 0)
    local ok = false
    if action == "inventory.give" then
      ok = player.Functions.AddItem(item, amount, slot ~= 0 and slot or false, payload.metadata or {})
      if ok then TriggerClientEvent(Config.InventoryItemBoxEvent, target, qbSharedItem(item), "add", amount) end
    else
      ok = player.Functions.RemoveItem(item, amount, slot ~= 0 and slot or false)
      if ok then TriggerClientEvent(Config.InventoryItemBoxEvent, target, qbSharedItem(item), "remove", amount) end
    end
    commandResult(commandId, ok == true, { message = ok and "Inventory updated" or "Inventory update failed. The player inventory may be full or the item/slot may be invalid.", item = item, amount = amount, slot = slot })
    return
  end

  if action == "inventory.clear" then
    if not requireOnlineTarget(commandId, target) then return end
    local player = qbPlayer(target)
    if not player then
      commandResult(commandId, false, { message = "QBCore player not found" })
      return
    end
    local ok = true
    if player.Functions.ClearInventory then
      player.Functions.ClearInventory()
    else
      player.PlayerData.items = {}
      player.Functions.SetPlayerData("items", {})
    end
    commandResult(commandId, ok, { message = "Inventory cleared" })
    return
  end

  if action == "character.phone.set" then
    if not requireOnlineTarget(commandId, target) then return end
    local player = qbPlayer(target)
    if not player then
      commandResult(commandId, false, { message = "QBCore player not found" })
      return
    end
    local charinfo = player.PlayerData.charinfo or {}
    charinfo.phone = tostring(payload.phone or "")
    player.Functions.SetPlayerData("charinfo", charinfo)
    commandResult(commandId, true, { message = "Phone number updated", phone = charinfo.phone })
    return
  end

  if action == "money.add" or action == "money.remove" or action == "money.set" then
    if not requireOnlineTarget(commandId, target) then return end
    local player = qbPlayer(target)
    if not player then
      commandResult(commandId, false, { message = "QBCore player not found" })
      return
    end
    local account = tostring(payload.account or "cash")
    local amount = tonumber(payload.amount or 0) or 0
    local reason = payload.reason or "A2 Panel"
    local ok = true
    if action == "money.add" then
      player.Functions.AddMoney(account, amount, reason)
    elseif action == "money.remove" then
      ok = player.Functions.RemoveMoney(account, amount, reason)
    else
      player.Functions.SetMoney(account, amount, reason)
    end
    commandResult(commandId, ok ~= false, { message = "Money updated", account = account, amount = amount })
    return
  end

  if action == "players.job.set" or action == "players.gang.set" then
    if not requireOnlineTarget(commandId, target) then return end
    local player = qbPlayer(target)
    if not player then
      commandResult(commandId, false, { message = "QBCore player not found" })
      return
    end
    local name = tostring(payload.name or "")
    local grade = tonumber(payload.grade) or payload.grade or 0
    local ok = false
    if action == "players.job.set" then
      ok = player.Functions.SetJob(name, grade)
    else
      ok = player.Functions.SetGang(name, grade)
    end
    commandResult(commandId, ok ~= false, { message = action == "players.job.set" and "Job updated" or "Gang updated", name = name, grade = grade })
    return
  end

  commandResult(commandId, false, { message = "Unknown A2 Panel command: " .. tostring(action) })
end

RegisterNetEvent("a2_panel_bridge:server:screenshot", function(commandId, dataUrl)
  if type(commandId) ~= "string" or type(dataUrl) ~= "string" then return end
  request("POST", "/api/bridge/screenshot", {
    commandId = commandId,
    dataUrl = dataUrl
  })
end)

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

AddEventHandler("playerConnecting", function(name, _setKickReason, deferrals)
  local src = source
  deferrals.defer()
  deferrals.update("Checking A2 Panel ban status...")
  checkBanForSource(src, function(banned, result)
    if banned then
      local reason = result and result.reason or "Banned by A2 Panel"
      deferrals.done("A2 Panel ban: " .. tostring(reason))
    else
      deferrals.done()
    end
  end)
end)

RegisterNetEvent("QBCore:Server:PlayerLoaded", function(player)
  if Config.Framework ~= "qbcore" and Config.Framework ~= "qbox" then return end
  local src = source
  local data = player and player.PlayerData or {}
  local ids = identifierMap(src)
  request("POST", "/api/bridge/ban-check", {
    citizenId = data.citizenid,
    identifiers = ids,
    license = ids.license,
    discord = ids.discord,
    steam = ids.steam,
    fivem = ids.fivem,
    ip = ids.ip,
    hwid = ids.hwid
  }, function(status, body)
    if status == 200 and body then
      local decoded = json.decode(body)
      if decoded and decoded.banned then
        DropPlayer(src, "A2 Panel ban: " .. tostring(decoded.reason or "Banned"))
      end
    end
  end)
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
