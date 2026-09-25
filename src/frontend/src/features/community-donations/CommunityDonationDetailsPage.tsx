import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { FoodCategorySchema, QuantityUnitSchema, type CommunityContributionFields, type CommunityDonationResponse } from "@surplus/shared";
import { useAuth } from "../auth/AuthContext";
import { addCommunityContribution, getCommunityDonation, manageCommunityDonation, updateCommunityContribution, withdrawCommunityContribution } from "./community-donation-api";

const categories = FoodCategorySchema.options;
const units = QuantityUnitSchema.options;
const localValue = (iso: string) => { const date = new Date(iso); date.setMinutes(date.getMinutes() - date.getTimezoneOffset()); return date.toISOString().slice(0, 16); };
const defaultExpiry = () => localValue(new Date(Date.now() + 2 * 86400000).toISOString());

export function CommunityDonationDetailsPage() {
  const { id = "" } = useParams();
  const { user } = useAuth();
  const [group, setGroup] = useState<CommunityDonationResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const load = useCallback(() => getCommunityDonation(id).then(setGroup).catch((reason) => setError(reason instanceof Error ? reason.message : "Unable to load this collection.")), [id]);
  useEffect(() => { load().finally(() => setLoading(false)); }, [load]);

  async function contribute(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!group) return;
    setSaving(true); setError("");
    const form = new FormData(event.currentTarget);
    const input: CommunityContributionFields = {
      foodName: String(form.get("foodName")), category: String(form.get("category")) as typeof categories[number],
      quantity: Number(form.get("quantity")), unit: String(form.get("unit")) as typeof units[number],
      expiresAt: new Date(String(form.get("expiresAt"))).toISOString(),
      ...(String(form.get("note")).trim() ? { note: String(form.get("note")) } : {}),
    };
    try {
      if (editing) await updateCommunityContribution(editing, input); else await addCommunityContribution(group.id, input);
      setEditing(null); event.currentTarget.reset(); await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to save contribution."); }
    finally { setSaving(false); }
  }
  async function groupAction(action: "close" | "cancel") {
    if (!group) return; setSaving(true); setError("");
    try { await manageCommunityDonation(group.id, action); await load(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to update the collection."); }
    finally { setSaving(false); }
  }
  async function withdraw(contributionId: string) {
    setSaving(true); setError("");
    try { await withdrawCommunityContribution(contributionId); await load(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to withdraw contribution."); }
    finally { setSaving(false); }
  }

  if (loading) return <section className="donation-detail"><p role="status">Loading collection...</p></section>;
  if (!group) return <section className="donation-detail"><p className="form-error" role="alert">{error || "Collection not found."}</p><Link to="/community-donations">Back to collections</Link></section>;
  const canContribute = user?.role === "DONOR" && group.status === "OPEN" && Date.parse(group.deadline) > Date.now();
  const canManage = group.isOrganizer && ["OPEN", "TARGET_REACHED"].includes(group.status);
  const activeMine = group.contributions.find((contribution) => contribution.id === editing);

  return <section className="donation-detail community-detail">
    <Link to="/community-donations">← All collections</Link>
    <div className="donation-card-top"><span className={`status-pill status-${group.status.toLowerCase()}`}>{group.status.replace(/_/g, " ")}</span><span>{group.pickupArea}</span></div>
    <h1>{group.title}</h1><p className="auth-description">{group.description || "A neighborhood food collection."}</p>
    <p>Collection deadline: {new Date(group.deadline).toLocaleString()}</p>
    {group.targetQuantity && <div className="community-progress"><div><strong>{group.targetProgressPercent}%</strong><span> of {group.targetQuantity} {group.targetUnit?.toLowerCase()} {group.targetCategory?.replace(/_/g, " ").toLowerCase()}</span></div><progress max="100" value={group.targetProgressPercent ?? 0} /></div>}
    <h2>Collected by item type</h2>
    {group.totals.length ? <ul className="community-totals">{group.totals.map((total) => <li key={`${total.category}-${total.unit}`}><strong>{total.quantity} {total.unit.toLowerCase()}</strong> {total.category.replace(/_/g, " ").toLowerCase()}</li>)}</ul> : <p>No food contributed yet.</p>}
    <p>{group.contributorCount} contributing household{group.contributorCount === 1 ? "" : "s"}</p>
    <h2>Contributions</h2>
    {group.contributions.length ? <div className="community-contribution-list">{group.contributions.map((contribution) => <article key={contribution.id} className="community-contribution">
      <div><strong>{contribution.foodName}</strong><p>{contribution.quantity} {contribution.unit.toLowerCase()} · {contribution.category.replace(/_/g, " ").toLowerCase()}</p><p>Use by {new Date(contribution.expiresAt).toLocaleString()}</p>
        {contribution.isMine && contribution.note && <p>Your note: {contribution.note}</p>}
        {contribution.isMine && contribution.belowIndividualThreshold && <p className="field-note">Accepted as a small community contribution below the configured individual posting threshold.</p>}
      </div>
      {contribution.isMine && group.status === "OPEN" && <div className="form-actions"><button className="secondary-button" onClick={() => setEditing(contribution.id)}>Edit</button><button className="danger-button" disabled={saving} onClick={() => void withdraw(contribution.id)}>Withdraw</button></div>}
    </article>)}</div> : <p className="field-note">Contribution details are shown without donor names or contact information.</p>}
    {canContribute && <div className="donation-empty community-contribute"><h2>{editing ? "Edit your contribution" : "Add food to this collection"}</h2>
      {!editing && <p>Verified donors can contribute different food types. Your record remains associated with your account.</p>}
      {error && <p role="alert" className="form-error">{error}</p>}
      <form className="auth-form" onSubmit={(event) => void contribute(event)} key={editing ?? "new"}>
        <label>Food item<input name="foodName" required minLength={2} maxLength={120} defaultValue={activeMine?.foodName ?? ""} /></label>
        <div className="donation-fields-row"><label>Category<select name="category" defaultValue={activeMine?.category ?? categories[0]}>{categories.map((category) => <option key={category} value={category}>{category.replace(/_/g, " ")}</option>)}</select></label>
          <label>Quantity<input name="quantity" type="number" min="0.01" step="any" max="100000" required defaultValue={activeMine?.quantity ?? ""} /></label>
          <label>Unit<select name="unit" defaultValue={activeMine?.unit ?? units[0]}>{units.map((unit) => <option key={unit} value={unit}>{unit}</option>)}</select></label></div>
        <label>Use-by time<input name="expiresAt" type="datetime-local" min={localValue(new Date().toISOString())} defaultValue={activeMine ? localValue(activeMine.expiresAt) : defaultExpiry()} required /></label>
        <label>Optional note<textarea name="note" maxLength={500} rows={2} defaultValue={activeMine?.note ?? ""} /></label>
        <div className="form-actions"><button className="primary-button" disabled={saving}>{saving ? "Saving..." : editing ? "Save changes" : "Contribute"}</button>{editing && <button type="button" className="secondary-button" onClick={() => setEditing(null)}>Stop editing</button>}</div>
      </form>
    </div>}
    {user?.role === "DONOR" && !canContribute && group.status !== "OPEN" && <p className="field-note">This collection is no longer accepting contributions.</p>}
    {canManage && <div className="community-organizer-actions"><h2>Organizer actions</h2><button className="secondary-button" disabled={saving} onClick={() => void groupAction("close")}>Close collection</button>{group.status === "OPEN" && <button className="danger-button" disabled={saving} onClick={() => void groupAction("cancel")}>Cancel collection</button>}</div>}
    {error && !canContribute && <p className="form-error" role="alert">{error}</p>}
  </section>;
}
