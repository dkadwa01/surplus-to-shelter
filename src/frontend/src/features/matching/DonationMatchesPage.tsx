import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import type { DonationMatchesResponse } from "@surplus/shared";
import { getDonationMatches } from "./matching-api";
import { MatchCard } from "./MatchCard";

export function DonationMatchesPage() {
  const { id = "" } = useParams();
  const [data, setData] = useState<DonationMatchesResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => { getDonationMatches(id).then(setData).catch((reason) => setError(reason instanceof Error ? reason.message : "Unable to find recipient matches.")).finally(() => setLoading(false)); }, [id]);
  return <section className="donation-page matching-page"><Link to={`/donations/${id}`}>Back to donation</Link><p className="eyebrow">Donation matching</p><h1>Suitable recipients</h1><p className="auth-description">Verified active recipients are ranked by food compatibility, stated capacity, proximity, and expiry urgency.</p>
    {loading && <p role="status">Finding recipients...</p>}{error && <p className="form-error" role="alert">{error}</p>}
    {!loading && !error && data?.matches.length === 0 && <div className="donation-empty"><h2>No suitable verified recipients found</h2><p>Check the donation category, location, expiry, and recipient directory.</p></div>}
    <div className="matching-list">{data?.matches.map((match) => <MatchCard key={match.recipient.recipientProfileId} match={match} />)}</div>
  </section>;
}
