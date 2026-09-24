import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { RegistrationRequestSchema, type SelfAssignableRole } from "@surplus/shared";
import { useAuth } from "./AuthContext";

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<SelfAssignableRole>("DONOR");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const parsed = RegistrationRequestSchema.safeParse({ fullName, email, phone: phone || undefined, password, role });
    if (!parsed.success) { setError(parsed.error.issues[0]?.message ?? "Check your details."); return; }
    setBusy(true);
    try { await register(parsed.data); navigate("/account", { replace: true }); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to create your account."); }
    finally { setBusy(false); }
  }

  return (
    <section className="auth-card">
      <p className="eyebrow">Join the rescue network</p>
      <h1>Create an account</h1>
      <p className="auth-description">Choose the role that best describes how you’ll participate.</p>
      <form className="auth-form" onSubmit={submit} noValidate>
        <label>Full name<input autoComplete="name" required minLength={2} value={fullName} onChange={(event) => setFullName(event.target.value)} /></label>
        <label>Email<input type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} /></label>
        <label>Phone <span className="field-note">optional, international format</span><input type="tel" autoComplete="tel" placeholder="+14155552671" value={phone} onChange={(event) => setPhone(event.target.value)} /></label>
        <label>Account role<select value={role} onChange={(event) => setRole(event.target.value as SelfAssignableRole)}><option value="DONOR">Donor</option><option value="RECIPIENT">Recipient organization</option><option value="DRIVER">Driver / volunteer</option></select></label>
        <label>Password <span className="field-note">at least 12 characters</span><input type="password" autoComplete="new-password" minLength={12} required value={password} onChange={(event) => setPassword(event.target.value)} /></label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="primary-button" disabled={busy}>{busy ? "Creating account…" : "Create account"}</button>
      </form>
      <p className="auth-switch">Already registered? <Link to="/login">Sign in</Link></p>
    </section>
  );
}
