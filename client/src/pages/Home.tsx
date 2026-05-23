import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { getProfile, getSnapshot, type Snapshot } from "../api";
import { getPath, setPath, type AssessmentPath } from "../path";
import { resetWorkflowProgress } from "../workflow";

export default function Home() {
  const [path, setPathState] = useState<AssessmentPath>(getPath());
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

  const pickPath = (p: AssessmentPath) => {
    setPath(p);
    setPathState(p);
    resetWorkflowProgress();
  };

  return (
    <>
      <section className="card">
        <h2>For adult children who care</h2>
        <p className="muted">
          Track {name}&apos;s functional aging with a calm, step-by-step guided check-in — choose
          how you want to measure movement.
        </p>
        {err && <p className="error">Start the API on port 8000. ({err})</p>}
      </section>

      <section className="card">
        <h2>Choose your path</h2>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
          <button
            type="button"
            className="activity-tile"
            style={{
              border: path === "manual" ? "2px solid var(--primary)" : "2px solid transparent",
              cursor: "pointer",
              textAlign: "left",
              width: "100%",
              background: path === "manual" ? "var(--primary-soft)" : undefined,
            }}
            onClick={() => pickPath("manual")}
          >
            <h3>At-home tests</h3>
            <p className="muted">Stopwatch, tap reaction, chair counter</p>
          </button>
          <button
            type="button"
            className="activity-tile"
            style={{
              border: path === "vision" ? "2px solid var(--primary)" : "2px solid transparent",
              cursor: "pointer",
              textAlign: "left",
              width: "100%",
              background: path === "vision" ? "var(--primary-soft)" : undefined,
            }}
            onClick={() => pickPath("vision")}
          >
            <h3>Video analysis</h3>
            <p className="muted">Computer vision for walk &amp; chair</p>
          </button>
        </div>
      </section>

      {snap?.overall.overall_score != null && (
        <section className="snapshot-hero">
          <div className="muted" style={{ fontWeight: 700 }}>
            Last snapshot
          </div>
          <div className="score-big">{snap.overall.overall_score}</div>
          <p style={{ margin: "0.25rem 0 0" }}>{snap.overall.headline}</p>
        </section>
      )}

      <Link className="btn block" to="/guided">
        Start guided check-in
      </Link>
      <p className="muted" style={{ textAlign: "center", marginTop: "0.75rem" }}>
        Step-by-step workflow for {path === "manual" ? "3 at-home tests" : "2 videos + reaction"}
      </p>
    </>
  );
}
