import { useState, type FormEvent } from "react";
import { FoodCategorySchema, RecipientProfileFieldsSchema, type RecipientProfileFields } from "@surplus/shared";

const categories = FoodCategorySchema.options;
const categoryLabels: Record<(typeof categories)[number], string> = {
  PREPARED_MEALS: "Prepared meals", PRODUCE: "Produce", BAKERY: "Bakery", DAIRY: "Dairy", GRAINS: "Grains", PROTEIN: "Protein", OTHER: "Other",
};
export const emptyRecipientProfile: RecipientProfileFields = {
  organizationName: "", recipientType: "NGO", address: "", serviceArea: "", acceptedCategories: [], isAcceptingDonations: true, isActive: true,
};

export function RecipientProfileForm({ initial, creating, onSave, onCancel }: {
  initial: RecipientProfileFields; creating: boolean; onSave: (fields: RecipientProfileFields) => Promise<void>; onCancel?: () => void;
}) {
  const [fields, setFields] = useState(initial); const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  function set<K extends keyof RecipientProfileFields>(key: K, value: RecipientProfileFields[K]) { setFields((current) => ({ ...current, [key]: value })); }
  function toggleCategory(category: RecipientProfileFields["acceptedCategories"][number]) {
    const selected = fields.acceptedCategories.includes(category) ? fields.acceptedCategories.filter((item) => item !== category) : [...fields.acceptedCategories, category];
    set("acceptedCategories", selected);
  }
  async function submit(event: FormEvent) {
    event.preventDefault(); setError("");
    const candidate = { ...fields, capacityQuantity: fields.capacityQuantity === undefined ? undefined : Number(fields.capacityQuantity), latitude: fields.latitude === undefined ? undefined : Number(fields.latitude), longitude: fields.longitude === undefined ? undefined : Number(fields.longitude), serviceRadiusKm: fields.serviceRadiusKm === undefined ? undefined : Number(fields.serviceRadiusKm) };
    const parsed = RecipientProfileFieldsSchema.safeParse(candidate);
    if (!parsed.success) { setError(parsed.error.issues[0]?.message ?? "Check the recipient details."); return; }
    setBusy(true); try { await onSave(parsed.data); } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to save recipient profile."); } finally { setBusy(false); }
  }
  return <form className="auth-form recipient-form" onSubmit={submit} noValidate>
    <label>Organization / receiver name<input required maxLength={140} value={fields.organizationName} onChange={(event) => set("organizationName", event.target.value)} /></label>
    <label>Recipient type<select value={fields.recipientType} onChange={(event) => set("recipientType", event.target.value as RecipientProfileFields["recipientType"])}><option value="NGO">NGO</option><option value="SHELTER">Shelter</option><option value="COMMUNITY_ORGANIZATION">Community organization</option><option value="FOOD_DISTRIBUTION_ORGANIZATION">Food distribution organization</option><option value="OTHER">Other</option></select></label>
    <label>Description (optional)<textarea rows={3} maxLength={1000} value={fields.description ?? ""} onChange={(event) => set("description", event.target.value || undefined)} /></label>
    <label>Street address<input required value={fields.address} onChange={(event) => set("address", event.target.value)} /></label>
    <label>Service area / neighborhood<input required value={fields.serviceArea} onChange={(event) => set("serviceArea", event.target.value)} /></label>
    <div className="donation-fields-row"><label>Latitude (optional)<input type="number" min="-90" max="90" step="any" value={fields.latitude ?? ""} onChange={(event) => set("latitude", event.target.value ? Number(event.target.value) : undefined)} /></label><label>Longitude (optional)<input type="number" min="-180" max="180" step="any" value={fields.longitude ?? ""} onChange={(event) => set("longitude", event.target.value ? Number(event.target.value) : undefined)} /></label></div>
    <label>Service radius in km (optional)<input type="number" min="0.1" max="250" step="any" value={fields.serviceRadiusKm ?? ""} onChange={(event) => set("serviceRadiusKm", event.target.value ? Number(event.target.value) : undefined)} /></label>
    <fieldset className="recipient-category-set"><legend>Food categories accepted</legend><div className="recipient-category-grid">{categories.map((category) => <label key={category}><input type="checkbox" checked={fields.acceptedCategories.includes(category)} onChange={() => toggleCategory(category)} />{categoryLabels[category]}</label>)}</div></fieldset>
    <div className="donation-fields-row"><label>Current capacity (optional)<input type="number" min="0.01" max="100000" step="any" value={fields.capacityQuantity ?? ""} onChange={(event) => set("capacityQuantity", event.target.value ? Number(event.target.value) : undefined)} /></label><label>Capacity unit<select value={fields.capacityUnit ?? ""} onChange={(event) => set("capacityUnit", event.target.value ? event.target.value as RecipientProfileFields["capacityUnit"] : undefined)}><option value="">Choose unit</option><option value="SERVINGS">Servings</option><option value="MEALS">Meals</option><option value="KG">Kilograms</option><option value="PACKAGES">Packages</option></select></label></div>
    <label>Dietary restrictions / special requirements<textarea rows={2} maxLength={500} value={fields.dietaryRestrictions ?? ""} onChange={(event) => set("dietaryRestrictions", event.target.value || undefined)} /></label>
    <label>Operating / availability notes<textarea rows={2} maxLength={500} value={fields.availabilityNotes ?? ""} onChange={(event) => set("availabilityNotes", event.target.value || undefined)} /></label>
    <label className="recipient-toggle"><input type="checkbox" checked={fields.isAcceptingDonations} onChange={(event) => set("isAcceptingDonations", event.target.checked)} />Currently accepting donations</label>
    <label className="recipient-toggle"><input type="checkbox" checked={fields.isActive} onChange={(event) => set("isActive", event.target.checked)} />Keep profile active</label>
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="form-actions">{onCancel ? <button type="button" className="secondary-button" onClick={onCancel}>Cancel</button> : <span /> }<button className="primary-button" disabled={busy}>{busy ? "Saving..." : creating ? "Create recipient profile" : "Save profile"}</button></div>
  </form>;
}
