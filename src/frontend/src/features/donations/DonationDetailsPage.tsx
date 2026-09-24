import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import type { DonationResponse } from "@surplus/shared";
import { cancelDonation, getDonation } from "./donation-api";
export function DonationDetailsPage() {
  const { id = "" } = useParams(); const [donation, setDonation] = useState<DonationResponse | null>(null); const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  useEffect(() => { getDonation(id).then(setDonation).catch((reason) => setError(reason instanceof Error ? reason.message : "Unable to load donation.")); }, [id]);
  async function cancel() { if (!window.confirm("Cancel this food donation?")) return; setBusy(true); try { setDonation(await cancelDonation(id)); } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to cancel donation."); } finally { setBusy(false); } }
  if (error) return <section className="auth-card"><p className="form-error" role="alert">{error}</p><Link to="/donations">Back to donations</Link></section>;
  if (!donation) return <p role="status">Loading donation...</p>;
  return <article className="donation-detail"><Link to="/donations">Back to all donations</Link><div className="donation-card-top"><span className={`status-pill status-${donation.status.toLowerCase()}`}>{donation.status}</span><span>{donation.category.replace(/_/g, " ")}</span></div><h1>{donation.foodName}</h1><p className="intro">{donation.quantity} {donation.unit.toLowerCase()}</p><dl><dt>Pickup location</dt><dd>{donation.pickupAddress}, {donation.pickupArea}</dd><dt>Use by</dt><dd>{new Date(donation.expiresAt).toLocaleString()}</dd>{donation.preparedAt && <><dt>Prepared</dt><dd>{new Date(donation.preparedAt).toLocaleString()}</dd></>}{donation.description && <><dt>Description</dt><dd>{donation.description}</dd></>}<dt>Donor type</dt><dd>{donation.donorType?.replace(/_/g, " ") ?? "Donor"}</dd></dl>
    {donation.status === "AVAILABLE" && <div className="form-actions"><Link className="secondary-button" to={`/donations/${id}/edit`}>Edit</Link><button className="danger-button" disabled={busy} onClick={() => void cancel()}>{busy ? "Cancelling..." : "Cancel donation"}</button></div>}{error && <p className="form-error" role="alert">{error}</p>}</article>;
}
