import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import DonutScore from "../components/DonutScore";
import SproutAvatar from "../components/SproutAvatar";
import { getProfile, getSnapshot, type Snapshot } from "../api";

const DAILY_MESSAGES = [
  "Small steps today build a steadier tomorrow.",
  "You're doing something loving by paying attention.",
  "Consistency matters more than any single score.",
  "Celebrate progress — not perfection.",
];

export default function LongevityDashboard() {
  const navigate = useNavigate();
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [name, setName] = useState("");
  const [tasksOpen, setTasksOpen] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const dailyMsg = DAILY_MESSAGES[new Date().getDate() % DAILY_MESSAGES.length];

  useEffect(() => {
    Promise.all([getProfile(), getSnapshot()])
      .then(([p, s]) => {
        setName(p.display_name);
        setSnap(s);
      })
      .catch((e) => setErr(e instanceof Error ? e.message : "Failed to load"));
  }, []);

  const score = snap?.overall.overall_score ?? null;

  return (
    <div className="screen screen-dashboard-v2">
      <header className="dash-v2-header">
        <button type="button" className="hub-back light" onClick={() => navigate("/parent")}>
          ←
        </button>
        <SproutAvatar size={72} />
        <h1>{name || "…"}</h1>
        <p className="dash-v2-message">{dailyMsg}</p>
      </header>

      <div className="dash-v2-scroll">
        <div className="dash-v2-actions">
          <Link to="/guided" className="dash-action dash-action-blue">
            <span className="dash-action-icon">+</span>
            <span>New Test</span>
          </Link>
          <button
            type="button"
            className="dash-action dash-action-sage"
            onClick={() => setTasksOpen(true)}
          >
            <span className="dash-action-icon">✓</span>
            <span>View Tasks</span>
          </button>
          <button type="button" className="dash-action dash-action-warm" disabled title="Coming soon">
            <span className="dash-action-icon">#</span>
            <span>Calendar</span>
          </button>
        </div>

        {err && <p className="error">{err}</p>}

        <section className="summary-card">
          <h2>Longevity Summary</h2>
          {score != null ? (
            <>
              <div className="summary-card-inner">
                <div className="summary-text">
                  <p>{snap?.overall.headline}</p>
                  {snap?.insights?.summary && (
                    <p className="muted">{snap.insights.summary}</p>
                  )}
                  <p className="muted">
                    Functional age ~{snap?.overall.overall_functional_age} · Actual age{" "}
                    {snap?.overall.chronological_age}
                  </p>
                </div>
                <DonutScore score={score} />
              </div>
              <Link to="/dashboard/detail" className="see-more-btn">
                See More
              </Link>
            </>
          ) : (
            <p className="muted">
              No scores yet. Run a test from the parent profile to build their summary.
            </p>
          )}
        </section>

        {snap?.categories && snap.categories.length > 0 && (
          <section className="summary-card mini-cats">
            <h3>Recent check-ins</h3>
            <ul>
              {snap.categories.map((c) => (
                <li key={c.category}>
                  <strong>{c.label}</strong> — {c.score}/100
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      {tasksOpen && snap && (
        <div className="modal-backdrop" onClick={() => setTasksOpen(false)} role="presentation">
          <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
            <h2>Action plan</h2>
            <ul>
              {snap.actions.map((a) => (
                <li key={a.title}>
                  <strong>{a.title}</strong>
                  <p className="muted">{a.detail}</p>
                </li>
              ))}
            </ul>
            <button type="button" className="btn block" onClick={() => setTasksOpen(false)}>
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
