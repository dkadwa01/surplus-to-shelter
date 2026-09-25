import { Router } from "express";
import { LocationSearchQuerySchema, LocationSearchResponseSchema } from "@surplus/shared";
import { requireAuth } from "../../middleware/auth.middleware.js";
import { ApiError, asyncHandler } from "../../shared/api-error.js";
import { searchLocations } from "./location-search.service.js";

export const locationSearchRouter = Router();
locationSearchRouter.use(requireAuth);
locationSearchRouter.get("/search", asyncHandler(async (request, response) => {
  const parsed = LocationSearchQuerySchema.safeParse({ query: request.query.q });
  if (!parsed.success) throw new ApiError(400, "INVALID_INPUT", parsed.error.issues[0]?.message ?? "Enter a location to search.");
  response.status(200).json(LocationSearchResponseSchema.parse(await searchLocations(parsed.data.query)));
}));
