# Backend Documentation

The Surplus-to-Shelter backend is a modular, type-safe REST API built with Node.js, Express, TypeScript, and Prisma ORM backed by SQLite.

---

## 1. Technology Stack

- **Runtime**: Node.js 20+ (ES Modules)
- **Web Framework**: Express 4.21
- **Language**: TypeScript 5.9
- **Database & ORM**: SQLite with Prisma Client 6.19
- **Validation**: Zod 3.25 (shared schemas from `@surplus/shared`)
- **Security & Utilities**: `cors`, `dotenv`, Node.js native `crypto` (scrypt password hashing and SHA-256 session token hashing)

---

## 2. Entry Point & Server Bootstrap

The backend entry point is located at [`src/backend/src/server.ts`](file:///c:/surplus-to-shelter/src/backend/src/server.ts). It imports the configured Express instance from [`src/backend/src/app.ts`](file:///c:/surplus-to-shelter/src/backend/src/app.ts) and binds to the specified port:

```typescript
// server.ts
import { app } from "./app.js";
import { env } from "./config/env.js";

app.listen(env.PORT, () => {
  console.log(`Backend listening on http://localhost:${env.PORT}`);
});
```

### Express Application Setup (`src/backend/src/app.ts`)
- Disables `x-powered-by` header.
- Configures CORS with `origin: env.FRONTEND_ORIGIN` and `credentials: true`.
- Parses incoming JSON payloads up to `32kb`.
- Mounts feature routers under `/api/*`.
- Registers a centralized error handler as the terminal middleware.

---

## 3. Configuration & Environment Variables

Environment variables are defined in `.env` and loaded/validated via [`src/backend/src/config/env.ts`](file:///c:/surplus-to-shelter/src/backend/src/config/env.ts) using Zod:

| Variable | Type | Default | Description |
|---|---|---|---|
| `PORT` | Number | `4000` | Port for the Express server. |
| `FRONTEND_ORIGIN` | String | `http://localhost:5173` | Allowed CORS origin for frontend requests. |
| `DATABASE_URL` | String | `file:./dev.db` | SQLite connection URL for Prisma. |
| `COOKIE_SECRET` | String | (Required) | Secret used for cookie signing. |
| `SESSION_TTL_HOURS` | Number | `72` | Session lifetime in hours before expiration. |
| `LOCATION_SEARCH_URL`| String | `https://nominatim.openstreetmap.org/search` | Nominatim-compatible search endpoint. |

---

## 4. Authentication & Authorization Middleware

Located in [`src/backend/src/middleware/auth.middleware.ts`](file:///c:/surplus-to-shelter/src/backend/src/middleware/auth.middleware.ts) and [`src/backend/src/modules/verification/verification.middleware.ts`](file:///c:/surplus-to-shelter/src/backend/src/modules/verification/verification.middleware.ts):

### 1. `requireAuth`
- Extracts session token from the signed HTTP-only cookie `surplus_session`.
- Computes SHA-256 hash of the token and queries the `AuthSession` table.
- Verifies session is unexpired (`expiresAt > new Date()`).
- Attaches authenticated user object (`id`, `fullName`, `email`, `role`, `donorType`) to `request.authUser`.
- Throws HTTP 401 `UNAUTHORIZED` if invalid or missing.

### 2. `requireRole(...roles: Role[])`
- Checks whether `request.authUser.role` matches one of the specified roles (`DONOR`, `RECIPIENT`, `DRIVER`, `ADMIN`).
- Throws HTTP 403 `FORBIDDEN` if the user's role is not authorized.

### 3. `requireVerifiedUser`
- Checks the user's current trust state in the verification module via `isUserVerified(userId)`.
- Rejects unverified participants on sensitive endpoints with HTTP 403 `VERIFICATION_REQUIRED`.

---

## 5. Main Backend Modules and API Endpoints

All routes are mounted under `/api`.

### 5.1. Authentication (`/api/auth`)
| Method | Path | Auth / Role | Description |
|---|---|---|---|
| `POST` | `/api/auth/register` | Public | Registers a new user (`fullName`, `email`, `password`, `role`, optional `phone`, optional `donorType`). Sets session cookie. |
| `POST` | `/api/auth/login` | Public | Authenticates credentials (`email`, `password`) and sets session cookie. |
| `POST` | `/api/auth/logout` | Authenticated | Deletes the active session record and clears the cookie. |
| `GET` | `/api/auth/me` | Authenticated | Returns the authenticated user's profile and active session state. |

### 5.2. Donations (`/api/donations`)
| Method | Path | Auth / Role | Description |
|---|---|---|---|
| `POST` | `/api/donations` | `DONOR` | Creates a new surplus food listing (`AVAILABLE`). Validates future use-by time and positive quantities. |
| `GET` | `/api/donations` | `DONOR`, `ADMIN` | Lists donations with optional `status` and `category` filters. Donors see only their own listings; admins see all. |
| `GET` | `/api/donations/:id` | `DONOR`, `ADMIN` | Retrieves one donation by ID (scoped to owner; other donor IDs return 404). |
| `PUT` | `/api/donations/:id` | `DONOR`, `ADMIN` | Updates editable fields of an unexpired, available listing. |
| `POST` | `/api/donations/:id/cancel` | `DONOR`, `ADMIN` | Transitions listing status to `CANCELLED`. Record is retained. |

### 5.3. Recipients (`/api/recipients`)
| Method | Path | Auth / Role | Description |
|---|---|---|---|
| `POST` | `/api/recipients` | `RECIPIENT` | Creates recipient organization profile with default `PENDING` verification status. |
| `GET` | `/api/recipients/me` | `RECIPIENT` | Retrieves the authenticated recipient's full profile including private address. |
| `PATCH` | `/api/recipients/me` | `RECIPIENT` | Updates profile details (capacity, accepted categories, notes). |
| `GET` | `/api/recipients` | `DONOR`, `DRIVER`, `ADMIN` | Discovers verified, active recipient profiles matching area/category filters. Sensitive contact details are omitted. |

### 5.4. Verification (`/api/verification`)
| Method | Path | Auth / Role | Description |
|---|---|---|---|
| `POST` | `/api/verification/requests` | `DONOR`, `RECIPIENT`, `DRIVER` | Submits verification metadata. Enforces one active request per user. |
| `GET` | `/api/verification/me` | Authenticated | Returns current participant's latest verification status and history. |
| `GET` | `/api/verification/admin/requests`| `ADMIN` | Lists verification requests with optional status filter. |
| `GET` | `/api/verification/admin/requests/:id`| `ADMIN` | Gets detailed applicant metadata and verification timeline. |
| `PATCH` | `/api/verification/admin/requests/:id`| `ADMIN` | Reviews request (`UNDER_REVIEW`, `VERIFIED`, `REJECTED`, `SUSPENDED`). Requires reason for rejection/suspension. |

### 5.5. Community Donations (`/api/community-donations`)
| Method | Path | Auth / Role | Description |
|---|---|---|---|
| `GET` | `/api/community-donations` | Authenticated | Lists open and target-reached collective collections. |
| `GET` | `/api/community-donations/:id` | Authenticated | Gets collection details, progress toward target, and contribution summaries. |
| `POST` | `/api/community-donations` | Verified `DONOR` | Creates a new community food drive with title, area, deadline, and optional target. |
| `POST` | `/api/community-donations/:id/contributions` | Verified `DONOR` | Contributes an individual surplus portion to an open collection. |
| `GET` | `/api/community-donations/contributions/:id` | Authenticated Owner | Reads user's own contribution details. |
| `PUT` | `/api/community-donations/contributions/:id` | Verified Owner | Edits contribution quantity/details while collection is open. |
| `POST` | `/api/community-donations/contributions/:id/withdraw` | Verified Owner | Withdraws contribution while collection is open. |
| `POST` | `/api/community-donations/:id/close` | Verified Organizer | Manually closes an open or target-reached collection. |
| `POST` | `/api/community-donations/:id/cancel` | Verified Organizer | Cancels an open collection. |
| `GET` | `/api/community-donations/thresholds` | Authenticated | Lists minimum threshold quantities by food category and unit. |
| `PUT` | `/api/community-donations/admin/thresholds` | `ADMIN` | Configures individual-listing minimum threshold for a category/unit. |

### 5.6. Matching Engine (`/api/matching`)
| Method | Path | Auth / Role | Description |
|---|---|---|---|
| `GET` | `/api/matching/donations/:id/recipients` | `DONOR` (Owner) | Evaluates and lists suitable verified recipient profiles for an available donation. |
| `GET` | `/api/matching/community-donations/:id/recipients` | `DONOR` (Organizer) | Evaluates per-item matches for closed or target-reached collective contributions. |
| `GET` | `/api/matching/recipients/me/donations` | Verified `RECIPIENT` | Evaluates and lists suitable individual donations and collective contributions for the recipient. |
| `GET` | `/api/matching/details/:sourceType/:sourceId/recipients/:recipientProfileId` | Source or Profile Owner | Returns fine-grained match explanation, compatibility checks, factor scores (0–100), and warnings. |

### 5.7. Dashboard & Analytics (`/api/dashboard`)
| Method | Path | Auth / Role | Description |
|---|---|---|---|
| `GET` | `/api/dashboard/summary` | Authenticated | Aggregates role-tailored metrics, active listings, matching counts, community totals, and map points on demand. |

### 5.8. Location Search (`/api/locations`)
| Method | Path | Auth / Role | Description |
|---|---|---|---|
| `GET` | `/api/locations/search?q=...` | Authenticated | Performs geocoding search via OpenStreetMap Nominatim with server-side caching and rate-limiting. |

### 5.9. Realtime & Health
| Method | Path | Auth / Role | Description |
|---|---|---|---|
| `GET` | `/api/health` | Public | Health-check endpoint reporting server status and uptime. |
| `GET` | `/api/events` | Authenticated | Server-Sent Events (SSE) stream for connection keep-alive and notifications. |

---

## 6. Validation & Error Handling

### Shared Zod Validation
All route handlers validate input data using schemas imported from `@surplus/shared`. Unmatched inputs fail before touching database transactions:
```typescript
const parsed = CreateDonationRequestSchema.safeParse(request.body);
if (!parsed.success) {
  throw new ApiError(400, "INVALID_INPUT", parsed.error.issues[0]?.message);
}
```

### Unified Error Model ([`src/backend/src/shared/api-error.ts`](file:///c:/surplus-to-shelter/src/backend/src/shared/api-error.ts))
Custom `ApiError` class standardizes status codes and machine-readable error codes:
- `400 INVALID_INPUT`: Malformed schema or validation failure.
- `401 UNAUTHORIZED`: Missing, invalid, or expired session.
- `403 FORBIDDEN` / `VERIFICATION_REQUIRED`: Insufficient permissions or unverified status.
- `404 NOT_FOUND`: Resource does not exist or user lacks ownership.
- `409 INVALID_STATE`: Conflicting transition, duplicate active request, or expired item.
- `500 INTERNAL_ERROR`: Unexpected server exceptions.

All route handlers are wrapped in `asyncHandler(...)` to forward rejected promises directly to `errorHandler`.

---

## 7. Database Access & Prisma Architecture

Database queries execute through the singleton Prisma client in [`src/backend/src/config/prisma.ts`](file:///c:/surplus-to-shelter/src/backend/src/config/prisma.ts):

- **Data Models**:
  - `User`, `AuthSession`
  - `Donation`
  - `RecipientProfile`, `RecipientFoodCategory`
  - `VerificationRequest`, `VerificationRecord`
  - `CommunityDonation`, `CommunityContribution`, `IndividualContributionThreshold`
- **Transactions**: Complex multi-table writes (such as verification state updates with record creation, or community donation closures) use `prisma.$transaction(...)`.
- **Integrity**: Deletions on critical parents use `onDelete: Restrict` or `onDelete: Cascade` where appropriate. Foreign keys and indexes optimize query execution for filtering by status, category, and expiration date.

---

## 8. Development & Testing Commands

Run from repository root:

```sh
# Start backend in watch mode (compiles shared package first)
npm run dev:backend

# Run TypeScript typechecks
npm --workspace @surplus/backend run typecheck

# Run automated integration test suite
npm test
```
