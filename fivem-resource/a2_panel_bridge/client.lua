RegisterNetEvent("a2_panel_bridge:client:heal", function()
  local ped = PlayerPedId()
  SetEntityHealth(ped, 200)
  SetPedArmour(ped, 100)
end)

RegisterNetEvent("a2_panel_bridge:client:armor", function(amount)
  SetPedArmour(PlayerPedId(), tonumber(amount) or 100)
end)

RegisterNetEvent("a2_panel_bridge:client:revive", function()
  local ped = PlayerPedId()
  NetworkResurrectLocalPlayer(GetEntityCoords(ped), GetEntityHeading(ped), true, false)
  SetEntityHealth(ped, 200)
  ClearPedBloodDamage(ped)
end)

RegisterNetEvent("a2_panel_bridge:client:freeze", function(frozen)
  FreezeEntityPosition(PlayerPedId(), frozen == true)
end)

RegisterNetEvent("a2_panel_bridge:client:teleport", function(coords)
  if not coords then return end
  SetEntityCoords(PlayerPedId(), coords.x + 0.0, coords.y + 0.0, coords.z + 0.0, false, false, false, false)
end)

RegisterNetEvent("a2_panel_bridge:client:message", function(message)
  TriggerEvent("chat:addMessage", {
    color = { 183, 254, 26 },
    multiline = true,
    args = { "System", tostring(message) }
  })
end)

RegisterNetEvent("a2_panel_bridge:client:announce", function(style, duration, message)
  TriggerEvent("chat:addMessage", {
    color = style == "danger" and { 255, 80, 80 } or { 183, 254, 26 },
    multiline = true,
    args = { "txAdmin", tostring(message) }
  })
  BeginTextCommandThefeedPost("STRING")
  AddTextComponentSubstringPlayerName(tostring(message))
  EndTextCommandThefeedPostTicker(false, duration or 8000)
end)

RegisterNetEvent("a2_panel_bridge:client:screenshot", function(commandId, options)
  if GetResourceState("screenshot-basic") ~= "started" then
    return
  end
  exports["screenshot-basic"]:requestScreenshot({
    encoding = "jpg",
    quality = options and options.quality or 0.55
  }, function(data)
    TriggerServerEvent("a2_panel_bridge:server:screenshot", commandId, data)
  end)
end)
