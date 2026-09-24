import type { RequestHandler } from "express";
import { isUserVerified } from "./verification.service.js";
import { ApiError } from "../../shared/api-error.js";

export const requireVerifiedUser: RequestHandler = (request, _response, next) => {
  if (!request.authUser) return next(new ApiError(401, "UNAUTHORIZED", "Sign in to continue."));
  void isUserVerified(request.authUser.id).then((verified) => {
    if (!verified) return next(new ApiError(403, "VERIFICATION_REQUIRED", "Complete participant verification before using this feature."));
    next();
  }).catch(next);
};
