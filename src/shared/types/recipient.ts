import { z } from "zod";
import { FoodCategorySchema } from "./donation.js";

export const RecipientTypeSchema = z.enum(["NGO", "SHELTER", "COMMUNITY_ORGANIZATION", "FOOD_DISTRIBUTION_ORGANIZATION", "OTHER"]);
export const RecipientVerificationStatusSchema = z.enum(["PENDING", "VERIFIED", "REJECTED", "RESTRICTED"]);
export const RecipientCapacityUnitSchema = z.enum(["SERVINGS", "KG", "MEALS", "PACKAGES"]);

const recipientProfileFieldsObject = z.object({
  organizationName: z.string().trim().min(2).max(140),
  recipientType: RecipientTypeSchema,
  description: z.string().trim().max(1000).optional(),
  address: z.string().trim().min(5).max(240),
  serviceArea: z.string().trim().min(2).max(120),
  latitude: z.number().finite().min(-90).max(90).optional(),
  longitude: z.number().finite().min(-180).max(180).optional(),
  serviceRadiusKm: z.number().finite().positive().max(250).optional(),
  acceptedCategories: z.array(FoodCategorySchema).max(7).refine((values) => new Set(values).size === values.length, "Remove duplicate food categories.").default([]),
  capacityQuantity: z.number().finite().positive().max(100000).optional(),
  capacityUnit: RecipientCapacityUnitSchema.optional(),
  dietaryRestrictions: z.string().trim().max(500).optional(),
  availabilityNotes: z.string().trim().max(500).optional(),
  isAcceptingDonations: z.boolean().default(true),
  isActive: z.boolean().default(true),
});

export const RecipientProfileFieldsSchema = recipientProfileFieldsObject.superRefine((value, context) => {
  if ((value.latitude === undefined) !== (value.longitude === undefined)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["latitude"], message: "Provide both coordinates or leave both blank." });
  }
  if ((value.capacityQuantity === undefined) !== (value.capacityUnit === undefined)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["capacityQuantity"], message: "Provide both a capacity and its unit, or leave both blank." });
  }
  if (value.serviceRadiusKm !== undefined && value.latitude === undefined) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["serviceRadiusKm"], message: "A service radius requires map coordinates." });
  }
});
export type RecipientProfileFields = z.infer<typeof RecipientProfileFieldsSchema>;

export const CreateRecipientProfileRequestSchema = RecipientProfileFieldsSchema;
export const UpdateRecipientProfileRequestSchema = recipientProfileFieldsObject.partial().superRefine((value, context) => {
  if (Object.keys(value).length === 0) context.addIssue({ code: z.ZodIssueCode.custom, message: "Provide at least one field to update." });
  if ((value.latitude === undefined) !== (value.longitude === undefined) && (value.latitude !== undefined || value.longitude !== undefined)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["latitude"], message: "Provide both coordinates together." });
  }
  if ((value.capacityQuantity === undefined) !== (value.capacityUnit === undefined) && (value.capacityQuantity !== undefined || value.capacityUnit !== undefined)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["capacityQuantity"], message: "Provide capacity and its unit together." });
  }
  if (value.serviceRadiusKm !== undefined && value.latitude === undefined) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["serviceRadiusKm"], message: "Update coordinates together with a service radius." });
  }
});

export const RecipientProfileResponseSchema = z.object({
  id: z.string(), userId: z.string(), organizationName: z.string(), recipientType: RecipientTypeSchema,
  description: z.string().nullable(), address: z.string(), serviceArea: z.string(), latitude: z.number().nullable(), longitude: z.number().nullable(),
  serviceRadiusKm: z.number().nullable(), acceptedCategories: z.array(FoodCategorySchema), capacityQuantity: z.number().nullable(),
  capacityUnit: RecipientCapacityUnitSchema.nullable(), dietaryRestrictions: z.string().nullable(), availabilityNotes: z.string().nullable(),
  isAcceptingDonations: z.boolean(), isActive: z.boolean(), verificationStatus: RecipientVerificationStatusSchema,
  contact: z.object({ fullName: z.string(), email: z.string().email(), phone: z.string().nullable() }),
  createdAt: z.string().datetime(), updatedAt: z.string().datetime(),
});
export type RecipientProfileResponse = z.infer<typeof RecipientProfileResponseSchema>;

export const RecipientDiscoveryQuerySchema = z.object({
  recipientType: RecipientTypeSchema.optional(),
  serviceArea: z.string().trim().min(2).max(120).optional(),
  category: FoodCategorySchema.optional(),
  accepting: z.enum(["true", "false"]).optional(),
  active: z.enum(["true", "false"]).optional(),
});
export const RecipientDiscoveryResponseSchema = z.object({
  id: z.string(), organizationName: z.string(), recipientType: RecipientTypeSchema,
  description: z.string().nullable(), serviceArea: z.string(), latitude: z.number().nullable(), longitude: z.number().nullable(),
  serviceRadiusKm: z.number().nullable(), acceptedCategories: z.array(FoodCategorySchema), capacityQuantity: z.number().nullable(),
  capacityUnit: RecipientCapacityUnitSchema.nullable(), dietaryRestrictions: z.string().nullable(), availabilityNotes: z.string().nullable(),
  isAcceptingDonations: z.boolean(),
});
export type RecipientDiscoveryResponse = z.infer<typeof RecipientDiscoveryResponseSchema>;
