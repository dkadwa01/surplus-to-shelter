import { z } from "zod";
import { UserRoleSchema } from "./auth.js";
import { RecipientCapacityUnitSchema, RecipientTypeSchema } from "./recipient.js";
import { FoodCategorySchema } from "./donation.js";

export const VerificationParticipantTypeSchema = z.enum(["DONOR", "RECIPIENT", "DRIVER"]);
export const VerificationStatusSchema = z.enum(["PENDING", "UNDER_REVIEW", "VERIFIED", "REJECTED", "SUSPENDED"]);
export const UserVerificationStatusSchema = z.union([VerificationStatusSchema, z.literal("NOT_SUBMITTED")]);
export const DriverVehicleTypeSchema = z.enum(["CAR", "VAN", "TRUCK", "MOTORCYCLE", "BICYCLE", "OTHER"]);

export const SubmitVerificationRequestSchema = z.object({
  organizationName: z.string().trim().min(2).max(140).optional(),
  vehicleType: DriverVehicleTypeSchema.optional(),
  additionalInfo: z.string().trim().max(1000).optional(),
}).strict();
export type SubmitVerificationRequest = z.infer<typeof SubmitVerificationRequestSchema>;

export const VerificationReviewRequestSchema = z.object({
  action: z.enum(["UNDER_REVIEW", "VERIFIED", "REJECTED", "SUSPENDED"]),
  reason: z.string().trim().min(10, "Provide a reason of at least 10 characters.").max(500).optional(),
}).strict().superRefine((value, context) => {
  if ((value.action === "REJECTED" || value.action === "SUSPENDED") && !value.reason) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["reason"], message: "A reason is required for rejection or suspension." });
  }
});
export type VerificationReviewRequest = z.infer<typeof VerificationReviewRequestSchema>;

export const VerificationHistoryRecordSchema = z.object({
  id: z.string(), previousStatus: VerificationStatusSchema.nullable(), newStatus: VerificationStatusSchema,
  reason: z.string().nullable(), createdAt: z.string().datetime(),
});
export const VerificationRequestResponseSchema = z.object({
  id: z.string(), participantType: VerificationParticipantTypeSchema, status: VerificationStatusSchema,
  organizationName: z.string().nullable(), vehicleType: DriverVehicleTypeSchema.nullable(), additionalInfo: z.string().nullable(),
  reviewReason: z.string().nullable(), reviewedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(), updatedAt: z.string().datetime(), records: z.array(VerificationHistoryRecordSchema),
});
export const VerificationStatusResponseSchema = z.object({ status: UserVerificationStatusSchema, request: VerificationRequestResponseSchema.nullable() });
export type VerificationStatusResponse = z.infer<typeof VerificationStatusResponseSchema>;

export const VerificationAdminRequestResponseSchema = VerificationRequestResponseSchema.extend({
  applicant: z.object({
    id: z.string(), fullName: z.string(), email: z.string().email(), phone: z.string().nullable(), role: UserRoleSchema,
    donorType: z.string().nullable(), recipientOrganizationName: z.string().nullable(),
    recipientProfile: z.object({ recipientType: RecipientTypeSchema, address: z.string(), serviceArea: z.string(),
      capacityQuantity: z.number().nullable(), capacityUnit: RecipientCapacityUnitSchema.nullable(), acceptedCategories: z.array(FoodCategorySchema) }).nullable(),
  }),
});
export type VerificationAdminRequestResponse = z.infer<typeof VerificationAdminRequestResponseSchema>;
export const VerificationAdminListQuerySchema = z.object({ status: VerificationStatusSchema.optional() });
