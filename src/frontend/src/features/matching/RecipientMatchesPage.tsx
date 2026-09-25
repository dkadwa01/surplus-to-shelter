import { useEffect, useState } from "react";
import type { RecipientMatchesResponse } from "@surplus/shared";
import { getRecipientMatches } from "./matching-api";
import { MatchCard } from "./MatchCard";

export function RecipientMatchesPage() {
  const [data, setData] = useState<RecipientMatchesResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => { getRecipientMatches().then(setData).catch((reason) => setError(reason instanceof Error ? reason.message : "Unable to load suitable donations.")).finally(() => setLoading(false)); }, []);
  return <section className="donation-page matching-page"><p className="eyebrow">Recipient workspace</p><h1>Food matched to your profile</h1><p className="auth-description">Only available, unexpired food and currently verified recipient profiles are considered. Matches do not reserve food.</p>
    {loading && <p role="status">Finding suitable food...</p>}{error && <p className="form-error" role="alert">{error}</p>}
    {!loading && !error && data?.matches.length === 0 && <div className="donation-empty"><h2>No suitable food found right now</h2><p>Eligible food will appear when it fits your categories, capacity, and location.</p></div>}
    <div className="matching-list">{data?.matches.map((match) => <MatchCard key={`${match.source.sourceType}-${match.source.sourceId}`} match={match} />)}</div>
  </section>;
}
