import { Prisma } from "@prisma/client";
import { ZodError } from "zod";
import type { ErrorRequestHandler } from "express";
import { ApiErrorResponseSchema } from "@surplus/shared";
import { ApiError } from "./api-error.js";

export const errorHandler: ErrorRequestHandler = (error, request, response, _next) => {
  if (error instanceof ZodError || (error instanceof SyntaxError && "status" in error && error.status === 400)) {
    const issues = error instanceof ZodError ? error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })) : [];
    response.status(400).json(ApiErrorResponseSchema.parse({
      error: { code: "INVALID_INPUT", message: "Request validation failed.", ...(issues.length ? { details: issues } : {}) },
    }));
    return;
  }
  if (error instanceof ApiError) {
    response.status(error.status).json(ApiErrorResponseSchema.parse({ error: { code: error.code, message: error.message } }));
    return;
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    response.status(409).json(ApiErrorResponseSchema.parse({ error: { code: "DUPLICATE_ACCOUNT", message: "An account with that email or phone already exists." } }));
    return;
  }
  console.error("Unhandled API error", request.method, request.path, error instanceof Error ? error.name : "UnknownError");
  response.status(500).json(ApiErrorResponseSchema.parse({ error: { code: "INTERNAL_ERROR", message: "An unexpected server error occurred." } }));
};
