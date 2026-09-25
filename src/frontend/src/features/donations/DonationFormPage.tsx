import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { DonationFieldsSchema, type DonationFields } from "@surplus/shared";
import { createDonation, getDonation, updateDonation } from "./donation-api";
import { LocationSearch } from "../../components/LocationSearch";

const blank: DonationFields = { foodName: "", category: "PREPARED_MEALS", quantity: 1, unit: "SERVINGS", expiresAt: "", pickupAddress: "", pickupArea: "" };
function localInput(value?: string | null) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const offset = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - offset).toISOString().slice(0, 16);
}
export function DonationFormPage() {
  const { id } = useParams(); const navigate = useNavigate(); const editing = Boolean(id);
  const [fields, setFields] = useState<DonationFields>(blank); const [loading, setLoading] = useState(editing); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  useEffect(() => { if (!id) return; getDonation(id).then((donation) => setFields({ foodName: donation.foodName, category: donation.category, quantity: donation.quantity, unit: donation.unit, preparedAt: donation.preparedAt ?? undefined, expiresAt: localInput(donation.expiresAt), pickupAddress: donation.pickupAddress, pickupArea: donation.pickupArea, latitude: donation.latitude ?? undefined, longitude: donation.longitude ?? undefined, description: donation.description ?? undefined })).catch((reason) => setError(reason instanceof Error ? reason.message : "Unable to load donation.")).finally(() => setLoading(false)); }, [id]);
  function set<K extends keyof DonationFields>(key: K, value: DonationFields[K]) { setFields((current) => ({ ...current, [key]: value })); }
  async function submit(event: FormEvent) { event.preventDefault(); setError(""); if (!fields.expiresAt || Number.isNaN(Date.parse(fields.expiresAt))) { setError("Enter a valid use-by time."); return; } const parsed = DonationFieldsSchema.safeParse({ ...fields, quantity: Number(fields.quantity), preparedAt: fields.preparedAt || undefined, expiresAt: new Date(fields.expiresAt).toISOString(), latitude: fields.latitude === undefined ? undefined : Number(fields.latitude), longitude: fields.longitude === undefined ? undefined : Number(fields.longitude) }); if (!parsed.success) { setError(parsed.error.issues[0]?.message ?? "Check your donation details."); return; }
    setBusy(true); try { const donation = editing && id ? await updateDonation(id, parsed.data) : await createDonation(parsed.data); navigate(`/donations/${donation.id}`, { replace: true }); } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to save donation."); } finally { setBusy(false); }
  }
  if (loading) return <p role="status">Loading donation…</p>;
  return <section className="auth-card donation-form-card"><p className="eyebrow">Food listing</p><h1>{editing ? "Edit donation" : "Add a donation"}</h1><p className="auth-description">Share what is available, how much there is, and where it can be collected.</p>
    <form className="auth-form" onSubmit={submit} noValidate>
      <label>Food name<input required value={fields.foodName} onChange={(e) => set("foodName", e.target.value)} /></label>
      <label>Category<select value={fields.category} onChange={(e) => set("category", e.target.value as DonationFields["category"])}>{[["PREPARED_MEALS","Prepared meals"],["PRODUCE","Produce"],["BAKERY","Bakery"],["DAIRY","Dairy"],["GRAINS","Grains"],["PROTEIN","Protein"],["OTHER","Other"]].map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <div className="donation-fields-row"><label>Quantity<input type="number" min="0.01" max="100000" step="any" required value={fields.quantity} onChange={(e) => set("quantity", Number(e.target.value))} /></label><label>Unit<select value={fields.unit} onChange={(e) => set("unit", e.target.value as DonationFields["unit"])}>{["SERVINGS","KG","GRAMS","LITRES","ITEMS","PACKAGES"].map((unit) => <option key={unit}>{unit}</option>)}</select></label></div>
      <label>Prepared at (optional)<input type="datetime-local" value={localInput(fields.preparedAt)} onChange={(e) => set("preparedAt", e.target.value ? new Date(e.target.value).toISOString() : undefined)} /></label>
      <label>Use by<input type="datetime-local" required value={localInput(fields.expiresAt)} onChange={(e) => set("expiresAt", e.target.value)} /></label>
      <LocationSearch title="Search pickup location" markerType="DONATION" value={fields.pickupAddress} latitude={fields.latitude} longitude={fields.longitude} onAddressChange={(address) => setFields((current) => ({ ...current, pickupAddress: address, latitude: undefined, longitude: undefined }))} onSelect={(location) => setFields((current) => ({ ...current, pickupAddress: location.address, pickupArea: location.area || current.pickupArea, latitude: location.latitude, longitude: location.longitude }))} />
      <label>Area / neighborhood<input required value={fields.pickupArea} onChange={(e) => set("pickupArea", e.target.value)} /></label>
      <label>Description (optional)<textarea rows={3} maxLength={1000} value={fields.description ?? ""} onChange={(e) => set("description", e.target.value || undefined)} /></label>
      {error && <p className="form-error" role="alert">{error}</p>}<div className="form-actions"><Link to={id ? `/donations/${id}` : "/donations"}>Back</Link><button className="primary-button" disabled={busy}>{busy ? "Saving…" : editing ? "Save changes" : "Publish donation"}</button></div>
    </form>
  </section>;
}
