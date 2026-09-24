import { z } from "zod";

export const HealthResponseSchema = z.object({
  status: z.literal("ok"),
  timestamp: z.string().datetime(),
  uptimeSeconds: z.number().nonnegative(),
});
