import { ApiErrorResponseSchema, CommunityDonationMatchesResponseSchema, DonationMatchesResponseSchema, MatchingResultSchema, RecipientMatchesResponseSchema } from "@surplus/shared";

async function get(path: string) {
  const response = await fetch(`/api/matching${path}`, { credentials: "include" });
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const error = ApiErrorResponseSchema.safeParse(payload);
    throw new Error(error.success ? error.data.error.message : "Unable to load matches.");
  }
  return payload;
}
export async function getDonationMatches(id: string) { return DonationMatchesResponseSchema.parse(await get(`/donations/${encodeURIComponent(id)}/recipients`)); }
export async function getRecipientMatches() { return RecipientMatchesResponseSchema.parse(await get("/recipients/me/donations")); }
export async function getCommunityDonationMatches(id: string) { return CommunityDonationMatchesResponseSchema.parse(await get(`/community-donations/${encodeURIComponent(id)}/recipients`)); }
export async function getMatchingDetails(type: string, sourceId: string, recipientId: string) { return MatchingResultSchema.parse(await get(`/details/${encodeURIComponent(type)}/${encodeURIComponent(sourceId)}/recipients/${encodeURIComponent(recipientId)}`)); }
