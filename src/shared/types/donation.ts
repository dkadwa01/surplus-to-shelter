import { z } from "zod";

export const FoodCategorySchema = z.enum(["PREPARED_MEALS", "PRODUCE", "BAKERY", "DAIRY", "GRAINS", "PROTEIN", "OTHER"]);
export const QuantityUnitSchema = z.enum(["SERVINGS", "KG", "GRAMS", "LITRES", "ITEMS", "PACKAGES"]);
export const DonationStatusSchema = z.enum(["AVAILABLE", "CANCELLED", "EXPIRED"]);
export const futureDateTime = z.string().datetime({ offset: true }).refine((value) => Date.parse(value) > Date.now(), "Use-by time must be in the future.");

export const DonationFieldsSchema = z.object({
  foodName: z.string().trim().min(2, "Enter a food name.").max(120),
  category: FoodCategorySchema,
  quantity: z.number().finite().positive("Quantity must be greater than zero.").max(100000),
  unit: QuantityUnitSchema,
  preparedAt: z.string().datetime({ offset: true }).optional(),
  expiresAt: futureDateTime,
  pickupAddress: z.string().trim().min(5).max(240),
  pickupArea: z.string().trim().min(2).max(120),
  latitude: z.number().finite().min(-90).max(90).optional(),
  longitude: z.number().finite().min(-180).max(180).optional(),
  description: z.string().trim().max(1000).optional(),
}).superRefine((value, context) => {
  if ((value.latitude === undefined) !== (value.longitude === undefined)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["latitude"], message: "Provide both coordinates or leave both blank." });
  }
  if (value.preparedAt && Date.parse(value.preparedAt) > Date.parse(value.expiresAt)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["preparedAt"], message: "Preparation time cannot be after the use-by time." });
  }
});
export type DonationFields = z.infer<typeof DonationFieldsSchema>;

export const CreateDonationRequestSchema = DonationFieldsSchema;
export const UpdateDonationRequestSchema = DonationFieldsSchema;
export const DonationQuerySchema = z.object({ status: DonationStatusSchema.optional(), category: FoodCategorySchema.optional() });

export const DonationResponseSchema = z.object({
  id: z.string(), donorId: z.string(), donorType: z.string().nullable(), foodName: z.string(), category: FoodCategorySchema,
  quantity: z.number(), unit: QuantityUnitSchema, preparedAt: z.string().datetime().nullable(), expiresAt: z.string().datetime(),
  pickupAddress: z.string(), pickupArea: z.string(), latitude: z.number().nullable(), longitude: z.number().nullable(),
  description: z.string().nullable(), status: DonationStatusSchema, createdAt: z.string().datetime(), updatedAt: z.string().datetime(),
});
export type DonationResponse = z.infer<typeof DonationResponseSchema>;
