import {
  ApiErrorResponseSchema,
  SubmitVerificationRequestSchema,
  VerificationAdminRequestResponseSchema,
  VerificationRequestResponseSchema,
  VerificationReviewRequestSchema,
  VerificationStatusResponseSchema,
  type SubmitVerificationRequest,
  type VerificationReviewRequest,
} from "@surplus/shared";

export class VerificationApiError extends Error {
  constructor(public readonly code: string, message: string) { super(message); this.name = "VerificationApiError"; }
}
async function request(path: string, options: RequestInit = {}) {
  const response = await fetch(`/api/verification${path}`, { ...options, credentials: "include", headers: { ...(options.body ? { "Content-Type": "application/json" } : {}), ...options.headers } });
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const error = ApiErrorResponseSchema.safeParse(payload);
    throw error.success ? new VerificationApiError(error.data.error.code, error.data.error.message) : new Error("The request could not be completed.");
  }
  return payload;
}
export async function getMyVerificationStatus() { return VerificationStatusResponseSchema.parse(await request("/me")); }
export async function submitVerification(input: SubmitVerificationRequest) {
  return VerificationRequestResponseSchema.parse(await request("/requests", { method: "POST", body: JSON.stringify(SubmitVerificationRequestSchema.parse(input)) }));
}
export async function listVerificationRequests(status?: string) {
  const params = status ? `?status=${encodeURIComponent(status)}` : "";
  return VerificationAdminRequestResponseSchema.array().parse(await request(`/admin/requests${params}`));
}
export async function getVerificationRequest(id: string) {
  return VerificationAdminRequestResponseSchema.parse(await request(`/admin/requests/${encodeURIComponent(id)}`));
}
export async function reviewVerificationRequest(id: string, input: VerificationReviewRequest) {
  return VerificationRequestResponseSchema.parse(await request(`/admin/requests/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(VerificationReviewRequestSchema.parse(input)) }));
}
