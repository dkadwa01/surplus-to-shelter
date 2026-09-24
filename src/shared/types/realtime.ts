export type { z } from "zod";
import type { z } from "zod";
import { SseEnvelopeSchema } from "../validation/realtime.js";

export type SseEnvelope = z.infer<typeof SseEnvelopeSchema>;
