import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import type { MatchingResult } from "@surplus/shared";
import { getMatchingDetails } from "./matching-api";
import { MatchCard } from "./MatchCard";
import { useAuth } from "../auth/AuthContext";
import { createDispatch } from "../dispatch/dispatch-api";

export function MatchDetailsPage() {
  const { sourceType = "", sourceId = "", recipientProfileId = "" } = useParams();
  const [match, setMatch] = useState<MatchingResult | null>(null);
  const [error, setError] = useState(""); const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false); const [createdId, setCreatedId] = useState(""); const [createError, setCreateError] = useState("");
  const { user } = useAuth();
  useEffect(() => { getMatchingDetails(sourceType, sourceId, recipientProfileId).then(setMatch).catch((reason) => setError(reason instanceof Error ? reason.message : "Unable to load match details.")).finally(() => setLoading(false)); }, [sourceType, sourceId, recipientProfileId]);
  const backLink = match?.source.sourceType === "DONATION" ? `/matching/donations/${sourceId}` : match?.source.communityDonationId ? `/matching/community-donations/${match.source.communityDonationId}` : "/matching";
  async function prepareDispatch() {
    setCreating(true); setCreateError("");
    try {
      const assignment = await createDispatch({ sourceType: match!.source.sourceType, sourceId: match!.source.sourceId, recipientProfileId });
      setCreatedId(assignment.id);
    } catch (reason) { setCreateError(reason instanceof Error ? reason.message : "Unable to prepare dispatch."); }
    finally { setCreating(false); }
  }
  return <section className="donation-page matching-page"><Link to={backLink}>Back to matches</Link><p className="eyebrow">Match explanation</p><h1>Compatibility details</h1>
    {loading && <p role="status">Loading match details...</p>}{error && <p className="form-error" role="alert">{error}</p>}
    {match && <><div className={`match-eligibility ${match.eligible ? "eligible" : "ineligible"}`}>{match.eligible ? "Suitable suggestion" : "Not currently suitable"} · Score {match.score}/100</div><MatchCard match={match} />
      {user?.role === "DONOR" && match.eligible && <div className="dispatch-panel"><h2>Prepare transport</h2><p>Preparing dispatch rechecks this match and reserves the food source until delivery or cancellation.</p>
        {createdId ? <p role="status">Dispatch assignment {createdId} is available to verified drivers.</p> : <button className="primary-button" disabled={creating} onClick={() => void prepareDispatch()}>{creating ? "Preparing…" : "Prepare dispatch"}</button>}
        {createError && <p className="form-error" role="alert">{createError}</p>}
      </div>}
    </>}
  </section>;
}
