import { z } from "zod";
import { QuantityUnitSchema } from "./donation.js";

export const DriverAvailabilitySchema = z.enum(["AVAILABLE", "BUSY", "OFFLINE"]);
export const DriverAvailabilityInputSchema = z.enum(["AVAILABLE", "OFFLINE"]);
export const DispatchStatusSchema = z.enum(["AVAILABLE", "ACCEPTED", "PICKUP_STARTED", "PICKED_UP", "IN_TRANSIT", "DELIVERED", "COMPLETED", "CANCELLED"]);
const driverProfileFieldsSchema = z.object({
  vehicleType: z.string().trim().min(2).max(60),
  capacityQuantity: z.number().finite().positive().max(100000),
  capacityUnit: QuantityUnitSchema,
  serviceArea: z.string().trim().min(2).max(120),
  serviceRadiusKm: z.number().finite().positive().max(1000).optional(),
  latitude: z.number().finite().min(-90).max(90).optional(),
  longitude: z.number().finite().min(-180).max(180).optional(),
});
export const DriverProfileInputSchema = driverProfileFieldsSchema.superRefine((value, context) => {
  if ((value.latitude === undefined) !== (value.longitude === undefined)) context.addIssue({ code: z.ZodIssueCode.custom, path: ["latitude"], message: "Provide both coordinates or leave both blank." });
});
export const DriverAvailabilityRequestSchema = z.object({ availability: DriverAvailabilityInputSchema });
export const DriverProfileResponseSchema = driverProfileFieldsSchema.extend({
  id: z.string(), availability: DriverAvailabilitySchema, verificationStatus: z.enum(["NOT_SUBMITTED", "PENDING", "UNDER_REVIEW", "VERIFIED", "REJECTED", "SUSPENDED"]),
});
export const CreateDispatchRequestSchema = z.discriminatedUnion("sourceType", [
  z.object({ sourceType: z.literal("DONATION"), sourceId: z.string().min(1), recipientProfileId: z.string().min(1) }),
  z.object({ sourceType: z.literal("COMMUNITY_CONTRIBUTION"), sourceId: z.string().min(1), recipientProfileId: z.string().min(1) }),
]);
export const DispatchResponseSchema = z.object({
  id: z.string(), sourceType: z.enum(["DONATION", "COMMUNITY_CONTRIBUTION"]), sourceId: z.string(), communityDonationId: z.string().nullable(),
  foodName: z.string(), category: z.string(), quantity: z.number(), unit: z.string(), expiresAt: z.string().datetime(),
  pickupAddress: z.string(), pickupArea: z.string(), pickupLatitude: z.number().nullable(), pickupLongitude: z.number().nullable(),
  recipientProfileId: z.string(), recipientName: z.string(), deliveryAddress: z.string(), deliveryArea: z.string(), deliveryLatitude: z.number().nullable(), deliveryLongitude: z.number().nullable(),
  distanceKm: z.number().nullable(), status: DispatchStatusSchema, assignedDriverId: z.string().nullable(),
  pickupStartedAt: z.string().datetime().nullable(), pickedUpAt: z.string().datetime().nullable(), transitStartedAt: z.string().datetime().nullable(),
  deliveredAt: z.string().datetime().nullable(), completedAt: z.string().datetime().nullable(), cancelledAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(), updatedAt: z.string().datetime(),
});
export const DispatchListResponseSchema = z.object({ assignments: z.array(DispatchResponseSchema) });
export type DriverProfileInput = z.infer<typeof DriverProfileInputSchema>;
export type CreateDispatchRequest = z.infer<typeof CreateDispatchRequestSchema>;
export type DriverProfileResponse = z.infer<typeof DriverProfileResponseSchema>;
export type DispatchResponse = z.infer<typeof DispatchResponseSchema>;
