# Surplus to Shelter

A food-rescue coordination platform foundation for connecting time-sensitive surplus food with eligible local organizations.

## Stack

- React 18, Vite, TypeScript, and vanilla CSS
- Express and TypeScript
- Prisma ORM with SQLite
- Zod contracts shared by frontend and backend
- Leaflet with OpenStreetMap (map components can be added as features are implemented)
- Server-Sent Events for future server-to-client updates

## Requirements

- Node.js 20 or newer
- npm 10 or newer

## Setup

```powershell
Copy-Item .env.example .env
npm install
npm run prisma:generate
```

The initial SQLite database is configured at `database/dev.db`. No application domain models have been added yet.

## Development

Run both frontend and backend:

```powershell
npm run dev
```

Or run either service separately:

```powershell
npm run dev:frontend
npm run dev:backend
```

- Frontend: http://localhost:5173
- Backend health: http://localhost:4000/api/health
- Frontend health status uses the Vite `/api` development proxy.

## Checks

```powershell
npm run typecheck
npm run build
npm run prisma:validate
npm run prisma:generate
```

## Environment

Copy `.env.example` to `.env`.

- `DATABASE_URL`: SQLite URL; default `file:./dev.db` resolves beside `database/schema.prisma`.
- `PORT`: Express port, default `4000`.
- `FRONTEND_ORIGIN`: allowed development frontend origin, default `http://localhost:5173`.

This repository currently contains only the technical foundation and health endpoint; product modules will be developed separately.
