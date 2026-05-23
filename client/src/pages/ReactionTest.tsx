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

  const resetTest = useCallback(() => {
    clearTimer();
    setPhase("idle");
    setTrials([]);
    setMessage("");
    setScores(null);
    setSaving(false);
  }, []);

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
    if (phase === "done") return;
    if (phase === "idle") {
      setTrials([]);
      setScores(null);
      startTrial();
      return;
    }
    if (phase === "waiting") {
      clearTimer();
      setPhase("idle");
      setMessage("Too soon — use Redo test or tap the pad to start over.");
      return;
    }
    if (phase === "go") {
      const ms = performance.now() - goAtRef.current;
      const next = [...trials, Math.round(ms)];
      setTrials(next);
      if (next.length >= TRIALS) {
        setPhase("done");
        setMessage(`All done! Median ${median(next)} ms — save or redo.`);
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

  const showRedo = trials.length > 0 || phase === "done" || scores !== null;

  return (
    <section className="card">
      <h2>Cognitive Speed</h2>
      <p className="muted">
        Parent taps when the circle turns green (simple reaction time). Scored vs age norms from
        Woods et al. (2015). A mini activity, not a dementia test.
      </p>
      <div
        className={`reaction-pad ${phase === "go" ? "go" : "waiting"}`}
        onClick={onPadClick}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === " " && onPadClick()}
      >
        {phase === "idle" && !message ? "Tap to start" : message || "Tap to start"}
      </div>
      {trials.length > 0 && (
        <p className="muted">Trials (ms): {trials.join(", ")}</p>
      )}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
        {phase === "done" && !scores && (
          <button className="btn" type="button" disabled={saving} onClick={save}>
            {saving ? "Saving…" : "Save & see insight"}
          </button>
        )}
        {showRedo && (
          <button className="btn secondary" type="button" onClick={resetTest}>
            Redo test
          </button>
        )}
      </div>
      {scores && (
        <div className="result-panel">
          <strong>{scores.label}</strong> — score {scores.score}/100
          <p>{scores.interpretation}</p>
          <p className="muted">Functional age estimate: {scores.functional_age}</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginTop: "0.75rem" }}>
            <Link className="btn secondary" to="/dashboard">
              View trajectory
            </Link>
            <button className="btn secondary" type="button" onClick={resetTest}>
              Redo test
            </button>
          </div>
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
