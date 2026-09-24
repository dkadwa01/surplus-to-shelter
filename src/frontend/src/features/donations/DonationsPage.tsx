import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { DonationResponse } from "@surplus/shared";
import { listDonations } from "./donation-api";

export function DonationsPage() {
  const [donations, setDonations] = useState<DonationResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => { listDonations().then(setDonations).catch((reason) => setError(reason instanceof Error ? reason.message : "Unable to load donations.")).finally(() => setLoading(false)); }, []);
  return <section className="donation-page">
    <div className="donation-heading"><div><p className="eyebrow">Donor workspace</p><h1>Your food donations</h1><p className="auth-description">Keep your available food listings up to date.</p></div><Link className="primary-button" to="/donations/new">Add donation</Link></div>
    {loading && <p role="status">Loading donations...</p>}{error && <p className="form-error" role="alert">{error}</p>}
    {!loading && !error && donations.length === 0 && <div className="donation-empty"><h2>No donations yet</h2><p>Post surplus food so it can find its next stop.</p><Link to="/donations/new">Create your first donation</Link></div>}
    <div className="donation-grid">{donations.map((donation) => <article className="donation-card" key={donation.id}><div className="donation-card-top"><span className={`status-pill status-${donation.status.toLowerCase()}`}>{donation.status}</span><span>{donation.category.replace(/_/g, " ")}</span></div><h2>{donation.foodName}</h2><p>{donation.quantity} {donation.unit.toLowerCase()} | {donation.pickupArea}</p><p>Use by {new Date(donation.expiresAt).toLocaleString()}</p><Link to={`/donations/${donation.id}`}>View details</Link></article>)}</div>
  </section>;
}
