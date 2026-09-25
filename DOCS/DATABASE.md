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

## Community collections

- `CommunityDonation` records the organizer, public title/description, area and optional coordinates, optional single category/unit target, deadline and lifecycle state.
- `CommunityContribution` records each household's food item separately with contributor, category, quantity/unit, use-by time, optional private note and withdrawal state. It does not copy or alter a standalone `Donation`, avoiding duplicate availability records until a future reservation/transfer lifecycle exists.
- `IndividualContributionThreshold` stores administrator-configured minimums by category and unit. No default amount is inserted. A community contribution below an individual-post minimum remains valid and is flagged as an exception.
- Totals aggregate only active contributions grouped by category and unit. Optional target progress uses only the target category/unit, so kilograms, servings and liters are never combined.
- Contributions and groups are retained; foreign keys restrict deletion to preserve history. Organizer and contributor identities are not exposed in discovery responses. Notes are returned only to their author.

## Verification records

- `VerificationRequest` belongs to a `User`; multiple requests preserve resubmission history. Participant type is captured from the account role at submission.
- A nullable unique `activeUserId` is set while a request is pending/under review and cleared on a terminal decision, preventing concurrent active requests per user while allowing resubmission after rejection.
- `VerificationRecord` is append-only status history with previous/new status, reviewer, optional reason, and timestamp. Requests cascade with the applicant; reviewer deletion preserves history and sets reviewer ID to null.
- Only minimal submitted information is stored: business name, driver vehicle type, and an optional note. Recipient organization/contact data reuses `RecipientProfile` and `User`. No document contents or public document URLs are stored.
- Recipient profile verification status follows admin outcomes (`VERIFIED`, `REJECTED`, `RESTRICTED`) and returns to `PENDING` on a valid resubmission. Other roles use their latest verification request as their trust state.
