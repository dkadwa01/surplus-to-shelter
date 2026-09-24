import { Link } from "react-router-dom";
import { useAuth } from "./AuthContext";

export function AccountPage() {
  const { user } = useAuth();
  if (!user) return null;
  return <section className="welcome-card"><p className="eyebrow">Signed in</p><h1>Your account</h1><p className="intro">{user.fullName} · {user.role}</p><p>This is the authentication foundation. Role-specific workspaces will be added in separate features.</p><Link to="/">Back to home</Link></section>;
}
