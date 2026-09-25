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
import { RecipientProfilePage } from "../features/recipients/RecipientProfilePage";
import { RecipientsPage } from "../features/recipients/RecipientsPage";
import { VerificationPage } from "../features/verification/VerificationPage";
import { AdminVerificationListPage } from "../features/verification/AdminVerificationListPage";
import { AdminVerificationDetailPage } from "../features/verification/AdminVerificationDetailPage";
import { CommunityDonationsPage } from "../features/community-donations/CommunityDonationsPage";
import { CommunityDonationDetailsPage } from "../features/community-donations/CommunityDonationDetailsPage";
import { DonationMatchesPage } from "../features/matching/DonationMatchesPage";
import { RecipientMatchesPage } from "../features/matching/RecipientMatchesPage";
import { CommunityDonationMatchesPage } from "../features/matching/CommunityDonationMatchesPage";
import { MatchDetailsPage } from "../features/matching/MatchDetailsPage";

export default function App() {
  const { user, loading, logout } = useAuth();
  return (
    <div className="app-shell">
      <header className="site-header">
        <Link className="brand" to="/">Surplus <span>to Shelter</span></Link>
        {user?.role === "DONOR" && <Link to="/donations">My donations</Link>}
        {user && <Link to="/community-donations">Community donations</Link>}
        {user && ["DONOR", "DRIVER", "ADMIN"].includes(user.role) && <Link to="/recipients">Recipients</Link>}
        {user?.role === "RECIPIENT" && <Link to="/recipients/profile">Recipient profile</Link>}
        {user?.role === "RECIPIENT" && <Link to="/matching">Food matches</Link>}
        {user && ["DONOR", "RECIPIENT", "DRIVER"].includes(user.role) && <Link to="/verification">Verification</Link>}
        {user?.role === "ADMIN" && <Link to="/admin/verifications">Verification review</Link>}
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
          <Route path="/community-donations" element={<ProtectedRoute allowedRoles={["DONOR", "RECIPIENT", "DRIVER", "ADMIN"]}><CommunityDonationsPage /></ProtectedRoute>} />
          <Route path="/community-donations/:id" element={<ProtectedRoute allowedRoles={["DONOR", "RECIPIENT", "DRIVER", "ADMIN"]}><CommunityDonationDetailsPage /></ProtectedRoute>} />
          <Route path="/matching" element={<ProtectedRoute allowedRoles={["RECIPIENT"]}><RecipientMatchesPage /></ProtectedRoute>} />
          <Route path="/matching/donations/:id" element={<ProtectedRoute allowedRoles={["DONOR"]}><DonationMatchesPage /></ProtectedRoute>} />
          <Route path="/matching/community-donations/:id" element={<ProtectedRoute allowedRoles={["DONOR"]}><CommunityDonationMatchesPage /></ProtectedRoute>} />
          <Route path="/matching/details/:sourceType/:sourceId/recipients/:recipientProfileId" element={<ProtectedRoute allowedRoles={["DONOR", "RECIPIENT"]}><MatchDetailsPage /></ProtectedRoute>} />
          <Route path="/recipients" element={<ProtectedRoute allowedRoles={["DONOR", "DRIVER", "ADMIN"]}><RecipientsPage /></ProtectedRoute>} />
          <Route path="/recipients/profile" element={<ProtectedRoute allowedRoles={["RECIPIENT"]}><RecipientProfilePage /></ProtectedRoute>} />
          <Route path="/verification" element={<ProtectedRoute allowedRoles={["DONOR", "RECIPIENT", "DRIVER"]}><VerificationPage role={user?.role ?? "DONOR"} donorType={user?.donorType ?? null} /></ProtectedRoute>} />
          <Route path="/admin/verifications" element={<ProtectedRoute allowedRoles={["ADMIN"]}><AdminVerificationListPage /></ProtectedRoute>} />
          <Route path="/admin/verifications/:id" element={<ProtectedRoute allowedRoles={["ADMIN"]}><AdminVerificationDetailPage /></ProtectedRoute>} />
          <Route path="/unauthorized" element={<UnauthorizedPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </main>
      <footer>Connecting surplus food with community care.</footer>
    </div>
  );
}
