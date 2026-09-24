import { Link } from "react-router-dom";

export function NotFoundPage() {
  return <section className="welcome-card"><p className="eyebrow">Page not found</p><h1>Let’s get you back.</h1><Link to="/">Return home</Link></section>;
}
