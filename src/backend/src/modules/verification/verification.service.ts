import { Prisma } from "@prisma/client";
import {
  VerificationAdminRequestResponseSchema,
  VerificationRequestResponseSchema,
  VerificationStatusResponseSchema,
  type SubmitVerificationRequest,
} from "@surplus/shared";
import type { UserRole } from "@surplus/shared";
import { prisma } from "../../config/prisma.js";
import { ApiError } from "../../shared/api-error.js";

const historyOrder = { createdAt: "asc" } as const;
const requestInclude = { records: { orderBy: historyOrder } } as const;
const adminInclude = { ...requestInclude, user: { select: { id: true, fullName: true, email: true, phone: true, role: true, donorType: true, recipientProfile: { select: { organizationName: true, recipientType: true, address: true, serviceArea: true, capacityQuantity: true, capacityUnit: true, acceptedCategories: { select: { category: true } } } } } } } as const;
type VerificationWithRecords = Prisma.VerificationRequestGetPayload<{ include: typeof requestInclude }>;
type VerificationForAdmin = Prisma.VerificationRequestGetPayload<{ include: typeof adminInclude }>;

function toRequestResponse(request: VerificationWithRecords) {
  return VerificationRequestResponseSchema.parse({ ...request,
    reviewedAt: request.reviewedAt?.toISOString() ?? null,
    createdAt: request.createdAt.toISOString(), updatedAt: request.updatedAt.toISOString(),
    records: request.records.map((record) => ({ ...record, createdAt: record.createdAt.toISOString() })),
  });
}
function toAdminResponse(request: VerificationForAdmin) {
  return VerificationAdminRequestResponseSchema.parse({ ...toRequestResponse(request), applicant: {
    ...request.user,
    recipientOrganizationName: request.user.recipientProfile?.organizationName ?? null,
    recipientProfile: request.user.recipientProfile ? { ...request.user.recipientProfile, acceptedCategories: request.user.recipientProfile.acceptedCategories.map(({ category }) => category) } : null,
  } });
}

export async function submitVerification(user: { id: string; role: UserRole; donorType: string | null }, input: SubmitVerificationRequest) {
  if (user.role !== "DONOR" && user.role !== "RECIPIENT" && user.role !== "DRIVER") throw new ApiError(403, "FORBIDDEN", "This account type cannot submit participant verification.");
  if (user.role === "DRIVER" && !input.vehicleType) throw new ApiError(400, "INVALID_INPUT", "Select a vehicle type for driver verification.");
  if (user.role !== "DRIVER" && input.vehicleType) throw new ApiError(400, "INVALID_INPUT", "Vehicle details are only accepted for driver verification.");
  if (user.role === "DONOR" && user.donorType !== "INDIVIDUAL" && !input.organizationName) throw new ApiError(400, "INVALID_INPUT", "Enter the business or organization name for this donor account.");

  const recipient = user.role === "RECIPIENT" ? await prisma.recipientProfile.findUnique({ where: { userId: user.id } }) : null;
  if (user.role === "RECIPIENT" && !recipient) throw new ApiError(409, "INVALID_STATE", "Complete your recipient profile before requesting verification.");

  try {
    return await prisma.$transaction(async (transaction) => {
      const latest = await transaction.verificationRequest.findFirst({ where: { userId: user.id }, orderBy: { createdAt: "desc" } });
      if (latest && ["PENDING", "UNDER_REVIEW"].includes(latest.status)) throw new ApiError(409, "INVALID_STATE", "A verification request is already active.");
      if (latest && ["VERIFIED", "SUSPENDED"].includes(latest.status)) throw new ApiError(409, "INVALID_STATE", latest.status === "VERIFIED" ? "This account is already verified." : "This account is suspended from verification.");
      const created = await transaction.verificationRequest.create({
        data: { userId: user.id, activeUserId: user.id, participantType: user.role,
          organizationName: recipient?.organizationName ?? input.organizationName ?? null,
          vehicleType: input.vehicleType ?? null, additionalInfo: input.additionalInfo ?? null,
          status: "PENDING", records: { create: { previousStatus: null, newStatus: "PENDING" } } },
        include: requestInclude,
      });
      if (user.role === "RECIPIENT") await transaction.recipientProfile.update({ where: { userId: user.id }, data: { verificationStatus: "PENDING" } });
      return toRequestResponse(created);
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new ApiError(409, "INVALID_STATE", "A verification request is already active.");
    throw error;
  }
}

export async function getMyVerificationStatus(userId: string) {
  const request = await prisma.verificationRequest.findFirst({ where: { userId }, orderBy: { createdAt: "desc" }, include: requestInclude });
  return VerificationStatusResponseSchema.parse(request ? { status: request.status, request: toRequestResponse(request) } : { status: "NOT_SUBMITTED", request: null });
}

export async function listVerificationRequests(status?: string) {
  const requests = await prisma.verificationRequest.findMany({
    where: status ? { status } : { status: { in: ["PENDING", "UNDER_REVIEW"] } },
    include: adminInclude, orderBy: { createdAt: "asc" }, take: 100,
  });
  return requests.map(toAdminResponse);
}
export async function getVerificationRequestForAdmin(id: string) {
  const request = await prisma.verificationRequest.findUnique({ where: { id }, include: adminInclude });
  if (!request) throw new ApiError(404, "NOT_FOUND", "Verification request not found.");
  return toAdminResponse(request);
}

const allowedTransitions: Record<string, string[]> = {
  PENDING: ["UNDER_REVIEW", "VERIFIED", "REJECTED"],
  UNDER_REVIEW: ["VERIFIED", "REJECTED"],
  VERIFIED: ["SUSPENDED"],
  REJECTED: [],
  SUSPENDED: [],
};
export async function reviewVerificationRequest(id: string, reviewerId: string, action: string, reason?: string) {
  return prisma.$transaction(async (transaction) => {
    const current = await transaction.verificationRequest.findUnique({ where: { id } });
    if (!current) throw new ApiError(404, "NOT_FOUND", "Verification request not found.");
    if (current.userId === reviewerId) throw new ApiError(403, "FORBIDDEN", "Reviewers cannot review their own verification request.");
    if (!allowedTransitions[current.status]?.includes(action)) throw new ApiError(409, "INVALID_STATE", `Cannot move verification from ${current.status} to ${action}.`);
    const isActive = action === "PENDING" || action === "UNDER_REVIEW";
    const changed = await transaction.verificationRequest.updateMany({
      where: { id, status: current.status },
      data: { status: action, activeUserId: isActive ? current.userId : null, reviewReason: reason ?? null, reviewedAt: action === "UNDER_REVIEW" ? null : new Date() },
    });
    if (!changed.count) throw new ApiError(409, "INVALID_STATE", "The verification request changed before this review was saved.");
    await transaction.verificationRecord.create({ data: { requestId: id, previousStatus: current.status, newStatus: action, reviewerId, reason: reason ?? null } });
    if (current.participantType === "RECIPIENT" && ["VERIFIED", "REJECTED", "SUSPENDED"].includes(action)) {
      await transaction.recipientProfile.updateMany({ where: { userId: current.userId }, data: { verificationStatus: action === "SUSPENDED" ? "RESTRICTED" : action } });
    }
    const updated = await transaction.verificationRequest.findUniqueOrThrow({ where: { id }, include: requestInclude });
    return toRequestResponse(updated);
  });
}

export async function isUserVerified(userId: string): Promise<boolean> {
  const latest = await prisma.verificationRequest.findFirst({ where: { userId }, orderBy: { createdAt: "desc" }, select: { status: true } });
  return latest?.status === "VERIFIED";
}
