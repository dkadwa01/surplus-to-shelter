import { ApiErrorResponseSchema, CreateDispatchRequestSchema, DispatchListResponseSchema, DispatchResponseSchema, DriverAvailabilityRequestSchema, DriverProfileInputSchema, DriverProfileResponseSchema, type CreateDispatchRequest, type DriverProfileInput } from "@surplus/shared";

async function request(path: string, options: RequestInit = {}) {
  const response = await fetch(`/api/dispatch${path}`, { ...options, credentials: "include", headers: { ...(options.body ? { "Content-Type": "application/json" } : {}), ...options.headers } });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const parsed = ApiErrorResponseSchema.safeParse(body);
    throw new Error(parsed.success ? parsed.data.error.message : "The request could not be completed.");
  }
  return body;
}
export async function getDriverProfile() {
  const response = await request("/drivers/me");
  return response.profile ? DriverProfileResponseSchema.parse(response.profile) : null;
}
export async function saveDriverProfile(input: DriverProfileInput) {
  return DriverProfileResponseSchema.parse(await request("/drivers/profile", { method: "PUT", body: JSON.stringify(DriverProfileInputSchema.parse(input)) }));
}
export async function setDriverAvailability(availability: "AVAILABLE" | "OFFLINE") {
  return DriverProfileResponseSchema.parse(await request("/drivers/availability", { method: "PATCH", body: JSON.stringify(DriverAvailabilityRequestSchema.parse({ availability })) }));
}
export async function getAvailableAssignments() { return DispatchListResponseSchema.parse(await request("/available")).assignments; }
export async function getMyAssignments() { return DispatchListResponseSchema.parse(await request("/mine")).assignments; }
export async function createDispatch(input: CreateDispatchRequest) {
  return DispatchResponseSchema.parse(await request("/", { method: "POST", body: JSON.stringify(CreateDispatchRequestSchema.parse(input)) }));
}
export async function dispatchAction(id: string, action: string) {
  return DispatchResponseSchema.parse(await request(`/${encodeURIComponent(id)}/${action}`, { method: "POST" }));
}
