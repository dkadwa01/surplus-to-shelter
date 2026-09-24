import { useEffect, useState } from "react";
import type { RecipientProfileFields, RecipientProfileResponse } from "@surplus/shared";
import { RecipientApiError, createMyProfile, getMyProfile, updateMyProfile } from "./recipient-api";
import { emptyRecipientProfile, RecipientProfileForm } from "./RecipientProfileForm";

function formFields(profile: RecipientProfileResponse): RecipientProfileFields {
  return { organizationName: profile.organizationName, recipientType: profile.recipientType, description: profile.description ?? undefined,
    address: profile.address, serviceArea: profile.serviceArea, latitude: profile.latitude ?? undefined, longitude: profile.longitude ?? undefined,
    serviceRadiusKm: profile.serviceRadiusKm ?? undefined, acceptedCategories: profile.acceptedCategories, capacityQuantity: profile.capacityQuantity ?? undefined,
    capacityUnit: profile.capacityUnit ?? undefined, dietaryRestrictions: profile.dietaryRestrictions ?? undefined,
    availabilityNotes: profile.availabilityNotes ?? undefined, isAcceptingDonations: profile.isAcceptingDonations, isActive: profile.isActive };
}
export function RecipientProfilePage() {
  const [profile, setProfile] = useState<RecipientProfileResponse | null>(null); const [loading, setLoading] = useState(true); const [editing, setEditing] = useState(false); const [error, setError] = useState("");
  useEffect(() => { getMyProfile().then(setProfile).catch((reason) => { if (reason instanceof RecipientApiError && reason.code === "NOT_FOUND") setProfile(null); else setError(reason instanceof Error ? reason.message : "Unable to load recipient profile."); }).finally(() => setLoading(false)); }, []);
  async function save(fields: RecipientProfileFields) { const saved = profile ? await updateMyProfile(fields) : await createMyProfile(fields); setProfile(saved); setEditing(false); setError(""); }
  if (loading) return <p role="status">Loading recipient profile...</p>;
  if (error && !profile) return <section className="auth-card"><p className="form-error" role="alert">{error}</p></section>;
  if (!profile || editing) return <section className="auth-card recipient-profile-card"><p className="eyebrow">Recipient profile</p><h1>{profile ? "Edit your profile" : "Set up your profile"}</h1><p className="auth-description">Share your organization's location, capacity, and food preferences. New profiles begin pending verification.</p>{error && <p className="form-error" role="alert">{error}</p>}<RecipientProfileForm initial={profile ? formFields(profile) : emptyRecipientProfile} creating={!profile} onSave={save} onCancel={profile ? () => setEditing(false) : undefined} /></section>;
  return <article className="recipient-profile-view"><div className="recipient-profile-head"><div><p className="eyebrow">Recipient profile</p><h1>{profile.organizationName}</h1><p>{profile.recipientType.replace(/_/g, " ")} | {profile.serviceArea}</p></div><button className="secondary-button" onClick={() => setEditing(true)}>Edit profile</button></div><span className="status-pill">Verification: {profile.verificationStatus}</span><p>{profile.description || "No organization description added."}</p><dl><dt>Address</dt><dd>{profile.address}</dd><dt>Account contact</dt><dd>{profile.contact.fullName} | {profile.contact.email}{profile.contact.phone ? ` | ${profile.contact.phone}` : ""}</dd><dt>Accepted categories</dt><dd>{profile.acceptedCategories.length ? profile.acceptedCategories.join(", ").replace(/_/g, " ") : "Not specified"}</dd><dt>Capacity</dt><dd>{profile.capacityQuantity ? `${profile.capacityQuantity} ${profile.capacityUnit?.toLowerCase()}` : "Not specified"}</dd><dt>Availability</dt><dd>{profile.isActive ? profile.isAcceptingDonations ? "Active and accepting donations" : "Active, not currently accepting" : "Inactive"}</dd><dt>Special requirements</dt><dd>{profile.dietaryRestrictions || "None listed"}</dd>{profile.availabilityNotes && <><dt>Availability notes</dt><dd>{profile.availabilityNotes}</dd></>}</dl></article>;
}
