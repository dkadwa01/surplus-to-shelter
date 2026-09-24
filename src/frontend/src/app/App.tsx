import { Link, Route, Routes } from "react-router-dom";
import { HomePage } from "../features/home/HomePage";
import { NotFoundPage } from "../features/home/NotFoundPage";

export default function App() {
  return (
    <div className="app-shell">
      <header className="site-header">
        <Link className="brand" to="/">Surplus <span>to Shelter</span></Link>
        <span className="foundation-label">Project foundation</span>
      </header>
      <main>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </main>
      <footer>Connecting surplus food with community care.</footer>
    </div>
  );
}
