import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import type { DispatchResponse } from "@surplus/shared";
import { dispatchAction, getMyAssignments } from "./dispatch-api";

export function DispatchAssignmentsPage() {
  const { user } = useAuth(); const [assignments, setAssignments] = useState<DispatchResponse[]>([]); const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  const refresh = useCallback(() => getMyAssignments().then(setAssignments).catch((reason) => setError(reason instanceof Error ? reason.message : "Unable to load dispatch assignments.")), []);
  useEffect(() => { void refresh(); }, [refresh]);
  async function cancel(id: string) { setBusy(true); setError(""); try { await dispatchAction(id, "cancel"); await refresh(); } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to cancel dispatch."); } finally { setBusy(false); } }
  return <section className="donation-page matching-page"><p className="eyebrow">Dispatch overview</p><h1>Transport assignments</h1>
    {error && <p className="form-error" role="alert">{error}</p>}
    {!assignments.length && !error && <div className="donation-empty"><p>No dispatch assignments are available for this account yet.</p></div>}
    <div className="dispatch-list">{assignments.map((item) => <article className="dispatch-card" key={item.id}>
      <div className="donation-card-top"><span>{item.sourceType === "DONATION" ? "Individual donation" : "Community contribution"}</span><span className={`status-pill status-${item.status.toLowerCase()}`}>{item.status.replace(/_/g, " ")}</span></div>
      <h2>{item.foodName}</h2><p>{item.quantity} {item.unit} · Recipient: {item.recipientName}</p>
      <p><strong>Pickup:</strong> {item.pickupAddress}, {item.pickupArea}</p><p><strong>Delivery:</strong> {item.deliveryAddress}, {item.deliveryArea}</p>
      {item.assignedDriverId && <p>A verified driver has accepted this assignment.</p>}
      {user?.role !== "RECIPIENT" && ["AVAILABLE", "ACCEPTED"].includes(item.status) && <button className="danger-button" disabled={busy} onClick={() => void cancel(item.id)}>Cancel dispatch</button>}
    </article>)}</div>
  </section>;
}
