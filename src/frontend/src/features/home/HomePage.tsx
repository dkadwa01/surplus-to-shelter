import { useEffect, useState } from "react";
import { HealthResponseSchema } from "@surplus/shared";
import { Link } from "react-router-dom";

export function HomePage() {
  const [apiStatus, setApiStatus] = useState("Checking API...");
  useEffect(() => {
    let active = true;
    fetch("/api/health")
      .then(async (response) => {
        if (!response.ok) throw new Error("API unavailable");
        return HealthResponseSchema.parse(await response.json());
      })
      .then((health) => { if (active) setApiStatus(`API ${health.status}`); })
      .catch(() => { if (active) setApiStatus("API not connected"); });
    return () => { active = false; };
  }, []);
  return <section className="welcome-card">
    <div className="welcome-copy"><p className="eyebrow">Local food rescue network</p><h1>Good food deserves<br />a good next stop.</h1>
      <p className="intro">Connect surplus food with local organizations ready to use it, while there is still time.</p>
      <div className="welcome-actions"><Link className="primary-button" to="/register">Join the network</Link><Link className="secondary-button" to="/login">Sign in</Link></div>
      <div className="status-row"><span className="status-dot" />{apiStatus}</div>
    </div>
    <div className="welcome-aside"><span className="welcome-orbit orbit-one" /><span className="welcome-orbit orbit-two" /><div className="welcome-food-mark" aria-hidden="true" /><p>Share what you have.<br /><strong>Help nearby.</strong></p></div>
    <div className="welcome-pill-row"><span>Verified participants</span><span>Community collections</span><span>Location-aware matching</span></div>
  </section>;
}
