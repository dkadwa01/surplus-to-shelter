import { Router } from "express";
import {
  CommunityContributionResponseSchema,
  CommunityDonationQuerySchema,
  CommunityDonationResponseSchema,
  CreateCommunityContributionRequestSchema,
  CreateCommunityDonationRequestSchema,
  IndividualContributionThresholdResponseSchema,
  UpsertIndividualContributionThresholdRequestSchema,
  UpdateCommunityContributionRequestSchema,
} from "@surplus/shared";
import { requireAuth, requireRole } from "../../middleware/auth.middleware.js";
import { requireVerifiedUser } from "../verification/verification.middleware.js";
import { ApiError, asyncHandler } from "../../shared/api-error.js";
import {
  contributeToCommunityDonation, createCommunityDonation, getCommunityDonation, getOwnContribution,
  listCommunityDonations, listIndividualContributionThresholds, manageCommunityDonation,
  setIndividualContributionThreshold, updateOwnContribution, withdrawOwnContribution,
} from "./community-donation.service.js";

export const communityDonationRouter = Router();
communityDonationRouter.use(requireAuth);

communityDonationRouter.get("/thresholds", asyncHandler(async (_request, response) => {
  response.status(200).json(IndividualContributionThresholdResponseSchema.array().parse(await listIndividualContributionThresholds()));
}));
communityDonationRouter.put("/admin/thresholds", requireRole("ADMIN"), asyncHandler(async (request, response) => {
  const input = UpsertIndividualContributionThresholdRequestSchema.parse(request.body);
  response.status(200).json(IndividualContributionThresholdResponseSchema.parse(await setIndividualContributionThreshold(input)));
}));
communityDonationRouter.get("/", asyncHandler(async (request, response) => {
  const filters = CommunityDonationQuerySchema.parse(request.query);
  if (filters.status && !["OPEN", "TARGET_REACHED"].includes(filters.status) && !["DONOR", "ADMIN"].includes(request.authUser?.role ?? "")) throw new ApiError(403, "FORBIDDEN", "Only donors and administrators can filter closed community donations.");
  response.status(200).json(CommunityDonationResponseSchema.array().parse(await listCommunityDonations(request.authUser!.id, filters)));
}));
communityDonationRouter.post("/", requireRole("DONOR"), requireVerifiedUser, asyncHandler(async (request, response) => {
  const input = CreateCommunityDonationRequestSchema.parse(request.body);
  response.status(201).json(CommunityDonationResponseSchema.parse(await createCommunityDonation(request.authUser!.id, input)));
}));
communityDonationRouter.post("/:id/contributions", requireRole("DONOR"), requireVerifiedUser, asyncHandler(async (request, response) => {
  const input = CreateCommunityContributionRequestSchema.parse(request.body);
  response.status(201).json(CommunityContributionResponseSchema.parse(await contributeToCommunityDonation(String(request.params.id), request.authUser!.id, input)));
}));
communityDonationRouter.get("/contributions/:contributionId", asyncHandler(async (request, response) => {
  response.status(200).json(CommunityContributionResponseSchema.parse(await getOwnContribution(String(request.params.contributionId), request.authUser!.id)));
}));
communityDonationRouter.put("/contributions/:contributionId", requireRole("DONOR"), requireVerifiedUser, asyncHandler(async (request, response) => {
  const input = UpdateCommunityContributionRequestSchema.parse(request.body);
  response.status(200).json(CommunityContributionResponseSchema.parse(await updateOwnContribution(String(request.params.contributionId), request.authUser!.id, input)));
}));
communityDonationRouter.post("/contributions/:contributionId/withdraw", requireRole("DONOR"), requireVerifiedUser, asyncHandler(async (request, response) => {
  response.status(200).json(CommunityContributionResponseSchema.parse(await withdrawOwnContribution(String(request.params.contributionId), request.authUser!.id)));
}));
communityDonationRouter.post("/:id/close", requireRole("DONOR"), requireVerifiedUser, asyncHandler(async (request, response) => {
  response.status(200).json(CommunityDonationResponseSchema.parse(await manageCommunityDonation(String(request.params.id), request.authUser!.id, "close")));
}));
communityDonationRouter.post("/:id/cancel", requireRole("DONOR"), requireVerifiedUser, asyncHandler(async (request, response) => {
  response.status(200).json(CommunityDonationResponseSchema.parse(await manageCommunityDonation(String(request.params.id), request.authUser!.id, "cancel")));
}));
communityDonationRouter.get("/:id", asyncHandler(async (request, response) => {
  response.status(200).json(CommunityDonationResponseSchema.parse(await getCommunityDonation(String(request.params.id), request.authUser!.id)));
}));
