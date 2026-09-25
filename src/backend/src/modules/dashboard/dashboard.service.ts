import { DashboardSummarySchema, type DashboardSummary } from "@surplus/shared";
import { prisma } from "../../config/prisma.js";
import { getMatchesForRecipient, getRecipientsForCommunityDonation, getRecipientsForDonation } from "../matching/matching.service.js";
import { getMyVerificationStatus, isUserVerified } from "../verification/verification.service.js";

type GroupedQuantity = { category: string; unit: string; _sum: { quantity: number | null } };
function quantities(rows: GroupedQuantity[]) {
  const totals = new Map<string, { category: string | null; unit: string; quantity: number }>();
  for (const row of rows) {
    const isMass = row.unit === "KG" || row.unit === "GRAMS";
    const unit = isMass ? "KG" : row.unit;
    const category = null;
    const key = unit;
    const amount = row._sum.quantity ?? 0;
    const normalized = row.unit === "GRAMS" ? amount / 1000 : amount;
    const current = totals.get(key) ?? { category, unit, quantity: 0 };
    current.quantity += normalized;
    totals.set(key, current);
  }
  return [...totals.values()].map((item) => ({ ...item, quantity: Math.round(item.quantity * 1000) / 1000 }));
}

type MapPoint = DashboardSummary["mapPoints"][number];
async function currentVerifiedUsers(userIds: string[]) {
  if (!userIds.length) return new Set<string>();
  const rows = await prisma.verificationRequest.findMany({ where: { userId: { in: userIds } }, orderBy: { createdAt: "desc" }, select: { userId: true, status: true } });
  const latest = new Map<string, string>();
  for (const row of rows) if (!latest.has(row.userId)) latest.set(row.userId, row.status);
  return new Set([...latest].filter(([, status]) => status === "VERIFIED").map(([id]) => id));
}

async function mapPoints(role: string, userId: string): Promise<MapPoint[]> {
  const points: MapPoint[] = [];
  if (role === "DONOR" || role === "ADMIN") {
    const donations = await prisma.donation.findMany({
      where: { status: "AVAILABLE", expiresAt: { gt: new Date() }, latitude: { not: null }, longitude: { not: null }, ...(role === "DONOR" ? { donorId: userId } : {}) },
      orderBy: { createdAt: "desc" }, take: 100, select: { id: true, foodName: true, pickupArea: true, latitude: true, longitude: true },
    });
    for (const item of donations) if (item.latitude !== null && item.longitude !== null) points.push({ id: item.id, type: "DONATION", label: item.foodName, area: item.pickupArea, latitude: item.latitude, longitude: item.longitude });
  }
  if (role === "DONOR" || role === "ADMIN") {
    const profiles = await prisma.recipientProfile.findMany({ where: { verificationStatus: "VERIFIED", isActive: true, isAcceptingDonations: true, latitude: { not: null }, longitude: { not: null } }, orderBy: { organizationName: "asc" }, take: 100, select: { id: true, userId: true, organizationName: true, serviceArea: true, latitude: true, longitude: true } });
    const verified = await currentVerifiedUsers(profiles.map((profile) => profile.userId));
    for (const profile of profiles) if (verified.has(profile.userId) && profile.latitude !== null && profile.longitude !== null) points.push({ id: profile.id, type: "RECIPIENT", label: profile.organizationName, area: profile.serviceArea, latitude: profile.latitude, longitude: profile.longitude });
  }
  if (role === "RECIPIENT") {
    const profile = await prisma.recipientProfile.findUnique({ where: { userId }, select: { id: true, organizationName: true, serviceArea: true, latitude: true, longitude: true } });
    if (profile?.latitude !== null && profile?.latitude !== undefined && profile.longitude !== null) points.push({ id: profile.id, type: "RECIPIENT", label: profile.organizationName, area: profile.serviceArea, latitude: profile.latitude, longitude: profile.longitude });
  }
  if (role === "DONOR" || role === "ADMIN") {
    const groups = await prisma.communityDonation.findMany({ where: { status: { in: ["OPEN", "TARGET_REACHED", "CLOSED"] }, latitude: { not: null }, longitude: { not: null }, ...(role === "DONOR" ? { creatorId: userId } : {}) }, orderBy: { createdAt: "desc" }, take: 100, select: { id: true, title: true, pickupArea: true, latitude: true, longitude: true } });
    for (const group of groups) if (group.latitude !== null && group.longitude !== null) points.push({ id: group.id, type: "COMMUNITY", label: group.title, area: group.pickupArea, latitude: group.latitude, longitude: group.longitude });
  }
  return points;
}

async function liveDonorMatches(userId: string) {
  const now = new Date();
  const availableSourceCount = await prisma.donation.count({ where: { donorId: userId, status: "AVAILABLE", expiresAt: { gt: now } } });
  const donations = await prisma.donation.findMany({ where: { donorId: userId, status: "AVAILABLE", expiresAt: { gt: now } }, orderBy: { createdAt: "desc" }, take: 100, select: { id: true } });
  const pairs = new Map<string, number>();
  for (const donation of donations) {
    try {
      const result = await getRecipientsForDonation(donation.id, userId);
      if (result.matches.length) pairs.set(`DONATION:${donation.id}`, result.matches.length);
    } catch { /* An individual listing may expire or change while the overview loads. */ }
  }
  const groups = await prisma.communityDonation.findMany({ where: { creatorId: userId, status: { in: ["TARGET_REACHED", "CLOSED"] } }, orderBy: { createdAt: "desc" }, take: 50, select: { id: true } });
  const groupCount = await prisma.communityDonation.count({ where: { creatorId: userId, status: { in: ["TARGET_REACHED", "CLOSED"] } } });
  let communityTruncated = false;
  if (await isUserVerified(userId)) for (const group of groups) {
    try {
      const contributionCount = await prisma.communityContribution.count({ where: { communityDonationId: group.id, status: "ACTIVE", expiresAt: { gt: now } } });
      if (contributionCount > 200) communityTruncated = true;
      const result = await getRecipientsForCommunityDonation(group.id, userId);
      for (const source of result.sources) if (source.matches.length) pairs.set(`COMMUNITY_CONTRIBUTION:${source.source.sourceId}`, source.matches.length);
    } catch { /* The matching screen remains the authoritative, current view. */ }
  }
  if (availableSourceCount > 100 || groupCount > 50 || communityTruncated) return { sourceCount: null, pairCount: null, note: "Live matching suggestions are available on each match screen. The overview omits a total when source lists exceed the matching screens' display limits; suggestions are not persisted." };
  return { sourceCount: pairs.size, pairCount: [...pairs.values()].reduce((total, count) => total + count, 0), note: "Live suitable suggestions from the current matching engine; matches are not stored or reserved." };
}

export async function getDashboardSummary(user: { id: string; role: string }) {
  const now = new Date();
  if (user.role === "DONOR" || user.role === "ADMIN") {
    await prisma.donation.updateMany({ where: { ...(user.role === "DONOR" ? { donorId: user.id } : {}), status: "AVAILABLE", expiresAt: { lte: now } }, data: { status: "EXPIRED" } });
  }
  const donationScope = user.role === "DONOR" ? { donorId: user.id } : user.role === "ADMIN" ? {} : null;
  const communityScope = user.role === "DONOR" ? { contributorId: user.id } : user.role === "ADMIN" ? {} : null;
  const own = donationScope ?? { id: "__not_applicable__" };
  const contributionScope = communityScope ?? { id: "__not_applicable__" };
  const donationWhere = { ...own, status: { not: "CANCELLED" } };
  const [totalDonations, activeDonations, donationRows, communityCollections, contributionRows, communityCounts] = await Promise.all([
    prisma.donation.count({ where: own }),
    prisma.donation.count({ where: { ...own, status: "AVAILABLE", expiresAt: { gt: now } } }),
    prisma.donation.groupBy({ by: ["category", "unit"], where: donationWhere, _sum: { quantity: true } }),
    prisma.communityDonation.count({ where: user.role === "DONOR" ? { creatorId: user.id } : user.role === "ADMIN" ? {} : { id: "__not_applicable__" } }),
    prisma.communityContribution.groupBy({ by: ["category", "unit"], where: { status: "ACTIVE", expiresAt: { gt: now }, ...contributionScope }, _sum: { quantity: true } }),
    prisma.communityContribution.findMany({ where: { status: "ACTIVE", expiresAt: { gt: now }, ...contributionScope }, select: { contributorId: true }, distinct: ["contributorId"] }),
  ]);
  const activeContributions = communityScope ? await prisma.communityContribution.count({ where: { status: "ACTIVE", expiresAt: { gt: now }, ...communityScope } }) : 0;
  const verification = await getMyVerificationStatus(user.id);
  const recipientRow = user.role === "RECIPIENT" ? await prisma.recipientProfile.findUnique({ where: { userId: user.id }, include: { acceptedCategories: { select: { category: true } } } }) : null;
  let matching = { sourceCount: null as number | null, pairCount: null as number | null, note: "Matching is calculated on demand. No persistent match or delivery records are available in this checkout." };
  if (user.role === "DONOR") matching = await liveDonorMatches(user.id);
  if (user.role === "RECIPIENT" && recipientRow && recipientRow.verificationStatus === "VERIFIED" && await isUserVerified(user.id) && recipientRow.isActive && recipientRow.isAcceptingDonations) {
    const result = await getMatchesForRecipient(user.id);
    matching = { sourceCount: new Set(result.matches.map((item) => `${item.source.sourceType}:${item.source.sourceId}`)).size, pairCount: result.matches.length, note: "Current eligible food suggestions from the matching engine; they are not reserved." };
  }

  let verifiedParticipants: { donors: number; recipients: number; drivers: number } | null = null;
  if (user.role === "ADMIN") {
    const users = await prisma.user.findMany({ where: { role: { in: ["DONOR", "RECIPIENT", "DRIVER"] } }, select: { id: true, role: true } });
    const verified = await currentVerifiedUsers(users.map(({ id }) => id));
    verifiedParticipants = {
      donors: users.filter((row) => row.role === "DONOR" && verified.has(row.id)).length,
      recipients: users.filter((row) => row.role === "RECIPIENT" && verified.has(row.id)).length,
      drivers: users.filter((row) => row.role === "DRIVER" && verified.has(row.id)).length,
    };
  }
  const data = {
    role: user.role,
    verificationStatus: verification.status,
    donations: { totalCount: totalDonations, activeCount: activeDonations, quantities: quantities(donationRows as GroupedQuantity[]) },
    community: { collectionCount: communityCollections, activeContributionCount: activeContributions, contributorCount: communityCounts.length, quantities: quantities(contributionRows as GroupedQuantity[]) },
    matching,
    delivery: { trackingAvailable: false, activeCount: null, completedCount: null, deliveredQuantities: null, recipientOrganizationsServed: null },
    recipientProfile: recipientRow ? {
      configured: true, capacityQuantity: recipientRow.capacityQuantity, capacityUnit: recipientRow.capacityUnit,
      acceptedCategories: recipientRow.acceptedCategories.map(({ category }) => category), isActive: recipientRow.isActive, isAcceptingDonations: recipientRow.isAcceptingDonations,
    } : user.role === "RECIPIENT" ? { configured: false, capacityQuantity: null, capacityUnit: null, acceptedCategories: [], isActive: false, isAcceptingDonations: false } : null,
    verifiedParticipants,
    mapPoints: await mapPoints(user.role, user.id),
  };
  return DashboardSummarySchema.parse(data);
}
