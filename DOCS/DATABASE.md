# Database

SQLite is managed through Prisma in `database/schema.prisma`; migrations live under `database/migrations`.

## Donation records

- `User.donorType` is an optional profile classification; registration assigns `INDIVIDUAL` to donors who do not select a type. It is `null` for non-donors.
- `Donation` is one pickup listing with a `donorId` foreign key to `User`. Individual donors, caterers, and food businesses use the same model and API.
- Food category, unit, and status are persisted as text for SQLite compatibility and constrained by shared Zod contracts.
- Optional coordinates are stored as a latitude/longitude pair alongside human-readable address and area. This can support later Leaflet rendering without a paid geocoding service.
- Donation records are retained after cancellation. Indexes support donor/status listing, category/status filtering, and expiration processing.

Current donation statuses: `AVAILABLE`, `CANCELLED`, `EXPIRED`. Reservation, pickup, delivery, and completion statuses are intentionally deferred until those workflows are implemented.
