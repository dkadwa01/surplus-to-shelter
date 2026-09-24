import type { RequestHandler } from "express";
import { ApiError } from "../shared/api-error.js";
import { findSessionUser } from "../modules/auth/auth.service.js";
import { readSessionToken } from "../modules/auth/session-cookie.js";
import type { UserRole } from "@surplus/shared";

export const requireAuth: RequestHandler = (request, _response, next) => {
  const token = readSessionToken(request.headers.cookie);
  if (!token) return next(new ApiError(401, "UNAUTHORIZED", "Sign in to continue."));
  void findSessionUser(token).then((session) => {
    if (!session) return next(new ApiError(401, "UNAUTHORIZED", "Your session is invalid or has expired."));
    request.authUser = session.user;
    request.authSessionTokenHash = session.tokenHash;
    next();
  }).catch(next);
};

export function requireRole(...roles: UserRole[]): RequestHandler {
  return (request, _response, next) => {
    if (!request.authUser) return next(new ApiError(401, "UNAUTHORIZED", "Sign in to continue."));
    if (!roles.includes(request.authUser.role)) return next(new ApiError(403, "FORBIDDEN", "You do not have permission to perform this action."));
    next();
  };
}
