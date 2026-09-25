import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { DashboardSummary } from "@surplus/shared";
import { useAuth } from "./auth/AuthContext";
import { LocationMap } from "../components/LocationMap";
import { getDashboardSummary } from "./dashboard-api";

const roleCopy = {
  DONOR: { eyebrow: "Donor dashboard", title: "Your food can go further.", text: "Track your listings and local community contributions." },
  RECIPIENT: { eyebrow: "Recipient dashboard", title: "Food matched to your needs.", text: "Review current suggestions based on your organization profile." },
  DRIVER: { eyebrow: "Driver dashboard", title: "Rescue food on the move.", text: "Driver availability and dispatch assignments are not connected in this checkout." },
  ADMIN: { eyebrow: "Platform overview", title: "A clearer view of local food rescue.", text: "Current platform data, verification totals, and locations." },
};

function quantityText(totals: DashboardSummary["donations"]["quantities"]) {
  if (!totals.length) return "No quantity recorded";
  return totals.map((row) => `${Number(row.quantity.toFixed(3))} ${row.unit.toLowerCase()}${row.category ? ` ${row.category.replace(/_/g, " ").toLowerCase()}` : ""}`).join(" | ");
}
function Metric({ label, value, note, to }: { label: string; value: string | number; note?: string; to?: string }) {
  const content = <><span>{label}</span><strong>{value}</strong>{note && <small>{note}</small>}</>;
  return to ? <Link className="dashboard-metric dashboard-metric-link" to={to}>{content}</Link> : <article className="dashboard-metric">{content}</article>;
}
const trackingValue = (value: number | null) => value === null ? "Not tracked" : value;

export function DashboardPage() {
  const { user } = useAuth();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let current = true;
    getDashboardSummary().then((data) => { if (current) setSummary(data); })
      .catch((reason) => { if (current) setError(reason instanceof Error ? reason.message : "Unable to load dashboard."); })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, []);
  if (!user) return null;
  const copy = roleCopy[user.role];
  return <section className="dashboard-page">
    <div className="dashboard-hero"><div><p className="eyebrow">{copy.eyebrow}</p><h1>{copy.title}</h1><p>{copy.text}</p></div><span className="dashboard-user">Welcome, {user.fullName.split(" ")[0]}</span></div>
    {loading && <p role="status">Loading your dashboard...</p>}{error && <p className="form-error" role="alert">{error}</p>}
    {summary && <>
      {user.role === "DONOR" && <DonorView summary={summary} />}
      {user.role === "RECIPIENT" && <RecipientView summary={summary} />}
      {user.role === "DRIVER" && <DriverView summary={summary} />}
      {user.role === "ADMIN" && <AdminView summary={summary} />}
      <LocationMap points={summary.mapPoints} title={user.role === "RECIPIENT" ? "Your service location" : "Food rescue network"} />
      <p className="dashboard-footnote">Map lines and distances are straight-line estimates, not driving routes. Food totals keep incompatible units separate; grams are normalized to kilograms.</p>
    </>}
  </section>;
}

function DonorView({ summary }: { summary: DashboardSummary }) {
  return <>
    <div className="dashboard-actions"><Link className="primary-button" to="/donations/new">Create donation</Link><Link className="secondary-button" to="/community-donations">Community donation</Link></div>
    <div className="dashboard-metrics"><Metric label="Available donations" value={summary.donations.activeCount} note={`${summary.donations.totalCount} total listings`} to="/donations" />
      <Metric label="Food offered" value={quantityText(summary.donations.quantities)} note="Cancelled listings excluded; units kept separate" />
      <Metric label="Live suitable matches" value={summary.matching.sourceCount ?? "Open matching"} note={summary.matching.note} />
      <Metric label="Completed deliveries" value={trackingValue(summary.delivery.completedCount)} note="Delivery tracking is not present in this checkout" />
    </div>
    <section className="dashboard-secondary"><div><p className="eyebrow">Collective giving</p><h2>{summary.community.activeContributionCount} active contribution{summary.community.activeContributionCount === 1 ? "" : "s"}</h2><p>{quantityText(summary.community.quantities)}</p></div><Link to="/community-donations">View community collections</Link></section>
  </>;
}

function RecipientView({ summary }: { summary: DashboardSummary }) {
  const profile = summary.recipientProfile;
  return <>
    <div className="dashboard-actions"><Link className="primary-button" to="/matching">View available food</Link><Link className="secondary-button" to="/recipients/profile">Update capacity</Link></div>
    <div className="dashboard-metrics"><Metric label="Suitable food sources" value={summary.matching.sourceCount ?? (summary.verificationStatus === "VERIFIED" ? "Unavailable" : "Verification needed")} note={summary.matching.note} to="/matching" />
      <Metric label="Food received" value={trackingValue(summary.delivery.completedCount)} note="Delivery completion is not tracked in this checkout" />
      <Metric label="Pending deliveries" value={trackingValue(summary.delivery.activeCount)} note="No dispatch records are available" />
      <Metric label="Current capacity" value={profile?.configured && profile.capacityQuantity !== null ? `${profile.capacityQuantity} ${profile.capacityUnit?.toLowerCase()}` : "Not set"} note={profile?.acceptedCategories.length ? `Accepting ${profile.acceptedCategories.map((category) => category.toLowerCase().replace(/_/g, " ")).join(", ")}` : "Accepted categories not restricted"} />
    </div>
    {!profile?.configured && <section className="dashboard-callout"><strong>Complete your recipient profile</strong><p>Add your capacity, accepted categories, and service location to receive suitable food suggestions.</p><Link to="/recipients/profile">Set up recipient profile</Link></section>}
    <section className="dashboard-secondary"><div><p className="eyebrow">Food rescue impact</p><h2>Meals served: Data-based estimate unavailable</h2><p>The project does not define a safe servings-to-meals conversion.</p></div></section>
  </>;
}

function DriverView({ summary }: { summary: DashboardSummary }) {
  return <>
    <section className="dashboard-callout"><strong>Driver dispatch is not connected in this checkout</strong><p>Your driver verification status is <b>{summary.verificationStatus.replace(/_/g, " ")}</b>. No driver profile, assignment, or delivery records are present.</p>{summary.verificationStatus !== "VERIFIED" && <Link to="/verification">Continue driver verification</Link>}</section>
    <div className="dashboard-metrics"><Metric label="Available assignments" value="Not tracked" /><Metric label="Active assignment" value="Not tracked" /><Metric label="Completed deliveries" value="Not tracked" /><Metric label="Delivered food" value="Not tracked" note="No dispatch data is present" /></div>
  </>;
}

function AdminView({ summary }: { summary: DashboardSummary }) {
  const verified = summary.verifiedParticipants;
  return <>
    <div className="dashboard-metrics"><Metric label="Total donations" value={summary.donations.totalCount} note="Cancelled listings included in count" />
      <Metric label="Available donations" value={summary.donations.activeCount} />
      <Metric label="Food offered" value={quantityText(summary.donations.quantities)} note="Mass units normalized; other units stay separate" />
      <Metric label="Community collections" value={summary.community.collectionCount} />
      <Metric label="Active matches" value="Not persisted" note={summary.matching.note} />
      <Metric label="Active deliveries" value="Not tracked" /><Metric label="Completed deliveries" value="Not tracked" />
      <Metric label="Verified donors" value={verified?.donors ?? 0} /><Metric label="Verified recipients" value={verified?.recipients ?? 0} />
      <Metric label="Verified drivers" value={verified?.drivers ?? 0} /><Metric label="Recipient organizations served" value="Not tracked" />
      <Metric label="Community contributors" value={summary.community.contributorCount} />
    </div>
    <section className="dashboard-secondary"><div><p className="eyebrow">Food offered</p><h2>{quantityText(summary.donations.quantities)}</h2><p>Available and expired offers, excluding cancelled offers; this is not a delivered-food total.</p></div><Link to="/admin/verifications">Review verification</Link></section>
  </>;
}
