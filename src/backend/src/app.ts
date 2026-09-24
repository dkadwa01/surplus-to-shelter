import express from "express";
import cors from "cors";
import { env } from "./config/env.js";
import { healthRouter } from "./modules/health/health.routes.js";
import { realtimeRouter } from "./modules/realtime/realtime.routes.js";
import { authRouter } from "./modules/auth/auth.routes.js";
import { errorHandler } from "./shared/error-handler.js";

export const app = express();
app.disable("x-powered-by");
app.use(cors({ origin: env.FRONTEND_ORIGIN, credentials: true }));
app.use(express.json({ limit: "32kb" }));
app.use("/api/health", healthRouter);
app.use("/api/events", realtimeRouter);
app.use("/api/auth", authRouter);
app.use(errorHandler);
