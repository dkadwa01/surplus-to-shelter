import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import type { MatchingResult } from "@surplus/shared";
import { getMatchingDetails } from "./matching-api";
import { MatchCard } from "./MatchCard";

export function MatchDetailsPage() {
  const { sourceType = "", sourceId = "", recipientProfileId = "" } = useParams();
  const [match, setMatch] = useState<MatchingResult | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => { getMatchingDetails(sourceType, sourceId, recipientProfileId).then(setMatch).catch((reason) => setError(reason instanceof Error ? reason.message : "Unable to load match details.")).finally(() => setLoading(false)); }, [sourceType, sourceId, recipientProfileId]);
  const backLink = match?.source.sourceType === "DONATION" ? `/matching/donations/${sourceId}` : match?.source.communityDonationId ? `/matching/community-donations/${match.source.communityDonationId}` : "/matching";
  return <section className="donation-page matching-page"><Link to={backLink}>Back to matches</Link><p className="eyebrow">Match explanation</p><h1>Compatibility details</h1>
    {loading && <p role="status">Loading match details...</p>}{error && <p className="form-error" role="alert">{error}</p>}{match && <><div className={`match-eligibility ${match.eligible ? "eligible" : "ineligible"}`}>{match.eligible ? "Suitable suggestion" : "Not currently suitable"} · Score {match.score}/100</div><MatchCard match={match} /></>}
  </section>;
}
