import { Link } from "react-router-dom";
import type { MatchingResult } from "@surplus/shared";

export function MatchCard({ match }: { match: MatchingResult }) {
  const sourceLabel = match.source.sourceType === "DONATION" ? "Individual donation" : "Community contribution";
  return <article className="match-card">
    <div className="match-card-head"><div><p className="eyebrow">{sourceLabel}</p><h2>{match.source.foodName}</h2></div><span className="match-score">{match.score}<small> / 100</small></span></div>
    <div className="match-pair-grid">
      <section><h3>Food source</h3><p>{match.source.quantity} {match.source.unit.toLowerCase()} · {match.source.category.replace(/_/g, " ").toLowerCase()}</p><p>Pickup area: {match.source.pickupArea}</p>
        {match.source.communityDonationId && <Link to={`/community-donations/${match.source.communityDonationId}`}>View collection</Link>}</section>
      <section><h3>{match.recipient.verificationStatus === "VERIFIED" ? "Verified recipient" : "Recipient profile"}</h3><p><strong>{match.recipient.organizationName}</strong> · {match.recipient.recipientType.replace(/_/g, " ").toLowerCase()}</p><p>Verification: {match.recipient.verificationStatus.toLowerCase()}</p><p>Service area: {match.recipient.serviceArea}</p><p>Capacity: {match.recipient.capacityQuantity === null ? "Not specified" : `${match.recipient.capacityQuantity} ${match.recipient.capacityUnit?.toLowerCase()}`}</p></section>
    </div>
    <div className="match-metrics"><span>{match.distanceKm === null ? "Distance unavailable" : `About ${match.distanceKm} km straight-line`}</span><span>{match.quantityCompatibility.replace(/_/g, " ").toLowerCase()}</span><span>Expires in {match.hoursUntilExpiry.toFixed(1)} h</span></div>
    <h3>Why this match</h3><ul className="match-reasons">{match.reasons.map((reason, index) => <li key={`${reason}-${index}`}>{reason}</li>)}</ul>
    {match.warnings.length > 0 && <ul className="match-warnings">{match.warnings.map((warning, index) => <li key={`${warning}-${index}`}>{warning}</li>)}</ul>}
    <div className="match-card-foot"><span>Suggestion only · no food has been reserved or assigned</span><Link to={`/matching/details/${match.source.sourceType}/${match.source.sourceId}/recipients/${match.recipient.recipientProfileId}`}>Match details</Link></div>
  </article>;
}
