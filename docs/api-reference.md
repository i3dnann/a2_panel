# A2 Panel API Reference

Base URL: `/api`

All staff routes require `Authorization: Bearer <jwt>` except login and bridge routes.

## Authentication

- `POST /auth/login`
- `POST /auth/logout`
- `GET /auth/me`
- `POST /auth/change-password`

## Dashboard

- `GET /dashboard/stats`
- `GET /dashboard/activity`
- `GET /server/status`

## Players

- `GET /players/online`
- `GET /players/search?q=...`
- `GET /players/:id`
- `POST /players/:id/kick`
- `POST /players/:id/ban`
- `POST /players/:id/warn`
- `POST /players/:id/revive`
- `POST /players/:id/heal`
- `POST /players/:id/freeze`
- `POST /players/:id/bring`
- `POST /players/:id/goto`
- `POST /players/:id/message`
- `POST /players/:id/screenshot`
- `GET /players/:id/inventory`
- `POST /players/:id/inventory/give`
- `POST /players/:id/inventory/remove`
- `GET /players/:id/money`
- `POST /players/:id/money/set`
- `POST /players/:id/job`
- `POST /players/:id/gang`

## Bans

- `GET /bans`
- `GET /bans/export`
- `POST /bans`
- `PATCH /bans/:id`
- `DELETE /bans/:id`
- `POST /bans/:id/unban`

## Warnings

- `GET /warnings`
- `POST /warnings`
- `DELETE /warnings/:id`

## Reports

- `GET /reports`
- `POST /reports`
- `PATCH /reports/:id/claim`
- `PATCH /reports/:id/close`
- `POST /reports/:id/note`

## Staff

- `GET /staff`
- `POST /staff`
- `PATCH /staff/:id`
- `DELETE /staff/:id`
- `POST /staff/:id/reset-password`

## Logs

- `GET /logs`
- `GET /logs/export`

## Settings

- `GET /settings`
- `PATCH /settings`

## Console

- `POST /console/command`

## Bridge

Bridge routes require `x-a2-bridge-secret`.

- `POST /bridge/heartbeat`
- `POST /bridge/players`
- `POST /bridge/event`
- `GET /bridge/commands`
- `POST /bridge/command-result`

## WebSocket Events

- `server.status`
- `players.updated`
- `player.joined`
- `player.left`
- `report.created`
- `report.updated`
- `admin.action`
- `ban.created`
- `warning.created`
- `notification.created`
