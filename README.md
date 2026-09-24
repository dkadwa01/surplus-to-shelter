# Surplus to Shelter

A food-rescue coordination platform for connecting time-sensitive surplus food with eligible local organizations.

## Stack

- React 18, Vite, TypeScript, and vanilla CSS
- Express and TypeScript
- Prisma ORM with SQLite
- Zod contracts shared by frontend and backend
- Leaflet with OpenStreetMap
- Server-Sent Events foundation

## Requirements and setup

- Node.js 20 or newer
- npm 10 or newer

```powershell
Copy-Item .env.example .env
npm install
npm run prisma:generate
npm run db:deploy
```

The local SQLite file is `database/dev.db`.

## Development

Start both services with `npm run dev`, or run `npm run dev:frontend` / `npm run dev:backend` separately.

- Frontend: http://localhost:5173
- Backend health: http://localhost:4000/api/health

## Authentication API

- `POST /api/auth/register` — creates a DONOR, RECIPIENT, or DRIVER account and starts a session.
- `POST /api/auth/login` — authenticates and starts a session.
- `POST /api/auth/logout` — revokes the current session.
- `GET /api/auth/me` — returns the current user; requires a valid session.

Sessions use an HttpOnly, SameSite=Lax cookie. Passwords are stored as scrypt hashes. ADMIN cannot be selected during public registration. To provision the first administrator, set `BOOTSTRAP_ADMIN_NAME`, `BOOTSTRAP_ADMIN_EMAIL`, and `BOOTSTRAP_ADMIN_PASSWORD` in the local `.env`, then run `npm run auth:bootstrap-admin`. The command refuses to promote an existing non-admin account.

## Checks

```powershell
npm run prisma:validate
npm run prisma:generate
npm run typecheck
npm run build
npm test
```

For schema changes during development, create/apply migrations with `npm run db:migrate -- --name descriptive_name`.
