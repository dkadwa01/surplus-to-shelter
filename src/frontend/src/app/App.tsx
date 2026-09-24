import { Link, Route, Routes } from "react-router-dom";
import { HomePage } from "../features/home/HomePage";
import { NotFoundPage } from "../features/home/NotFoundPage";
import { useAuth } from "../features/auth/AuthContext";
import { AccountPage } from "../features/auth/AccountPage";
import { LoginPage } from "../features/auth/LoginPage";
import { ProtectedRoute } from "../features/auth/ProtectedRoute";
import { RegisterPage } from "../features/auth/RegisterPage";
import { UnauthorizedPage } from "../features/auth/UnauthorizedPage";
import { DonationsPage } from "../features/donations/DonationsPage";
import { DonationFormPage } from "../features/donations/DonationFormPage";
import { DonationDetailsPage } from "../features/donations/DonationDetailsPage";

export default function App() {
  const { user, loading, logout } = useAuth();
  return (
    <div className="app-shell">
      <header className="site-header">
        <Link className="brand" to="/">Surplus <span>to Shelter</span></Link>
        {user?.role === "DONOR" && <Link to="/donations">My donations</Link>}
        <nav className="header-nav" aria-label="Account navigation">
          {loading ? <span className="foundation-label">Loading…</span> : user ? <><Link to="/account">{user.fullName}</Link><span className="role-badge">{user.role}</span><button className="text-button" onClick={() => { void logout(); }}>Sign out</button></> : <><Link to="/login">Sign in</Link><Link className="nav-join" to="/register">Create account</Link></>}
        </nav>
      </header>
      <main>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/account" element={<ProtectedRoute allowedRoles={["DONOR", "RECIPIENT", "DRIVER", "ADMIN"]}><AccountPage /></ProtectedRoute>} />
          <Route path="/donations" element={<ProtectedRoute allowedRoles={["DONOR"]}><DonationsPage /></ProtectedRoute>} />
          <Route path="/donations/new" element={<ProtectedRoute allowedRoles={["DONOR"]}><DonationFormPage /></ProtectedRoute>} />
          <Route path="/donations/:id/edit" element={<ProtectedRoute allowedRoles={["DONOR"]}><DonationFormPage /></ProtectedRoute>} />
          <Route path="/donations/:id" element={<ProtectedRoute allowedRoles={["DONOR"]}><DonationDetailsPage /></ProtectedRoute>} />
          <Route path="/unauthorized" element={<UnauthorizedPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </main>
      <footer>Connecting surplus food with community care.</footer>
    </div>
  );
}
