import { env } from "../../config/env.js";
import { ApiError } from "../../shared/api-error.js";
import { LocationSearchResponseSchema, type LocationSearchResult } from "@surplus/shared";

type ProviderResult = { place_id?: unknown; display_name?: unknown; lat?: unknown; lon?: unknown; address?: Record<string, unknown> };
const cache = new Map<string, LocationSearchResult[]>();
let nextRequestAt = 0;

function locationArea(address?: Record<string, unknown>) {
  if (!address) return "";
  for (const key of ["suburb", "neighbourhood", "city", "town", "village", "county", "state_district", "state"]) {
    const value = address[key];
    if (typeof value === "string") return value.slice(0, 120);
  }
  return "";
}
async function waitForProviderSlot() {
  const now = Date.now();
  const scheduled = Math.max(now, nextRequestAt);
  nextRequestAt = scheduled + 1100;
  if (scheduled > now) await new Promise((resolve) => setTimeout(resolve, scheduled - now));
}

export async function searchLocations(query: string): Promise<LocationSearchResult[]> {
  const key = query.trim().toLocaleLowerCase();
  const cached = cache.get(key);
  if (cached) return cached;
  await waitForProviderSlot();
  const url = new URL(env.LOCATION_SEARCH_URL);
  url.search = new URLSearchParams({ q: query, format: "jsonv2", addressdetails: "1", limit: "5" }).toString();
  let response: Response;
  try {
    response = await fetch(url, { headers: { Accept: "application/json", "User-Agent": "Surplus-to-Shelter/0.1 (hackathon prototype)" }, signal: AbortSignal.timeout(10000) });
  } catch {
    throw new ApiError(503, "INTERNAL_ERROR", "Location search is temporarily unavailable. You can still enter the address manually.");
  }
  if (!response.ok) throw new ApiError(503, "INTERNAL_ERROR", "Location search is busy or unavailable. Please wait and try again.");
  let payload: unknown;
  try { payload = await response.json(); } catch { throw new ApiError(503, "INTERNAL_ERROR", "Location search returned an invalid response."); }
  if (!Array.isArray(payload)) throw new ApiError(503, "INTERNAL_ERROR", "Location search returned an invalid response.");
  const results = payload.slice(0, 5).flatMap((raw): LocationSearchResult[] => {
    if (!raw || typeof raw !== "object") return [];
    const row = raw as ProviderResult;
    const latitude = Number(row.lat); const longitude = Number(row.lon);
    if (typeof row.place_id !== "number" || !Number.isInteger(row.place_id) || typeof row.display_name !== "string" || !row.display_name.trim() || !Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) return [];
    return [{ id: row.place_id, address: row.display_name.slice(0, 240), area: locationArea(row.address), latitude, longitude }];
  });
  const parsed = LocationSearchResponseSchema.parse(results);
  cache.set(key, parsed);
  if (cache.size > 500) cache.delete(cache.keys().next().value as string);
  return parsed;
}
