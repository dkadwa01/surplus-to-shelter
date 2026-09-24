import { z } from "zod";

export const UserRoleSchema = z.enum(["DONOR", "RECIPIENT", "DRIVER", "ADMIN"]);
export const SelfAssignableRoleSchema = z.enum(["DONOR", "RECIPIENT", "DRIVER"]);
export type UserRole = z.infer<typeof UserRoleSchema>;
export type SelfAssignableRole = z.infer<typeof SelfAssignableRoleSchema>;

export const PublicUserSchema = z.object({
  id: z.string(),
  fullName: z.string(),
  email: z.string().email(),
  phone: z.string().nullable(),
  role: UserRoleSchema,
  createdAt: z.string().datetime(),
});
export type PublicUser = z.infer<typeof PublicUserSchema>;
export const AuthResponseSchema = z.object({ user: PublicUserSchema });
export type AuthResponse = z.infer<typeof AuthResponseSchema>;
