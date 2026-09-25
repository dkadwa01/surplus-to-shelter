import { z } from "zod";
import { UserRoleSchema } from "./auth.js";
import { FoodCategorySchema, QuantityUnitSchema } from "./donation.js";
import { RecipientCapacityUnitSchema } from "./recipient.js";
import { UserVerificationStatusSchema } from "./verification.js";

export const DashboardQuantityTotalSchema = z.object({ category: FoodCategorySchema.nullable(), unit: QuantityUnitSchema, quantity: z.number().nonnegative() });
export const DashboardMapPointSchema = z.object({ id: z.string(), type: z.enum(["DONATION", "COMMUNITY", "RECIPIENT"]), label: z.string(), area: z.string(), latitude: z.number().min(-90).max(90), longitude: z.number().min(-180).max(180) });
export const DashboardSummarySchema = z.object({
  role: UserRoleSchema,
  verificationStatus: UserVerificationStatusSchema,
  donations: z.object({ totalCount: z.number().int().nonnegative(), activeCount: z.number().int().nonnegative(), quantities: z.array(DashboardQuantityTotalSchema) }),
  community: z.object({ collectionCount: z.number().int().nonnegative(), activeContributionCount: z.number().int().nonnegative(), contributorCount: z.number().int().nonnegative(), quantities: z.array(DashboardQuantityTotalSchema) }),
  matching: z.object({ sourceCount: z.number().int().nonnegative().nullable(), pairCount: z.number().int().nonnegative().nullable(), note: z.string() }),
  delivery: z.object({ trackingAvailable: z.boolean(), activeCount: z.number().int().nonnegative().nullable(), completedCount: z.number().int().nonnegative().nullable(), deliveredQuantities: z.array(DashboardQuantityTotalSchema).nullable(), recipientOrganizationsServed: z.number().int().nonnegative().nullable() }),
  recipientProfile: z.object({ configured: z.boolean(), capacityQuantity: z.number().nullable(), capacityUnit: RecipientCapacityUnitSchema.nullable(), acceptedCategories: z.array(FoodCategorySchema), isActive: z.boolean(), isAcceptingDonations: z.boolean() }).nullable(),
  verifiedParticipants: z.object({ donors: z.number().int().nonnegative(), recipients: z.number().int().nonnegative(), drivers: z.number().int().nonnegative() }).nullable(),
  mapPoints: z.array(DashboardMapPointSchema),
});
export type DashboardSummary = z.infer<typeof DashboardSummarySchema>;
