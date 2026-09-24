import { Router } from "express";
import { CreateDonationRequestSchema, DonationQuerySchema, DonationResponseSchema, UpdateDonationRequestSchema } from "@surplus/shared";
import { requireAuth, requireRole } from "../../middleware/auth.middleware.js";
import { ApiError, asyncHandler } from "../../shared/api-error.js";
import { cancelDonation, createDonation, getDonation, listDonations, updateDonation } from "./donation.service.js";

export const donationRouter = Router();
donationRouter.use(requireAuth);
donationRouter.post("/", requireRole("DONOR"), asyncHandler(async (request, response) => {
  if (!request.authUser) throw new ApiError(401, "UNAUTHORIZED", "Sign in to continue.");
  const fields = CreateDonationRequestSchema.parse(request.body);
  response.status(201).json(DonationResponseSchema.parse(await createDonation(request.authUser.id, fields)));
}));
donationRouter.get("/", requireRole("DONOR", "ADMIN"), asyncHandler(async (request, response) => {
  if (!request.authUser) throw new ApiError(401, "UNAUTHORIZED", "Sign in to continue.");
  const filters = DonationQuerySchema.parse(request.query);
  response.status(200).json(await listDonations(request.authUser.id, request.authUser.role === "ADMIN", filters));
}));
donationRouter.get("/:id", requireRole("DONOR", "ADMIN"), asyncHandler(async (request, response) => {
  if (!request.authUser) throw new ApiError(401, "UNAUTHORIZED", "Sign in to continue.");
  response.status(200).json(DonationResponseSchema.parse(await getDonation(String(request.params.id), request.authUser.id, request.authUser.role === "ADMIN")));
}));
donationRouter.put("/:id", requireRole("DONOR", "ADMIN"), asyncHandler(async (request, response) => {
  if (!request.authUser) throw new ApiError(401, "UNAUTHORIZED", "Sign in to continue.");
  const fields = UpdateDonationRequestSchema.parse(request.body);
  response.status(200).json(DonationResponseSchema.parse(await updateDonation(String(request.params.id), request.authUser.id, request.authUser.role === "ADMIN", fields)));
}));
donationRouter.post("/:id/cancel", requireRole("DONOR", "ADMIN"), asyncHandler(async (request, response) => {
  if (!request.authUser) throw new ApiError(401, "UNAUTHORIZED", "Sign in to continue.");
  response.status(200).json(DonationResponseSchema.parse(await cancelDonation(String(request.params.id), request.authUser.id, request.authUser.role === "ADMIN")));
}));
