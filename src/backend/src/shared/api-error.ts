import type { NextFunction, Request, RequestHandler, Response } from "express";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: "DUPLICATE_ACCOUNT" | "INVALID_CREDENTIALS" | "UNAUTHORIZED" | "FORBIDDEN" | "INTERNAL_ERROR",
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

type AsyncHandler = (request: Request, response: Response, next: NextFunction) => Promise<unknown>;
export const asyncHandler = (handler: AsyncHandler): RequestHandler => (request, response, next) => {
  void handler(request, response, next).catch(next);
};
