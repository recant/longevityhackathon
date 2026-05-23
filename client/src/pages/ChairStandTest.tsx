import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { saveChairStand, type CategoryScore } from "../api";

const DURATION = 30;

export default function ChairStandTest() {
  const [phase, setPhase] = useState<"idle" | "running" | "done">("idle");
  const [secondsLeft, setSecondsLeft] = useState(DURATION);
  const [reps, setReps] = useState(0);
  const [saving, setSaving] = useState(false);
  const [scores, setScores] = useState<CategoryScore | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const start = () => {
    setScores(null);
    setReps(0);
    setSecondsLeft(DURATION);
    setPhase("running");
    intervalRef.current = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          if (intervalRef.current) clearInterval(intervalRef.current);
          setPhase("done");
          return 0;
        }
        return s - 1;
      });
    }, 1000);
  };

  const addRep = () => {
    if (phase === "running") setReps((r) => r + 1);
  };

  const finishEarly = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setPhase("done");
    setSecondsLeft(0);
  };

  const save = async () => {
    setSaving(true);
    try {
      const res = await saveChairStand(reps);
      setScores(res.scores);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="card">
      <h2>Strength & Stability — chair stand</h2>
      <p className="muted">
        <strong>CDC STEADI 30-second chair stand:</strong> sturdy chair, arms crossed on chest if
        safe (or hands on thighs). Count full stands in 30 seconds — tap +1 each time. Compared to
        Rikli &amp; Jones Senior Fitness Test norms.
      </p>
      {phase === "idle" && (
        <button type="button" className="btn block" onClick={start}>
          Start 30-second activity
        </button>
      )}
      {phase === "running" && (
        <>
          <div className="timer-display">{secondsLeft}s</div>
          <p style={{ textAlign: "center", fontSize: "2rem", fontWeight: 800 }}>{reps} stands</p>
          <button type="button" className="btn block" onClick={addRep}>
            +1 stand
          </button>
          <button type="button" className="btn secondary block" style={{ marginTop: "0.5rem" }} onClick={finishEarly}>
            Finish early
          </button>
        </>
      )}
      {phase === "done" && (
        <>
          <p className="success-msg">Total: {reps} stands in 30 seconds</p>
          {!scores && (
            <button type="button" className="btn block" disabled={saving} onClick={save}>
              {saving ? "Saving…" : "Save & see insight"}
            </button>
          )}
        </>
      )}
      {scores && (
        <div className="result-panel">
          <strong>{scores.label}</strong> — score {scores.score}/100
          <p>{scores.interpretation}</p>
          <p className="muted">Functional age estimate: {scores.functional_age}</p>
          <Link className="btn secondary" to="/dashboard">
            View trajectory
          </Link>
        </div>
      )}
    </section>
  );
}
