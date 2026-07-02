# A2 Panel Install Guide

## Requirements

- Node.js LTS 20 or newer.
- MySQL or MariaDB.
- HeidiSQL for database administration.
- FiveM server on Windows VPS or Linux VPS.
- Optional: PM2, NSSM, or a reverse proxy such as Nginx.

## Database Setup

1. Create a database named `a2_panel`.
2. Import `database/migrations.sql`.
3. Import `database/seed.sql`.
4. Confirm `a2_users`, `a2_roles`, and `a2_permissions` exist.

The migration only creates `a2_*` tables and does not modify QBCore or ESX tables.

## Backend Setup

```bash
cd backend
npm install
cp .env.example .env
npm run dev
```

Production:

```bash
npm run build
npm start
```

Edit `backend/.env` for MySQL, JWT, CORS, and bridge settings.

## Frontend Setup

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

Production:

```bash
npm run build
```

Set `VITE_API_URL` to the backend API URL.

## FiveM Resource Setup

1. Copy `fivem-resource/a2_panel_bridge` to your FiveM `resources` folder.
2. Edit `config.lua`.
3. Add `ensure a2_panel_bridge` to `server.cfg`.
4. Restart the server or run `refresh` then `ensure a2_panel_bridge`.

## Netlify Deployment

Deploy only `frontend/dist`.

Set Netlify environment variable:

```env
VITE_API_URL=https://your-backend-domain.example.com
```

The backend must run on a VPS. Add the Netlify URL to backend `FRONTEND_URL`.

## Windows VPS

Use PM2:

```bash
npm install -g pm2
pm2 start backend/dist/server.js --name a2-panel-backend
pm2 save
```

Or use NSSM to run `node backend/dist/server.js` as a Windows service.

Open firewall port `3001` or proxy it through HTTPS.

## Login

- Username: `admin`
- Password: `admin`

Change the password immediately from A2 Panel staff settings or by replacing the seeded hash.
