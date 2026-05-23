import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { saveGait, type CategoryScore } from "../api";

type WalkState = "idle" | "running" | "paused" | "stopped";

type Props = { embedded?: boolean; onSaved?: () => void };

export default function WalkTest({ embedded, onSaved }: Props = {}) {
  const [walkState, setWalkState] = useState<WalkState>("idle");
  const [displaySec, setDisplaySec] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState<number | null>(null);
  const [manual, setManual] = useState("");
  const [saving, setSaving] = useState(false);
  const [scores, setScores] = useState<CategoryScore | null>(null);

  const accumRef = useRef(0);
  const segStartRef = useRef(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopTick = () => {
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
  };

  const refreshDisplay = useCallback(() => {
    setDisplaySec(accumRef.current + (performance.now() - segStartRef.current) / 1000);
  }, []);

  useEffect(() => () => stopTick(), []);

  const start = () => {
    setScores(null);
    setElapsed(null);
    setManual("");
    accumRef.current = 0;
    segStartRef.current = performance.now();
    setWalkState("running");
    stopTick();
    tickRef.current = setInterval(refreshDisplay, 50);
  };

  const pause = () => {
    if (walkState !== "running") return;
    accumRef.current += (performance.now() - segStartRef.current) / 1000;
    stopTick();
    setWalkState("paused");
    setDisplaySec(accumRef.current);
  };

  const resume = () => {
    if (walkState !== "paused") return;
    segStartRef.current = performance.now();
    setWalkState("running");
    stopTick();
    tickRef.current = setInterval(refreshDisplay, 50);
  };

  const stop = () => {
    if (walkState === "running") {
      accumRef.current += (performance.now() - segStartRef.current) / 1000;
    }
    const sec = accumRef.current;
    setElapsed(sec);
    setDisplaySec(sec);
    setManual(sec.toFixed(2));
    setWalkState("stopped");
  };

  const reset = () => {
    stopTick();
    accumRef.current = 0;
    setWalkState("idle");
    setDisplaySec(null);
    setElapsed(null);
    setManual("");
    setScores(null);
  };

  const submit = async () => {
    const t = elapsed ?? parseFloat(manual);
    if (!t || t <= 0) return;
    setSaving(true);
    try {
      const res = await saveGait(t);
      setScores(res.scores);
      onSaved?.();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const speed =
    displaySec && displaySec > 0
      ? (3.048 / displaySec).toFixed(2)
      : manual
        ? (3.048 / parseFloat(manual)).toFixed(2)
        : null;

  const Tag = embedded ? "div" : "section";
  return (
    <Tag className={embedded ? "" : "card"}>
      <h2>Mobility — 10-foot walk</h2>
      <p className="muted">
        Mark 10 feet on the floor (3.05 m). Parent walks at a <strong>comfortable</strong> pace; time
        from first movement to crossing the line. Use Pause if they need a brief break mid-walk.
      </p>
      <div className="timer-display">
        {displaySec != null ? displaySec.toFixed(2) : "—"}s
        {walkState === "paused" && <span className="muted"> (paused)</span>}
      </div>
      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
        <button type="button" className="btn" onClick={start} disabled={walkState === "running" || walkState === "paused"}>
          Start
        </button>
        <button type="button" className="btn secondary" onClick={pause} disabled={walkState !== "running"}>
          Pause
        </button>
        <button type="button" className="btn secondary" onClick={resume} disabled={walkState !== "paused"}>
          Resume
        </button>
        <button type="button" className="btn secondary" onClick={stop} disabled={walkState === "idle" || walkState === "stopped"}>
          Stop at 10 ft
        </button>
        <button type="button" className="btn secondary" onClick={reset}>
          Reset
        </button>
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
          {!embedded && (
            <Link className="btn secondary" to="/dashboard">
              View trajectory
            </Link>
          )}
        </div>
      )}
    </Tag>
  );
}
