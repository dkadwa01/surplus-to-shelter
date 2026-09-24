import { Link } from "react-router-dom";

export function UnauthorizedPage() {
  return (
    <section className="welcome-card">
      <p className="eyebrow">Access restricted</p>
      <h1>This area isn’t available to your role.</h1>
      <p className="intro">Use an account with the required role, or return to your account.</p>
      <Link to="/account">Go to your account</Link>
    </section>
  );
}

