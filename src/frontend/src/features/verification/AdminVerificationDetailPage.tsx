import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import type { VerificationAdminRequestResponse } from "@surplus/shared";
import { getVerificationRequest, reviewVerificationRequest } from "./verification-api";
export function AdminVerificationDetailPage() {
  const { id = "" } = useParams(); const navigate = useNavigate(); const [request, setRequest] = useState<VerificationAdminRequestResponse | null>(null); const [reason, setReason] = useState(""); const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  useEffect(() => { getVerificationRequest(id).then(setRequest).catch((failure) => setError(failure instanceof Error ? failure.message : "Unable to load request.")); }, [id]);
  async function review(action: "UNDER_REVIEW" | "VERIFIED" | "REJECTED" | "SUSPENDED") {
    setError(""); setBusy(true); try { await reviewVerificationRequest(id, { action, ...(reason ? { reason } : {}) }); navigate("/admin/verifications", { replace: true }); }
    catch (failure) { setError(failure instanceof Error ? failure.message : "Unable to save review."); } finally { setBusy(false); }
  }
  if (error && !request) return <section className="auth-card"><p className="form-error" role="alert">{error}</p><Link to="/admin/verifications">Back to requests</Link></section>;
  if (!request) return <p role="status">Loading verification request...</p>;
  const canStart = request.status === "PENDING"; const canDecide = request.status === "PENDING" || request.status === "UNDER_REVIEW"; const canSuspend = request.status === "VERIFIED";
  return <article className="recipient-profile-view verification-admin-detail"><Link to="/admin/verifications">Back to requests</Link><p className="eyebrow">Verification review</p><h1>{request.applicant.fullName}</h1><span className="status-pill">{request.status.replace(/_/g, " ")}</span>
    <dl><dt>Participant type</dt><dd>{request.participantType}</dd><dt>Email</dt><dd>{request.applicant.email}</dd>{request.applicant.phone && <><dt>Phone</dt><dd>{request.applicant.phone}</dd></>}<dt>Donor type</dt><dd>{request.applicant.donorType || "Not applicable"}</dd><dt>Organization</dt><dd>{request.applicant.recipientOrganizationName || request.organizationName || "Not provided"}</dd>{request.applicant.recipientProfile && <><dt>Recipient type</dt><dd>{request.applicant.recipientProfile.recipientType}</dd><dt>Service address</dt><dd>{request.applicant.recipientProfile.address}</dd><dt>Service area</dt><dd>{request.applicant.recipientProfile.serviceArea}</dd><dt>Accepts</dt><dd>{request.applicant.recipientProfile.acceptedCategories.join(", ") || "Not specified"}</dd><dt>Capacity</dt><dd>{request.applicant.recipientProfile.capacityQuantity ? `${request.applicant.recipientProfile.capacityQuantity} ${request.applicant.recipientProfile.capacityUnit}` : "Not specified"}</dd></>}<dt>Vehicle</dt><dd>{request.vehicleType || "Not applicable"}</dd><dt>Additional information</dt><dd>{request.additionalInfo || "None provided"}</dd><dt>Submitted</dt><dd>{new Date(request.createdAt).toLocaleString()}</dd></dl>
    <div className="verification-admin-actions"><label>Reviewer reason / note<textarea rows={3} maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Required when rejecting or suspending." /></label>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="form-actions">{canStart && <button className="secondary-button" disabled={busy} onClick={() => void review("UNDER_REVIEW")}>Start review</button>}{canDecide && <><button className="primary-button" disabled={busy} onClick={() => void review("VERIFIED")}>Approve</button><button className="danger-button" disabled={busy} onClick={() => void review("REJECTED")}>Reject</button></>}{canSuspend && <button className="danger-button" disabled={busy} onClick={() => void review("SUSPENDED")}>Suspend participant</button>}</div>
    </div><div className="verification-history"><h2>Status history</h2>{request.records.map((record) => <div className="verification-history-row" key={record.id}><span>{record.previousStatus ? `${record.previousStatus} to ` : "Submitted as "}{record.newStatus}</span><time>{new Date(record.createdAt).toLocaleString()}</time>{record.reason && <p>{record.reason}</p>}</div>)}</div>
  </article>;
}
