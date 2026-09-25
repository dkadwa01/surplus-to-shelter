import { z } from "zod";
import { FoodCategorySchema, futureDateTime, QuantityUnitSchema } from "./donation.js";

export const CommunityDonationStatusSchema = z.enum(["OPEN", "TARGET_REACHED", "CLOSED", "CANCELLED", "EXPIRED"]);
export const CommunityContributionStatusSchema = z.enum(["ACTIVE", "RESERVED", "DELIVERED", "WITHDRAWN"]);

export const CreateCommunityDonationRequestSchema = z.object({
  title: z.string().trim().min(3).max(120),
  description: z.string().trim().max(1000).optional(),
  pickupArea: z.string().trim().min(2).max(120),
  latitude: z.number().finite().min(-90).max(90).optional(),
  longitude: z.number().finite().min(-180).max(180).optional(),
  deadline: futureDateTime,
  targetQuantity: z.number().finite().positive().max(100000).optional(),
  targetUnit: QuantityUnitSchema.optional(),
  targetCategory: FoodCategorySchema.optional(),
}).superRefine((value, context) => {
  if ((value.latitude === undefined) !== (value.longitude === undefined)) context.addIssue({ code: z.ZodIssueCode.custom, path: ["latitude"], message: "Provide both coordinates or leave both blank." });
  const targetFields = [value.targetQuantity, value.targetUnit, value.targetCategory];
  if (targetFields.some((field) => field !== undefined) && targetFields.some((field) => field === undefined)) context.addIssue({ code: z.ZodIssueCode.custom, path: ["targetQuantity"], message: "Provide a target quantity, category, and unit together." });
});
export type CreateCommunityDonationRequest = z.infer<typeof CreateCommunityDonationRequestSchema>;

export const CommunityContributionFieldsSchema = z.object({
  foodName: z.string().trim().min(2).max(120), category: FoodCategorySchema,
  quantity: z.number().finite().positive("Quantity must be greater than zero.").max(100000), unit: QuantityUnitSchema,
  expiresAt: futureDateTime, note: z.string().trim().max(500).optional(),
});
export type CommunityContributionFields = z.infer<typeof CommunityContributionFieldsSchema>;
export const CreateCommunityContributionRequestSchema = CommunityContributionFieldsSchema;
export const UpdateCommunityContributionRequestSchema = CommunityContributionFieldsSchema;

export const CommunityDonationQuerySchema = z.object({
  status: CommunityDonationStatusSchema.optional(), pickupArea: z.string().trim().min(2).max(120).optional(),
});
export const CommunityQuantityTotalSchema = z.object({ category: FoodCategorySchema, unit: QuantityUnitSchema, quantity: z.number().nonnegative() });
export const CommunityContributionSummarySchema = z.object({
  id: z.string(), foodName: z.string(), category: FoodCategorySchema, quantity: z.number(), unit: QuantityUnitSchema,
  expiresAt: z.string().datetime(), note: z.string().nullable(), status: CommunityContributionStatusSchema,
  isMine: z.boolean(), belowIndividualThreshold: z.boolean(), createdAt: z.string().datetime(),
});
export const CommunityDonationResponseSchema = z.object({
  id: z.string(), title: z.string(), description: z.string().nullable(), pickupArea: z.string(),
  latitude: z.number().nullable(), longitude: z.number().nullable(),
  targetQuantity: z.number().nullable(), targetCategory: FoodCategorySchema.nullable(), targetUnit: QuantityUnitSchema.nullable(),
  deadline: z.string().datetime(), status: CommunityDonationStatusSchema,
  totals: z.array(CommunityQuantityTotalSchema), targetProgressPercent: z.number().nullable(),
  contributorCount: z.number().int().nonnegative(), contributions: z.array(CommunityContributionSummarySchema),
  isOrganizer: z.boolean(), createdAt: z.string().datetime(), updatedAt: z.string().datetime(),
});
export type CommunityDonationResponse = z.infer<typeof CommunityDonationResponseSchema>;
export const CommunityContributionResponseSchema = z.object({
  id: z.string(), communityDonationId: z.string(), foodName: z.string(), category: FoodCategorySchema,
  quantity: z.number(), unit: QuantityUnitSchema, expiresAt: z.string().datetime(), note: z.string().nullable(),
  status: CommunityContributionStatusSchema, belowIndividualThreshold: z.boolean(), isEditable: z.boolean(),
  createdAt: z.string().datetime(), updatedAt: z.string().datetime(),
});
export type CommunityContributionResponse = z.infer<typeof CommunityContributionResponseSchema>;
export const IndividualContributionThresholdSchema = z.object({ category: FoodCategorySchema, unit: QuantityUnitSchema, minimumQuantity: z.number().positive() });
export const UpsertIndividualContributionThresholdRequestSchema = IndividualContributionThresholdSchema;
export const IndividualContributionThresholdResponseSchema = IndividualContributionThresholdSchema.extend({ id: z.string(), updatedAt: z.string().datetime() });
