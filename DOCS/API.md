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

## Community donations

All community donation routes require an authenticated session. Browsing is available to signed-in roles. Creating a collection, contributing, editing/withdrawing a contribution, and organizer actions require a verified `DONOR`. The user ID always comes from the session. Organizer actions are restricted to the collection creator. Contribution summaries omit donor names and contact details; notes are returned only to the author.

| Method | Path | Access | Result |
| --- | --- | --- | --- |
| `GET` | `/api/community-donations?pickupArea=North` | Authenticated | Lists up to 100 open/target-reached collections, with optional area substring filter. |
| `GET` | `/api/community-donations?status=CLOSED` | Donor, admin | Filters by any lifecycle status. |
| `GET` | `/api/community-donations/:id` | Authenticated | Collection, unit-separated totals, progress, contributor count and up to 200 recent active contribution summaries. |
| `POST` | `/api/community-donations` | Verified donor | Creates a collection; target quantity/category/unit are optional and must be provided together (`201`). |
| `POST` | `/api/community-donations/:id/contributions` | Verified donor | Adds an individually attributed food item (`201`). |
| `GET` | `/api/community-donations/contributions/:contributionId` | Authenticated owner | Reads the current user's own contribution; other IDs return `404`. |
| `PUT` | `/api/community-donations/contributions/:contributionId` | Verified donor owner | Edits an active contribution while its collection is `OPEN`. |
| `POST` | `/api/community-donations/contributions/:contributionId/withdraw` | Verified donor owner | Withdraws an active contribution while its collection is `OPEN`. |
| `POST` | `/api/community-donations/:id/close` | Verified creator | Closes an `OPEN` or `TARGET_REACHED` collection. |
| `POST` | `/api/community-donations/:id/cancel` | Verified creator | Cancels an `OPEN` collection. |
| `GET` | `/api/community-donations/thresholds` | Authenticated | Lists configured individual posting thresholds. |
| `PUT` | `/api/community-donations/admin/thresholds` | Admin | Upserts a threshold by category/unit; body includes `category`, `unit`, and `minimumQuantity`. |

Group lifecycle: `OPEN -> TARGET_REACHED -> CLOSED`, or `OPEN -> CLOSED|CANCELLED|EXPIRED`; an open group may also expire. Reached/closed/cancelled/expired collections reject contribution changes. Target progress is calculated only for the selected category and unit; all other totals remain separate. A community contribution below a configured individual-post threshold is accepted as a collective exception and flagged only in its owner's response. No threshold is preconfigured, so no arbitrary quantity is assumed. Expiration is processed when collections are read or changed.

Configured thresholds are also enforced when standalone donations are created or edited. Administrators configure them through the threshold endpoint; until a category/unit threshold is configured, the system applies no minimum for that pair.

Errors include `INVALID_INPUT` (`400`), `UNAUTHORIZED` (`401`), `FORBIDDEN` (`403`), `NOT_FOUND` (`404`), and `INVALID_STATE` (`409`). Expired available records are marked `EXPIRED` when accessed. Allowed lifecycle in this module: `AVAILABLE -> CANCELLED` or `AVAILABLE -> EXPIRED`; future reservation/delivery states belong to later modules.

## Matching

Matching routes require the existing session cookie and calculate suggestions on demand. No match, allocation, or reservation is persisted. Donor-side requests are scoped to the donor's own source; recipient-side requests always use the signed-in recipient's own profile. Match details can be read by the source owner or by the owner of the recipient profile. Other owners receive `404`.

| Method | Path | Access | Result |
| --- | --- | --- | --- |
| `GET` | `/api/matching/donations/:donationId/recipients` | Donor, source owner | Suitable verified recipients for an unexpired `AVAILABLE` donation. |
| `GET` | `/api/matching/community-donations/:communityDonationId/recipients` | Donor, collection organizer | Per-item recipient matches for a target-reached or closed collection. Only active, unexpired contributions from currently verified contributors are considered. |
| `GET` | `/api/matching/recipients/me/donations` | Verified, active, accepting recipient | Suitable individual donations and eligible community contributions for the signed-in profile. |
| `GET` | `/api/matching/details/:sourceType/:sourceId/recipients/:recipientProfileId` | Donor source owner or recipient profile owner | One pair's eligibility, factor scores, reasons, and warnings. A known but incompatible pair can return `eligible: false`. Unverified/inactive recipient profiles are hidden as `404`. |

Candidate lists contain only eligible pairs and are capped at 100 direct donations, 1,000 community contribution items, or 100 recipient profiles per request. Responses omit donor identity, street addresses, recipient contact details, and exact coordinates. Distance is rounded to the nearest kilometer and is straight-line distance, not a route estimate. An unavailable/expired individual donation returns `409`; a community collection must be `TARGET_REACHED` or `CLOSED`.

## Driver dispatch

Dispatch uses existing accounts, latest verification requests, food sources, recipient profiles, and the matching evaluator. Matches remain transient; dispatch creation reruns eligibility and reserves the selected source transactionally. Community dispatch references one contribution at a time.

| Method | Path | Access | Result |
| --- | --- | --- | --- |
| `GET` | `/api/dispatch/drivers/me` | Driver | Own driver profile and current verification state. |
| `PUT` | `/api/dispatch/drivers/profile` | Driver | Creates/updates vehicle capacity and service-area details. |
| `PATCH` | `/api/dispatch/drivers/availability` | Driver | Sets `AVAILABLE` or `OFFLINE`; becoming available requires current verification. `BUSY` is backend-managed. |
| `POST` | `/api/dispatch` | Verified donor | Body: `sourceType`, `sourceId`, `recipientProfileId`. Rechecks the match and reserves the owned donation or organizer's community contribution. |
| `GET` | `/api/dispatch/available` | Verified driver | Suitable assignments filtered by capacity/unit and service area/radius. |
| `GET` | `/api/dispatch/mine` | Signed-in participant | Assignments created by the donor, assigned to the driver, or addressed to the recipient profile. Admins can view all. |
| `GET` | `/api/dispatch/:id` | Related participant, suitable verified driver, admin | Authorized assignment details; unrelated IDs return `404`. |
| `POST` | `/api/dispatch/:id/accept` | Verified driver | Atomically claims the assignment and sets availability to `BUSY`. |
| `POST` | `/api/dispatch/:id/decline` | Assigned driver | Returns an accepted, not-yet-started assignment to the available pool. |
| `POST` | `/api/dispatch/:id/pickup/start` | Assigned driver | `ACCEPTED -> PICKUP_STARTED`. |
| `POST` | `/api/dispatch/:id/pickup/confirm` | Assigned driver | `PICKUP_STARTED -> PICKED_UP`, recording pickup time. |
| `POST` | `/api/dispatch/:id/transit/start` | Assigned driver | `PICKED_UP -> IN_TRANSIT`. |
| `POST` | `/api/dispatch/:id/delivery/confirm` | Assigned driver | `IN_TRANSIT -> DELIVERED`, recording delivery time and marking the source delivered. |
| `POST` | `/api/dispatch/:id/complete` | Assigned driver | `DELIVERED -> COMPLETED`; driver availability returns to `AVAILABLE`. |
| `POST` | `/api/dispatch/:id/cancel` | Assignment creator, admin | Cancels before pickup and releases an unexpired source. |

Client-supplied owner, driver, and lifecycle values are ignored. Addresses are visible only to related participants and suitable verified drivers. Distance is rounded straight-line distance, not a route estimate. Expired food cannot be picked up or confirmed delivered.
