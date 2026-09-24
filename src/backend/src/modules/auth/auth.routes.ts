import { Router } from "express";
import { AuthResponseSchema, LoginRequestSchema, RegistrationRequestSchema } from "@surplus/shared";
import { requireAuth } from "../../middleware/auth.middleware.js";
import { ApiError, asyncHandler } from "../../shared/api-error.js";
import { deleteSession, findSessionUser, loginUser, registerUser } from "./auth.service.js";
import { clearSessionCookie, readSessionToken, setSessionCookie } from "./session-cookie.js";

export const authRouter = Router();

authRouter.post("/register", asyncHandler(async (request, response) => {
  const input = RegistrationRequestSchema.parse(request.body);
  const result = await registerUser(input);
  setSessionCookie(response, result.token);
  response.status(201).json(AuthResponseSchema.parse({ user: result.user }));
}));

authRouter.post("/login", asyncHandler(async (request, response) => {
  const input = LoginRequestSchema.parse(request.body);
  const result = await loginUser(input);
  setSessionCookie(response, result.token);
  response.status(200).json(AuthResponseSchema.parse({ user: result.user }));
}));

authRouter.post("/logout", asyncHandler(async (request, response) => {
  const token = readSessionToken(request.headers.cookie);
  const session = token ? await findSessionUser(token) : null;
  await deleteSession(session?.tokenHash);
  clearSessionCookie(response);
  response.status(204).end();
}));

authRouter.get("/me", requireAuth, (request, response, next) => {
  if (!request.authUser) return next(new ApiError(401, "UNAUTHORIZED", "Sign in to continue."));
  response.status(200).json(AuthResponseSchema.parse({ user: request.authUser }));
});
