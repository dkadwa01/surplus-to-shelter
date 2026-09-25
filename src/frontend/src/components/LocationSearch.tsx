import { useEffect, useRef, useState, type FormEvent } from "react";
import { ApiErrorResponseSchema, LocationSearchResultSchema, type DashboardSummary, type LocationSearchResult } from "@surplus/shared";
import { LocationMap } from "./LocationMap";

type Point = DashboardSummary["mapPoints"][number];
type SelectedLocation = { address: string; area: string; latitude: number; longitude: number };
const resultCache = new Map<string, LocationSearchResult[]>();
async function searchLocations(query: string, signal: AbortSignal): Promise<LocationSearchResult[]> {
  const response = await fetch(`/api/locations/search?q=${encodeURIComponent(query)}`, { credentials: "include", signal });
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const parsed = ApiErrorResponseSchema.safeParse(body);
    throw new Error(parsed.success ? parsed.data.error.message : "Location search is temporarily unavailable.");
  }
  return LocationSearchResultSchema.array().parse(body);
}

export function LocationSearch({ value, latitude, longitude, title, markerType, onAddressChange, onSelect }: {
  value: string; latitude?: number; longitude?: number; title: string; markerType: "DONATION" | "RECIPIENT";
  onAddressChange: (address: string) => void; onSelect: (location: SelectedLocation) => void;
}) {
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState<LocationSearchResult[]>([]);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => setQuery(value), [value]);
  useEffect(() => () => controller.current?.abort(), []);

  async function search(event: FormEvent) {
    event.preventDefault();
    const normalized = query.trim();
    if (normalized.length < 3) { setStatus("Enter at least 3 characters to search."); return; }
    const cacheKey = normalized.toLocaleLowerCase();
    const cached = resultCache.get(cacheKey);
    if (cached) { setResults(cached); setStatus(cached.length ? "Choose the matching location." : "No locations found. Try a nearby landmark or area."); return; }
    controller.current?.abort();
    const requestController = new AbortController(); controller.current = requestController;
    setLoading(true); setStatus("Searching OpenStreetMap locations..."); setResults([]);
    try {
      const found = await searchLocations(normalized, requestController.signal);
      if (requestController.signal.aborted) return;
      resultCache.set(cacheKey, found);
      setResults(found);
      setStatus(found.length ? "Choose the matching location." : "No locations found. Try a nearby landmark or area.");
    } catch (error) {
      if (!requestController.signal.aborted) setStatus(error instanceof Error ? error.message : "Location search is temporarily unavailable.");
    } finally { if (!requestController.signal.aborted) setLoading(false); }
  }

  function choose(result: LocationSearchResult) {
    const selected = { address: result.address, area: result.area, latitude: result.latitude, longitude: result.longitude };
    onSelect(selected); setQuery(selected.address); setResults([]); setStatus("Location selected.");
  }

  const points: Point[] = latitude !== undefined && longitude !== undefined && Number.isFinite(latitude) && Number.isFinite(longitude)
    ? [{ id: "location-preview", type: markerType, label: value || title, area: "Selected location", latitude, longitude }]
    : [];
  return <div className="location-search">
    <label>{title}<input value={query} maxLength={240} autoComplete="street-address" onChange={(event) => { const next = event.target.value; controller.current?.abort(); setLoading(false); setQuery(next); onAddressChange(next); setResults([]); setStatus(""); }} placeholder="e.g. SKIT Jaipur or Jaipur railway station" required /></label>
    <form className="location-search-action" onSubmit={(event) => void search(event)}><button className="secondary-button" type="submit" disabled={loading}>{loading ? "Searching..." : "Search locations"}</button><span className="field-note">Search is sent only when you submit, to respect OpenStreetMap service limits.</span></form>
    {status && <p className={status.includes("unavailable") || status.includes("busy") ? "form-error" : "field-note"} role="status">{status}</p>}
    {results.length > 0 && <ul className="location-search-results" aria-label="Location search results">{results.map((result) => <li key={result.id}><button type="button" onClick={() => choose(result)}><strong>{result.address}</strong>{result.area && <small>{result.area}</small>}</button></li>)}</ul>}
    {points.length > 0 ? <LocationMap points={points} title="Selected location" /> : <p className="field-note">Location coordinates unavailable. The address can still be saved.</p>}
    <p className="location-attribution">Search data &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a></p>
  </div>;
}
