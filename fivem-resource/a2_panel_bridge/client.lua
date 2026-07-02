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
    args = { "A2 Panel", tostring(message) }
  })
end)

RegisterNetEvent("a2_panel_bridge:client:announce", function(style, duration, message)
  TriggerEvent("chat:addMessage", {
    color = style == "danger" and { 255, 80, 80 } or { 183, 254, 26 },
    multiline = true,
    args = { "A2 Panel", tostring(message) }
  })
  BeginTextCommandThefeedPost("STRING")
  AddTextComponentSubstringPlayerName(tostring(message))
  EndTextCommandThefeedPostTicker(false, duration or 8000)
end)

RegisterNetEvent("a2_panel_bridge:client:screenshot", function(commandId)
  if GetResourceState("screenshot-basic") ~= "started" then
    TriggerEvent("chat:addMessage", { args = { "A2 Panel", "Screenshot requested, but screenshot-basic is not started." } })
    return
  end
  TriggerEvent("chat:addMessage", { args = { "A2 Panel", "Screenshot request received: " .. tostring(commandId) } })
  -- Add your screenshot-basic upload endpoint here if you want persistent screenshot history.
end)
