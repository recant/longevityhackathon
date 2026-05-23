import { useEffect, useState } from "react";
import { getSnapshot, type CategoryScore, type Snapshot } from "../api";

function categoryClass(cat: string) {
  if (cat === "cognitive_speed") return "cognitive";
  if (cat === "mobility") return "mobility";
  return "strength";
}

function CategoryCard({ cat }: { cat: CategoryScore }) {
  const trend = cat.trend_detail?.trend ?? "stable";
  return (
    <div className={`category-card ${categoryClass(cat.category)}`}>
      <div className="category-header">
        <div>
          <h3>
            {cat.category === "cognitive_speed" && "🧠 "}
            {cat.category === "mobility" && "🚶 "}
            {cat.category === "strength_stability" && "🪑 "}
            {cat.label}
          </h3>
          <p className="functional-age">
            Functional age estimate: {cat.functional_age} · Chronological compared on profile
          </p>
        </div>
        <span className="score-pill">{cat.score}</span>
      </div>
      <p style={{ margin: "0.5rem 0 0" }}>{cat.interpretation}</p>
      {cat.trend_detail && (
        <span className={`trend ${trend}`}>
          {trend === "improving" && "↑ "}
          {trend === "stable" && "→ "}
          {trend === "watch_closely" && "↓ "}
          {cat.trend_detail.summary}
        </span>
      )}
      {cat.assessment_mode && (
        <p className="muted" style={{ marginTop: "0.25rem", fontSize: "0.8rem" }}>
          Source: {cat.assessment_mode === "computer_vision" ? "Video analysis" : "At-home test"}
        </p>
      )}
      {cat.evidence && cat.evidence.length > 0 && (
        <p className="muted" style={{ marginTop: "0.5rem", fontSize: "0.8rem" }}>
          Based on: {cat.evidence.join(" · ")}
        </p>
      )}
    </div>
  );
}

export default function Dashboard() {
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    getSnapshot()
      .then(setSnap)
      .catch((e) => setErr(e instanceof Error ? e.message : "Failed to load"));
  }, []);

  if (err) return <p className="error">{err}</p>;
  if (!snap) return <p className="muted">Loading trajectory…</p>;

  const { overall, categories, actions, insights, tracking_checklist, history_counts } = snap;
  const biomarkerDone = {
    reaction: history_counts.reactions > 0,
    gait: history_counts.gaits > 0,
    chair: history_counts.chairs > 0,
  };

  return (
    <>
      <section className="snapshot-hero">
        <div className="muted" style={{ fontWeight: 700 }}>
          Aging trajectory
        </div>
        {overall.overall_score != null ? (
          <>
            <div className="score-big">{overall.overall_score}</div>
            <p style={{ margin: "0.35rem 0" }}>{overall.headline}</p>
            <div className="ages">
              <span>Actual age: {overall.chronological_age}</span>
              <span>Functional age (blend): {overall.overall_functional_age}</span>
            </div>
          </>
        ) : (
          <p>Complete all three check-ins to see your trajectory.</p>
        )}
      </section>

      {insights && (
        <section className="card">
          <h2>Explain like a caring family member</h2>
          <div className="insight-box">{insights.summary}</div>
          {insights.what_changed && <p className="muted">{insights.what_changed}</p>}
          <div className="conversation-box">
            <strong>How to talk about this</strong>
            <p style={{ margin: "0.35rem 0 0" }}>{insights.conversation_tip}</p>
          </div>
          {insights.mock && (
            <p className="muted">Set OPENAI_API_KEY on the server for richer personalized text.</p>
          )}
        </section>
      )}

      {categories.length > 0 ? (
        categories.map((c) => <CategoryCard key={c.category} cat={c} />)
      ) : (
        <section className="card">
          <p className="muted">No scored check-ins yet. Start from Check-ins.</p>
        </section>
      )}

      <section className="card">
        <h2>Action plan</h2>
        <p className="muted">
          Low-cost habits — framed as independence, not treatment. See{" "}
          <a href="https://github.com/recant/longevityhackathon/blob/main/REFERENCES.md" target="_blank" rel="noreferrer">
            REFERENCES.md
          </a>{" "}
          for citations (LIFE Study, STEADI, etc.).
        </p>
        <ul>
          {actions.map((a) => (
            <li key={a.title} style={{ marginBottom: "0.75rem" }}>
              <strong>{a.title}</strong>
              <br />
              <span className="muted">{a.detail}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="card">
        <h2>What to track over time</h2>
        <ul className="checklist">
          {tracking_checklist.map((item) => {
            const done =
              (item.id === "reaction" && biomarkerDone.reaction) ||
              (item.id === "gait" && biomarkerDone.gait) ||
              (item.id === "chair" && biomarkerDone.chair);
            return (
              <li key={item.id} className={done ? "done" : ""}>
                {done ? "✓ " : "○ "}
                {item.label} <span className="muted">({item.cadence})</span>
                {!item.biomarker && (
                  <span className="muted"> — coming soon</span>
                )}
              </li>
            );
          })}
        </ul>
      </section>
    </>
  );
}
