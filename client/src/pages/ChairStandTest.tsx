import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import TestBack from "../components/TestBack";
import { saveChairStand, type CategoryScore } from "../api";

type Props = { embedded?: boolean; onSaved?: () => void };

export default function ChairStandTest({ embedded, onSaved }: Props = {}) {
  const [phase, setPhase] = useState<"idle" | "running" | "done">("idle");
  const [elapsed, setElapsed] = useState(0);
  const [saving, setSaving] = useState(false);
  const [scores, setScores] = useState<CategoryScore | null>(null);
  const startRef = useRef(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopTick = () => {
    if (tickRef.current) clearInterval(tickRef.current);
    tickRef.current = null;
  };

  const start = () => {
    setScores(null);
    setElapsed(0);
    setPhase("running");
    startRef.current = performance.now();
    stopTick();
    tickRef.current = setInterval(() => {
      setElapsed((performance.now() - startRef.current) / 1000);
    }, 50);
  };

  const finish = () => {
    if (phase !== "running") return;
    stopTick();
    setElapsed((performance.now() - startRef.current) / 1000);
    setPhase("done");
  };

  const reset = () => {
    stopTick();
    setPhase("idle");
    setElapsed(0);
    setScores(null);
  };

  const save = async () => {
    if (elapsed < 0.4) return;
    setSaving(true);
    try {
      const res = await saveChairStand(elapsed);
      setScores(res.scores);
      onSaved?.();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const Tag = embedded ? "div" : "section";
  return (
    <Tag className={embedded ? "" : "card"}>
      {!embedded && <TestBack />}
      <h2>Strength & Stability — chair stand</h2>
      <p className="muted">
        Sit fully on a sturdy chair, then stand once smoothly. Tap <strong>Start</strong> when the
        rise begins and <strong>Finish</strong> when fully upright. We score quickness and assume
        typical smoothness for manual timing.
      </p>
      <div className="timer-display">
        {phase === "idle" && elapsed === 0 ? "—" : `${elapsed.toFixed(2)}s`}
      </div>
      {phase === "idle" && (
        <button type="button" className="btn block" onClick={start}>
          Start stand
        </button>
      )}
      {phase === "running" && (
        <>
          <button type="button" className="btn block" onClick={finish}>
            Finish stand
          </button>
          <button type="button" className="btn secondary block" style={{ marginTop: "0.5rem" }} onClick={reset}>
            Reset
          </button>
        </>
      )}
      {phase === "done" && !scores && (
        <>
          <p className="success-msg">Rise time: {elapsed.toFixed(2)} seconds</p>
          <button type="button" className="btn block" disabled={saving} onClick={save}>
            {saving ? "Saving…" : "Save & see insight"}
          </button>
          <button type="button" className="btn secondary block" style={{ marginTop: "0.5rem" }} onClick={reset}>
            Try again
          </button>
        </>
      )}
      {scores && (
        <div className="result-panel">
          <strong>{scores.label}</strong> — score {scores.score}/100
          <p>{scores.interpretation}</p>
          <p className="muted">Functional age estimate: {scores.functional_age}</p>
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
