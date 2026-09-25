import { Router } from "express";
import {
  CommunityDonationMatchesResponseSchema, DonationMatchesResponseSchema,
  MatchingRouteParamsSchema, MatchingResultSchema, RecipientMatchesResponseSchema,
} from "@surplus/shared";
import { requireAuth, requireRole } from "../../middleware/auth.middleware.js";
import { ApiError, asyncHandler } from "../../shared/api-error.js";
import { getMatchDetails, getMatchesForRecipient, getRecipientsForCommunityDonation, getRecipientsForDonation } from "./matching.service.js";

export const matchingRouter = Router();
matchingRouter.use(requireAuth);

matchingRouter.get("/recipients/me/donations", requireRole("RECIPIENT"), asyncHandler(async (request, response) => {
  if (!request.authUser) throw new ApiError(401, "UNAUTHORIZED", "Sign in to continue.");
  response.status(200).json(RecipientMatchesResponseSchema.parse(await getMatchesForRecipient(request.authUser.id)));
}));

matchingRouter.get("/donations/:donationId/recipients", requireRole("DONOR"), asyncHandler(async (request, response) => {
  if (!request.authUser) throw new ApiError(401, "UNAUTHORIZED", "Sign in to continue.");
  response.status(200).json(DonationMatchesResponseSchema.parse(await getRecipientsForDonation(String(request.params.donationId), request.authUser.id)));
}));

matchingRouter.get("/community-donations/:communityDonationId/recipients", requireRole("DONOR"), asyncHandler(async (request, response) => {
  if (!request.authUser) throw new ApiError(401, "UNAUTHORIZED", "Sign in to continue.");
  response.status(200).json(CommunityDonationMatchesResponseSchema.parse(await getRecipientsForCommunityDonation(String(request.params.communityDonationId), request.authUser.id)));
}));

matchingRouter.get("/details/:sourceType/:sourceId/recipients/:recipientProfileId", requireRole("DONOR", "RECIPIENT"), asyncHandler(async (request, response) => {
  if (!request.authUser) throw new ApiError(401, "UNAUTHORIZED", "Sign in to continue.");
  const params = MatchingRouteParamsSchema.parse({
    sourceType: request.params.sourceType, sourceId: request.params.sourceId, recipientProfileId: request.params.recipientProfileId,
  });
  response.status(200).json(MatchingResultSchema.parse(await getMatchDetails(params.sourceType, params.sourceId, params.recipientProfileId, request.authUser.id, request.authUser.role)));
}));
