import { Prisma } from "@prisma/client";
import { RecipientDiscoveryResponseSchema, RecipientProfileResponseSchema, type RecipientProfileFields } from "@surplus/shared";
import { prisma } from "../../config/prisma.js";
import { ApiError } from "../../shared/api-error.js";

const includeProfile = {
  user: { select: { fullName: true, email: true, phone: true } },
  acceptedCategories: { select: { category: true } },
} as const;
type ProfileWithRelations = Prisma.RecipientProfileGetPayload<{ include: typeof includeProfile }>;

function profileResponse(profile: ProfileWithRelations) {
  return RecipientProfileResponseSchema.parse({ ...profile,
    acceptedCategories: profile.acceptedCategories.map(({ category }) => category),
    contact: profile.user, createdAt: profile.createdAt.toISOString(), updatedAt: profile.updatedAt.toISOString() });
}
function discoveryResponse(profile: ProfileWithRelations) {
  return RecipientDiscoveryResponseSchema.parse({ id: profile.id, organizationName: profile.organizationName,
    recipientType: profile.recipientType, description: profile.description, serviceArea: profile.serviceArea,
    latitude: profile.latitude, longitude: profile.longitude, serviceRadiusKm: profile.serviceRadiusKm,
    acceptedCategories: profile.acceptedCategories.map(({ category }) => category), capacityQuantity: profile.capacityQuantity,
    capacityUnit: profile.capacityUnit, dietaryRestrictions: profile.dietaryRestrictions,
    availabilityNotes: profile.availabilityNotes, isAcceptingDonations: profile.isAcceptingDonations });
}
function profileData(fields: RecipientProfileFields) {
  const { acceptedCategories, ...scalars } = fields;
  return { ...scalars, acceptedCategories: { create: acceptedCategories.map((category) => ({ category })) } };
}

export async function createRecipientProfile(userId: string, fields: RecipientProfileFields) {
  try {
    const profile = await prisma.recipientProfile.create({ data: { ...profileData(fields), userId }, include: includeProfile });
    return profileResponse(profile);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new ApiError(409, "INVALID_STATE", "A recipient profile already exists for this account.");
    throw error;
  }
}
export async function getMyRecipientProfile(userId: string) {
  const profile = await prisma.recipientProfile.findUnique({ where: { userId }, include: includeProfile });
  if (!profile) throw new ApiError(404, "NOT_FOUND", "Recipient profile not found.");
  return profileResponse(profile);
}
export async function updateRecipientProfile(userId: string, fields: Partial<RecipientProfileFields>) {
  const { acceptedCategories, ...scalars } = fields;
  try {
    const profile = await prisma.$transaction(async (transaction) => {
      await transaction.recipientProfile.update({ where: { userId }, data: scalars });
      if (acceptedCategories !== undefined) {
        const current = await transaction.recipientProfile.findUniqueOrThrow({ where: { userId }, select: { id: true } });
        await transaction.recipientFoodCategory.deleteMany({ where: { profileId: current.id } });
        if (acceptedCategories.length) await transaction.recipientFoodCategory.createMany({ data: acceptedCategories.map((category) => ({ profileId: current.id, category })) });
      }
      return transaction.recipientProfile.findUniqueOrThrow({ where: { userId }, include: includeProfile });
    });
    return profileResponse(profile);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") throw new ApiError(404, "NOT_FOUND", "Recipient profile not found.");
    throw error;
  }
}
export async function discoverRecipients(filters: { recipientType?: string; serviceArea?: string; category?: string; accepting?: "true" | "false"; active?: "true" | "false" }) {
  const profiles = await prisma.recipientProfile.findMany({ where: {
    verificationStatus: "VERIFIED", isActive: filters.active === "false" ? false : true,
    isAcceptingDonations: filters.accepting === "false" ? false : true,
    ...(filters.recipientType ? { recipientType: filters.recipientType } : {}),
    ...(filters.serviceArea ? { serviceArea: { contains: filters.serviceArea } } : {}),
    ...(filters.category ? { acceptedCategories: { some: { category: filters.category } } } : {}),
  }, include: includeProfile, orderBy: { organizationName: "asc" }, take: 100 });
  return profiles.map(discoveryResponse);
}
