import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import WorkflowNav from "../components/WorkflowNav";
import WorkflowStepper from "../components/WorkflowStepper";
import { getPath, setPath, type AssessmentPath } from "../path";
import {
  getWorkflow,
  loadCompleted,
  markStepComplete,
  resetWorkflowProgress,
  type StepId,
} from "../workflow";
import ChairStandTest from "./ChairStandTest";
import Dashboard from "./Dashboard";
import Profile from "./Profile";
import ReactionTest from "./ReactionTest";
import StepIntro from "./StepIntro";
import VideoChair from "./VideoChair";
import VideoWalk from "./VideoWalk";
import WalkTest from "./WalkTest";

const STEP_KEY = "kinspan_workflow_step";

export default function GuidedCheckIn() {
  const navigate = useNavigate();
  const path = getPath();
  const steps = useMemo(() => getWorkflow(path), [path]);
  const [stepIndex, setStepIndex] = useState(() => {
    const saved = localStorage.getItem(STEP_KEY);
    const n = saved ? parseInt(saved, 10) : 0;
    return Number.isFinite(n) && n >= 0 && n < steps.length ? n : 0;
  });
  const [completed, setCompleted] = useState(loadCompleted);

  const current = steps[stepIndex];

  useEffect(() => {
    localStorage.setItem(STEP_KEY, String(stepIndex));
  }, [stepIndex]);

  const complete = useCallback((id: StepId) => {
    setCompleted((prev) => markStepComplete(prev, id));
  }, []);

  const onProfileSaved = useCallback(() => complete("profile"), [complete]);

  const canContinue = useMemo(() => {
    if (!current) return false;
    if (current.id === "intro") return true;
    if (current.id === "results") return true;
    return completed.has(current.id);
  }, [current, completed]);

  const goBack = () => setStepIndex((i) => Math.max(0, i - 1));
  const goNext = () => {
    if (stepIndex >= steps.length - 1) {
      navigate("/");
      return;
    }
    setStepIndex((i) => i + 1);
  };

  const restart = () => {
    resetWorkflowProgress();
    setCompleted(new Set());
    setStepIndex(0);
  };

  const switchPath = (p: AssessmentPath) => {
    setPath(p);
    restart();
    window.location.reload();
  };

  return (
    <>
      <section className="card workflow-path-banner">
        <p className="muted" style={{ margin: 0 }}>
          <strong>{path === "manual" ? "At-home tests" : "Video analysis"}</strong> guided check-in
        </p>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginTop: "0.5rem" }}>
          <button type="button" className="btn secondary" onClick={() => switchPath(path === "manual" ? "vision" : "manual")}>
            Switch path
          </button>
          <button type="button" className="btn secondary" onClick={restart}>
            Restart workflow
          </button>
          <Link className="btn secondary" to="/">
            Home
          </Link>
        </div>
      </section>

      <WorkflowStepper steps={steps} currentIndex={stepIndex} completed={completed} />

      <section className="card workflow-step-card">
        <p className="workflow-step-kicker">{current?.subtitle}</p>

        {current?.id === "intro" && <StepIntro path={path} />}
        {current?.id === "profile" && (
          <Profile embedded onSaved={onProfileSaved} />
        )}
        {current?.id === "reaction" && (
          <ReactionTest embedded onSaved={() => complete("reaction")} />
        )}
        {current?.id === "walk" && <WalkTest embedded onSaved={() => complete("walk")} />}
        {current?.id === "chair" && (
          <ChairStandTest embedded onSaved={() => complete("chair")} />
        )}
        {current?.id === "cvWalk" && (
          <VideoWalk embedded onSaved={() => complete("cvWalk")} />
        )}
        {current?.id === "cvChair" && (
          <VideoChair embedded onSaved={() => complete("cvChair")} />
        )}
        {current?.id === "results" && <Dashboard embedded />}
      </section>

      {!completed.has(current?.id ?? "") && current?.id !== "intro" && current?.id !== "results" && (
        <p className="muted workflow-hint">Complete this step to unlock Continue.</p>
      )}

      <WorkflowNav
        stepIndex={stepIndex}
        totalSteps={steps.length}
        canContinue={canContinue}
        continueLabel={current?.id === "results" ? "Done" : "Continue"}
        onBack={goBack}
        onContinue={goNext}
      />
    </>
  );
}
