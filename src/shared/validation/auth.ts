import { z } from "zod";
import { SelfAssignableRoleSchema, UserRoleSchema } from "../types/auth.js";

export const RegistrationRequestSchema = z.object({
  fullName: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
  phone: z.string().trim().regex(/^\+[1-9]\d{7,14}$/, "Enter a phone number in international format, such as +14155552671.").optional(),
  password: z.string().min(12, "Password must be at least 12 characters.").max(128, "Password must be 128 characters or fewer."),
  role: SelfAssignableRoleSchema,
});
export type RegistrationRequest = z.infer<typeof RegistrationRequestSchema>;

export const LoginRequestSchema = z.object({
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
  password: z.string().min(1).max(128),
});
export type LoginRequest = z.infer<typeof LoginRequestSchema>;

export const ApiErrorCodeSchema = z.enum([
  "INVALID_INPUT",
  "DUPLICATE_ACCOUNT",
  "INVALID_CREDENTIALS",
  "UNAUTHORIZED",
  "FORBIDDEN",
  "INTERNAL_ERROR",
]);
export const ApiErrorResponseSchema = z.object({
  error: z.object({
    code: ApiErrorCodeSchema,
    message: z.string(),
    details: z.array(z.object({ path: z.string(), message: z.string() })).optional(),
  }),
});
export type ApiErrorResponse = z.infer<typeof ApiErrorResponseSchema>;
