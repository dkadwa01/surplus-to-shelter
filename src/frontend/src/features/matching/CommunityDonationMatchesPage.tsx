import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import type { CommunityDonationMatchesResponse } from "@surplus/shared";
import { getCommunityDonationMatches } from "./matching-api";
import { MatchCard } from "./MatchCard";

export function CommunityDonationMatchesPage() {
  const { id = "" } = useParams();
  const [data, setData] = useState<CommunityDonationMatchesResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => { getCommunityDonationMatches(id).then(setData).catch((reason) => setError(reason instanceof Error ? reason.message : "Unable to find community matches.")).finally(() => setLoading(false)); }, [id]);
  return <section className="donation-page matching-page"><Link to={`/community-donations/${id}`}>Back to community collection</Link><p className="eyebrow">Community matching</p><h1>{data?.title ?? "Recipient matches"}</h1><p className="auth-description">Each household item is matched independently. Different categories and units are never combined.</p>
    {loading && <p role="status">Finding recipients for each contribution...</p>}{error && <p className="form-error" role="alert">{error}</p>}
    {!loading && !error && data?.sources.length === 0 && <div className="donation-empty"><h2>No active contributions to match</h2><p>The collection must be target reached or closed, and its items must still be unexpired.</p></div>}
    {data?.sources.map(({ source, matches }) => <section className="matching-source" key={source.sourceId}><h2>{source.foodName} · {source.quantity} {source.unit.toLowerCase()}</h2><p>{source.category.replace(/_/g, " ").toLowerCase()} · Use by {new Date(source.expiresAt).toLocaleString()}</p>{matches.length === 0 ? <p>No suitable verified recipients for this item.</p> : <div className="matching-list">{matches.map((match) => <MatchCard key={match.recipient.recipientProfileId} match={match} />)}</div>}</section>)}
  </section>;
}
