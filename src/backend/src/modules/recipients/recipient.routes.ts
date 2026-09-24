import { Router } from "express";
import { CreateRecipientProfileRequestSchema, RecipientDiscoveryQuerySchema, RecipientProfileResponseSchema, UpdateRecipientProfileRequestSchema } from "@surplus/shared";
import { requireAuth, requireRole } from "../../middleware/auth.middleware.js";
import { ApiError, asyncHandler } from "../../shared/api-error.js";
import { createRecipientProfile, discoverRecipients, getMyRecipientProfile, updateRecipientProfile } from "./recipient.service.js";

export const recipientRouter = Router();
recipientRouter.use(requireAuth);
recipientRouter.post("/", requireRole("RECIPIENT"), asyncHandler(async (request, response) => {
  if (!request.authUser) throw new ApiError(401, "UNAUTHORIZED", "Sign in to continue.");
  const fields = CreateRecipientProfileRequestSchema.parse(request.body);
  response.status(201).json(RecipientProfileResponseSchema.parse(await createRecipientProfile(request.authUser.id, fields)));
}));
recipientRouter.get("/me", requireRole("RECIPIENT"), asyncHandler(async (request, response) => {
  if (!request.authUser) throw new ApiError(401, "UNAUTHORIZED", "Sign in to continue.");
  response.status(200).json(RecipientProfileResponseSchema.parse(await getMyRecipientProfile(request.authUser.id)));
}));
recipientRouter.patch("/me", requireRole("RECIPIENT"), asyncHandler(async (request, response) => {
  if (!request.authUser) throw new ApiError(401, "UNAUTHORIZED", "Sign in to continue.");
  const fields = UpdateRecipientProfileRequestSchema.parse(request.body);
  response.status(200).json(RecipientProfileResponseSchema.parse(await updateRecipientProfile(request.authUser.id, fields)));
}));
recipientRouter.get("/", requireRole("DONOR", "DRIVER", "ADMIN"), asyncHandler(async (request, response) => {
  const filters = RecipientDiscoveryQuerySchema.parse(request.query);
  if (filters.active === "false" && request.authUser?.role !== "ADMIN") throw new ApiError(403, "FORBIDDEN", "Only administrators can discover inactive recipient profiles.");
  response.status(200).json(await discoverRecipients(filters));
}));
