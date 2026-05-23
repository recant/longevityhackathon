import { Link } from "react-router-dom";

export default function Assess() {
  return (
    <section className="card">
      <h2>Guided check-ins</h2>
      <p className="muted">
        Short activities — not clinical tests. Do them together in a hallway or living room.
      </p>
      <div className="activity-grid">
        <Link className="activity-tile" to="/assess/reaction">
          <h3>🧠 Tap when green</h3>
          <p className="muted">5 trials · Cognitive Speed</p>
        </Link>
        <Link className="activity-tile" to="/assess/walk">
          <h3>🚶 10-foot walk</h3>
          <p className="muted">Stopwatch · Mobility</p>
        </Link>
        <Link className="activity-tile" to="/assess/chair">
          <h3>🪑 Chair stand</h3>
          <p className="muted">30 seconds · Strength & Stability</p>
        </Link>
      </div>
    </section>
  );
}
