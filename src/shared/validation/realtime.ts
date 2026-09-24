import { z } from "zod";

export const SseEnvelopeSchema = z.object({
  event: z.string().min(1),
  data: z.unknown(),
  timestamp: z.string().datetime(),
});
