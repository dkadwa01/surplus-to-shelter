import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import type { DashboardSummary, MatchingResult } from "@surplus/shared";
import { useAuth } from "../auth/AuthContext";
import { LocationMap } from "../../components/LocationMap";
import { getCommunityDonation } from "../community-donations/community-donation-api";
import { getDonation } from "../donations/donation-api";
import { discoverRecipients, getMyProfile } from "../recipients/recipient-api";
import { getMatchingDetails } from "./matching-api";
import { MatchCard } from "./MatchCard";

type MapPoint = DashboardSummary["mapPoints"][number];
export function MatchDetailsPage() {
  const { sourceType = "", sourceId = "", recipientProfileId = "" } = useParams();
  const { user } = useAuth();
  const [match, setMatch] = useState<MatchingResult | null>(null);
  const [points, setPoints] = useState<MapPoint[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let current = true;
    async function load() {
      try {
        const result = await getMatchingDetails(sourceType, sourceId, recipientProfileId);
        if (!current) return;
        setMatch(result);
        const mapPoints: MapPoint[] = [];
        if (user?.role === "DONOR") {
          try {
            if (result.source.sourceType === "DONATION") {
              const donation = await getDonation(result.source.sourceId);
              if (donation.latitude !== null && donation.longitude !== null) mapPoints.push({ id: donation.id, type: "DONATION", label: donation.foodName, area: donation.pickupArea, latitude: donation.latitude, longitude: donation.longitude });
            } else if (result.source.communityDonationId) {
              const group = await getCommunityDonation(result.source.communityDonationId);
              if (group.latitude !== null && group.longitude !== null) mapPoints.push({ id: group.id, type: "COMMUNITY", label: group.title, area: group.pickupArea, latitude: group.latitude, longitude: group.longitude });
            }
            const recipients = await discoverRecipients({ category: result.source.category });
            const recipient = recipients.find((profile) => profile.id === result.recipient.recipientProfileId);
            if (recipient?.latitude !== null && recipient?.latitude !== undefined && recipient.longitude !== null) mapPoints.push({ id: recipient.id, type: "RECIPIENT", label: recipient.organizationName, area: recipient.serviceArea, latitude: recipient.latitude, longitude: recipient.longitude });
          } catch { /* The match details remain useful if optional map data is unavailable. */ }
        } else if (user?.role === "RECIPIENT") {
          try {
            const profile = await getMyProfile();
            if (profile.latitude !== null && profile.longitude !== null) mapPoints.push({ id: profile.id, type: "RECIPIENT", label: profile.organizationName, area: profile.serviceArea, latitude: profile.latitude, longitude: profile.longitude });
          } catch { /* A profile without coordinates has no map pin. */ }
        }
        if (current) setPoints(mapPoints);
      } catch (reason) {
        if (current) setError(reason instanceof Error ? reason.message : "Unable to load match details.");
      } finally { if (current) setLoading(false); }
    }
    void load();
    return () => { current = false; };
  }, [sourceType, sourceId, recipientProfileId, user?.role]);
  const backLink = match?.source.sourceType === "DONATION" ? `/matching/donations/${sourceId}` : match?.source.communityDonationId ? `/matching/community-donations/${match.source.communityDonationId}` : "/matching";
  return <section className="donation-page matching-page"><Link to={backLink}>Back to matches</Link><p className="eyebrow">Match explanation</p><h1>Compatibility details</h1>
    {loading && <p role="status">Loading match details...</p>}{error && <p className="form-error" role="alert">{error}</p>}{match && <><div className={`match-eligibility ${match.eligible ? "eligible" : "ineligible"}`}>{match.eligible ? "Suitable suggestion" : "Not currently suitable"} | Review the factors below</div><MatchCard match={match} /><LocationMap points={points} title={user?.role === "RECIPIENT" ? "Your recipient service location" : "Pickup and recipient locations"} /><p className="dashboard-footnote">Coordinates and straight-line distance appear when the current role is authorized to view them. No street address is placed on the map.</p></>}
  </section>;
}
