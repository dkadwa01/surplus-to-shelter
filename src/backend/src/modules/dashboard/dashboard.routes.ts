import { Router } from "express";
import { DashboardSummarySchema } from "@surplus/shared";
import { requireAuth } from "../../middleware/auth.middleware.js";
import { ApiError, asyncHandler } from "../../shared/api-error.js";
import { getDashboardSummary } from "./dashboard.service.js";

export const dashboardRouter = Router();
dashboardRouter.use(requireAuth);
dashboardRouter.get("/summary", asyncHandler(async (request, response) => {
  if (!request.authUser) throw new ApiError(401, "UNAUTHORIZED", "Sign in to continue.");
  response.status(200).json(DashboardSummarySchema.parse(await getDashboardSummary(request.authUser)));
}));
