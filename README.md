# A2 Panel

A2 Panel is a full-stack FiveM web administration system with a React/Vite frontend, Node/Express backend, MySQL/MariaDB storage, and a FiveM bridge resource named `a2_panel_bridge`.

Default demo login:

- Username: `admin`
- Password: `admin`

Change this password immediately after installing on a real server.

## Features

- Premium dark A2 Panel dashboard with green `#b7fe1a` accent.
- JWT login, bcrypt password hashing, role permissions, account lockout, audit logging, rate-limited auth.
- MySQL/MariaDB tables under the `a2_` prefix only, safe for QBCore/ESX databases.
- Online players, offline player search, bans, warnings, reports, staff, logs, settings, vehicles, inventory, money, jobs/gangs, Discord webhooks, console, announcements, and live view.
- FiveM bridge heartbeat, live player sync, `/report`, command polling, kick, ban drop, revive, heal, freeze, bring, message, announce, screenshot-basic detection, and safe missing-framework handling.
- WebSocket events for live updates and notifications.
- Demo fallback mode so the backend still runs and `admin/admin` works before MySQL is configured.

## Install And Run

```bash
npm install
npm run dev
```

Or run each app:

```bash
cd backend
cp .env.example .env
npm install
npm run dev
```

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

Open the frontend at `http://localhost:5173` and log in with `admin / admin`.

## Database

Create a MySQL/MariaDB database named `a2_panel`, then import:

1. `database/migrations.sql`
2. `database/seed.sql`

Configure credentials in `backend/.env`:

```env
DATABASE_HOST=127.0.0.1
DATABASE_PORT=3306
DATABASE_USER=root
DATABASE_PASSWORD=
DATABASE_NAME=a2_panel
```

HeidiSQL is only the client. A2 Panel connects through the backend using the values above.

## FiveM Bridge

Copy `fivem-resource/a2_panel_bridge` into your server resources folder, edit `config.lua`, then add this to `server.cfg`:

```cfg
ensure a2_panel_bridge
```

Make sure `Config.BackendUrl` and `Config.SharedSecret` match `backend/.env`.

## Netlify

Only deploy the frontend to Netlify. Set:

```env
VITE_API_URL=https://your-vps-api.example.com
```

The backend must run on a VPS or dedicated Node host. Netlify cannot host the Express API or connect privately to your FiveM/MySQL server.

## Troubleshooting

- Database connection failed: check `DATABASE_*` values and that MySQL accepts the backend host.
- CORS blocked: set `FRONTEND_URL` in backend `.env` to your local or Netlify frontend URL.
- FiveM bridge offline: start `a2_panel_bridge`, verify `Config.BackendUrl`, open firewall/reverse proxy access to the backend.
- Invalid shared secret: `FIVEM_SHARED_SECRET` must match `Config.SharedSecret`.
- Table not found: A2 Panel detects missing QBCore/ESX tables and shows module status instead of crashing.
- Netlify frontend cannot reach backend: use a public HTTPS backend URL and configure CORS.

## Security Checklist

- Change `admin/admin`.
- Replace `JWT_SECRET` and `FIVEM_SHARED_SECRET`.
- Use HTTPS for public backend access.
- Restrict database access to trusted hosts.
- Do not expose `.env` files or database credentials.
- Review staff roles and remove unused accounts.
- Keep audit logs enabled.

More documentation is in `docs/`.
