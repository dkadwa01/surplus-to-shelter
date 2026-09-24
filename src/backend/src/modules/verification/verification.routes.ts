import { Router } from "express";
import { VerificationAdminListQuerySchema, VerificationAdminRequestResponseSchema, VerificationRequestResponseSchema, VerificationReviewRequestSchema, VerificationStatusResponseSchema, SubmitVerificationRequestSchema } from "@surplus/shared";
import { requireAuth, requireRole } from "../../middleware/auth.middleware.js";
import { ApiError, asyncHandler } from "../../shared/api-error.js";
import { getMyVerificationStatus, getVerificationRequestForAdmin, listVerificationRequests, reviewVerificationRequest, submitVerification } from "./verification.service.js";

export const verificationRouter = Router();
verificationRouter.use(requireAuth);
verificationRouter.post("/requests", asyncHandler(async (request, response) => {
  if (!request.authUser) throw new ApiError(401, "UNAUTHORIZED", "Sign in to continue.");
  const input = SubmitVerificationRequestSchema.parse(request.body);
  response.status(201).json(VerificationRequestResponseSchema.parse(await submitVerification(request.authUser, input)));
}));
verificationRouter.get("/me", asyncHandler(async (request, response) => {
  if (!request.authUser) throw new ApiError(401, "UNAUTHORIZED", "Sign in to continue.");
  response.status(200).json(VerificationStatusResponseSchema.parse(await getMyVerificationStatus(request.authUser.id)));
}));
verificationRouter.get("/admin/requests", requireRole("ADMIN"), asyncHandler(async (request, response) => {
  const { status } = VerificationAdminListQuerySchema.parse(request.query);
  response.status(200).json(VerificationAdminRequestResponseSchema.array().parse(await listVerificationRequests(status)));
}));
verificationRouter.get("/admin/requests/:id", requireRole("ADMIN"), asyncHandler(async (request, response) => {
  response.status(200).json(VerificationAdminRequestResponseSchema.parse(await getVerificationRequestForAdmin(String(request.params.id))));
}));
verificationRouter.patch("/admin/requests/:id", requireRole("ADMIN"), asyncHandler(async (request, response) => {
  if (!request.authUser) throw new ApiError(401, "UNAUTHORIZED", "Sign in to continue.");
  const input = VerificationReviewRequestSchema.parse(request.body);
  response.status(200).json(VerificationRequestResponseSchema.parse(await reviewVerificationRequest(String(request.params.id), request.authUser.id, input.action, input.reason)));
}));
