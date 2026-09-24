import { ApiErrorResponseSchema, CreateDonationRequestSchema, DonationQuerySchema, DonationResponseSchema, UpdateDonationRequestSchema, type DonationFields, type DonationResponse } from "@surplus/shared";

async function request(path: string, options: RequestInit = {}) {
  const response = await fetch(`/api/donations${path}`, { ...options, credentials: "include", headers: { ...(options.body ? { "Content-Type": "application/json" } : {}), ...options.headers } });
  const payload: unknown = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) {
    const error = ApiErrorResponseSchema.safeParse(payload);
    throw new Error(error.success ? error.data.error.message : "The request could not be completed.");
  }
  return payload;
}
export async function listDonations(filters: { status?: string; category?: string } = {}): Promise<DonationResponse[]> {
  const query = DonationQuerySchema.parse(filters);
  const params = new URLSearchParams(query as Record<string, string>);
  const result = await request(`/${params.size ? `?${params}` : ""}`);
  return DonationResponseSchema.array().parse(result);
}
export async function getDonation(id: string) { return DonationResponseSchema.parse(await request(`/${encodeURIComponent(id)}`)); }
export async function createDonation(input: DonationFields) {
  return DonationResponseSchema.parse(await request("/", { method: "POST", body: JSON.stringify(CreateDonationRequestSchema.parse(input)) }));
}
export async function updateDonation(id: string, input: DonationFields) {
  return DonationResponseSchema.parse(await request(`/${encodeURIComponent(id)}`, { method: "PUT", body: JSON.stringify(UpdateDonationRequestSchema.parse(input)) }));
}
export async function cancelDonation(id: string) {
  return DonationResponseSchema.parse(await request(`/${encodeURIComponent(id)}/cancel`, { method: "POST" }));
}
