# Problem Statement — Surplus-to-Shelter: Real-Time Food Rescue Routing

> **“Turn a restaurant's or caterer's unsold food into a shelter's next meal — before it hits the dumpster.”**

## Domain
Food waste & surplus redistribution (industry + social-impact overlap)

## Difficulty
Intermediate — accessible entry point with real depth for advanced teams

## Duration
24 hours

## Technology
Open / any

## Focus
Social-impact-first, with genuine industry/logistics relevance

---

# 1. Problem Statement

Every day, restaurants, grocery stores, caterers, cafeterias, campus dining facilities, and households generate surplus edible food that may go to waste — not because no one wants it, but because there is no fast, reliable way to connect what is available **right now and nearby** with people or organizations that can pick it up and use it before it spoils.

Wedding and event caterers can generate particularly large amounts of prepared food after an event. At the same time, individual households may have smaller amounts of surplus food that are difficult to collect economically when handled as separate requests.

Food banks, shelters, NGOs, and food-rescue organizations may rely on phone calls, spreadsheets, or messaging groups to coordinate donations. This becomes difficult under time pressure and does not provide a unified view of food availability, recipient capacity, pickup routing, or participant trust.

The platform should therefore support both **individual donations** and **coordinated community donations**, while enabling verified participants to safely coordinate pickup and delivery.

---

# 2. Who Experiences It

### Food businesses
Restaurants, grocery stores, cafeterias, and campus dining facilities may have surplus food and need a fast, practical donation channel.

### Wedding and event caterers
Caterers may have substantial quantities of prepared food after events and need a reliable way to make that surplus available to suitable recipients within its safe-use window.

### Households / local communities
Individual households may have small quantities of different surplus food items. Separately, these quantities may be too small to justify individual pickup, but collectively a neighborhood can create a meaningful donation.

### Food rescue organizations / shelters / NGOs
Recipients need timely information about available food, quantity, suitability, capacity, and pickup requirements.

### Drivers / volunteers
Pickup participants need a unified view of assignments, locations, timing, and route information.

---

# 3. Why It Matters

Surplus food that cannot be matched in time can become waste while nearby organizations or communities may have unmet food needs.

The problem therefore combines:
- time-sensitive food rescue,
- local logistics,
- recipient capacity,
- trust and verification,
- community coordination, and
- measurable impact reporting.

---

# 4. Current Limitations

Current/manual coordination can suffer from:

- phone, text, spreadsheet, or messaging-based coordination;
- lack of real-time visibility into available surplus;
- lack of shared recipient-capacity information;
- difficulty coordinating multiple small household donations;
- difficulty handling large post-event/catering donations;
- lack of systematic pickup routing;
- lack of a consistent participant-verification process;
- nuisance, fake, or unsuitable requests;
- food becoming unavailable before a match is completed;
- limited tracking of how much food was successfully rescued.

---

# 5. Core Objective

Build a trusted real-time platform that allows verified food donors to post surplus food and automatically connect it with appropriate verified recipient organizations based on factors such as:

- food safety / usable window,
- recipient eligibility,
- capacity,
- food compatibility,
- need,
- distance, and
- pickup timing.

The system should also allow multiple households in the same local area to combine different food items into one coordinated community donation.

The platform should coordinate pickup and delivery while maintaining a measurable record of rescued food.

---

# 6. Donor Categories

## 6.1 Restaurants, Grocers, Cafeterias & Food Businesses

A donor can register and post:
- food item/type,
- quantity,
- pickup location,
- availability time,
- safe-use/expiry window,
- relevant food-handling information.

## 6.2 Wedding & Event Caterers

Caterers can register as a distinct donor type and post bulk/event surplus including:
- food items,
- approximate quantities,
- number/type of servings where useful,
- event or service end time,
- pickup location,
- available-from time,
- safe-use window,
- other relevant handling information.

The system should support bulk donations because event caterers may have substantially more surplus than individual households.

## 6.3 Local Community / Household Donations

The platform should allow households from the same local area to coordinate a **community donation**.

Different households can contribute different food items.

Example:

```text
Household A → Rice
Household B → Dal
Household C → Vegetables
Household D → Rotis
                ↓
      Combined Community Donation
                ↓
        One Pickup Opportunity
```

The system should keep the individual food items and quantities visible rather than treating different foods as physically mixed.

A community donation can include:
- local area/community identifier,
- participating households,
- initiating household/coordinator,
- item-level quantities,
- combined donation information,
- collection/pickup point,
- pickup time window,
- relevant safe-use information.

---

# 7. Verification & Trust

Because the platform coordinates real-world food, organizations, drivers, and pickups, participants should go through an appropriate verification process.

## Donor verification

Depending on donor type, the system may verify:
- phone/email,
- identity where appropriate,
- business/organization details,
- caterer/event-business details,
- location,
- account/activity history.

## Recipient verification

Recipients may provide:
- organization information,
- responsible contact,
- location,
- capacity,
- accepted food categories/preferences,
- verification status.

## Driver / Volunteer verification

Potential checks include:
- phone/email,
- identity,
- profile information,
- vehicle information where relevant,
- participation/history.

## Community verification

Households participating in community donations should have verified accounts. A community donation can have a designated coordinator responsible for coordination.

## Verification states

The platform can represent states such as:

```text
Unverified
    ↓
Verification Pending
    ↓
Verified
    ↓
Restricted / Suspended (if misuse is detected)
```

The exact verification mechanism can be implemented according to the team's available APIs and hackathon constraints.

---

# 8. Meaningful Donation Threshold

A potential issue is users creating separate requests for extremely small quantities, for example **100 grams**, where the logistics required to collect the donation may exceed its practical value.

The system should therefore consider a **minimum meaningful donation threshold**.

However, one fixed quantity should not necessarily apply to every situation. The threshold can be configurable based on factors such as:
- food type,
- estimated servings,
- quantity,
- recipient demand,
- distance,
- pickup effort,
- whether the donation is part of a community batch.

### Community contribution exception

A household contribution below the individual threshold can still be accepted when combined with other nearby contributions.

For example:

```text
Household A: 500 g rice
Household B: 1 kg dal
Household C: 1.5 kg vegetables
Household D: 1 kg rotis

                ↓

Combined Community Donation
                ↓

Meaningful Pickup Quantity
```

This prevents the platform from rejecting useful household contributions merely because each household's contribution is small individually.

**Implementation note:** the exact threshold should remain configurable and be determined during product testing rather than being treated as a universal food-safety or legal requirement.

---

# 9. Recipient Capacity & Preferences

Verified recipient organizations should be able to specify:
- current capacity,
- accepted food categories,
- quantity they can receive,
- availability,
- relevant preferences/constraints,
- location.

This prevents the system from matching donations to recipients that cannot realistically accept them.

---

# 10. Real-Time Matching

The matching engine should consider:

1. **Food safety / usable window**
2. **Recipient verification / eligibility**
3. **Recipient capacity**
4. **Food compatibility**
5. **Recipient need**
6. **Distance**
7. **Pickup timing**
8. **Driver/volunteer availability**

Safety should act as a hard constraint: the system must not intentionally route food outside its safe-use window.

---

# 11. Expected Solution Capabilities

### 1. Fast donation intake
A donor should be able to post:
- item,
- quantity,
- pickup location,
- availability,
- safe-use/expiry window.

### 2. Caterer donation workflow
Wedding/event caterers should be able to register and submit bulk surplus.

### 3. Community donation workflow
Multiple households from one local area should be able to contribute different items to a coordinated donation.

### 4. Verification
Support appropriate verification for donors, recipients, drivers/volunteers, and community participants.

### 5. Meaningful donation validation
Detect extremely small individual donations and encourage aggregation where appropriate.

### 6. Real-time matching
Match suitable donations with appropriate nearby recipients.

### 7. Driver / volunteer dispatch
Provide pickup assignments or routing suggestions.

### 8. Capacity management
Allow recipients to update their available capacity and preferences.

### 9. Status tracking
Track:

**Posted → Matched → Pickup Assigned → Picked Up → Delivered → Completed**

### 10. Notifications
Provide time-sensitive notifications through appropriate channels.

### 11. Impact dashboard
Track:
- meals rescued,
- weight diverted,
- successful pickups,
- successful deliveries,
- community donations,
- caterer/event donations,
- estimated CO2e avoided.

---

# 12. Innovation Opportunities

The following can be added where genuinely useful.

### AI / ML
- donation-demand prediction,
- intelligent donor-recipient matching,
- expiry-risk prioritization.

### Computer Vision
Estimate/classify food type or quantity from uploaded images where feasible.

### NLP
Convert free-text donation descriptions into structured donation information.

### Route Optimization
Optimize multiple pickups for a driver.

### Agentic AI
Assist with coordinating pickup times between donor, recipient, and driver.

### Data Analytics
Identify:
- waste hotspots,
- high-surplus areas,
- demand patterns,
- rescue performance.

### Community Intelligence
Identify neighborhoods where small household contributions can be grouped efficiently.

> The goal is not to add AI merely for novelty. The matching, verification, aggregation, and routing workflow should work even if advanced AI features are disabled.

---

# 13. Constraints & Considerations

### Safety
Respect food safety/use windows and do not intentionally route expired-risk food.

### Privacy
Handle donor, recipient, household, driver, and location information responsibly.

### Trust
Use appropriate verification and moderation to reduce fake accounts, nuisance requests, and misuse.

### Reliability
A failed or delayed match can result in the food being wasted.

### Accessibility
The interface should be usable by non-technical shelter staff, drivers, caterers, and households.

### Scalability
The design should be extendable beyond one city.

### Cost / Latency
Matching should be near-instant for a good demonstration.

### Ethical design
Verification and minimum-donation rules should reduce abuse without unnecessarily preventing genuine small donors from contributing.

---

# 14. 24-Hour Hackathon Scope

## Core MVP

A realistic MVP should demonstrate:

1. User registration/login.
2. Role-based accounts.
3. Basic verification workflow/status.
4. Restaurant/business donor registration.
5. Wedding/event caterer registration and bulk donation.
6. Household/community donation creation.
7. Multiple households contributing different food items.
8. Minimum/meaningful donation validation.
9. Verified recipient registration.
10. Recipient capacity management.
11. Rule-based real-time matching.
12. Driver/volunteer pickup view.
13. Donation status tracking.
14. Basic notification flow.
15. Impact dashboard.

## Advanced scope

If time permits:
- route optimization,
- AI-assisted matching,
- computer vision,
- expiry-risk prioritization,
- agentic dispatch,
- demand prediction,
- community waste hotspot analytics.

---

# 15. End-to-End System Flow

```text
                 DONORS
                   │
       ┌───────────┼────────────┐
       │           │            │
   Restaurant   Caterer     Households
       │           │            │
       │           │      Community Group
       │           │            │
       └───────────┴────────────┘
                   ↓
              VERIFICATION
                   ↓
          CREATE DONATION
                   ↓
     Validate Food / Quantity /
     Location / Safe-Use Window
                   ↓
       Meaningful Donation Check
                   ↓
       Find Verified Recipients
                   ↓
       Matching & Prioritization
       (Capacity + Need + Distance
        + Safety + Time)
                   ↓
        Driver / Volunteer
             Dispatch
                   ↓
                PICKUP
                   ↓
               DELIVERY
                   ↓
          Status Confirmation
                   ↓
           IMPACT DASHBOARD
```

---

# 16. Success Criteria for the MVP

The MVP should demonstrate that:

- a genuine donor can register;
- a wedding caterer can create a bulk donation;
- multiple households can combine different food items into one community donation;
- inappropriate/trivial individual requests can be handled through a meaningful-donation rule;
- verified recipients can publish capacity;
- the system can identify a suitable recipient;
- a driver/volunteer can receive a pickup assignment;
- the donation can be tracked through delivery;
- the system records the resulting rescue impact.

The project should prioritize a complete working rescue flow over a large number of partially implemented features.
