import { DonationResponseSchema, type DonationFields } from "@surplus/shared";
import { prisma } from "../../config/prisma.js";
import { ApiError } from "../../shared/api-error.js";

function toResponse(donation: any) {
  return DonationResponseSchema.parse({ ...donation, donorType: donation.donor.donorType,
    preparedAt: donation.preparedAt?.toISOString() ?? null, expiresAt: donation.expiresAt.toISOString(),
    createdAt: donation.createdAt.toISOString(), updatedAt: donation.updatedAt.toISOString() });
}
const includeDonor = { donor: { select: { donorType: true } } } as const;
function dataFromFields(fields: DonationFields) {
  return { foodName: fields.foodName, category: fields.category, quantity: fields.quantity, unit: fields.unit,
    preparedAt: fields.preparedAt ? new Date(fields.preparedAt) : null, expiresAt: new Date(fields.expiresAt),
    pickupAddress: fields.pickupAddress, pickupArea: fields.pickupArea, latitude: fields.latitude ?? null,
    longitude: fields.longitude ?? null, description: fields.description ?? null };
}
async function assertIndividualThreshold(fields: DonationFields) {
  const threshold = await prisma.individualContributionThreshold.findUnique({ where: { category_unit: { category: fields.category, unit: fields.unit } } });
  if (threshold && fields.quantity < threshold.minimumQuantity) {
    throw new ApiError(400, "INVALID_INPUT", `Individual donations for this category and unit must be at least ${threshold.minimumQuantity} ${fields.unit.toLowerCase()}. Try contributing to a community collection for smaller portions.`);
  }
}
export async function createDonation(donorId: string, fields: DonationFields) {
  await assertIndividualThreshold(fields);
  return toResponse(await prisma.donation.create({ data: { ...dataFromFields(fields), donorId }, include: includeDonor }));
}
export async function listDonations(userId: string, isAdmin: boolean, filters: { status?: string; category?: string }) {
  await prisma.donation.updateMany({ where: { status: "AVAILABLE", expiresAt: { lte: new Date() }, ...(isAdmin ? {} : { donorId: userId }) }, data: { status: "EXPIRED" } });
  const where = { ...(isAdmin ? {} : { donorId: userId }), ...(filters.status ? { status: filters.status } : {}), ...(filters.category ? { category: filters.category } : {}) };
  return (await prisma.donation.findMany({ where, include: includeDonor, orderBy: { createdAt: "desc" }, take: 100 })).map(toResponse);
}
async function ownedDonation(id: string, userId: string, isAdmin: boolean) {
  await prisma.donation.updateMany({ where: { id, status: "AVAILABLE", expiresAt: { lte: new Date() } }, data: { status: "EXPIRED" } });
  const donation = await prisma.donation.findUnique({ where: { id }, include: includeDonor });
  if (!donation || (!isAdmin && donation.donorId !== userId)) throw new ApiError(404, "NOT_FOUND", "Donation not found.");
  return donation;
}
export async function getDonation(id: string, userId: string, isAdmin: boolean) {
  return toResponse(await ownedDonation(id, userId, isAdmin));
}
export async function updateDonation(id: string, userId: string, isAdmin: boolean, fields: DonationFields) {
  const current = await ownedDonation(id, userId, isAdmin);
  if (current.status !== "AVAILABLE" || current.expiresAt.getTime() <= Date.now()) throw new ApiError(409, "INVALID_STATE", "Only unexpired available donations can be edited.");
  await assertIndividualThreshold(fields);
  return toResponse(await prisma.donation.update({ where: { id }, data: dataFromFields(fields), include: includeDonor }));
}
export async function cancelDonation(id: string, userId: string, isAdmin: boolean) {
  const current = await ownedDonation(id, userId, isAdmin);
  if (current.status !== "AVAILABLE" || current.expiresAt.getTime() <= Date.now()) throw new ApiError(409, "INVALID_STATE", "Only unexpired available donations can be cancelled.");
  return toResponse(await prisma.donation.update({ where: { id }, data: { status: "CANCELLED" }, include: includeDonor }));
}
