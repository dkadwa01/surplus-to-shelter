import { Prisma } from "@prisma/client";
import { CommunityDonationMatchesResponseSchema, DonationMatchesResponseSchema, MatchingResultSchema, RecipientMatchesResponseSchema, type MatchingResult } from "@surplus/shared";
import { prisma } from "../../config/prisma.js";
import { ApiError } from "../../shared/api-error.js";
import { isUserVerified } from "../verification/verification.service.js";
import { evaluateMatch, sortMatches, type MatchableFood, type MatchableRecipient } from "./matching.logic.js";

const recipientInclude = { acceptedCategories: { select: { category: true } } } as const;
type RecipientWithCategories = Prisma.RecipientProfileGetPayload<{ include: typeof recipientInclude }>;
type SourceDonation = Prisma.DonationGetPayload<{}>;
type SourceContribution = Prisma.CommunityContributionGetPayload<{ include: { communityDonation: true } }>;
const readyCommunityStatuses = ["TARGET_REACHED", "CLOSED"];

function publicRecipient(profile: RecipientWithCategories, currentlyVerified: boolean): MatchableRecipient {
  return {
    recipientProfileId: profile.id, organizationName: profile.organizationName, recipientType: profile.recipientType,
    serviceArea: profile.serviceArea, serviceRadiusKm: profile.serviceRadiusKm,
    latitude: profile.latitude, longitude: profile.longitude,
    acceptedCategories: profile.acceptedCategories.map(({ category }) => category),
    capacityQuantity: profile.capacityQuantity, capacityUnit: profile.capacityUnit,
    verificationStatus: profile.verificationStatus, currentlyVerified, dietaryRestrictions: profile.dietaryRestrictions,
  };
}

function directDonationSource(donation: SourceDonation): MatchableFood {
  return {
    sourceType: "DONATION", sourceId: donation.id, communityDonationId: null, communityStatus: null,
    foodName: donation.foodName, category: donation.category as MatchableFood["category"], quantity: donation.quantity,
    unit: donation.unit as MatchableFood["unit"], preparedAt: donation.preparedAt?.toISOString() ?? null,
    expiresAt: donation.expiresAt.toISOString(), pickupArea: donation.pickupArea,
    status: "AVAILABLE", latitude: donation.latitude, longitude: donation.longitude,
  };
}

function communityContributionSource(contribution: SourceContribution): MatchableFood {
  return {
    sourceType: "COMMUNITY_CONTRIBUTION", sourceId: contribution.id,
    communityDonationId: contribution.communityDonationId,
    communityStatus: contribution.communityDonation.status as "TARGET_REACHED" | "CLOSED",
    foodName: contribution.foodName, category: contribution.category as MatchableFood["category"],
    quantity: contribution.quantity, unit: contribution.unit as MatchableFood["unit"], preparedAt: null,
    expiresAt: contribution.expiresAt.toISOString(), pickupArea: contribution.communityDonation.pickupArea,
    status: "ACTIVE", latitude: contribution.communityDonation.latitude, longitude: contribution.communityDonation.longitude,
  };
}

async function currentVerifiedUserIds(userIds: string[]) {
  if (!userIds.length) return new Set<string>();
  const requests = await prisma.verificationRequest.findMany({
    where: { userId: { in: [...new Set(userIds)] } }, orderBy: { createdAt: "desc" },
    select: { userId: true, status: true },
  });
  const current = new Map<string, string>();
  for (const request of requests) if (!current.has(request.userId)) current.set(request.userId, request.status);
  return new Set([...current].filter(([, status]) => status === "VERIFIED").map(([userId]) => userId));
}

async function discoverVerifiedRecipients(): Promise<MatchableRecipient[]> {
  const profiles = await prisma.recipientProfile.findMany({
    where: { verificationStatus: "VERIFIED", isActive: true, isAcceptingDonations: true },
    include: recipientInclude, orderBy: { organizationName: "asc" }, take: 100,
  });
  const verifiedIds = await currentVerifiedUserIds(profiles.map((profile) => profile.userId));
  return profiles.filter((profile) => verifiedIds.has(profile.userId)).map((profile) => publicRecipient(profile, true));
}

function makeResults(source: MatchableFood, recipients: MatchableRecipient[]): MatchingResult[] {
  return sortMatches(recipients.map((recipient) => evaluateMatch(source, recipient)).filter((result) => result.eligible));
}

async function loadOwnedDonation(id: string, donorId: string) {
  const donation = await prisma.donation.findUnique({ where: { id } });
  if (!donation || donation.donorId !== donorId) throw new ApiError(404, "NOT_FOUND", "Donation not found.");
  if (donation.status === "AVAILABLE" && donation.expiresAt.getTime() <= Date.now()) {
    await prisma.donation.updateMany({ where: { id, status: "AVAILABLE" }, data: { status: "EXPIRED" } });
    throw new ApiError(409, "INVALID_STATE", "This donation has expired and cannot be matched.");
  }
  if (donation.status !== "AVAILABLE") throw new ApiError(409, "INVALID_STATE", "Only available donations can be matched.");
  return donation;
}

async function readyOwnedCommunityDonation(id: string, creatorId: string) {
  const group = await prisma.communityDonation.findUnique({ where: { id } });
  if (!group || group.creatorId !== creatorId) throw new ApiError(404, "NOT_FOUND", "Community donation not found.");
  if (group.status === "TARGET_REACHED" && group.deadline.getTime() <= Date.now()) {
    await prisma.communityDonation.updateMany({ where: { id, status: "TARGET_REACHED" }, data: { status: "EXPIRED" } });
    throw new ApiError(409, "INVALID_STATE", "This community collection has expired.");
  }
  if (!readyCommunityStatuses.includes(group.status)) throw new ApiError(409, "INVALID_STATE", "Community collections can be matched after they reach their target or the organizer closes them.");
  if (!(await isUserVerified(creatorId))) throw new ApiError(403, "VERIFICATION_REQUIRED", "Current organizer verification is required to view community matches.");
  return group;
}

async function readyCommunityContributions(groupId?: string) {
  await prisma.communityDonation.updateMany({ where: { status: "TARGET_REACHED", deadline: { lte: new Date() } }, data: { status: "EXPIRED" } });
  const contributions = await prisma.communityContribution.findMany({
    where: { ...(groupId ? { communityDonationId: groupId } : {}), status: "ACTIVE", expiresAt: { gt: new Date() }, communityDonation: { status: { in: readyCommunityStatuses } } },
    include: { communityDonation: true }, orderBy: [{ expiresAt: "asc" }, { id: "asc" }], take: groupId ? 200 : 1000,
  });
  const verifiedContributors = await currentVerifiedUserIds(contributions.map((contribution) => contribution.contributorId));
  return contributions.filter((contribution) => verifiedContributors.has(contribution.contributorId));
}

async function loadRecipientForDetails(id: string, userId: string, role: string): Promise<MatchableRecipient> {
  const profile = await prisma.recipientProfile.findUnique({ where: { id }, include: recipientInclude });
  if (!profile) throw new ApiError(404, "NOT_FOUND", "Recipient profile not found.");
  if (role === "RECIPIENT" && profile.userId !== userId) throw new ApiError(404, "NOT_FOUND", "Recipient profile not found.");
  const currentlyVerified = await isUserVerified(profile.userId);
  if (!currentlyVerified || profile.verificationStatus !== "VERIFIED" || !profile.isActive || !profile.isAcceptingDonations) {
    throw new ApiError(404, "NOT_FOUND", "Eligible recipient profile not found.");
  }
  return publicRecipient(profile, true);
}

async function loadSourceForDetails(sourceType: "DONATION" | "COMMUNITY_CONTRIBUTION", sourceId: string, userId: string, role: string): Promise<MatchableFood> {
  if (sourceType === "DONATION") {
    if (role === "RECIPIENT") {
      await prisma.donation.updateMany({ where: { id: sourceId, status: "AVAILABLE", expiresAt: { lte: new Date() } }, data: { status: "EXPIRED" } });
      const donation = await prisma.donation.findUnique({ where: { id: sourceId } });
      if (!donation || donation.status !== "AVAILABLE" || donation.expiresAt.getTime() <= Date.now()) throw new ApiError(404, "NOT_FOUND", "Available donation not found.");
      return directDonationSource(donation);
    }
    return directDonationSource(await loadOwnedDonation(sourceId, userId));
  }

  const contribution = await prisma.communityContribution.findUnique({ where: { id: sourceId }, include: { communityDonation: true } });
  if (!contribution) throw new ApiError(404, "NOT_FOUND", "Community contribution not found.");
  if (role === "DONOR" && contribution.contributorId !== userId && contribution.communityDonation.creatorId !== userId) throw new ApiError(404, "NOT_FOUND", "Community contribution not found.");
  if (contribution.communityDonation.status === "TARGET_REACHED" && contribution.communityDonation.deadline.getTime() <= Date.now()) {
    await prisma.communityDonation.updateMany({ where: { id: contribution.communityDonationId, status: "TARGET_REACHED" }, data: { status: "EXPIRED" } });
    throw new ApiError(409, "INVALID_STATE", "This community collection has expired.");
  }
  if (!readyCommunityStatuses.includes(contribution.communityDonation.status) || contribution.status !== "ACTIVE" || contribution.expiresAt.getTime() <= Date.now()) {
    throw new ApiError(409, "INVALID_STATE", "This community contribution is not available for matching.");
  }
  if (!(await isUserVerified(contribution.contributorId))) throw new ApiError(409, "INVALID_STATE", "This contribution is excluded because its donor is no longer verified.");
  return communityContributionSource(contribution);
}

async function loadRecipientProfileForMatching(userId: string) {
  const profile = await prisma.recipientProfile.findUnique({ where: { userId }, include: recipientInclude });
  if (!profile) throw new ApiError(404, "NOT_FOUND", "Complete your recipient profile before viewing matches.");
  if (profile.verificationStatus !== "VERIFIED" || !(await isUserVerified(userId))) throw new ApiError(403, "VERIFICATION_REQUIRED", "Recipient verification is required to view suitable donations.");
  if (!profile.isActive || !profile.isAcceptingDonations) throw new ApiError(409, "INVALID_STATE", "Your recipient profile is not active and accepting donations.");
  return publicRecipient(profile, true);
}

export async function getRecipientsForDonation(donationId: string, donorId: string) {
  const donation = await loadOwnedDonation(donationId, donorId);
  const source = directDonationSource(donation);
  const recipients = await discoverVerifiedRecipients();
  return DonationMatchesResponseSchema.parse({ donationId, matches: makeResults(source, recipients) });
}

export async function getMatchesForRecipient(userId: string) {
  const recipient = await loadRecipientProfileForMatching(userId);
  await prisma.donation.updateMany({ where: { status: "AVAILABLE", expiresAt: { lte: new Date() } }, data: { status: "EXPIRED" } });
  const [donations, groups] = await Promise.all([
    prisma.donation.findMany({ where: { status: "AVAILABLE", expiresAt: { gt: new Date() } }, orderBy: [{ expiresAt: "asc" }, { id: "asc" }], take: 100 }),
    readyCommunityContributions(),
  ]);
  const directMatches = donations.map((donation) => evaluateMatch(directDonationSource(donation), recipient)).filter((match) => match.eligible);
  const communitySources = groups.map(communityContributionSource);
  const communityMatches = communitySources.map((source) => evaluateMatch(source, recipient)).filter((match) => match.eligible);
  return RecipientMatchesResponseSchema.parse({ recipientProfileId: recipient.recipientProfileId, matches: sortMatches([...directMatches, ...communityMatches]) });
}

export async function getRecipientsForCommunityDonation(groupId: string, creatorId: string) {
  const group = await readyOwnedCommunityDonation(groupId, creatorId);
  const contributions = await readyCommunityContributions(groupId);
  const recipients = await discoverVerifiedRecipients();
  const sources = contributions.map((contribution) => {
    const source = communityContributionSource(contribution);
    return { source, matches: makeResults(source, recipients) };
  });
  return CommunityDonationMatchesResponseSchema.parse({
    communityDonationId: group.id, title: group.title, pickupArea: group.pickupArea, status: group.status, sources,
  });
}

export async function getMatchDetails(sourceType: "DONATION" | "COMMUNITY_CONTRIBUTION", sourceId: string, recipientProfileId: string, userId: string, role: string) {
  const source = await loadSourceForDetails(sourceType, sourceId, userId, role);
  const recipient = await loadRecipientForDetails(recipientProfileId, userId, role);
  return MatchingResultSchema.parse(evaluateMatch(source, recipient));
}
