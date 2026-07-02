# A2 Panel Database Mapping

A2 Panel owns only `a2_*` tables. It reads common FiveM framework tables when present.

## QBCore Defaults

`players`

- `citizenid`
- `license`
- `name`
- `money` JSON
- `charinfo` JSON
- `job` JSON
- `gang` JSON
- `metadata` JSON

`player_vehicles`

- `citizenid`
- `plate`
- `vehicle`
- `garage`
- `state`
- `mods`

## ESX Defaults

`users`

- `identifier`
- `firstname`
- `lastname`
- `accounts` JSON
- `job`
- `job_grade`
- `inventory` JSON
- `loadout` JSON

`owned_vehicles`

- `owner`
- `plate`
- `vehicle`
- `stored`

## Missing Tables

The backend checks table existence before reading framework data. Missing tables return module status such as `missing`, `offline`, or `demo`; the backend should not crash.

## Custom Servers

Use the Settings page `tableMapping` field or update `backend/src/services/dataService.ts` if your schema is heavily customized.
