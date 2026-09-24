# Project Context — Surplus-to-Shelter

## Hackathon
- **Event:** AmiHacks
- **Selected Track:** Track A — NGO / Social Impact
- **Problem:** Surplus-to-Shelter: Real-Time Food Rescue Routing
- **Duration:** 24 hours
- **Difficulty:** Intermediate, with an advanced ceiling
- **Technology:** Open / any

## Project vision

Build a trusted, real-time food-rescue platform that connects surplus edible food from restaurants, grocery stores, cafeterias, **wedding/event caterers**, and local households with shelters, NGOs, food-rescue organizations, and other eligible recipients before the food's safe-use window expires.

The platform should make it easy to donate individually or collectively while reducing fake accounts, nuisance activity, unsuitable donations, failed pickups, and wasted food.

## Core problem

Edible surplus food can become waste because there is no fast and reliable way to connect what is available **right now and nearby** with a recipient that can actually accept and use it.

The original problem statement notes that many surplus donations have only a **2–6 hour usable window**. Current coordination may rely on phone calls, spreadsheets, or WhatsApp groups, which creates problems with scale, capacity visibility, routing, timing, trust, and impact tracking.

## Donor types

The platform should support multiple donor categories:

### 1. Restaurants / food businesses
They can register and post:
- food/item type
- quantity
- preparation/availability time
- safe donation window / expiry
- pickup location
- relevant handling information

### 2. Grocery stores / cafeterias / campus dining
They can post eligible surplus food using the same core donation flow.

### 3. Wedding and event caterers
Wedding/event caterers can register as donors and post surplus food after or during an event, including:
- approximate quantity
- food items
- number/type of servings where useful
- pickup location
- availability time
- safe-use window
- event/end-of-service timing

The system should make bulk catering donations practical because a caterer may have significantly more surplus than an individual household.

### 4. Local community / household groups
A neighborhood or local community area can create a **collective donation**.

Multiple households in the same area may contribute different food items into one combined donation. For example:

Household A → rice  
Household B → vegetables  
Household C → rotis  
Household D → dal

The system treats these as a coordinated community donation while preserving item-level information.

This should help prevent many tiny individual listings and make neighborhood-level food rescue practical.

## Community donation model

A community donation should have:
- community/area identifier
- coordinator or initiating household
- participating households
- individual food items
- quantity per item
- total combined quantity
- common pickup area or collection point
- earliest/latest pickup time
- safe-use information for each relevant item

The system should not assume that different food items are physically mixed. They are combined as one **donation batch / pickup opportunity**, while their individual item information remains available.

## Verification and trust

Verification is an important platform requirement because donors, recipients, drivers, and other participants should not be able to create accounts purely for nuisance, spam, fake donations, fake pickup requests, or other misuse.

### Potential verification levels

#### Donor verification
Depending on donor type:
- phone/email verification
- identity verification where appropriate
- organization/business details for registered businesses
- caterer/event-business details where applicable
- location verification
- account/activity history

#### Recipient verification
For shelters, NGOs, food banks, and other recipient organizations:
- organization details
- responsible-person/contact verification
- location verification
- capacity information
- approval/verification status

#### Driver / volunteer verification
Potential checks:
- phone/email verification
- identity verification
- basic profile information
- vehicle information where relevant
- acceptance/history record

#### Community verification
A household participating in community donations should have a verified account. A community batch can have a designated coordinator so the platform has a responsible person for pickup coordination.

### Trust status

The UI should clearly distinguish states such as:

**Unverified → Verification Pending → Verified → Restricted/Suspended**

Verification should be designed to reduce abuse without creating unnecessary friction for genuine small donors.

## Donation-size / minimum-value concept

The platform may introduce a **minimum donation threshold** so users do not create separate rescue requests for extremely small quantities such as 100 g when the logistics cost is greater than the value of the donation.

However, the threshold should not be a simplistic fixed rule for every food type.

A better approach is to make the threshold configurable based on:
- food type
- estimated servings
- total quantity
- distance
- pickup cost/effort
- recipient demand
- whether it is part of a community batch

### Community exception

A household contribution below the normal individual threshold can still be accepted when it is combined with other nearby household contributions into a meaningful community donation.

Example:

```text
Household A: 500 g rice
Household B: 1 kg dal
Household C: 1.5 kg vegetables
Household D: 1 kg rotis
             ↓
Combined Community Donation
             ↓
Meaningful pickup quantity
```

The exact minimum threshold should be decided during implementation/testing rather than hard-coded into the project context without evidence.

## Recipient types

Primary recipients can include:
- shelters
- food banks
- food-rescue organizations
- eligible NGOs/community organizations

Recipients should maintain:
- current capacity
- accepted food categories
- dietary/handling preferences where relevant
- pickup/delivery availability
- location
- verification status

## Core matching logic

A donation should be matched to an eligible recipient using factors such as:

1. **Safety / usable window**
2. **Recipient eligibility**
3. **Capacity**
4. **Food compatibility / preferences**
5. **Need**
6. **Distance**
7. **Pickup timing**
8. **Available driver/volunteer capacity**

Safety should be a hard constraint: the system must not intentionally route expired-risk food.

## Core workflow

```text
Donor / Community
      ↓
Verification
      ↓
Create Donation
      ↓
Food + Quantity + Location + Safe Window Validation
      ↓
Minimum / Meaningful Donation Check
      ↓
Find Eligible Verified Recipients
      ↓
Real-Time Matching
      ↓
Driver / Volunteer Dispatch
      ↓
Pickup
      ↓
Delivery
      ↓
Status + Proof / Confirmation
      ↓
Impact Record
```

## Expected product modules

### Authentication & verification
- registration/login
- role selection
- verification status
- profile management
- moderation/restriction support

### Donor module
- create donation
- manage active donations
- donation history
- pickup status
- notifications

### Caterer module
- business/caterer registration
- bulk donation creation
- event-related surplus information
- pickup scheduling

### Community module
- create/join area-wise community
- add individual household contributions
- combine different food items
- designate coordinator
- create collective pickup request

### Recipient module
- organization registration
- verification
- capacity management
- accepted-food preferences
- accept/reject/confirm matched donations

### Driver / volunteer module
- available pickups
- route/distance
- pickup assignment
- status updates
- completion confirmation

### Matching & routing engine
- eligibility filtering
- capacity matching
- distance calculation
- urgency/safe-window consideration
- route suggestion
- optional multi-stop optimization

### Notification module
- new match
- pickup reminders
- urgent/expiring donation alerts
- status changes

### Impact dashboard
Track metrics such as:
- meals rescued
- food weight diverted
- number of donations
- community donations
- caterer/event donations
- successful pickups
- successful deliveries
- estimated CO2e avoided

## AI / advanced opportunities

Use advanced technology only where it improves the core problem.

Potential features:
- AI-assisted donation description parsing
- food image classification
- quantity estimation from images where feasible
- expiry-risk prioritization
- demand prediction
- donor/recipient matching
- route optimization
- agentic dispatch assistance
- waste-hotspot analytics

The original problem statement explicitly emphasizes that useful matching is more important than adding AI only for novelty.

## Safety and misuse principles

- Never intentionally route food outside its safe-use window.
- Do not expose unnecessary personal contact/location information.
- Verified status should influence who can participate in sensitive workflows.
- Maintain moderation/restriction mechanisms.
- Keep an auditable status history for donations.
- Avoid creating excessive friction for genuine donors.

## 24-hour MVP

The MVP should prioritize a complete working flow rather than implementing every advanced feature.

### Must-have MVP
1. Role-based registration/login.
2. Basic verification status/workflow.
3. Donor creates a donation.
4. Wedding/event caterer can create a bulk donation.
5. Community coordinator can create a combined donation from multiple households.
6. Minimum/meaningful donation validation.
7. Recipient profile with capacity.
8. Real-time/rule-based matching.
9. Driver/volunteer pickup view.
10. Donation status tracking.
11. Basic notifications.
12. Impact dashboard.

### Advanced if time permits
- route optimization
- CV-based food/quantity detection
- AI matching
- agentic dispatcher
- demand prediction
- waste hotspot mapping

## AI coding-agent instruction

Before making changes:
1. Read `PROJECT_CONTEXT.md`.
2. Read `docs/PROBLEM_STATEMENT.md`.
3. Inspect the existing repository structure.
4. Preserve working functionality.
5. Implement the smallest coherent change required.
6. Do not rebuild working modules unnecessarily.
7. Treat verification, safety windows, community aggregation, caterer donations, and meaningful donation thresholds as first-class requirements.
8. Do not invent unsupported legal/food-safety rules; keep configurable values configurable.
