# Architecture and Technical Decisions

This document records the key architectural, technical, and domain decisions implemented in the Surplus-to-Shelter platform. Every decision documented here directly reflects the current codebase.

---

## 1. Monorepo Architecture with Shared Contracts (`@surplus/shared`)

- **Context**: The project consists of a React frontend and an Express backend that share common business domain models, enum values, validation constraints, and API payloads.
- **Decision**: Implemented an npm workspaces monorepo containing `src/frontend`, `src/backend`, and `src/shared`. All Zod schemas and TypeScript types are maintained in `@surplus/shared`.
- **Rationale**:
  - Eliminates client-server schema drift.
  - Ensures runtime input validation on the backend while providing compile-time type safety across both frontend and backend.
  - Avoids code duplication and manual API contract synchronization.

---

## 2. Persistence: SQLite with Prisma ORM

- **Context**: The hackathon prototype requires fast local setup, zero-friction developer onboarding, relational data integrity, and ACID transaction support.
- **Decision**: Selected SQLite managed through Prisma ORM (`database/schema.prisma`) with versioned SQL migrations (`database/migrations`).
- **Rationale**:
  - Requires no external database daemon or container installation (`dev.db` file-based).
  - Prisma generates type-safe database client queries and enforces relational foreign keys with explicit cascade/restrict rules.
  - Supports atomic multi-table transactions via `prisma.$transaction(...)` for operations like verification reviews, community donation closures, and threshold adjustments.

---

## 3. Session-Based Authentication over Stateless JWTs

- **Context**: User sessions must be secure against cross-site scripting (XSS), support instant logout revocation, and protect session tokens.
- **Decision**: Implemented server-side session management using signed, HTTP-only, secure cookies with SHA-256 token hashing in the [`AuthSession`](file:///c:/surplus-to-shelter/database/schema.prisma#L30-L39) table.
- **Rationale**:
  - HTTP-only cookies prevent client-side JavaScript access, eliminating XSS token theft.
  - Storing only the SHA-256 hash in SQLite ensures that database inspection cannot compromise active sessions.
  - Unlike stateless JWTs, sessions can be revoked immediately upon logout or account suspension by deleting the session row.
  - Password hashes use Node.js native `crypto.scrypt` with cryptographic salts.

---

## 4. On-Demand Matching Engine vs. Persistent Allocation Queues

- **Context**: Food donors and recipient organizations need to find compatible partners based on food category, quantity, distance, and use-by urgency.
- **Decision**: The matching engine ([`src/backend/src/modules/matching`](file:///c:/surplus-to-shelter/src/backend/src/modules/matching)) is a deterministic, read-only calculator that computes suggestions on demand. It does not persist match records or automatically lock/reserve donations in this checkout.
- **Rationale**:
  - Avoids distributed race conditions and complex reservation lock timeouts in the prototype.
  - Always reflects real-time status: if food expires or a recipient’s capacity changes, matching feeds update instantly.
  - Keeps match computation transparent and explainable through factor scores (0–100) and human-readable tags.

---

## 5. Strict Unit Safety and Conservative Conversion

- **Context**: Food listings use diverse measurement units (`KG`, `GRAMS`, `SERVINGS`, `LITRES`, `ITEMS`, `PACKAGES`), and shelters specify capacity limits in specific units.
- **Decision**: The platform strictly prevents arbitrary unit conversions.
- **Rationale**:
  - `SERVINGS` are never assumed or converted into `KG` or `MEALS` because meal density and serving sizes vary dramatically.
  - Only exact metric conversions (`KG` ↔ `GRAMS`) are performed where mathematically precise.
  - If a recipient specifies capacity in `KG` and a donation is offered in `SERVINGS`, the capacity check is marked incompatible or unconstrained to prevent food spoilage or shelter overflow.

---

## 6. OpenStreetMap & Leaflet with Submit-Only Geocoding

- **Context**: The app needs location search, distance estimation, and map previews without incurring commercial API costs or violating third-party rate limits.
- **Decision**: Integrated OpenStreetMap Nominatim for geocoding through an authenticated backend proxy (`/api/locations/search`), visualized using Leaflet and React-Leaflet with OpenStreetMap tiles.
- **Rationale**:
  - **Policy Compliance**: Search only executes upon explicit form submission (never on-keystroke autocomplete), respecting the OpenStreetMap Foundation Nominatim usage policy.
  - **Rate Limiting & Caching**: The backend caches query results in memory and serializes upstream requests to a maximum of 1 request per 1.1 seconds.
  - **Zero Cost**: Completely free and open-source; requires no paid API keys.
  - **Graceful Degradation**: Latitude/longitude coordinates are optional. If geocoding fails, users can save plain-text addresses.
  - **Distance**: Calculated as straight-line distance using the Haversine formula; no false claims of driving routes or turn-by-turn navigation are made.

---

## 7. Community Collections with Below-Threshold Allowance

- **Context**: Commercial donors typically donate in bulk, whereas individual households or event hosts may have small quantities of surplus food that would otherwise be rejected.
- **Decision**: Created the Community Donations module ([`CommunityDonation`](file:///c:/surplus-to-shelter/database/schema.prisma#L137-L158) & [`CommunityContribution`](file:///c:/surplus-to-shelter/database/schema.prisma#L160-L180)). Organizers create pooled drives where multiple donors contribute portions toward a collective target.
- **Rationale**:
  - Administrators configure minimum posting thresholds (`IndividualContributionThreshold`) for standalone donations to ensure operational viability.
  - Community contributions allow below-threshold portions as explicit exceptions, enabling local community pooling without lowering commercial listing standards.
  - Individual contributions remain attributed to their author, and can be edited or withdrawn while the collection remains `OPEN`.

---

## 8. Explicit Support for Wedding and Event Caterers

- **Context**: Event and wedding caterers produce high-volume, highly perishable prepared meals that require rapid rescue.
- **Decision**: Built explicit support for caterers in user registration, donor categorization (`donorType: "CATERER"`), verification requests, and bulk matching.
- **Rationale**:
  - Caterers can register directly, complete organization verification, list prepared meals with preparation time and use-by limits, or contribute bulk portions to community drives.
  - The matching engine prioritizes near-expiry prepared meals by boosting urgency factor scores.

---

## 9. Two-Step Verification with Append-Only Audit History

- **Context**: Food safety and recipient trust require participant vetting without storing sensitive identity documents or PII.
- **Decision**: Implemented an organization-metadata verification workflow ([`VerificationRequest`](file:///c:/surplus-to-shelter/database/schema.prisma#L102-L120) & [`VerificationRecord`](file:///c:/surplus-to-shelter/database/schema.prisma#L122-L135)).
- **Rationale**:
  - Participants submit business or vehicle details without uploading raw identity document files, avoiding cloud storage complexity and privacy liabilities.
  - Enforces one active request per user using the unique constraint `activeUserId`.
  - Administrative review actions (`UNDER_REVIEW`, `VERIFIED`, `REJECTED`, `SUSPENDED`) require documented reasons for rejections/suspensions and write to an immutable, append-only history log.
  - Recipient profile trust states synchronize automatically with administrative decisions.

---

## 10. Privacy-First Discovery & IDOR Protection

- **Context**: Shelters, safe-havens, and donors require protection against public enumeration and unwanted physical exposure.
- **Decision**:
  - Public and cross-party discovery endpoints omit exact street addresses, contact names, and direct phone numbers; only general service areas and verified organization names are displayed.
  - Donor records are strictly owner-scoped. Requests attempting to access another user's donation ID return HTTP 404 (`NOT_FOUND`) rather than 403 (`FORBIDDEN`) to prevent resource enumeration.

---

## 11. Role-Aware Operational Dashboard without Heavy Analytics Pipelines

- **Context**: Users require visibility into active listings, suitable matches, and platform impact.
- **Decision**: Implemented `GET /api/dashboard/summary` which computes role-tailored summaries dynamically from operational tables.
- **Rationale**:
  - Avoids separate data warehouse tables or asynchronous ETL cron jobs.
  - Delivers real-time counts of active listings, community drive progress, and compatible matches directly from the database.
  - Accurately reports untracked metrics (such as completed delivery counts in checkouts where dispatch is not yet connected) instead of inventing placeholder statistics.
