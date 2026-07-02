# A2 Panel Permissions

Roles:

- Owner
- Super Admin
- Admin
- Moderator
- Support
- Viewer

Permissions:

- `dashboard.view`
- `players.view`
- `players.kick`
- `players.ban`
- `players.warn`
- `players.revive`
- `players.heal`
- `players.teleport`
- `players.screenshot`
- `players.inventory.view`
- `players.inventory.edit`
- `players.money.view`
- `players.money.edit`
- `players.job.edit`
- `players.gang.edit`
- `bans.view`
- `bans.create`
- `bans.delete`
- `reports.view`
- `reports.claim`
- `reports.close`
- `staff.view`
- `staff.create`
- `staff.edit`
- `staff.delete`
- `settings.view`
- `settings.edit`
- `console.use`
- `logs.view`
- `database.write`

Every protected backend route checks permission server-side. The frontend is only a convenience layer and is not trusted for authorization.
