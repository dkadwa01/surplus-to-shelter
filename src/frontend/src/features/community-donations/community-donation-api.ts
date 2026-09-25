import {
  ApiErrorResponseSchema, CommunityContributionResponseSchema, CommunityDonationQuerySchema,
  CommunityDonationResponseSchema, CreateCommunityContributionRequestSchema,
  CreateCommunityDonationRequestSchema, IndividualContributionThresholdResponseSchema,
  UpdateCommunityContributionRequestSchema, type CommunityContributionFields,
  type CommunityDonationResponse, type CreateCommunityDonationRequest,
} from "@surplus/shared";

async function request(path: string, options: RequestInit = {}) {
  const response = await fetch(`/api/community-donations${path}`, {
    ...options, credentials: "include",
    headers: { ...(options.body ? { "Content-Type": "application/json" } : {}), ...options.headers },
  });
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const error = ApiErrorResponseSchema.safeParse(payload);
    throw new Error(error.success ? error.data.error.message : "The request could not be completed.");
  }
  return payload;
}

export async function listCommunityDonations(filters: { status?: string; pickupArea?: string } = {}): Promise<CommunityDonationResponse[]> {
  const query = CommunityDonationQuerySchema.parse(filters);
  const params = new URLSearchParams(query as Record<string, string>);
  return CommunityDonationResponseSchema.array().parse(await request(`/${params.size ? `?${params}` : ""}`));
}
export async function getCommunityDonation(id: string) {
  return CommunityDonationResponseSchema.parse(await request(`/${encodeURIComponent(id)}`));
}
export async function createCommunityDonation(input: CreateCommunityDonationRequest) {
  return CommunityDonationResponseSchema.parse(await request("/", { method: "POST", body: JSON.stringify(CreateCommunityDonationRequestSchema.parse(input)) }));
}
export async function addCommunityContribution(id: string, input: CommunityContributionFields) {
  return CommunityContributionResponseSchema.parse(await request(`/${encodeURIComponent(id)}/contributions`, { method: "POST", body: JSON.stringify(CreateCommunityContributionRequestSchema.parse(input)) }));
}
export async function updateCommunityContribution(id: string, input: CommunityContributionFields) {
  return CommunityContributionResponseSchema.parse(await request(`/contributions/${encodeURIComponent(id)}`, { method: "PUT", body: JSON.stringify(UpdateCommunityContributionRequestSchema.parse(input)) }));
}
export async function withdrawCommunityContribution(id: string) {
  return CommunityContributionResponseSchema.parse(await request(`/contributions/${encodeURIComponent(id)}/withdraw`, { method: "POST" }));
}
export async function manageCommunityDonation(id: string, action: "close" | "cancel") {
  return CommunityDonationResponseSchema.parse(await request(`/${encodeURIComponent(id)}/${action}`, { method: "POST" }));
}
export async function getIndividualThresholds() {
  return IndividualContributionThresholdResponseSchema.array().parse(await request("/thresholds"));
}
