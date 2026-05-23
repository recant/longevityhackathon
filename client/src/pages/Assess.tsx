import { Link } from "react-router-dom";
import { useStoredPath } from "./PathSelect";

export default function Assess() {
  const [path] = useStoredPath();

  if (path === "vision") {
    return (
      <section className="card">
        <h2>Video check-ins</h2>
        <p className="muted">Computer vision path — film movement, then optional tap reaction.</p>
        <div className="activity-grid">
          <Link className="activity-tile" to="/assess/video-walk">
            <h3>🚶 Video walk</h3>
            <p className="muted">Gait speed, cadence, symmetry</p>
          </Link>
          <Link className="activity-tile" to="/assess/video-chair">
            <h3>🪑 Video chair stand</h3>
            <p className="muted">Count stands from video</p>
          </Link>
          <Link className="activity-tile" to="/assess/reaction">
            <h3>🧠 Reaction (manual)</h3>
            <p className="muted">Tap test — no video needed</p>
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="card">
      <h2>Guided check-ins</h2>
      <p className="muted">At-home tests — short activities, not clinical exams.</p>
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
