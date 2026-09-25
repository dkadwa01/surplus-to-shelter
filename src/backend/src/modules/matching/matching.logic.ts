import { MatchingResultSchema, type MatchingResult, type MatchingSource } from "@surplus/shared";

export type MatchableFood = MatchingSource & {
  latitude: number | null;
  longitude: number | null;
};
export type MatchableRecipient = {
  recipientProfileId: string;
  organizationName: string;
  recipientType: string;
  serviceArea: string;
  serviceRadiusKm: number | null;
  latitude: number | null;
  longitude: number | null;
  acceptedCategories: string[];
  capacityQuantity: number | null;
  capacityUnit: string | null;
  verificationStatus: string;
  currentlyVerified: boolean;
  dietaryRestrictions: string | null;
};

export function haversineDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const radians = (degrees: number) => degrees * Math.PI / 180;
  const dLat = radians(lat2 - lat1);
  const dLon = radians(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(radians(lat1)) * Math.cos(radians(lat2)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const normalizeArea = (area: string) => area.trim().toLocaleLowerCase().replace(/\s+/g, " ");
const clampScore = (score: number, max: number) => Math.max(0, Math.min(max, Math.round(score)));

export function evaluateMatch(source: MatchableFood, recipient: MatchableRecipient, now = new Date()): MatchingResult {
  const reasons: string[] = [];
  const warnings: string[] = [];
  const problems: string[] = [];
  const hoursUntilExpiry = Math.max(0, (Date.parse(source.expiresAt) - now.getTime()) / 3_600_000);
  const preparedAt = source.preparedAt ? Date.parse(source.preparedAt) : null;

  if (source.status !== "AVAILABLE" && source.status !== "ACTIVE") problems.push("Food is not available.");
  if (hoursUntilExpiry <= 0) problems.push("Food has expired.");
  if (preparedAt !== null && preparedAt > now.getTime()) problems.push("Food is not prepared and available yet.");
  if (!recipient.currentlyVerified || recipient.verificationStatus !== "VERIFIED") problems.push("Recipient verification is not current.");
  else reasons.push("Recipient verification is current.");

  const categoryCompatible = recipient.acceptedCategories.length === 0 || recipient.acceptedCategories.includes(source.category);
  const categoryScore = categoryCompatible ? (recipient.acceptedCategories.length === 0 ? 22 : 35) : 0;
  if (categoryCompatible) {
    reasons.push(recipient.acceptedCategories.length === 0
      ? "Recipient has not listed category restrictions."
      : `Food category ${source.category.replace(/_/g, " ").toLowerCase()} is accepted.`);
  } else {
    problems.push(`Recipient does not accept the ${source.category.replace(/_/g, " ").toLowerCase()} category.`);
  }

  let quantityCompatibility: MatchingResult["quantityCompatibility"];
  let capacityScore: number;
  if (recipient.capacityQuantity === null && recipient.capacityUnit === null) {
    quantityCompatibility = "CAPACITY_UNKNOWN"; capacityScore = 12;
    warnings.push("Recipient capacity is not specified, so quantity fit cannot be confirmed.");
  } else if (recipient.capacityQuantity === null || recipient.capacityUnit === null) {
    quantityCompatibility = "CAPACITY_UNKNOWN"; capacityScore = 8;
    warnings.push("Recipient capacity details are incomplete, so quantity fit cannot be confirmed.");
  } else if (recipient.capacityUnit !== source.unit) {
    quantityCompatibility = "UNIT_INCOMPATIBLE"; capacityScore = 0;
    problems.push(`Quantity units cannot be compared safely (${source.unit} vs ${recipient.capacityUnit}).`);
  } else if (source.quantity > recipient.capacityQuantity) {
    quantityCompatibility = "EXCEEDS_CAPACITY"; capacityScore = 0;
    problems.push(`Donation quantity exceeds the recipient's stated capacity of ${recipient.capacityQuantity} ${recipient.capacityUnit.toLowerCase()}.`);
  } else {
    quantityCompatibility = "WITHIN_CAPACITY"; capacityScore = 25;
    reasons.push(`Donation quantity fits the recipient's stated capacity (${recipient.capacityQuantity} ${recipient.capacityUnit.toLowerCase()}).`);
  }

  let distanceKm: number | null = null;
  let locationCompatibility: MatchingResult["locationCompatibility"];
  let locationScore: number;
  if (source.latitude !== null && source.longitude !== null && recipient.latitude !== null && recipient.longitude !== null) {
    distanceKm = haversineDistanceKm(source.latitude, source.longitude, recipient.latitude, recipient.longitude);
    const approximateDistanceKm = Math.round(distanceKm);
    if (recipient.serviceRadiusKm !== null && distanceKm > recipient.serviceRadiusKm) {
      locationCompatibility = "OUTSIDE_SERVICE_RADIUS"; locationScore = 0;
      problems.push(`The approximate ${approximateDistanceKm} km straight-line distance is outside the recipient's ${recipient.serviceRadiusKm} km service radius.`);
    } else {
      locationCompatibility = recipient.serviceRadiusKm === null ? "DISTANCE_AVAILABLE" : "WITHIN_SERVICE_RADIUS";
      locationScore = clampScore(25 / (1 + distanceKm), 25);
      reasons.push(`Locations are about ${approximateDistanceKm} km apart in a straight line${recipient.serviceRadiusKm === null ? "." : `, within the ${recipient.serviceRadiusKm} km service radius.`}`);
      if (recipient.serviceRadiusKm === null) warnings.push("Distance is straight-line only and does not account for road routes or pickup time.");
    }
  } else {
    const sameArea = normalizeArea(source.pickupArea) === normalizeArea(recipient.serviceArea);
    locationCompatibility = sameArea ? "SAME_AREA" : "LOCATION_UNKNOWN";
    locationScore = sameArea ? 15 : 5;
    if (sameArea) reasons.push("Pickup and service areas have the same name.");
    warnings.push("Coordinates are incomplete, so distance could not be calculated.");
    if (recipient.serviceRadiusKm !== null) problems.push("The recipient has a service radius, but missing coordinates prevent checking it.");
  }

  const expiryScore = clampScore(15 / (1 + hoursUntilExpiry / 6), 15);
  if (hoursUntilExpiry <= 6) reasons.push(`Time-sensitive: food expires in about ${Math.max(1, Math.round(hoursUntilExpiry))} hour(s).`);
  else reasons.push(`Food remains usable until ${new Date(source.expiresAt).toISOString()}.`);
  if (source.preparedAt) reasons.push(`Preparation time is ${new Date(source.preparedAt).toISOString()}.`);
  if (recipient.dietaryRestrictions?.trim()) warnings.push("Recipient dietary notes are free text and are not automatically interpreted.");

  const factors = { category: categoryScore, location: locationScore, capacity: capacityScore, expiry: expiryScore };
  const eligible = problems.length === 0;
  return MatchingResultSchema.parse({
    eligible, score: factors.category + factors.location + factors.capacity + factors.expiry,
    factors, source: {
      sourceType: source.sourceType, sourceId: source.sourceId, communityDonationId: source.communityDonationId,
      communityStatus: source.communityStatus, foodName: source.foodName, category: source.category,
      quantity: source.quantity, unit: source.unit, preparedAt: source.preparedAt, expiresAt: source.expiresAt,
      pickupArea: source.pickupArea, status: source.status,
    },
    recipient: {
      recipientProfileId: recipient.recipientProfileId, organizationName: recipient.organizationName,
      recipientType: recipient.recipientType, serviceArea: recipient.serviceArea,
      serviceRadiusKm: recipient.serviceRadiusKm, acceptedCategories: recipient.acceptedCategories,
      capacityQuantity: recipient.capacityQuantity, capacityUnit: recipient.capacityUnit,
      verificationStatus: recipient.verificationStatus,
    },
    distanceKm: distanceKm === null ? null : Math.round(distanceKm),
    locationCompatibility, quantityCompatibility, hoursUntilExpiry: Math.round(hoursUntilExpiry * 100) / 100,
    reasons: [...problems, ...reasons], warnings: [...new Set(warnings)], suggestionOnly: true,
  });
}

export function sortMatches(matches: MatchingResult[]) {
  return matches.sort((a, b) => b.score - a.score
    || Date.parse(a.source.expiresAt) - Date.parse(b.source.expiresAt)
    || a.recipient.organizationName.localeCompare(b.recipient.organizationName)
    || a.source.sourceId.localeCompare(b.source.sourceId));
}
