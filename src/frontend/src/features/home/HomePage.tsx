import { useEffect, useState } from "react";
import { HealthResponseSchema } from "@surplus/shared";

export function HomePage() {
  const [apiStatus, setApiStatus] = useState("Checking API…");

  useEffect(() => {
    let active = true;
    fetch("/api/health")
      .then(async (response) => {
        if (!response.ok) throw new Error("API unavailable");
        return HealthResponseSchema.parse(await response.json());
      })
      .then((health) => {
        if (active) setApiStatus(`API ${health.status}`);
      })
      .catch(() => {
        if (active) setApiStatus("API not connected");
      });
    return () => { active = false; };
  }, []);

  return (
    <section className="welcome-card">
      <p className="eyebrow">Food rescue, made easier</p>
      <h1>Good food deserves<br />a good next stop.</h1>
      <p className="intro">A shared foundation for connecting surplus food with organizations ready to use it.</p>
      <div className="status-row"><span className="status-dot" />{apiStatus}</div>
    </section>
  );
}
