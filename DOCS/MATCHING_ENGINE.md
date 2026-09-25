# Matching engine

The matching engine is a deterministic, read-only module at `src/backend/src/modules/matching`. It reads current donation, community contribution, recipient profile, and verification data. It does not persist match scores, reserve items, change quantities, or alter donation lifecycle state except marking a direct donation or target-reached collection expired when its existing expiry has passed.

## Eligibility rules

1. Source must be current: individual donations must be `AVAILABLE` and unexpired; community sources must be an unexpired `ACTIVE` contribution in a `TARGET_REACHED` or `CLOSED` group, with a currently verified contributor. Contributions are never combined across item categories or units.
2. Recipient must have a current verified request and a profile marked `VERIFIED`, active, and accepting donations. Recipient profile details are not returned to an ineligible caller.
3. If accepted food categories are specified, the source category must match one exactly. An empty list means the recipient has not restricted categories. Free-text dietary notes are surfaced as a warning and are not guessed or interpreted.
4. Capacity must either be unspecified or comparable using the exact same unit. No conversions are assumed (`SERVINGS` is not treated as `MEALS`, and `KG` is not treated as `GRAMS`). If comparable source quantity exceeds stated capacity, the candidate is ineligible. There is no partial allocation model.
5. Future-prepared food is not yet matchable. Past-expiry food is never eligible.
6. When both coordinate pairs exist, Haversine distance is used. A recipient service radius is a hard limit. When coordinates are missing and no radius can be checked, area-name equality contributes to ranking and the result warns that distance is unknown.

## Explainable score

Eligible matches receive a score from 0–100 from four independent factors:

- Food category: up to 35 points for an accepted category; 22 points when no categories were specified.
- Location: up to 25 points using `round(25 / (1 + distanceKm))`; without coordinates, 15 points for the same normalized area name or 5 for an unknown/different area.
- Capacity: 25 points when exact-unit capacity fits; 12 points when capacity is absent; 8 points when its details are incomplete. Incompatible units or excess quantity make the pair ineligible.
- Expiry urgency: `round(15 / (1 + hoursUntilExpiry / 6))`, with expired sources excluded.

Scores are server-calculated. Lists sort by score descending, then earliest expiry, recipient organization name, and source ID. Exclusion reasons and uncertainty warnings are returned for details. The result is a suggestion, not confirmation of available transport, recipient need, or final allocation.

## Privacy and current limits

The API does not return donor IDs/names, pickup street addresses, recipient account contacts, or exact coordinates. It returns the service/pickup area and straight-line distance rounded to the nearest kilometer. It does not model recipient demand beyond accepted categories and capacity, interpret free-text dietary preferences, estimate road travel time, or account for driver availability. Those inputs or workflows should be added only with their own validated data and allocation rules.
