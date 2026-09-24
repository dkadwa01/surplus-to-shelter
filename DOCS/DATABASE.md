# Database

SQLite is managed through Prisma in `database/schema.prisma`; migrations live under `database/migrations`.

## Donation records

- `User.donorType` is an optional profile classification; registration assigns `INDIVIDUAL` to donors who do not select a type. It is `null` for non-donors.
- `Donation` is one pickup listing with a `donorId` foreign key to `User`. Individual donors, caterers, and food businesses use the same model and API.
- Food category, unit, and status are persisted as text for SQLite compatibility and constrained by shared Zod contracts.
- Optional coordinates are stored as a latitude/longitude pair alongside human-readable address and area. This can support later Leaflet rendering without a paid geocoding service.
- Donation records are retained after cancellation. Indexes support donor/status listing, category/status filtering, and expiration processing.

## Recipient records

- `RecipientProfile` is a one-to-one extension of `User`, keyed by a unique `userId` foreign key with cascade delete. It stores organization, service location, optional capacity, food requirements, availability, active state, and verification status.
- Contact identity reuses the linked `User` full name, email, and phone rather than duplicating account values.
- `RecipientFoodCategory` normalizes accepted food categories and enforces one row per profile/category.
- New profile status defaults to `PENDING`; recipient profile APIs cannot edit verification status. The future verification module may own that transition.
- Discovery only returns `VERIFIED`, active profiles and omits exact street address and account contact details. A future matching record can reference a donation and recipient together without changing the donation lifecycle or adding reservation behavior here.

Current donation statuses: `AVAILABLE`, `CANCELLED`, `EXPIRED`. Reservation, pickup, delivery, and completion statuses are intentionally deferred until those workflows are implemented.
