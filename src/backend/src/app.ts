import express from "express";
import cors from "cors";
import { env } from "./config/env.js";
import { healthRouter } from "./modules/health/health.routes.js";
import { realtimeRouter } from "./modules/realtime/realtime.routes.js";

export const app = express();
app.disable("x-powered-by");
app.use(cors({ origin: env.FRONTEND_ORIGIN }));
app.use(express.json());
app.use("/api/health", healthRouter);
app.use("/api/events", realtimeRouter);
