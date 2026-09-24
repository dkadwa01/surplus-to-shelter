import { Router } from "express";
import { HealthResponseSchema } from "@surplus/shared";

export const healthRouter = Router();

healthRouter.get("/", (_request, response) => {
  const payload = HealthResponseSchema.parse({
    status: "ok",
    timestamp: new Date().toISOString(),
    uptimeSeconds: process.uptime(),
  });
  response.status(200).json(payload);
});
