import { useEffect, useState, type FormEvent } from "react";
import { FoodCategorySchema, RecipientTypeSchema, type RecipientDiscoveryResponse } from "@surplus/shared";
import { discoverRecipients } from "./recipient-api";

export function RecipientsPage() {
  const [recipients, setRecipients] = useState<RecipientDiscoveryResponse[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState("");
  const [recipientType, setRecipientType] = useState(""); const [serviceArea, setServiceArea] = useState(""); const [category, setCategory] = useState(""); const [accepting, setAccepting] = useState("true");
  async function load(filters = { recipientType, serviceArea, category, accepting: accepting as "true" | "false" }) {
    setLoading(true); setError("");
    try { setRecipients(await discoverRecipients({ recipientType: filters.recipientType || undefined, serviceArea: filters.serviceArea || undefined, category: filters.category || undefined, accepting: filters.accepting })); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to load recipients."); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load({ recipientType: "", serviceArea: "", category: "", accepting: "true" }); }, []);
  function submit(event: FormEvent) { event.preventDefault(); void load(); }
  return <section className="donation-page"><div className="donation-heading"><div><p className="eyebrow">Recipient directory</p><h1>Verified receivers</h1><p className="auth-description">Active verified organizations that are currently accepting food.</p></div></div>
    <form className="recipient-filter-bar" onSubmit={submit}><label>Type<select value={recipientType} onChange={(event) => setRecipientType(event.target.value)}><option value="">All types</option>{RecipientTypeSchema.options.map((type) => <option key={type} value={type}>{type.replace(/_/g, " ")}</option>)}</select></label><label>Service area<input value={serviceArea} onChange={(event) => setServiceArea(event.target.value)} placeholder="Area or neighborhood" /></label><label>Food category<select value={category} onChange={(event) => setCategory(event.target.value)}><option value="">Any category</option>{FoodCategorySchema.options.map((item) => <option key={item} value={item}>{item.replace(/_/g, " ")}</option>)}</select></label><label>Availability<select value={accepting} onChange={(event) => setAccepting(event.target.value)}><option value="true">Accepting donations</option><option value="false">Not currently accepting</option></select></label><button className="primary-button">Apply filters</button></form>
    {loading && <p role="status">Loading recipients...</p>}{error && <p className="form-error" role="alert">{error}</p>}{!loading && !error && recipients.length === 0 && <div className="donation-empty"><h2>No recipients found</h2><p>Try another type, food category, or service area.</p></div>}
    <div className="donation-grid">{recipients.map((recipient) => <article className="donation-card" key={recipient.id}><div className="donation-card-top"><span className="status-pill">Verified</span><span>{recipient.recipientType.replace(/_/g, " ")}</span></div><h2>{recipient.organizationName}</h2><p>{recipient.serviceArea}</p>{recipient.description && <p>{recipient.description}</p>}<p>Accepts: {recipient.acceptedCategories.length ? recipient.acceptedCategories.map((item) => item.replace(/_/g, " ")).join(", ") : "Categories not specified"}</p><p>Capacity: {recipient.capacityQuantity ? `${recipient.capacityQuantity} ${recipient.capacityUnit?.toLowerCase()}` : "Not specified"}</p><p>{recipient.availabilityNotes || "Currently accepting donations"}</p></article>)}</div>
  </section>;
}
