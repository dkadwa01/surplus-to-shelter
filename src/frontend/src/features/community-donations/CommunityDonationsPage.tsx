import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FoodCategorySchema, QuantityUnitSchema, type CreateCommunityDonationRequest, type CommunityDonationResponse } from "@surplus/shared";
import { useAuth } from "../auth/AuthContext";
import { createCommunityDonation, listCommunityDonations } from "./community-donation-api";

const categories = FoodCategorySchema.options;
const units = QuantityUnitSchema.options;
const localDateTime = (days: number) => { const date = new Date(Date.now() + days * 86400000); date.setMinutes(date.getMinutes() - date.getTimezoneOffset()); return date.toISOString().slice(0, 16); };

export function CommunityDonationsPage() {
  const [groups, setGroups] = useState<CommunityDonationResponse[]>([]);
  const [area, setArea] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();
  const load = (filterArea = area) => {
    setLoading(true); setError("");
    listCommunityDonations(filterArea.trim() ? { pickupArea: filterArea.trim() } : {}).then(setGroups)
      .catch((reason) => setError(reason instanceof Error ? reason.message : "Unable to load community donations."))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(""); }, []);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError("");
    const form = new FormData(event.currentTarget);
    const targetQuantity = String(form.get("targetQuantity") ?? "");
    const input: CreateCommunityDonationRequest = {
      title: String(form.get("title")), pickupArea: String(form.get("pickupArea")), deadline: new Date(String(form.get("deadline"))).toISOString(),
      ...(String(form.get("description")).trim() ? { description: String(form.get("description")) } : {}),
      ...(targetQuantity ? { targetQuantity: Number(targetQuantity), targetCategory: String(form.get("targetCategory")) as typeof categories[number], targetUnit: String(form.get("targetUnit")) as typeof units[number] } : {}),
    };
    try { const group = await createCommunityDonation(input); navigate(`/community-donations/${group.id}`); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to create the group."); }
    finally { setSaving(false); }
  }

  return <section className="donation-page community-page">
    <div className="donation-heading"><div><p className="eyebrow">Together, we can share more</p><h1>Community donations</h1><p className="auth-description">Find nearby food collections and add a contribution that stays tracked to your household.</p></div></div>
    {user?.role === "DONOR" && <details className="community-create"><summary className="primary-button">Start a community collection</summary>
      <form className="auth-form community-create-form" onSubmit={(event) => void create(event)}>
        <label>Collection title<input name="title" required minLength={3} maxLength={120} placeholder="Weekend pantry collection" /></label>
        <label>Area<input name="pickupArea" required minLength={2} maxLength={120} placeholder="Neighborhood or locality" /></label>
        <label>Description<textarea name="description" maxLength={1000} rows={3} /></label>
        <div className="donation-fields-row"><label>Optional target quantity<input name="targetQuantity" type="number" min="0.01" step="any" placeholder="Leave blank for mixed items" /></label>
          <label>Target food category<select name="targetCategory" defaultValue="PRODUCE">{categories.map((category) => <option key={category} value={category}>{category.replace(/_/g, " ")}</option>)}</select></label>
          <label>Target unit<select name="targetUnit" defaultValue="KG">{units.map((unit) => <option key={unit} value={unit}>{unit}</option>)}</select></label></div>
        <label>Collection deadline<input name="deadline" type="datetime-local" min={localDateTime(0)} defaultValue={localDateTime(7)} required /></label>
        <p className="field-note">If you set a target, progress counts only contributions with its category and unit. All other item quantities remain separate.</p>
        {error && <p role="alert" className="form-error">{error}</p>}
        <button className="primary-button" disabled={saving}>{saving ? "Creating..." : "Create collection"}</button>
      </form>
    </details>}
    <form className="community-filters" onSubmit={(event) => { event.preventDefault(); load(); }}><label>Filter by area<input value={area} onChange={(event) => setArea(event.target.value)} placeholder="Area name" /></label><button className="secondary-button">Search</button></form>
    {loading && <p role="status">Loading community donations...</p>}{error && <p className="form-error" role="alert">{error}</p>}
    {!loading && !error && groups.length === 0 && <div className="donation-empty"><h2>No open collections found</h2><p>Try another area, or start a collection if you are a verified donor.</p></div>}
    <div className="donation-grid">{groups.map((group) => <article className="donation-card" key={group.id}>
      <div className="donation-card-top"><span className={`status-pill status-${group.status.toLowerCase()}`}>{group.status.replace(/_/g, " ")}</span><span>{group.pickupArea}</span></div>
      <h2>{group.title}</h2><p>{group.description || "A neighborhood food collection."}</p>
      <p>{group.contributorCount} contributing household{group.contributorCount === 1 ? "" : "s"}</p>
      {group.targetQuantity ? <p>{group.targetProgressPercent}% toward {group.targetQuantity} {group.targetUnit?.toLowerCase()} {group.targetCategory?.replace(/_/g, " ").toLowerCase()}</p> : <p>{group.totals.length} item type{group.totals.length === 1 ? "" : "s"} collected</p>}
      <p>Closes {new Date(group.deadline).toLocaleString()}</p><Link to={`/community-donations/${group.id}`}>View collection</Link>
    </article>)}</div>
  </section>;
}
