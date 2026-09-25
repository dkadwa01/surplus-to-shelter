# Frontend Documentation

The Surplus-to-Shelter frontend is a Single Page Application (SPA) built with React 18, Vite, TypeScript, and Leaflet. It provides role-tailored dashboards and intuitive workflows for food donors, recipient organizations, drivers, and administrators.

---

## 1. Technology Stack

- **Framework**: React 18
- **Build Tool**: Vite 5
- **Language**: TypeScript 5.9
- **Routing**: React Router 6 (`react-router-dom`)
- **Mapping & Geocoding**: Leaflet 1.9 & React-Leaflet 4 with OpenStreetMap tiles
- **Styling**: Modern, responsive Vanilla CSS with CSS custom properties (variables)
- **Validation & Types**: Shared contracts from `@surplus/shared`

---

## 2. Directory Structure

Located under [`src/frontend`](file:///c:/surplus-to-shelter/src/frontend):

```text
src/frontend/src/
├── main.tsx                         # Application bootstrap with BrowserRouter & AuthProvider
├── styles.css                       # Global design system, utility classes, and media queries
├── app/
│   └── App.tsx                      # Top-level shell, header navigation, role-based links, and routes
├── components/                      # Shared reusable UI components
│   ├── LocationMap.tsx              # Interactive Leaflet map with OpenStreetMap tiles and polylines
│   └── LocationSearch.tsx           # Address search with Nominatim geocoding and map preview
└── features/                        # Domain feature modules
    ├── auth/                        # Login, registration, account profile, ProtectedRoute, AuthContext
    ├── donations/                   # Donation listings, creation form, details, cancellation
    ├── recipients/                  # Recipient profile creation, updates, and discovery directory
    ├── verification/                # Verification requests, timeline, and admin review interfaces
    ├── community-donations/         # Collective food drives, progress bars, and contributions
    ├── matching/                    # Match suggestion feeds, score breakdowns, and explanations
    ├── home/                        # Public landing page and 404 page
    └── DashboardPage.tsx            # Role-tailored dashboard with impact metrics and rescue map
```

---

## 3. Client-Side Routing

Managed in [`src/frontend/src/app/App.tsx`](file:///c:/surplus-to-shelter/src/frontend/src/app/App.tsx) with route protection via `ProtectedRoute`:

| Route Path | Allowed Roles | Component | Purpose |
|---|---|---|---|
| `/` | Public / All | `HomePage` / `DashboardPage` | Landing page for guests; redirects authenticated users to Dashboard. |
| `/login` | Public | `LoginPage` | Email and password sign-in. |
| `/register` | Public | `RegisterPage` | Account creation with role selection (`DONOR`, `RECIPIENT`, `DRIVER`). |
| `/account` | Authenticated | `AccountPage` | Profile overview, role badge, and session details. |
| `/dashboard` | Authenticated | `DashboardPage` | Role-tailored operational overview and network map. |
| `/donations` | `DONOR` | `DonationsPage` | List of donor's own surplus food listings with status filter. |
| `/donations/new` | `DONOR` | `DonationFormPage` | Form to list new surplus food with location search. |
| `/donations/:id/edit` | `DONOR` | `DonationFormPage` | Edit active, unexpired listing. |
| `/donations/:id` | `DONOR` | `DonationDetailsPage` | Details view with actions to edit, cancel, or view matches. |
| `/recipients` | `DONOR`, `DRIVER`, `ADMIN`| `RecipientsPage` | Directory of verified, active recipient organizations. |
| `/recipients/profile` | `RECIPIENT` | `RecipientProfilePage` | Recipient profile setup, capacity editor, and category preferences. |
| `/community-donations` | Authenticated | `CommunityDonationsPage` | Browse collective food drives. |
| `/community-donations/:id` | Authenticated | `CommunityDonationDetailsPage`| Collective drive details, target progress, and contributions. |
| `/matching` | `RECIPIENT` | `RecipientMatchesPage` | Food matches suitable for the signed-in recipient's capacity. |
| `/matching/donations/:id` | `DONOR` | `DonationMatchesPage` | Suitable recipient organizations for a specific donation. |
| `/matching/community-donations/:id` | `DONOR` | `CommunityDonationMatchesPage`| Matches for contributions in a target-reached or closed drive. |
| `/matching/details/:sourceType/:sourceId/recipients/:recipientProfileId` | `DONOR`, `RECIPIENT` | `MatchDetailsPage` | In-depth compatibility breakdown and factor scores (0–100). |
| `/verification` | `DONOR`, `RECIPIENT`, `DRIVER` | `VerificationPage` | Submit verification metadata and track approval status. |
| `/admin/verifications` | `ADMIN` | `AdminVerificationListPage` | Administrative queue of pending verification requests. |
| `/admin/verifications/:id` | `ADMIN` | `AdminVerificationDetailPage` | Review metadata, inspect history, and approve/reject/suspend. |
| `/unauthorized` | Public | `UnauthorizedPage` | Displayed when a user lacks required role permissions. |
| `*` | Public | `NotFoundPage` | 404 fallback page. |

---

## 4. State Management & API Communication

### Authentication Context (`AuthContext`)
- Located at [`src/frontend/src/features/auth/AuthContext.tsx`](file:///c:/surplus-to-shelter/src/frontend/src/features/auth/AuthContext.tsx).
- Provides `user`, `loading`, `login(credentials)`, `register(data)`, and `logout()` through the `useAuth()` hook.
- Bootstraps session state on initial application mount by calling `GET /api/auth/me`.

### Local Component State
- UI views use native React hooks: `useState`, `useEffect`, `useCallback`, `useRef`.
- No heavy external state management libraries (Redux/MobX) are needed; state is scoped cleanly to feature containers.

### API Clients
Each feature communicates through a dedicated HTTP client module using native `fetch` with `credentials: "include"`:
- `auth-api.ts`
- `donation-api.ts`
- `recipient-api.ts`
- `verification-api.ts`
- `community-donation-api.ts`
- `matching-api.ts`
- `dashboard-api.ts`

---

## 5. UI Features & Components

### 5.1. Dashboard (`DashboardPage.tsx`)
A dynamic, role-aware operational command center:
- **Donor View**: Metrics for active listings, total food offered (units kept distinct; grams normalized to kilograms), live match count, and links to create donations.
- **Recipient View**: Capacity utilization indicator, accepted categories, suitable food matches, and profile completion callout.
- **Driver View**: Driver verification status badge and note regarding direct coordination in this prototype.
- **Admin View**: Platform-wide metrics, verified participant counts by role, total food offered, and verification queue link.
- **Network Map**: Interactive Leaflet map displaying active donation and recipient locations with straight-line distance estimates.

### 5.2. Location Search & Leaflet Map (`LocationSearch.tsx` & `LocationMap.tsx`)
- **Explicit Search**: Users submit an address query to `/api/locations/search`. Results display standardized address names and coordinates.
- **Map Preview**: Selecting an address renders an interactive OpenStreetMap marker centered on the chosen location.
- **Straight-Line Distance**: Calculates distance using the Haversine formula and renders a dashed polyline between donor pickup and shelter delivery points.
- **Fallback Support**: If a user does not geocode, the form accepts standard text addresses without coordinates.

### 5.3. Matching Engine UI (`MatchCard.tsx` & `MatchDetailsPage.tsx`)
- Visualizes eligibility status with color-coded pills (`Suitable suggestion` vs `Not currently suitable`).
- Displays total match score out of 100 with a detailed breakdown:
  - **Food Category**: Exact match compatibility.
  - **Quantity & Capacity**: Fit within recipient capacity limits.
  - **Distance**: Straight-line proximity in kilometers.
  - **Expiry Urgency**: Safe window remaining before use-by date.
  - **Verification Trust**: Persisted verification check.
- Lists human-readable explanation tags and cautionary dietary warnings.

### 5.4. Community Donations UI (`CommunityDonationDetailsPage.tsx`)
- Interactive progress bar calculating target completion percentage.
- Separates quantities by unit so kilograms and servings are never combined.
- Contribution form allowing small household portions (even below commercial donation thresholds).
- Individual contribution cards allowing authors to edit or withdraw active portions while the drive remains open.

### 5.5. Verification UI (`VerificationPage.tsx` & Admin Review)
- Role-specific submission form:
  - Caterers & Food Businesses: Organization/Business name.
  - Drivers: Vehicle type (e.g., Van, Refrigerated Truck).
  - Shelters: Leverages existing recipient organization profile.
- Shows current status badge (`PENDING`, `UNDER_REVIEW`, `VERIFIED`, `REJECTED`, `SUSPENDED`) and historical review notes.
- Administrator interface provides review actions (`Verify`, `Mark Under Review`, `Reject`, `Suspend`) with mandatory rejection reasons.

---

## 6. Major User Flows

### Flow 1: Donor User Flow
```text
1. Register / Sign In (Select role DONOR; choose type: INDIVIDUAL, CATERER, or FOOD_BUSINESS)
2. Submit Verification (Enter business name or organization details)
3. Navigate to "My Donations" -> "Create Donation"
4. Search & select pickup location on OpenStreetMap (or enter text address)
5. Fill food details (name, category, quantity, unit, use-by date) -> Submit
6. Open Donation Details -> Click "View Matches"
7. Review suitable verified recipient organizations ranked by compatibility score
8. Inspect Match Details -> Coordinate pickup directly with shelter
```

### Flow 2: Recipient Shelter User Flow
```text
1. Register / Sign In (Select role RECIPIENT)
2. Complete Recipient Profile (Organization name, type, address, capacity, accepted categories)
3. Profile defaults to PENDING verification -> Admin reviews and marks VERIFIED
4. Navigate to "Food Matches"
5. Review currently available surplus food listings and collective community contributions
6. View match score breakdown and distance to donor pickup location
7. Coordinate food acceptance and intake
```

### Flow 3: Community Collection Flow
```text
1. Verified Donor clicks "Community Donations" -> "Start Community Collection"
2. Sets title, pickup area, deadline, and optional target (e.g. 50 KG PRODUCE)
3. Collection becomes OPEN
4. Multiple local donors contribute portions to the drive
5. Progress bar updates dynamically; below-threshold portions are marked as community exceptions
6. When target is reached or deadline nears, organizer marks collection CLOSED
7. Organizer navigates to "Matching" to connect the aggregated items with a local shelter
```

### Flow 4: Driver User Flow
```text
1. Register / Sign In (Select role DRIVER)
2. Navigate to "Verification"
3. Submit vehicle information (e.g. Van, Insulated boxes)
4. View verification approval progress on Driver Dashboard
5. Review community food rescue network map and direct coordination instructions
```

---

## 7. Styling Approach

Located in [`src/frontend/src/styles.css`](file:///c:/surplus-to-shelter/src/frontend/src/styles.css):
- **Design Tokens**: Standardized CSS variables for palette (`--primary`, `--primary-hover`, `--background`, `--card`, `--text`, `--muted`, `--border`, `--error`).
- **Typography**: Clean, accessible sans-serif font stack with fluid clamp typography (`font-size: clamp(...)`).
- **Responsive Layout**: Fluid CSS Grid and Flexbox layouts adapting gracefully from mobile screens (<560px) to wide desktop displays.
- **Accessibility**: High-contrast status badges, standard HTML form elements with explicit labels, and ARIA roles for loading and error states.
