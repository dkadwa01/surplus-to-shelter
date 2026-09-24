import { config } from "dotenv";
import { z } from "zod";
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../dist/modules/auth/crypto.js";

config();
const BootstrapSchema = z.object({
  BOOTSTRAP_ADMIN_NAME: z.string().trim().min(2).max(100),
  BOOTSTRAP_ADMIN_EMAIL: z.string().trim().email().max(254).transform((email) => email.toLowerCase()),
  BOOTSTRAP_ADMIN_PASSWORD: z.string().min(12).max(128),
});
const parsed = BootstrapSchema.safeParse(process.env);
if (!parsed.success) {
  console.error("Set BOOTSTRAP_ADMIN_NAME, BOOTSTRAP_ADMIN_EMAIL, and a 12+ character BOOTSTRAP_ADMIN_PASSWORD in the local environment.");
  process.exitCode = 1;
} else {
  const prisma = new PrismaClient();
  try {
    const existing = await prisma.user.findUnique({ where: { email: parsed.data.BOOTSTRAP_ADMIN_EMAIL } });
    if (existing) {
      if (existing.role !== "ADMIN") throw new Error("That email belongs to a non-admin account; refusing to elevate it.");
      console.log("An administrator with that email already exists.");
    } else {
      await prisma.user.create({
        data: {
          fullName: parsed.data.BOOTSTRAP_ADMIN_NAME,
          email: parsed.data.BOOTSTRAP_ADMIN_EMAIL,
          passwordHash: await hashPassword(parsed.data.BOOTSTRAP_ADMIN_PASSWORD),
          role: "ADMIN",
        },
      });
      console.log("Administrator account created. Sign in through the normal login flow.");
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Unable to provision administrator.");
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}
