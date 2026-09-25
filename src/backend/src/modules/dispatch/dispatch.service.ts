import { Prisma } from "@prisma/client";
import { DriverProfileResponseSchema, DispatchListResponseSchema, DispatchResponseSchema, type DriverProfileInput } from "@surplus/shared";
import { prisma } from "../../config/prisma.js";
import { ApiError } from "../../shared/api-error.js";
import { getMatchDetails } from "../matching/matching.service.js";
import { haversineDistanceKm } from "../matching/matching.logic.js";
import { getMyVerificationStatus, isUserVerified } from "../verification/verification.service.js";

import type { CreateDispatchRequest } from "@surplus/shared";
const assignmentInclude = {
  donation: true,
  communityContribution: { include: { communityDonation: true } },
  recipientProfile: true,
} as const;
type Assignment = Prisma.DispatchAssignmentGetPayload<{ include: typeof assignmentInclude }>;

const serializeDate = (date: Date | null) => date?.toISOString() ?? null;
async function driverResponse(profile: Prisma.DriverProfileGetPayload<{}>) {
  const verification = await getMyVerificationStatus(profile.userId);
  return DriverProfileResponseSchema.parse({
    ...profile, serviceRadiusKm: profile.serviceRadiusKm ?? undefined,
    latitude: profile.latitude ?? undefined, longitude: profile.longitude ?? undefined,
    verificationStatus: verification.status,
  });
}
function toDispatchResponse(row: Assignment) {
  const food = row.donation ?? row.communityContribution;
  if (!food) throw new Error("Dispatch assignment has no food source.");
  const community = row.communityContribution?.communityDonation;
  const direct = row.donation;
  const pickupAddress = direct?.pickupAddress ?? community?.pickupArea ?? "";
  const pickupArea = direct?.pickupArea ?? community?.pickupArea ?? "";
  const pickupLatitude = direct?.latitude ?? community?.latitude ?? null;
  const pickupLongitude = direct?.longitude ?? community?.longitude ?? null;
  const distanceKm = pickupLatitude !== null && pickupLongitude !== null && row.recipientProfile.latitude !== null && row.recipientProfile.longitude !== null
    ? Math.round(haversineDistanceKm(pickupLatitude, pickupLongitude, row.recipientProfile.latitude, row.recipientProfile.longitude)) : null;
  return DispatchResponseSchema.parse({
    id: row.id, sourceType: direct ? "DONATION" : "COMMUNITY_CONTRIBUTION", sourceId: direct?.id ?? row.communityContribution!.id,
    communityDonationId: community?.id ?? null, foodName: food.foodName, category: food.category, quantity: food.quantity, unit: food.unit,
    expiresAt: food.expiresAt.toISOString(), pickupAddress, pickupArea, pickupLatitude, pickupLongitude,
    recipientProfileId: row.recipientProfileId, recipientName: row.recipientProfile.organizationName,
    deliveryAddress: row.recipientProfile.address, deliveryArea: row.recipientProfile.serviceArea,
    deliveryLatitude: row.recipientProfile.latitude, deliveryLongitude: row.recipientProfile.longitude,
    distanceKm, status: row.status, assignedDriverId: row.assignedDriverId,
    pickupStartedAt: serializeDate(row.pickupStartedAt), pickedUpAt: serializeDate(row.pickedUpAt), transitStartedAt: serializeDate(row.transitStartedAt),
    deliveredAt: serializeDate(row.deliveredAt), completedAt: serializeDate(row.completedAt), cancelledAt: serializeDate(row.cancelledAt),
    createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString(),
  });
}

async function getAssignment(id: string) {
  const assignment = await prisma.dispatchAssignment.findUnique({ where: { id }, include: assignmentInclude });
  if (!assignment) throw new ApiError(404, "NOT_FOUND", "Dispatch assignment not found.");
  return assignment;
}

export async function getDriverProfile(userId: string) {
  const profile = await prisma.driverProfile.findUnique({ where: { userId } });
  if (!profile) return null;
  return driverResponse(profile);
}

export async function saveDriverProfile(userId: string, fields: DriverProfileInput) {
  const current = await prisma.driverProfile.findUnique({ where: { userId } });
  if (current?.availability === "BUSY") throw new ApiError(409, "INVALID_STATE", "Driver profile cannot be changed during an active assignment.");
  const profile = await prisma.driverProfile.upsert({
    where: { userId },
    create: { userId, vehicleType: fields.vehicleType, capacityQuantity: fields.capacityQuantity, capacityUnit: fields.capacityUnit, serviceArea: fields.serviceArea, serviceRadiusKm: fields.serviceRadiusKm ?? null, latitude: fields.latitude ?? null, longitude: fields.longitude ?? null },
    update: { vehicleType: fields.vehicleType, capacityQuantity: fields.capacityQuantity, capacityUnit: fields.capacityUnit, serviceArea: fields.serviceArea, serviceRadiusKm: fields.serviceRadiusKm ?? null, latitude: fields.latitude ?? null, longitude: fields.longitude ?? null },
  });
  return driverResponse(profile);
}

export async function setDriverAvailability(userId: string, availability: "AVAILABLE" | "OFFLINE") {
  if (availability === "AVAILABLE" && !(await isUserVerified(userId))) throw new ApiError(403, "VERIFICATION_REQUIRED", "Current driver verification is required to become available.");
  const result = await prisma.driverProfile.updateMany({ where: { userId, availability: { not: "BUSY" } }, data: { availability } });
  if (!result.count) {
    const exists = await prisma.driverProfile.findUnique({ where: { userId } });
    if (!exists) throw new ApiError(409, "INVALID_STATE", "Complete your driver profile before changing availability.");
    throw new ApiError(409, "INVALID_STATE", "Availability cannot change during an active assignment.");
  }
  return getDriverProfile(userId);
}

function isSuitable(profile: { serviceArea: string; serviceRadiusKm: number | null; capacityQuantity: number; capacityUnit: string; latitude: number | null; longitude: number | null }, assignment: Assignment) {
  const food = assignment.donation ?? assignment.communityContribution;
  if (!food || food.quantity > profile.capacityQuantity || food.unit !== profile.capacityUnit) return false;
  const group = assignment.communityContribution?.communityDonation;
  const pickupArea = assignment.donation?.pickupArea ?? group?.pickupArea ?? "";
  const latitude = assignment.donation?.latitude ?? group?.latitude ?? null;
  const longitude = assignment.donation?.longitude ?? group?.longitude ?? null;
  if (latitude !== null && longitude !== null && profile.latitude !== null && profile.longitude !== null) {
    const distance = haversineDistanceKm(profile.latitude, profile.longitude, latitude, longitude);
    return profile.serviceRadiusKm !== null
      ? distance <= profile.serviceRadiusKm
      : pickupArea.trim().toLocaleLowerCase() === profile.serviceArea.trim().toLocaleLowerCase();
  }
  return pickupArea.trim().toLocaleLowerCase() === profile.serviceArea.trim().toLocaleLowerCase();
}

async function requireDispatchReadyDriver(userId: string) {
  if (!(await isUserVerified(userId))) throw new ApiError(403, "VERIFICATION_REQUIRED", "Current driver verification is required.");
  const profile = await prisma.driverProfile.findUnique({ where: { userId } });
  if (!profile) throw new ApiError(409, "INVALID_STATE", "Complete your driver profile first.");
  return profile;
}

export async function listAvailableAssignments(userId: string) {
  const profile = await requireDispatchReadyDriver(userId);
  if (profile.availability !== "AVAILABLE") throw new ApiError(409, "INVALID_STATE", "Set your driver availability to available to browse assignments.");
  const rows = await prisma.dispatchAssignment.findMany({ where: { status: "AVAILABLE" }, include: assignmentInclude, orderBy: { createdAt: "asc" }, take: 100 });
  const suitable = rows.filter((row) => {
    const food = row.donation ?? row.communityContribution;
    return food && food.expiresAt.getTime() > Date.now() && isSuitable(profile, row);
  });
  return DispatchListResponseSchema.parse({ assignments: suitable.map(toDispatchResponse) });
}

export async function listMyAssignments(userId: string, role: string) {
  const where = role === "DRIVER" ? { assignedDriverId: userId } : role === "RECIPIENT"
    ? { recipientProfile: { userId } } : role === "DONOR" ? { createdById: userId } : {};
  const rows = await prisma.dispatchAssignment.findMany({ where, include: assignmentInclude, orderBy: { updatedAt: "desc" }, take: 100 });
  return DispatchListResponseSchema.parse({ assignments: rows.map(toDispatchResponse) });
}

export async function getVisibleAssignment(id: string, userId: string, role: string) {
  const row = await getAssignment(id);
  const owns = row.createdById === userId || row.recipientProfile.userId === userId || row.assignedDriverId === userId;
  if (!owns && role === "DRIVER" && row.status === "AVAILABLE" && await isUserVerified(userId)) {
    const profile = await prisma.driverProfile.findUnique({ where: { userId } });
    if (profile?.availability === "AVAILABLE" && isSuitable(profile, row)) return toDispatchResponse(row);
  }
  if (!owns && role !== "ADMIN") throw new ApiError(404, "NOT_FOUND", "Dispatch assignment not found.");
  return toDispatchResponse(row);
}

export async function createDispatch(userId: string, input: CreateDispatchRequest) {
  if (!(await isUserVerified(userId))) throw new ApiError(403, "VERIFICATION_REQUIRED", "Current donor verification is required to prepare dispatch.");
  const match = await getMatchDetails(input.sourceType, input.sourceId, input.recipientProfileId, userId, "DONOR");
  if (!match.eligible) throw new ApiError(409, "INVALID_STATE", "The selected source and recipient no longer form an eligible match.");
  let communityDonationId: string | null = null;
  if (input.sourceType === "COMMUNITY_CONTRIBUTION") {
    const source = await prisma.communityContribution.findUnique({ where: { id: input.sourceId }, include: { communityDonation: true } });
    if (!source) throw new ApiError(404, "NOT_FOUND", "Donation source not found.");
    if (source.communityDonation.creatorId !== userId) throw new ApiError(404, "NOT_FOUND", "Community donation not found.");
    communityDonationId = source.communityDonationId;
  } else {
    const source = await prisma.donation.findUnique({ where: { id: input.sourceId } });
    if (!source || source.donorId !== userId) throw new ApiError(404, "NOT_FOUND", "Donation not found.");
  }

  try {
    const row = await prisma.$transaction(async (tx) => {
      const now = new Date();
      const reserved = input.sourceType === "DONATION"
        ? await tx.donation.updateMany({ where: { id: input.sourceId, donorId: userId, status: "AVAILABLE", expiresAt: { gt: now } }, data: { status: "RESERVED" } })
        : await tx.communityContribution.updateMany({ where: { id: input.sourceId, status: "ACTIVE", expiresAt: { gt: now }, communityDonation: { creatorId: userId, status: { in: ["TARGET_REACHED", "CLOSED"] } } }, data: { status: "RESERVED" } });
      if (!reserved.count) throw new ApiError(409, "INVALID_STATE", "This food source is no longer available for dispatch.");
      const existing = input.sourceType === "DONATION"
        ? await tx.dispatchAssignment.findUnique({ where: { donationId: input.sourceId }, include: assignmentInclude })
        : await tx.dispatchAssignment.findUnique({ where: { communityContributionId: input.sourceId }, include: assignmentInclude });
      if (existing) {
        if (existing.status !== "CANCELLED") throw new ApiError(409, "INVALID_STATE", "A dispatch assignment already exists for this food source.");
        return tx.dispatchAssignment.update({ where: { id: existing.id }, data: { recipientProfileId: input.recipientProfileId, createdById: userId, assignedDriverId: null, status: "AVAILABLE", cancelledAt: null }, include: assignmentInclude });
      }
      return tx.dispatchAssignment.create({ data: {
        donationId: input.sourceType === "DONATION" ? input.sourceId : null,
        communityContributionId: input.sourceType === "COMMUNITY_CONTRIBUTION" ? input.sourceId : null,
        communityDonationId,
        recipientProfileId: input.recipientProfileId, createdById: userId,
      }, include: assignmentInclude });
    });
    return toDispatchResponse(row);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new ApiError(409, "INVALID_STATE", "A dispatch assignment already exists for this food source.");
    throw error;
  }
}

export async function acceptAssignment(id: string, userId: string) {
  const profile = await requireDispatchReadyDriver(userId);
  if (profile.availability !== "AVAILABLE") throw new ApiError(409, "INVALID_STATE", "You must be available to accept an assignment.");
  const current = await getAssignment(id);
  const food = current.donation ?? current.communityContribution;
  if (current.status !== "AVAILABLE" || !food || food.expiresAt.getTime() <= Date.now() || !isSuitable(profile, current)) throw new ApiError(409, "INVALID_STATE", "This assignment is unavailable or outside your transport capacity/service area.");
  const updated = await prisma.$transaction(async (tx) => {
    const claim = await tx.dispatchAssignment.updateMany({ where: { id, status: "AVAILABLE", assignedDriverId: null }, data: { status: "ACCEPTED", assignedDriverId: userId } });
    if (!claim.count) throw new ApiError(409, "INVALID_STATE", "Another driver has accepted this assignment.");
    const busy = await tx.driverProfile.updateMany({ where: { userId, availability: "AVAILABLE" }, data: { availability: "BUSY" } });
    if (!busy.count) throw new ApiError(409, "INVALID_STATE", "Driver availability changed; refresh and try again.");
    return tx.dispatchAssignment.findUniqueOrThrow({ where: { id }, include: assignmentInclude });
  });
  return toDispatchResponse(updated);
}

export async function declineAssignment(id: string, userId: string) {
  const current = await getAssignment(id);
  if (current.assignedDriverId !== userId) throw new ApiError(404, "NOT_FOUND", "Dispatch assignment not found.");
  if (current.status !== "ACCEPTED") throw new ApiError(409, "INVALID_STATE", "An assignment can only be declined before pickup starts.");
  const updated = await prisma.$transaction(async (tx) => {
    const released = await tx.dispatchAssignment.updateMany({ where: { id, assignedDriverId: userId, status: "ACCEPTED" }, data: { status: "AVAILABLE", assignedDriverId: null } });
    if (!released.count) throw new ApiError(409, "INVALID_STATE", "Assignment changed; refresh and try again.");
    await tx.driverProfile.updateMany({ where: { userId, availability: "BUSY" }, data: { availability: "AVAILABLE" } });
    return tx.dispatchAssignment.findUniqueOrThrow({ where: { id }, include: assignmentInclude });
  });
  return toDispatchResponse(updated);
}

type Transition = "PICKUP_STARTED" | "PICKED_UP" | "IN_TRANSIT" | "DELIVERED" | "COMPLETED";
const transitionFrom: Record<Transition, string> = { PICKUP_STARTED: "ACCEPTED", PICKED_UP: "PICKUP_STARTED", IN_TRANSIT: "PICKED_UP", DELIVERED: "IN_TRANSIT", COMPLETED: "DELIVERED" };
export async function advanceAssignment(id: string, userId: string, next: Transition) {
  const timestamp: Record<Transition, keyof Prisma.DispatchAssignmentUpdateManyMutationInput> = {
    PICKUP_STARTED: "pickupStartedAt", PICKED_UP: "pickedUpAt", IN_TRANSIT: "transitStartedAt", DELIVERED: "deliveredAt", COMPLETED: "completedAt",
  };
  const updated = await prisma.$transaction(async (tx) => {
    const current = await tx.dispatchAssignment.findUnique({ where: { id }, include: assignmentInclude });
    if (!current || current.assignedDriverId !== userId) throw new ApiError(404, "NOT_FOUND", "Dispatch assignment not found.");
    if (current.status !== transitionFrom[next]) throw new ApiError(409, "INVALID_STATE", `Cannot move dispatch from ${current.status} to ${next}.`);
    if (next === "PICKED_UP" || next === "DELIVERED") {
      const food = current.donation ?? current.communityContribution;
      if (!food || food.expiresAt.getTime() <= Date.now()) throw new ApiError(409, "INVALID_STATE", "This food is past its safe-use time and cannot advance in dispatch.");
    }
    const changed = await tx.dispatchAssignment.updateMany({ where: { id, assignedDriverId: userId, status: transitionFrom[next] }, data: { status: next, [timestamp[next]]: new Date() } });
    if (!changed.count) throw new ApiError(409, "INVALID_STATE", "Assignment changed; refresh and try again.");
    if (next === "DELIVERED") {
      if (current.donationId) await tx.donation.updateMany({ where: { id: current.donationId, status: "RESERVED" }, data: { status: "DELIVERED" } });
      if (current.communityContributionId) await tx.communityContribution.updateMany({ where: { id: current.communityContributionId, status: "RESERVED" }, data: { status: "DELIVERED" } });
    }
    if (next === "COMPLETED") await tx.driverProfile.updateMany({ where: { userId, availability: "BUSY" }, data: { availability: "AVAILABLE" } });
    return tx.dispatchAssignment.findUniqueOrThrow({ where: { id }, include: assignmentInclude });
  });
  return toDispatchResponse(updated);
}

export async function cancelAssignment(id: string, userId: string, isAdmin = false) {
  const current = await getAssignment(id);
  if (!isAdmin && current.createdById !== userId) throw new ApiError(404, "NOT_FOUND", "Dispatch assignment not found.");
  if (!["AVAILABLE", "ACCEPTED"].includes(current.status)) throw new ApiError(409, "INVALID_STATE", "This assignment can no longer be cancelled.");
  const updated = await prisma.$transaction(async (tx) => {
    const changed = await tx.dispatchAssignment.updateMany({ where: { id, status: current.status }, data: { status: "CANCELLED", cancelledAt: new Date(), assignedDriverId: null } });
    if (!changed.count) throw new ApiError(409, "INVALID_STATE", "Assignment changed; refresh and try again.");
    const source = current.donation ?? current.communityContribution;
    const available = source && source.expiresAt.getTime() > Date.now();
    if (current.donationId) await tx.donation.updateMany({ where: { id: current.donationId, status: "RESERVED" }, data: { status: available ? "AVAILABLE" : "EXPIRED" } });
    if (current.communityContributionId) await tx.communityContribution.updateMany({ where: { id: current.communityContributionId, status: "RESERVED" }, data: { status: available ? "ACTIVE" : "WITHDRAWN" } });
    if (current.assignedDriverId) await tx.driverProfile.updateMany({ where: { userId: current.assignedDriverId, availability: "BUSY" }, data: { availability: "AVAILABLE" } });
    return tx.dispatchAssignment.findUniqueOrThrow({ where: { id }, include: assignmentInclude });
  });
  return toDispatchResponse(updated);
}
