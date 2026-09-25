import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import type { DispatchResponse, DriverProfileInput, DriverProfileResponse } from "@surplus/shared";
import { dispatchAction, getAvailableAssignments, getDriverProfile, getMyAssignments, saveDriverProfile, setDriverAvailability } from "./dispatch-api";

const emptyProfile: DriverProfileInput = { vehicleType: "", capacityQuantity: 0, capacityUnit: "KG", serviceArea: "" };
const actions: Partial<Record<DispatchResponse["status"], { label: string; path: string }>> = {
  ACCEPTED: { label: "Start pickup", path: "pickup/start" }, PICKUP_STARTED: { label: "Confirm pickup", path: "pickup/confirm" },
  PICKED_UP: { label: "Start transit", path: "transit/start" }, IN_TRANSIT: { label: "Confirm delivery", path: "delivery/confirm" }, DELIVERED: { label: "Complete assignment", path: "complete" },
};

export function DriverDashboard() {
  const [profile, setProfile] = useState<DriverProfileResponse | null>(null); const [form, setForm] = useState<DriverProfileInput>(emptyProfile);
  const [available, setAvailable] = useState<DispatchResponse[]>([]); const [mine, setMine] = useState<DispatchResponse[]>([]);
  const [error, setError] = useState(""); const [loading, setLoading] = useState(true); const [busy, setBusy] = useState(false);
  const refresh = useCallback(async () => {
    const [current, own] = await Promise.all([getDriverProfile(), getMyAssignments()]); setProfile(current); setMine(own);
    if (current) {
      const { id: _id, availability: _availability, verificationStatus: _verification, ...values } = current;
      setForm(values);
      if (current.availability === "AVAILABLE" && current.verificationStatus === "VERIFIED") setAvailable(await getAvailableAssignments()); else setAvailable([]);
    }
  }, []);
  useEffect(() => { refresh().catch((reason) => setError(reason instanceof Error ? reason.message : "Unable to load driver workspace.")).finally(() => setLoading(false)); }, [refresh]);
  async function save(event: FormEvent) { event.preventDefault(); setBusy(true); setError(""); try { setProfile(await saveDriverProfile(form)); await refresh(); } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to save profile."); } finally { setBusy(false); } }
  async function availability(value: "AVAILABLE" | "OFFLINE") { setBusy(true); setError(""); try { setProfile(await setDriverAvailability(value)); await refresh(); } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to change availability."); } finally { setBusy(false); } }
  async function action(id: string, path: string) { setBusy(true); setError(""); try { await dispatchAction(id, path); await refresh(); } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to update assignment."); } finally { setBusy(false); } }
  if (loading) return <p role="status">Loading driver workspace...</p>;
  return <section className="donation-page matching-page"><p className="eyebrow">Driver workspace</p><h1>Transportation and dispatch</h1>
    {error && <p className="form-error" role="alert">{error}</p>}
    <article className="dispatch-panel"><h2>Driver profile</h2><p>Current verification: <strong>{profile?.verificationStatus ?? "NOT SUBMITTED"}</strong>. Verified drivers can set themselves available for suitable assignments.</p>
      <form className="auth-form" onSubmit={(event) => void save(event)}>
        <div className="donation-fields-row"><label>Vehicle type<input required minLength={2} maxLength={60} value={form.vehicleType} onChange={(event) => setForm({ ...form, vehicleType: event.target.value })} /></label>
          <label>Vehicle capacity<input required type="number" min="0.1" step="any" value={form.capacityQuantity || ""} onChange={(event) => setForm({ ...form, capacityQuantity: Number(event.target.value) })} /></label>
          <label>Capacity unit<select value={form.capacityUnit} onChange={(event) => setForm({ ...form, capacityUnit: event.target.value as DriverProfileInput["capacityUnit"] })}>{["KG", "GRAMS", "SERVINGS", "LITRES", "ITEMS", "PACKAGES"].map((unit) => <option key={unit}>{unit}</option>)}</select></label>
          <label>Service area<input required minLength={2} value={form.serviceArea} onChange={(event) => setForm({ ...form, serviceArea: event.target.value })} /></label>
          <label>Service radius (km)<input type="number" min="0.1" step="any" value={form.serviceRadiusKm ?? ""} onChange={(event) => setForm({ ...form, serviceRadiusKm: event.target.value ? Number(event.target.value) : undefined })} /></label>
        </div><button className="primary-button" disabled={busy}>{profile ? "Save profile" : "Create driver profile"}</button>
      </form>
      <p>Availability: <strong>{profile?.availability ?? "PROFILE REQUIRED"}</strong></p>
      {profile?.verificationStatus !== "VERIFIED" && <p><Link to="/verification">Submit or check driver verification</Link></p>}
      {profile && profile.availability !== "BUSY" && <button className="secondary-button" disabled={busy} onClick={() => void availability(profile.availability === "AVAILABLE" ? "OFFLINE" : "AVAILABLE")}>{profile.availability === "AVAILABLE" ? "Go offline" : "Set available"}</button>}
    </article>
    {profile?.availability === "AVAILABLE" && <><h2>Available assignments</h2>{available.length === 0 && <div className="donation-empty"><p>No suitable assignments right now.</p></div>}
      <div className="dispatch-list">{available.map((item) => <DispatchCard key={item.id} item={item} busy={busy} onAction={(path) => void action(item.id, path)} />)}</div></>}
    <h2>My assignments</h2>{mine.length === 0 && <div className="donation-empty"><p>Accepted and completed assignments will appear here.</p></div>}
    <div className="dispatch-list">{mine.map((item) => <DispatchCard key={item.id} item={item} busy={busy} onAction={(path) => void action(item.id, path)} />)}</div>
  </section>;
}

function DispatchCard({ item, busy, onAction }: { item: DispatchResponse; busy: boolean; onAction: (path: string) => void }) {
  const next = actions[item.status];
  return <article className="dispatch-card"><div className="donation-card-top"><span>{item.sourceType === "DONATION" ? "Individual donation" : "Community contribution"}</span><span className={`status-pill status-${item.status.toLowerCase()}`}>{item.status.replace(/_/g, " ")}</span></div>
    <h3>{item.foodName}</h3><p>{item.quantity} {item.unit} · usable until {new Date(item.expiresAt).toLocaleString()}</p>
    <div className="dispatch-route"><p><strong>Pickup</strong><br />{item.pickupAddress} · {item.pickupArea}</p><p><strong>Deliver to {item.recipientName}</strong><br />{item.deliveryAddress} · {item.deliveryArea}</p></div>
    {item.distanceKm !== null && <p>About {item.distanceKm} km straight-line distance.</p>}
    {item.status === "AVAILABLE" && <button className="primary-button" disabled={busy} onClick={() => onAction("accept")}>Accept assignment</button>}
    {item.status === "ACCEPTED" && <button className="secondary-button" disabled={busy} onClick={() => onAction("decline")}>Decline assignment</button>}
    {next && <button className="primary-button" disabled={busy} onClick={() => onAction(next.path)}>{next.label}</button>}
  </article>;
}
