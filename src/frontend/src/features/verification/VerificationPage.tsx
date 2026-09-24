import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { DriverVehicleTypeSchema, SubmitVerificationRequestSchema, type SubmitVerificationRequest, type UserRole, type VerificationStatusResponse } from "@surplus/shared";
import { getMyVerificationStatus, submitVerification } from "./verification-api";

export function VerificationPage({ role, donorType }: { role: UserRole; donorType: string | null }) {
  const [status, setStatus] = useState<VerificationStatusResponse | null>(null); const [loading, setLoading] = useState(true); const [error, setError] = useState("");
  const [organizationName, setOrganizationName] = useState(""); const [vehicleType, setVehicleType] = useState(""); const [additionalInfo, setAdditionalInfo] = useState(""); const [busy, setBusy] = useState(false);
  useEffect(() => { getMyVerificationStatus().then(setStatus).catch((reason) => setError(reason instanceof Error ? reason.message : "Unable to load verification status.")).finally(() => setLoading(false)); }, []);
  async function submit(event: FormEvent) {
    event.preventDefault(); setError("");
    const input: SubmitVerificationRequest = { ...(organizationName ? { organizationName } : {}), ...(vehicleType ? { vehicleType: vehicleType as SubmitVerificationRequest["vehicleType"] } : {}), ...(additionalInfo ? { additionalInfo } : {}) };
    const parsed = SubmitVerificationRequestSchema.safeParse(input);
    if (!parsed.success) { setError(parsed.error.issues[0]?.message ?? "Check the verification information."); return; }
    if (role === "DRIVER" && !parsed.data.vehicleType) { setError("Select the vehicle type you use for pickups."); return; }
    if (role === "DONOR" && donorType !== "INDIVIDUAL" && !parsed.data.organizationName) { setError("Enter the business or organization name for this donor account."); return; }
    setBusy(true); try { await submitVerification(parsed.data); setStatus(await getMyVerificationStatus()); setOrganizationName(""); setVehicleType(""); setAdditionalInfo(""); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to submit verification."); }
    finally { setBusy(false); }
  }
  if (loading) return <p role="status">Loading verification status...</p>;
  if (error && !status) return <section className="auth-card"><p className="form-error" role="alert">{error}</p></section>;
  const request = status?.request;
  const canResubmit = !request || request.status === "REJECTED";
  return <section className="auth-card verification-card"><p className="eyebrow">Participant trust</p><h1>Verification</h1>
    <div className={`verification-status status-${status?.status.toLowerCase()}`}><strong>{status?.status.replace(/_/g, " ")}</strong>
      {!request && <p>Submit your details for review before using future verified-participant features.</p>}
      {request?.status === "PENDING" && <p>Your request is in the review queue. You can continue using currently available features.</p>}
      {request?.status === "UNDER_REVIEW" && <p>A reviewer is checking your information.</p>}
      {request?.status === "VERIFIED" && <p>Your account is verified. Restricted features can now check this status.</p>}
      {request?.status === "REJECTED" && <p>Review outcome: {request.reviewReason || "The reviewer requested more information."}</p>}
      {request?.status === "SUSPENDED" && <p>Verification is suspended. Contact the platform administrator if you believe this is an error.</p>}
    </div>
    {role === "RECIPIENT" && !request && <p className="field-note">Your recipient profile must be set up first. <Link to="/recipients/profile">Open recipient profile</Link></p>}
    {canResubmit && <form className="auth-form verification-form" onSubmit={submit} noValidate>
      {role === "DONOR" && donorType !== "INDIVIDUAL" && <label>Business / organization name<input required maxLength={140} value={organizationName} onChange={(event) => setOrganizationName(event.target.value)} /></label>}
      {role === "DRIVER" && <label>Pickup vehicle type<select required value={vehicleType} onChange={(event) => setVehicleType(event.target.value)}><option value="">Select vehicle type</option>{DriverVehicleTypeSchema.options.map((item) => <option key={item} value={item}>{item.replace(/_/g, " ")}</option>)}</select></label>}
      {role === "RECIPIENT" && <p className="field-note">Reviewers will use your saved recipient profile. No duplicate organization or contact details are collected here.</p>}
      <label>Additional information (optional)<textarea rows={4} maxLength={1000} value={additionalInfo} onChange={(event) => setAdditionalInfo(event.target.value)} placeholder="Share any relevant context for the reviewer." /></label>
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="primary-button" disabled={busy}>{busy ? "Submitting..." : request?.status === "REJECTED" ? "Resubmit for review" : "Submit for verification"}</button>
    </form>}
    {request && <div className="verification-history"><h2>Request history</h2><p>Submitted {new Date(request.createdAt).toLocaleString()}</p>{request.records.map((record) => <div className="verification-history-row" key={record.id}><span>{record.previousStatus ? `${record.previousStatus} to ` : "Submitted as "}{record.newStatus}</span><time>{new Date(record.createdAt).toLocaleString()}</time>{record.reason && <p>{record.reason}</p>}</div>)}</div>}
  </section>;
}
