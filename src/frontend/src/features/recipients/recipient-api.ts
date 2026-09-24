import {
  ApiErrorResponseSchema,
  CreateRecipientProfileRequestSchema,
  RecipientDiscoveryQuerySchema,
  RecipientDiscoveryResponseSchema,
  RecipientProfileResponseSchema,
  UpdateRecipientProfileRequestSchema,
  type RecipientProfileFields,
} from "@surplus/shared";

export class RecipientApiError extends Error {
  constructor(public readonly code: string, message: string) { super(message); this.name = "RecipientApiError"; }
}
async function request(path: string, options: RequestInit = {}) {
  const response = await fetch(`/api/recipients${path}`, { ...options, credentials: "include", headers: { ...(options.body ? { "Content-Type": "application/json" } : {}), ...options.headers } });
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const error = ApiErrorResponseSchema.safeParse(payload);
    throw error.success ? new RecipientApiError(error.data.error.code, error.data.error.message) : new Error("The request could not be completed.");
  }
  return payload;
}
export async function getMyProfile() { return RecipientProfileResponseSchema.parse(await request("/me")); }
export async function createMyProfile(fields: RecipientProfileFields) {
  return RecipientProfileResponseSchema.parse(await request("/", { method: "POST", body: JSON.stringify(CreateRecipientProfileRequestSchema.parse(fields)) }));
}
export async function updateMyProfile(fields: Partial<RecipientProfileFields>) {
  return RecipientProfileResponseSchema.parse(await request("/me", { method: "PATCH", body: JSON.stringify(UpdateRecipientProfileRequestSchema.parse(fields)) }));
}
export async function discoverRecipients(filters: { recipientType?: string; serviceArea?: string; category?: string; accepting?: "true" | "false"; active?: "true" | "false" } = {}) {
  const parsed = RecipientDiscoveryQuerySchema.parse(filters);
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(parsed)) if (value) params.set(key, value);
  const result = await request(`/${params.size ? `?${params}` : ""}`);
  return RecipientDiscoveryResponseSchema.array().parse(result);
}
