import { useCallback, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { saveReaction, type CategoryScore } from "../api";

const TRIALS = 5;
type Phase = "idle" | "waiting" | "go" | "done";

export default function ReactionTest() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [trials, setTrials] = useState<number[]>([]);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [scores, setScores] = useState<CategoryScore | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const goAtRef = useRef(0);

  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const startTrial = useCallback(() => {
    clearTimer();
    setMessage("Wait for green…");
    setPhase("waiting");
    const delay = 1500 + Math.random() * 2500;
    timerRef.current = setTimeout(() => {
      goAtRef.current = performance.now();
      setPhase("go");
      setMessage("TAP!");
    }, delay);
  }, []);

  const onPadClick = () => {
    if (phase === "idle") {
      setTrials([]);
      setScores(null);
      startTrial();
      return;
    }
    if (phase === "waiting") {
      clearTimer();
      setPhase("idle");
      setMessage("Too soon — tap Start to try again.");
      return;
    }
    if (phase === "go") {
      const ms = performance.now() - goAtRef.current;
      const next = [...trials, Math.round(ms)];
      setTrials(next);
      if (next.length >= TRIALS) {
        setPhase("done");
        setMessage(`Nice! Median ${median(next)} ms`);
      } else {
        setMessage(`Trial ${next.length}/${TRIALS}`);
        setPhase("waiting");
        setTimeout(startTrial, 700);
      }
    }
  };

  const save = async () => {
    if (trials.length < TRIALS) return;
    setSaving(true);
    try {
      const res = await saveReaction(trials);
      setScores(res.scores);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="card">
      <h2>Cognitive Speed</h2>
      <p className="muted">
        Parent taps when the circle turns green. Encourage them — this is a mini activity, not an
        exam.
      </p>
      <div
        className={`reaction-pad ${phase === "go" ? "go" : "waiting"}`}
        onClick={onPadClick}
        role="button"
        tabIndex={0}
      >
        {phase === "idle" ? "Tap to start" : message}
      </div>
      {trials.length > 0 && (
        <p className="muted">Trials (ms): {trials.join(", ")}</p>
      )}
      {phase === "done" && !scores && (
        <button className="btn block" type="button" disabled={saving} onClick={save}>
          {saving ? "Saving…" : "Save & see insight"}
        </button>
      )}
      {scores && (
        <div className="result-panel">
          <strong>{scores.label}</strong> — score {scores.score}/100
          <p>{scores.interpretation}</p>
          <p className="muted">Functional age estimate: {scores.functional_age}</p>
          <Link className="btn secondary" to="/dashboard" style={{ marginTop: "0.75rem" }}>
            View trajectory
          </Link>
        </div>
      )}
    </section>
  );
}

function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
}
