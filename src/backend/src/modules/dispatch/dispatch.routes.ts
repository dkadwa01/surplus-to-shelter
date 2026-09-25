import { Router } from "express";
import { CreateDispatchRequestSchema, DriverAvailabilityRequestSchema, DriverProfileInputSchema, DispatchListResponseSchema, DispatchResponseSchema, DriverProfileResponseSchema } from "@surplus/shared";
import { requireAuth, requireRole } from "../../middleware/auth.middleware.js";
import { requireVerifiedUser } from "../verification/verification.middleware.js";
import { ApiError, asyncHandler } from "../../shared/api-error.js";
import { acceptAssignment, advanceAssignment, cancelAssignment, createDispatch, declineAssignment, getDriverProfile, getVisibleAssignment, listAvailableAssignments, listMyAssignments, saveDriverProfile, setDriverAvailability } from "./dispatch.service.js";

export const dispatchRouter = Router();
dispatchRouter.use(requireAuth);

dispatchRouter.get("/drivers/me", requireRole("DRIVER"), asyncHandler(async (request, response) => {
  if (!request.authUser) throw new ApiError(401, "UNAUTHORIZED", "Sign in to continue.");
  const profile = await getDriverProfile(request.authUser.id);
  response.status(200).json({ profile: profile ? DriverProfileResponseSchema.parse(profile) : null });
}));
dispatchRouter.put("/drivers/profile", requireRole("DRIVER"), asyncHandler(async (request, response) => {
  if (!request.authUser) throw new ApiError(401, "UNAUTHORIZED", "Sign in to continue.");
  response.status(200).json(DriverProfileResponseSchema.parse(await saveDriverProfile(request.authUser.id, DriverProfileInputSchema.parse(request.body))));
}));
dispatchRouter.patch("/drivers/availability", requireRole("DRIVER"), asyncHandler(async (request, response) => {
  if (!request.authUser) throw new ApiError(401, "UNAUTHORIZED", "Sign in to continue.");
  const fields = DriverAvailabilityRequestSchema.parse(request.body);
  response.status(200).json(DriverProfileResponseSchema.parse(await setDriverAvailability(request.authUser.id, fields.availability)));
}));

dispatchRouter.get("/available", requireRole("DRIVER"), requireVerifiedUser, asyncHandler(async (request, response) => {
  if (!request.authUser) throw new ApiError(401, "UNAUTHORIZED", "Sign in to continue.");
  response.status(200).json(DispatchListResponseSchema.parse(await listAvailableAssignments(request.authUser.id)));
}));
dispatchRouter.get("/mine", requireRole("DRIVER", "DONOR", "RECIPIENT", "ADMIN"), asyncHandler(async (request, response) => {
  if (!request.authUser) throw new ApiError(401, "UNAUTHORIZED", "Sign in to continue.");
  response.status(200).json(DispatchListResponseSchema.parse(await listMyAssignments(request.authUser.id, request.authUser.role)));
}));
dispatchRouter.post("/", requireRole("DONOR"), requireVerifiedUser, asyncHandler(async (request, response) => {
  if (!request.authUser) throw new ApiError(401, "UNAUTHORIZED", "Sign in to continue.");
  response.status(201).json(DispatchResponseSchema.parse(await createDispatch(request.authUser.id, CreateDispatchRequestSchema.parse(request.body))));
}));
dispatchRouter.get("/:id", requireRole("DRIVER", "DONOR", "RECIPIENT", "ADMIN"), asyncHandler(async (request, response) => {
  if (!request.authUser) throw new ApiError(401, "UNAUTHORIZED", "Sign in to continue.");
  response.status(200).json(DispatchResponseSchema.parse(await getVisibleAssignment(String(request.params.id), request.authUser.id, request.authUser.role)));
}));
dispatchRouter.post("/:id/accept", requireRole("DRIVER"), requireVerifiedUser, asyncHandler(async (request, response) => {
  if (!request.authUser) throw new ApiError(401, "UNAUTHORIZED", "Sign in to continue.");
  response.status(200).json(DispatchResponseSchema.parse(await acceptAssignment(String(request.params.id), request.authUser.id)));
}));
dispatchRouter.post("/:id/decline", requireRole("DRIVER"), asyncHandler(async (request, response) => {
  if (!request.authUser) throw new ApiError(401, "UNAUTHORIZED", "Sign in to continue.");
  response.status(200).json(DispatchResponseSchema.parse(await declineAssignment(String(request.params.id), request.authUser.id)));
}));
dispatchRouter.post("/:id/pickup/start", requireRole("DRIVER"), asyncHandler(async (request, response) => {
  if (!request.authUser) throw new ApiError(401, "UNAUTHORIZED", "Sign in to continue.");
  response.status(200).json(DispatchResponseSchema.parse(await advanceAssignment(String(request.params.id), request.authUser.id, "PICKUP_STARTED")));
}));
dispatchRouter.post("/:id/pickup/confirm", requireRole("DRIVER"), asyncHandler(async (request, response) => {
  if (!request.authUser) throw new ApiError(401, "UNAUTHORIZED", "Sign in to continue.");
  response.status(200).json(DispatchResponseSchema.parse(await advanceAssignment(String(request.params.id), request.authUser.id, "PICKED_UP")));
}));
dispatchRouter.post("/:id/transit/start", requireRole("DRIVER"), asyncHandler(async (request, response) => {
  if (!request.authUser) throw new ApiError(401, "UNAUTHORIZED", "Sign in to continue.");
  response.status(200).json(DispatchResponseSchema.parse(await advanceAssignment(String(request.params.id), request.authUser.id, "IN_TRANSIT")));
}));
dispatchRouter.post("/:id/delivery/confirm", requireRole("DRIVER"), asyncHandler(async (request, response) => {
  if (!request.authUser) throw new ApiError(401, "UNAUTHORIZED", "Sign in to continue.");
  response.status(200).json(DispatchResponseSchema.parse(await advanceAssignment(String(request.params.id), request.authUser.id, "DELIVERED")));
}));
dispatchRouter.post("/:id/complete", requireRole("DRIVER"), asyncHandler(async (request, response) => {
  if (!request.authUser) throw new ApiError(401, "UNAUTHORIZED", "Sign in to continue.");
  response.status(200).json(DispatchResponseSchema.parse(await advanceAssignment(String(request.params.id), request.authUser.id, "COMPLETED")));
}));
dispatchRouter.post("/:id/cancel", requireRole("DONOR", "ADMIN"), asyncHandler(async (request, response) => {
  if (!request.authUser) throw new ApiError(401, "UNAUTHORIZED", "Sign in to continue.");
  response.status(200).json(DispatchResponseSchema.parse(await cancelAssignment(String(request.params.id), request.authUser.id, request.authUser.role === "ADMIN")));
}));
