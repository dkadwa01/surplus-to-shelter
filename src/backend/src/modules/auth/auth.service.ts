import { AuthResponseSchema, PublicUserSchema, type LoginRequest, type PublicUser, type RegistrationRequest } from "@surplus/shared";
import { Prisma } from "@prisma/client";
import { prisma } from "../../config/prisma.js";
import { ApiError } from "../../shared/api-error.js";
import { createSessionToken, hashPassword, hashSessionToken, verifyPassword } from "./crypto.js";
import { SESSION_DURATION_SECONDS } from "./session-cookie.js";

const toPublicUser = (user: { id: string; fullName: string; email: string; phone: string | null; role: string; createdAt: Date }): PublicUser =>
  PublicUserSchema.parse({ ...user, createdAt: user.createdAt.toISOString() });

function isUniqueConstraintError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

export async function registerUser(input: RegistrationRequest): Promise<{ user: PublicUser; token: string }> {
  const passwordHash = await hashPassword(input.password);
  const token = createSessionToken();
  const tokenHash = hashSessionToken(token);
  const expiresAt = new Date(Date.now() + SESSION_DURATION_SECONDS * 1000);

  try {
    const user = await prisma.$transaction(async (transaction) => {
      const created = await transaction.user.create({
        data: { fullName: input.fullName, email: input.email, phone: input.phone ?? null, passwordHash, role: input.role },
      });
      await transaction.authSession.create({ data: { tokenHash, userId: created.id, expiresAt } });
      return created;
    });
    return { user: toPublicUser(user), token };
  } catch (error) {
    if (isUniqueConstraintError(error)) throw new ApiError(409, "DUPLICATE_ACCOUNT", "An account with that email or phone already exists.");
    throw error;
  }
}

export async function loginUser(input: LoginRequest): Promise<{ user: PublicUser; token: string }> {
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  if (!user || !(await verifyPassword(input.password, user.passwordHash))) {
    throw new ApiError(401, "INVALID_CREDENTIALS", "Email or password is incorrect.");
  }

  const token = createSessionToken();
  await prisma.authSession.create({
    data: { tokenHash: hashSessionToken(token), userId: user.id, expiresAt: new Date(Date.now() + SESSION_DURATION_SECONDS * 1000) },
  });
  return { user: toPublicUser(user), token };
}

export async function findSessionUser(token: string): Promise<{ user: PublicUser; tokenHash: string } | null> {
  const tokenHash = hashSessionToken(token);
  const session = await prisma.authSession.findUnique({ where: { tokenHash }, include: { user: true } });
  if (!session) return null;
  if (session.expiresAt.getTime() <= Date.now()) {
    await prisma.authSession.deleteMany({ where: { tokenHash } });
    return null;
  }
  return { user: toPublicUser(session.user), tokenHash };
}

export async function deleteSession(tokenHash: string | undefined): Promise<void> {
  if (tokenHash) await prisma.authSession.deleteMany({ where: { tokenHash } });
}

export function authResponse(user: PublicUser) {
  return AuthResponseSchema.parse({ user });
}
