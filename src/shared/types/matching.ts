import { z } from "zod";
import { FoodCategorySchema, QuantityUnitSchema } from "./donation.js";
import { RecipientCapacityUnitSchema, RecipientTypeSchema } from "./recipient.js";
import { CommunityDonationStatusSchema } from "./community-donation.js";

export const MatchingSourceTypeSchema = z.enum(["DONATION", "COMMUNITY_CONTRIBUTION"]);
export const MatchingQuantityCompatibilitySchema = z.enum(["WITHIN_CAPACITY", "CAPACITY_UNKNOWN", "EXCEEDS_CAPACITY", "UNIT_INCOMPATIBLE"]);
export const MatchingLocationCompatibilitySchema = z.enum(["WITHIN_SERVICE_RADIUS", "DISTANCE_AVAILABLE", "SAME_AREA", "OUTSIDE_SERVICE_RADIUS", "LOCATION_UNKNOWN"]);

export const MatchingRouteParamsSchema = z.object({
  sourceType: MatchingSourceTypeSchema,
  sourceId: z.string().trim().min(1).max(128),
  recipientProfileId: z.string().trim().min(1).max(128),
});

export const MatchingSourceSchema = z.object({
  sourceType: MatchingSourceTypeSchema,
  sourceId: z.string(),
  communityDonationId: z.string().nullable(),
  communityStatus: CommunityDonationStatusSchema.nullable(),
  foodName: z.string(), category: FoodCategorySchema, quantity: z.number().positive(), unit: QuantityUnitSchema,
  preparedAt: z.string().datetime().nullable(), expiresAt: z.string().datetime(), pickupArea: z.string(), status: z.enum(["AVAILABLE", "ACTIVE"]),
});
export type MatchingSource = z.infer<typeof MatchingSourceSchema>;

export const MatchingRecipientSchema = z.object({
  recipientProfileId: z.string(), organizationName: z.string(), recipientType: RecipientTypeSchema,
  serviceArea: z.string(), serviceRadiusKm: z.number().nullable(), acceptedCategories: z.array(FoodCategorySchema),
  capacityQuantity: z.number().nullable(), capacityUnit: RecipientCapacityUnitSchema.nullable(),
  verificationStatus: z.literal("VERIFIED"),
});
export const MatchingFactorScoresSchema = z.object({ category: z.number().int().min(0).max(35), location: z.number().int().min(0).max(25), capacity: z.number().int().min(0).max(25), expiry: z.number().int().min(0).max(15) });
export const MatchingResultSchema = z.object({
  eligible: z.boolean(), score: z.number().int().min(0).max(100), factors: MatchingFactorScoresSchema,
  source: MatchingSourceSchema, recipient: MatchingRecipientSchema,
  distanceKm: z.number().nonnegative().nullable(), locationCompatibility: MatchingLocationCompatibilitySchema,
  quantityCompatibility: MatchingQuantityCompatibilitySchema, hoursUntilExpiry: z.number().nonnegative(),
  reasons: z.array(z.string()), warnings: z.array(z.string()),
  suggestionOnly: z.literal(true),
});
export type MatchingResult = z.infer<typeof MatchingResultSchema>;
export const DonationMatchesResponseSchema = z.object({ donationId: z.string(), matches: z.array(MatchingResultSchema) });
export const RecipientMatchesResponseSchema = z.object({ recipientProfileId: z.string(), matches: z.array(MatchingResultSchema) });
export const CommunitySourceMatchesResponseSchema = z.object({ source: MatchingSourceSchema, matches: z.array(MatchingResultSchema) });
export const CommunityDonationMatchesResponseSchema = z.object({
  communityDonationId: z.string(), title: z.string(), pickupArea: z.string(), status: CommunityDonationStatusSchema,
  sources: z.array(CommunitySourceMatchesResponseSchema),
});
export type DonationMatchesResponse = z.infer<typeof DonationMatchesResponseSchema>;
export type RecipientMatchesResponse = z.infer<typeof RecipientMatchesResponseSchema>;
export type CommunityDonationMatchesResponse = z.infer<typeof CommunityDonationMatchesResponseSchema>;
