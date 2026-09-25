# System Architecture

Surplus-to-Shelter is a full-stack platform built to connect surplus food donors (households, restaurants, caterers, and food businesses) with verified recipient organizations (shelters, community kitchens, food banks, and NGOs).

---

## 1. High-Level System Architecture

The application is structured as a monorepo using npm workspaces, separating concerns between client, server, and shared contracts:

```text
User (Browser)
      ↓
React Frontend (Vite + TypeScript + Leaflet)
      ↓ HTTP Fetch with Credentials (JSON / Cookies)
Express Backend API (Node.js + TypeScript)
      ↓ Validation (Shared Zod Schemas) & Auth Middleware
Business Modules (Auth, Donations, Recipients, Verification, Community, Matching, Dashboard)
      ↓
Prisma ORM Client
      ↓
SQLite Database (dev.db)
```

### Component Roles

1. **Frontend (`@surplus/frontend`)**: A Single Page Application (SPA) built with React 18, Vite, React Router, and Leaflet for OpenStreetMap previews.
2. **Backend (`@surplus/backend`)**: An Express REST API written in TypeScript, exposing versioned `/api/*` routes.
3. **Shared Contracts (`@surplus/shared`)**: Shared TypeScript types and Zod schemas imported by both frontend and backend to guarantee end-to-end data integrity.
4. **Database (`database/schema.prisma`)**: Local SQLite relational database accessed via Prisma ORM for schema definition, type-safe queries, and transactional migrations.

---

## 2. Monorepo & Workspace Structure

```text
surplus-to-shelter/
├── database/
│   ├── schema.prisma          # Prisma schema definition
│   └── migrations/            # Version-controlled SQL migrations
├── src/
│   ├── shared/                # @surplus/shared: Zod schemas & TypeScript types
│   │   ├── types/             # Domain schemas (auth, donation, recipient, etc.)
│   │   └── validation/        # Validation helpers
│   ├── backend/               # @surplus/backend: Express REST API
│   │   ├── src/
│   │   │   ├── config/        # Environment and Prisma client singleton
│   │   │   ├── middleware/    # Auth, role authorization, and validation guards
│   │   │   ├── modules/       # Domain business logic and route handlers
│   │   │   └── shared/        # Error handlers and utility helpers
│   │   └── test/              # Integration and end-to-end test suites
│   └── frontend/              # @surplus/frontend: React 18 + Vite SPA
│       ├── src/
│       │   ├── app/           # App root, router, and navigation shell
│       │   ├── components/    # Reusable UI widgets (LocationMap, LocationSearch)
│       │   ├── features/      # Feature pages and HTTP API clients
│       │   └── styles.css     # Responsive design system
└── DOCS/                      # Technical documentation
```

---

## 3. Communication & Data Flow

- **Protocol**: HTTP/1.1 REST API over JSON.
- **Client-to-Server**: Frontend features make asynchronous requests via native `fetch` with `credentials: "include"`.
- **Response Format**: Successful responses return typed JSON payloads. Errors return a unified shape:
  ```json
  {
    "error": {
      "code": "INVALID_INPUT",
      "message": "Human-readable error description",
      "details": {}
    }
  }
  ```
- **Realtime Updates**: Server-Sent Events (SSE) route `/api/events` provides a streaming heartbeat and event notifications.

---

## 4. Authentication & Security Architecture

1. **Session-Based Authentication**:
   - HTTP-only, secure, `SameSite=Lax` cookies store an opaque session identifier.
   - Session identifiers are hashed using SHA-256 before storage in the [`AuthSession`](file:///c:/surplus-to-shelter/database/schema.prisma#L30-L39) table, preventing token leak from raw database dumps.
   - Passwords are salted and hashed using Node.js `crypto.scrypt`.
2. **Role-Based Authorization**:
   - Supported participant roles: `DONOR`, `RECIPIENT`, `DRIVER`, and `ADMIN`.
   - Donor accounts optionally specify a `donorType`: `INDIVIDUAL`, `CATERER`, `FOOD_BUSINESS`, or `OTHER`.
   - Backend routes are protected by `requireAuth`, `requireRole(...)`, and `requireVerifiedUser` middlewares.
3. **Data Privacy & IDOR Protection**:
   - Records are scoped to the authenticated owner. Donors can only inspect or modify their own listings.
   - Recipient and donor discovery endpoints deliberately omit exact street addresses, contact names, phone numbers, and raw GPS coordinates to protect vulnerable shelters and donors.

---

## 5. Main Domain Modules

The platform implements the following core modules:

### 1. Authentication & Account Management ([`src/backend/src/modules/auth`](file:///c:/surplus-to-shelter/src/backend/src/modules/auth))
Handles user registration, login, logout, session restoration, and password management. Enforces unique email and phone constraints.

### 2. Donations Management ([`src/backend/src/modules/donations`](file:///c:/surplus-to-shelter/src/backend/src/modules/donations))
Allows verified and individual donors (including wedding/event caterers and food businesses) to create, list, update, and cancel surplus food listings. Tracks food category, quantity, unit, safe use-by date/time, pickup address, pickup area, and optional geographical coordinates.

### 3. Recipients Management ([`src/backend/src/modules/recipients`](file:///c:/surplus-to-shelter/src/backend/src/modules/recipients))
Allows recipient organizations (shelters, community kitchens, NGOs) to configure their operational profile, service area, accepted food categories, capacity limits, dietary notes, and active availability. Provides a discovery endpoint for donors to locate suitable local organizations.

### 4. Verification & Trust ([`src/backend/src/modules/verification`](file:///c:/surplus-to-shelter/src/backend/src/modules/verification))
Enforces trust without storing sensitive identity documents. Users submit organizational, business, or vehicle metadata. Administrators review, approve, reject, or suspend requests. Status transitions maintain an append-only audit log in [`VerificationRecord`](file:///c:/surplus-to-shelter/database/schema.prisma#L122-L135).

### 5. Community Donations ([`src/backend/src/modules/community-donations`](file:///c:/surplus-to-shelter/src/backend/src/modules/community-donations))
Allows community organizers to host pooled food drives. Multiple donors contribute individual portions toward a common target. Enforces unit integrity (kilograms, servings, and liters are never combined) and allows administrator-configured minimum thresholds with exceptions for small household contributions.

### 6. Matching Engine ([`src/backend/src/modules/matching`](file:///c:/surplus-to-shelter/src/backend/src/modules/matching))
A deterministic, on-demand suggestion engine. Evaluates compatibility between available food sources and verified recipient profiles across food category, quantity capacity, distance, and expiry urgency. Scores candidates from 0 to 100 without persisting transient suggestions.

### 7. Dashboard & Impact ([`src/backend/src/modules/dashboard`](file:///c:/surplus-to-shelter/src/backend/src/modules/dashboard))
Provides a role-tailored summary for donors, recipients, drivers, and administrators. Aggregates available food quantities, matching suggestions, community collections, verification metrics, and mapped locations on-demand without dedicated analytics tables.

### 8. Location Search & Maps ([`src/backend/src/modules/location-search`](file:///c:/surplus-to-shelter/src/backend/src/modules/location-search))
Integrates OpenStreetMap Nominatim for user-initiated address search and geocoding. Backend caches search results and serializes upstream requests. Leaflet renders interactive maps with pickup and delivery markers.

### Note on Driver Dispatch & Transportation
Driver accounts and driver vehicle verification are fully supported in authentication and verification. In this prototype checkout, physical dispatch assignment, active GPS tracking, and delivery route optimization are deferred; participants coordinate collection and delivery directly based on matching suggestions.

---

## 6. Location and Map Architecture

```text
Frontend LocationSearch Component
  │ (User types address & explicitly submits search)
  ▼
GET /api/locations/search?q=...
  │ (Backend verifies auth session)
  ▼
Backend In-Memory Cache (LRU/TTL)
  │ (If cache miss: serialized at 1 request / 1.1s)
  ▼
OpenStreetMap Nominatim API (configured via LOCATION_SEARCH_URL)
  │
  ▼
Coordinates (lat, lon) + Standardized Address returned to Client
  │
  ▼
Leaflet / React-Leaflet MapContainer renders OpenStreetMap Tiles
```

- **Policy Compliance**: Search executes exclusively upon explicit form submission (never on-keystroke autocomplete) to respect OpenStreetMap Foundation usage policies.
- **Graceful Degradation**: If geocoding fails or is unavailable, users can save manual text addresses without latitude/longitude coordinates.
- **Distance Calculation**: Straight-line distance is computed on both frontend and backend using the Haversine formula; driving routes are not assumed.
