import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { VerificationAdminRequestResponse } from "@surplus/shared";
import { listVerificationRequests } from "./verification-api";
export function AdminVerificationListPage() {
  const [requests, setRequests] = useState<VerificationAdminRequestResponse[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState(""); const [status, setStatus] = useState("");
  useEffect(() => { listVerificationRequests(status || undefined).then(setRequests).catch((reason) => setError(reason instanceof Error ? reason.message : "Unable to load requests.")).finally(() => setLoading(false)); }, [status]);
  return <section className="donation-page"><div className="donation-heading"><div><p className="eyebrow">Trust review</p><h1>Verification requests</h1><p className="auth-description">Review participant information before changing their trust status.</p></div></div>
    <label className="verification-status-filter">Filter requests<select value={status} onChange={(event) => setStatus(event.target.value)}><option value="">Needs review</option><option value="VERIFIED">Verified</option><option value="REJECTED">Rejected</option><option value="SUSPENDED">Suspended</option></select></label>
    {loading && <p role="status">Loading requests...</p>}{error && <p className="form-error" role="alert">{error}</p>}{!loading && !error && requests.length === 0 && <div className="donation-empty"><h2>No requests found</h2><p>There are no requests in this status.</p></div>}
    <div className="donation-grid">{requests.map((request) => <article className="donation-card" key={request.id}><div className="donation-card-top"><span className="status-pill">{request.status.replace(/_/g, " ")}</span><span>{request.participantType}</span></div><h2>{request.applicant.fullName}</h2><p>{request.applicant.email}</p><p>{request.applicant.recipientOrganizationName || request.organizationName || request.vehicleType?.replace(/_/g, " ") || "Participant verification"}</p><Link to={`/admin/verifications/${request.id}`}>Review request</Link></article>)}</div>
  </section>;
}
