import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { getProfile, getSnapshot, type Snapshot } from "../api";

export default function Home() {
  const [name, setName] = useState("your parent");
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([getProfile(), getSnapshot()])
      .then(([p, s]) => {
        setName(p.display_name);
        setSnap(s);
      })
      .catch((e) => setErr(e instanceof Error ? e.message : "Server not running"));
  }, []);

  const done =
    (snap?.history_counts.reactions ?? 0) > 0 &&
    (snap?.history_counts.gaits ?? 0) > 0 &&
    (snap?.history_counts.chairs ?? 0) > 0;

  return (
    <>
      <section className="card">
        <h2>For adult children who care</h2>
        <p className="muted">
          You notice {name} walking slower, forgetting things, or tiring easily — but it is hard
          to know what is normal aging versus what deserves attention, especially when they
          distrust doctors.
        </p>
        <p className="muted">
          KinSpan turns three cheap, respected home observations into plain-language trajectory
          insights and gentle next steps.
        </p>
        {err && <p className="error">Start the API on port 8000. ({err})</p>}
      </section>

      <section className="snapshot-hero">
        <div className="muted" style={{ fontWeight: 700 }}>
          Today&apos;s functional health snapshot
        </div>
        {snap?.overall.overall_score != null ? (
          <>
            <div className="score-big">{snap.overall.overall_score}</div>
            <p style={{ margin: "0.25rem 0 0" }}>{snap.overall.headline}</p>
            <div className="ages">
              <span>Actual age: {snap.overall.chronological_age}</span>
              <span>
                Functional age estimate: {snap.overall.overall_functional_age ?? "—"}
              </span>
            </div>
          </>
        ) : (
          <p style={{ marginTop: "0.75rem" }}>
            Complete the three mini check-ins to unlock your first snapshot.
          </p>
        )}
      </section>

      <section className="card">
        <h2>Three biomarkers (MVP)</h2>
        <div className="activity-grid">
          <Link className="activity-tile" to="/assess/reaction">
            <h3>🧠 Cognitive Speed</h3>
            <p className="muted">Reaction time — mental sharpness & responsiveness</p>
          </Link>
          <Link className="activity-tile" to="/assess/walk">
            <h3>🚶 Mobility</h3>
            <p className="muted">10-foot walk — movement health & independence</p>
          </Link>
          <Link className="activity-tile" to="/assess/chair">
            <h3>🪑 Strength & Stability</h3>
            <p className="muted">30-second chair stand — leg strength & fall resilience</p>
          </Link>
        </div>
        {!done && (
          <p className="muted" style={{ marginTop: "0.75rem" }}>
            Progress: {snap?.history_counts.reactions ?? 0}/1 reaction ·{" "}
            {snap?.history_counts.gaits ?? 0}/1 walk · {snap?.history_counts.chairs ?? 0}/1 chair
          </p>
        )}
      </section>

      <Link className="btn block" to={done ? "/dashboard" : "/assess"}>
        {done ? "View aging trajectory" : "Start check-ins"}
      </Link>
    </>
  );
}
