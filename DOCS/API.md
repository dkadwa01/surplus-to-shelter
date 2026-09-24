# API

All endpoints are mounted under `/api`. Authentication uses the existing HTTP-only session cookie. Errors use `{ "error": { "code", "message", "details?" } }`.

## Donations

Donation routes require a valid session. Donor routes are restricted to `DONOR`; administrators may list, view, update, or cancel records. Donors only see or change records they own; requests for another donor's ID return `404` to avoid revealing record existence.

| Method | Path | Access | Result |
| --- | --- | --- | --- |
| `POST` | `/api/donations` | Donor | Creates an `AVAILABLE` donation; returns the safe donation representation (`201`). Owner ID comes from the session. |
| `GET` | `/api/donations?status=AVAILABLE&category=PRODUCE` | Donor, admin | Lists up to 100 records. Donor scope is always their own records; admin sees all. Filters are optional. |
| `GET` | `/api/donations/:id` | Donor, admin | Returns one authorized donation. |
| `PUT` | `/api/donations/:id` | Donor, admin | Replaces editable fields while record is unexpired and `AVAILABLE`. |
| `POST` | `/api/donations/:id/cancel` | Donor, admin | Sets status to `CANCELLED`; records are retained. |

## Recipients

Recipient profile endpoints require the existing session cookie and `RECIPIENT` role. Profile identity always comes from the authenticated session; request bodies cannot assign a user ID. Contact name, email, and phone are read from the associated account. `GET /api/recipients/me` returns the owner's full profile, including its private street address and account contact.

| Method | Path | Access | Result |
| --- | --- | --- | --- |
| `POST` | `/api/recipients` | Recipient | Creates the authenticated user's profile with `PENDING` verification status (`201`). |
| `GET` | `/api/recipients/me` | Recipient | Returns the current recipient's profile, or `404` if setup has not been completed. |
| `PATCH` | `/api/recipients/me` | Recipient | Updates fields on the current recipient's profile. Verification status is not writable here. |
| `GET` | `/api/recipients?recipientType=NGO&serviceArea=North&category=PRODUCE&accepting=true` | Donor, driver, admin | Returns up to 100 verified active profiles matching filters. `accepting` and `active` default to `true`; only admins may request `active=false`. Discovery omits street address and account contact details. |

Profile fields include organization name/type, description, address/service area, optional paired coordinates and radius, accepted food categories, optional current capacity/unit, dietary requirements, availability notes, and active/accepting flags. New profiles are never automatically verified. Verification status values are `PENDING`, `VERIFIED`, `REJECTED`, and `RESTRICTED`; no verification workflow is included in this module.

## Verification

Verification uses the same session cookie. Participants may only submit for their own session account; participant type is derived from the account role. No identity documents or private document URLs are accepted or stored.

| Method | Path | Access | Result |
| --- | --- | --- | --- |
| `POST` | `/api/verification/requests` | Donor, recipient, driver | Submits a verification request; creates a pending request and history record (`201`). An active pending/under-review request prevents duplicates. |
| `GET` | `/api/verification/me` | Authenticated participant | Returns the signed-in user's latest request/status and status history, or `NOT_SUBMITTED`. |
| `GET` | `/api/verification/admin/requests?status=VERIFIED` | Admin | Lists up to 100 requests; defaults to pending and under review. Optional status filter. |
| `GET` | `/api/verification/admin/requests/:id` | Admin | Returns applicant information and request history for review. |
| `PATCH` | `/api/verification/admin/requests/:id` | Admin | Body action is `UNDER_REVIEW`, `VERIFIED`, `REJECTED`, or `SUSPENDED`; rejection/suspension require a reason of at least 10 characters. |

Donor businesses submit an organization name; recipient requests reuse the linked recipient profile; drivers submit a vehicle type. An optional short note is supported. Valid transitions are `PENDING -> UNDER_REVIEW|VERIFIED|REJECTED`, `UNDER_REVIEW -> VERIFIED|REJECTED`, and `VERIFIED -> SUSPENDED`. Rejected participants may submit a new request. Verified and suspended accounts cannot resubmit. Recipient profile verification state is synchronized by admin decisions. `requireVerifiedUser` is available for future sensitive routes; existing donation and recipient routes are not newly gated.

Fields: `foodName`, `category` (`PREPARED_MEALS`, `PRODUCE`, `BAKERY`, `DAIRY`, `GRAINS`, `PROTEIN`, `OTHER`), positive finite `quantity`, `unit` (`SERVINGS`, `KG`, `GRAMS`, `LITRES`, `ITEMS`, `PACKAGES`), future ISO `expiresAt`, `pickupAddress`, `pickupArea`; optional `preparedAt`, paired `latitude`/`longitude`, and `description`. The response includes `donorId`, the account's `donorType`, `status`, and timestamps. Donor type values: `INDIVIDUAL`, `CATERER`, `FOOD_BUSINESS`, `OTHER`.

Errors include `INVALID_INPUT` (`400`), `UNAUTHORIZED` (`401`), `FORBIDDEN` (`403`), `NOT_FOUND` (`404`), and `INVALID_STATE` (`409`). Expired available records are marked `EXPIRED` when accessed. Allowed lifecycle in this module: `AVAILABLE -> CANCELLED` or `AVAILABLE -> EXPIRED`; future reservation/delivery states belong to later modules.
