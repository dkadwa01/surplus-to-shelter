import { Prisma } from "@prisma/client";
import {
  CommunityContributionResponseSchema,
  CommunityDonationResponseSchema,
  IndividualContributionThresholdResponseSchema,
  type CommunityContributionFields,
  type CreateCommunityDonationRequest,
} from "@surplus/shared";
import { prisma } from "../../config/prisma.js";
import { ApiError } from "../../shared/api-error.js";

const now = () => new Date();
const activeStatuses = ["OPEN", "TARGET_REACHED"];
const groupInclude = () => ({ contributions: { where: { status: "ACTIVE", expiresAt: { gt: new Date() } }, orderBy: { createdAt: "desc" as const }, take: 200 } });
type GroupWithContributions = Prisma.CommunityDonationGetPayload<{ include: { contributions: true } }>;

async function expireDueGroups(database: typeof prisma | Prisma.TransactionClient = prisma) {
  await database.communityDonation.updateMany({ where: { status: { in: activeStatuses }, deadline: { lte: now() } }, data: { status: "EXPIRED" } });
}

async function groupResponse(group: GroupWithContributions, userId: string) {
  const [aggregate, contributors] = await Promise.all([
    prisma.communityContribution.groupBy({
      by: ["category", "unit"], where: { communityDonationId: group.id, status: "ACTIVE", expiresAt: { gt: new Date() } },
      _sum: { quantity: true },
    }),
    prisma.communityContribution.findMany({ where: { communityDonationId: group.id, status: "ACTIVE", expiresAt: { gt: new Date() } }, select: { contributorId: true }, distinct: ["contributorId"] }),
  ]);
  const totals = aggregate.map((row) => ({ category: row.category, unit: row.unit, quantity: row._sum.quantity ?? 0 }));
  const matchingCategoryTotals = group.targetCategory ? totals.filter((total) => total.category === group.targetCategory) : [];
  const targetTotal = group.targetUnit === "KG"
    ? matchingCategoryTotals.reduce((sum, total) => sum + (total.unit === "KG" ? total.quantity : total.unit === "GRAMS" ? total.quantity / 1000 : 0), 0)
    : group.targetUnit === "GRAMS"
      ? matchingCategoryTotals.reduce((sum, total) => sum + (total.unit === "GRAMS" ? total.quantity : total.unit === "KG" ? total.quantity * 1000 : 0), 0)
      : group.targetUnit ? matchingCategoryTotals.find((total) => total.unit === group.targetUnit)?.quantity ?? 0 : null;
  return CommunityDonationResponseSchema.parse({
    id: group.id, title: group.title, description: group.description, pickupArea: group.pickupArea,
    latitude: group.latitude, longitude: group.longitude, targetQuantity: group.targetQuantity,
    targetCategory: group.targetCategory, targetUnit: group.targetUnit, deadline: group.deadline.toISOString(),
    status: group.status, totals,
    targetProgressPercent: targetTotal === null || !group.targetQuantity ? null : Math.min(100, Math.max(0, Math.round((targetTotal / group.targetQuantity) * 100))),
    contributorCount: contributors.length,
    contributions: group.contributions.map((contribution) => ({
      id: contribution.id, foodName: contribution.foodName, category: contribution.category,
      quantity: contribution.quantity, unit: contribution.unit, expiresAt: contribution.expiresAt.toISOString(),
      note: contribution.contributorId === userId ? contribution.note : null,
      status: contribution.status, isMine: contribution.contributorId === userId,
      belowIndividualThreshold: contribution.contributorId === userId && contribution.belowIndividualThreshold,
      createdAt: contribution.createdAt.toISOString(),
    })),
    isOrganizer: group.creatorId === userId, createdAt: group.createdAt.toISOString(), updatedAt: group.updatedAt.toISOString(),
  });
}

function contributionResponse(row: any, groupOpen: boolean) {
  return CommunityContributionResponseSchema.parse({
    id: row.id, communityDonationId: row.communityDonationId, foodName: row.foodName,
    category: row.category, quantity: row.quantity, unit: row.unit,
    expiresAt: row.expiresAt.toISOString(), note: row.note, status: row.status,
    belowIndividualThreshold: row.belowIndividualThreshold, isEditable: row.status === "ACTIVE" && groupOpen,
    createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString(),
  });
}

export async function createCommunityDonation(creatorId: string, fields: CreateCommunityDonationRequest) {
  const group = await prisma.communityDonation.create({ data: {
    creatorId, title: fields.title, description: fields.description ?? null, pickupArea: fields.pickupArea,
    latitude: fields.latitude ?? null, longitude: fields.longitude ?? null, deadline: new Date(fields.deadline),
    targetQuantity: fields.targetQuantity ?? null, targetCategory: fields.targetCategory ?? null, targetUnit: fields.targetUnit ?? null,
  }, include: groupInclude() });
  return groupResponse(group, creatorId);
}

export async function listCommunityDonations(userId: string, filters: { status?: string; pickupArea?: string }) {
  await expireDueGroups();
  const groups = await prisma.communityDonation.findMany({
    where: { status: filters.status ?? { in: activeStatuses }, ...(filters.pickupArea ? { pickupArea: { contains: filters.pickupArea } } : {}) },
    orderBy: { createdAt: "desc" }, take: 100, include: { contributions: { where: { id: "__list__" } } },
  });
  return Promise.all(groups.map((group) => groupResponse(group as GroupWithContributions, userId)));
}

export async function getCommunityDonation(id: string, userId: string) {
  await expireDueGroups();
  const group = await prisma.communityDonation.findUnique({ where: { id }, include: groupInclude() });
  if (!group) throw new ApiError(404, "NOT_FOUND", "Community donation not found.");
  return groupResponse(group, userId);
}

function assertOpen(group: { status: string; deadline: Date }) {
  if (group.deadline.getTime() <= Date.now() || group.status === "EXPIRED") throw new ApiError(409, "INVALID_STATE", "This community donation has expired.");
  if (group.status !== "OPEN") throw new ApiError(409, "INVALID_STATE", "This community donation is no longer accepting contributions.");
}

async function belowThreshold(database: typeof prisma | Prisma.TransactionClient, fields: CommunityContributionFields) {
  const threshold = await database.individualContributionThreshold.findUnique({ where: { category_unit: { category: fields.category, unit: fields.unit } } });
  return Boolean(threshold && fields.quantity < threshold.minimumQuantity);
}

async function maybeReachTarget(database: Prisma.TransactionClient, group: { id: string; status: string; targetQuantity: number | null; targetCategory: string | null; targetUnit: string | null }) {
  if (!group.targetQuantity || !group.targetCategory || !group.targetUnit || group.status !== "OPEN") return;
  const totals = await database.communityContribution.groupBy({
    by: ["unit"], where: { communityDonationId: group.id, status: "ACTIVE", expiresAt: { gt: new Date() }, category: group.targetCategory }, _sum: { quantity: true },
  });
  const current = group.targetUnit === "KG"
    ? totals.reduce((sum, total) => sum + (total.unit === "KG" ? total._sum.quantity ?? 0 : total.unit === "GRAMS" ? (total._sum.quantity ?? 0) / 1000 : 0), 0)
    : group.targetUnit === "GRAMS"
      ? totals.reduce((sum, total) => sum + (total.unit === "GRAMS" ? total._sum.quantity ?? 0 : total.unit === "KG" ? (total._sum.quantity ?? 0) * 1000 : 0), 0)
      : totals.find((total) => total.unit === group.targetUnit)?._sum.quantity ?? 0;
  if (current >= group.targetQuantity) {
    await database.communityDonation.updateMany({ where: { id: group.id, status: "OPEN" }, data: { status: "TARGET_REACHED" } });
  }
}

export async function contributeToCommunityDonation(groupId: string, contributorId: string, fields: CommunityContributionFields) {
  const contributionId = await prisma.$transaction(async (transaction) => {
    const group = await transaction.communityDonation.findUnique({ where: { id: groupId } });
    if (!group) throw new ApiError(404, "NOT_FOUND", "Community donation not found.");
    assertOpen(group);
    if (new Date(fields.expiresAt).getTime() <= Date.now()) throw new ApiError(400, "INVALID_INPUT", "Food use-by time must be in the future.");
    const contribution = await transaction.communityContribution.create({ data: {
      communityDonationId: group.id, contributorId, foodName: fields.foodName, category: fields.category,
      quantity: fields.quantity, unit: fields.unit, expiresAt: new Date(fields.expiresAt), note: fields.note ?? null,
      belowIndividualThreshold: await belowThreshold(transaction, fields),
    } });
    await maybeReachTarget(transaction, group);
    return contribution.id;
  });
  return getOwnContribution(contributionId, contributorId);
}

async function getOwnContributionRecord(id: string, contributorId: string) {
  const contribution = await prisma.communityContribution.findUnique({ where: { id }, include: { communityDonation: { select: { status: true, deadline: true } } } });
  if (!contribution || contribution.contributorId !== contributorId) throw new ApiError(404, "NOT_FOUND", "Contribution not found.");
  return contribution;
}

export async function getOwnContribution(id: string, contributorId: string) {
  const row = await getOwnContributionRecord(id, contributorId);
  const groupOpen = row.communityDonation.status === "OPEN" && row.communityDonation.deadline.getTime() > Date.now();
  return contributionResponse(row, groupOpen);
}

export async function updateOwnContribution(id: string, contributorId: string, fields: CommunityContributionFields) {
  const resultId = await prisma.$transaction(async (transaction) => {
    const row = await transaction.communityContribution.findUnique({ where: { id }, include: { communityDonation: true } });
    if (!row || row.contributorId !== contributorId) throw new ApiError(404, "NOT_FOUND", "Contribution not found.");
    assertOpen(row.communityDonation);
    if (row.status !== "ACTIVE") throw new ApiError(409, "INVALID_STATE", "Withdrawn contributions cannot be edited.");
    const updated = await transaction.communityContribution.update({ where: { id }, data: {
      foodName: fields.foodName, category: fields.category, quantity: fields.quantity, unit: fields.unit,
      expiresAt: new Date(fields.expiresAt), note: fields.note ?? null,
      belowIndividualThreshold: await belowThreshold(transaction, fields),
    } });
    await maybeReachTarget(transaction, row.communityDonation);
    return updated.id;
  });
  return getOwnContribution(resultId, contributorId);
}

export async function withdrawOwnContribution(id: string, contributorId: string) {
  await prisma.$transaction(async (transaction) => {
    const row = await transaction.communityContribution.findUnique({ where: { id }, include: { communityDonation: true } });
    if (!row || row.contributorId !== contributorId) throw new ApiError(404, "NOT_FOUND", "Contribution not found.");
    assertOpen(row.communityDonation);
    if (row.status !== "ACTIVE") throw new ApiError(409, "INVALID_STATE", "This contribution has already been withdrawn.");
    await transaction.communityContribution.update({ where: { id }, data: { status: "WITHDRAWN" } });
  });
  return getOwnContribution(id, contributorId);
}

export async function manageCommunityDonation(id: string, creatorId: string, action: "close" | "cancel") {
  const current = await prisma.communityDonation.findUnique({ where: { id } });
  if (!current || current.creatorId !== creatorId) throw new ApiError(404, "NOT_FOUND", "Community donation not found.");
  if (current.deadline.getTime() <= Date.now() && activeStatuses.includes(current.status)) {
    await prisma.communityDonation.updateMany({ where: { id, status: { in: activeStatuses } }, data: { status: "EXPIRED" } });
    throw new ApiError(409, "INVALID_STATE", "Expired community donations cannot be changed.");
  }
  const allowed = action === "close" ? activeStatuses : ["OPEN"];
  if (!allowed.includes(current.status)) throw new ApiError(409, "INVALID_STATE", `A ${current.status.toLowerCase()} community donation cannot be ${action}d.`);
  await prisma.communityDonation.update({ where: { id }, data: { status: action === "close" ? "CLOSED" : "CANCELLED" } });
  return getCommunityDonation(id, creatorId);
}

export async function listIndividualContributionThresholds() {
  const thresholds = await prisma.individualContributionThreshold.findMany({ orderBy: [{ category: "asc" }, { unit: "asc" }] });
  return thresholds.map((threshold) => IndividualContributionThresholdResponseSchema.parse({ ...threshold, updatedAt: threshold.updatedAt.toISOString() }));
}

export async function setIndividualContributionThreshold(input: { category: string; unit: string; minimumQuantity: number }) {
  const row = await prisma.individualContributionThreshold.upsert({
    where: { category_unit: { category: input.category, unit: input.unit } },
    create: input, update: { minimumQuantity: input.minimumQuantity },
  });
  return IndividualContributionThresholdResponseSchema.parse({ ...row, updatedAt: row.updatedAt.toISOString() });
}
