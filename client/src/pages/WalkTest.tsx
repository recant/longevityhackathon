import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { saveGait, type CategoryScore } from "../api";

export default function WalkTest() {
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState<number | null>(null);
  const [manual, setManual] = useState("");
  const [saving, setSaving] = useState(false);
  const [scores, setScores] = useState<CategoryScore | null>(null);
  const startRef = useRef(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const start = () => {
    setScores(null);
    setElapsed(null);
    setManual("");
    startRef.current = performance.now();
    setRunning(true);
    tickRef.current = setInterval(() => {
      setElapsed((performance.now() - startRef.current) / 1000);
    }, 50);
  };

  const stop = () => {
    if (tickRef.current) clearInterval(tickRef.current);
    const sec = (performance.now() - startRef.current) / 1000;
    setElapsed(sec);
    setRunning(false);
    setManual(sec.toFixed(2));
  };

  const submit = async () => {
    const t = elapsed ?? parseFloat(manual);
    if (!t || t <= 0) return;
    setSaving(true);
    try {
      const res = await saveGait(t);
      setScores(res.scores);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const speed =
    elapsed && elapsed > 0 ? (3.048 / elapsed).toFixed(2) : manual ? (3.048 / parseFloat(manual)).toFixed(2) : null;

  return (
    <section className="card">
      <h2>Mobility — 10-foot walk</h2>
      <p className="muted">
        Mark 10 feet on the floor (about 3 large steps). Parent walks at a normal pace. Time from
        first movement to crossing the line.
      </p>
      <div className="timer-display">
        {running ? elapsed?.toFixed(2) ?? "0.00" : elapsed?.toFixed(2) ?? "—"}s
      </div>
      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
        {!running && !elapsed && (
          <button type="button" className="btn" onClick={start}>
            Start timer
          </button>
        )}
        {running && (
          <button type="button" className="btn" onClick={stop}>
            Stop at 10 ft
          </button>
        )}
      </div>
      <label className="field-label" style={{ marginTop: "1rem" }}>
        Or enter time manually (seconds)
      </label>
      <input
        type="number"
        step="0.1"
        min="1"
        max="60"
        value={manual}
        onChange={(e) => setManual(e.target.value)}
        placeholder="e.g. 4.5"
      />
      {speed && <p className="muted">Estimated speed: {speed} m/s</p>}
      <button
        className="btn block"
        type="button"
        disabled={saving || (!elapsed && !manual)}
        onClick={submit}
      >
        {saving ? "Saving…" : "Save & see insight"}
      </button>
      {scores && (
        <div className="result-panel">
          <strong>{scores.label}</strong> — score {scores.score}/100
          <p>{scores.interpretation}</p>
          <p className="muted">
            Speed: {(scores.raw as { speed_mps: number }).speed_mps} m/s · Functional age:{" "}
            {scores.functional_age}
          </p>
          <Link className="btn secondary" to="/dashboard">
            View trajectory
          </Link>
        </div>
      )}
    </section>
  );
}
