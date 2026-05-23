import type { AssessmentPath } from "./path";

export type StepId =
  | "intro"
  | "profile"
  | "reaction"
  | "walk"
  | "chair"
  | "cvWalk"
  | "cvChair"
  | "results";

export type WorkflowStep = {
  id: StepId;
  title: string;
  subtitle: string;
};

export const MANUAL_WORKFLOW: WorkflowStep[] = [
  {
    id: "intro",
    title: "Welcome",
    subtitle: "At-home tests — about 10 minutes together",
  },
  {
    id: "profile",
    title: "Profile",
    subtitle: "Age & sex for fair comparisons",
  },
  {
    id: "reaction",
    title: "Reaction",
    subtitle: "Cognitive speed — tap when green",
  },
  {
    id: "walk",
    title: "Walk",
    subtitle: "10-foot timed walk",
  },
  {
    id: "chair",
    title: "Chair stand",
    subtitle: "30-second strength check",
  },
  {
    id: "results",
    title: "Results",
    subtitle: "Trajectory & next steps",
  },
];

export const VISION_WORKFLOW: WorkflowStep[] = [
  {
    id: "intro",
    title: "Welcome",
    subtitle: "Video analysis — film two short clips",
  },
  {
    id: "profile",
    title: "Profile",
    subtitle: "Age & sex for fair comparisons",
  },
  {
    id: "cvWalk",
    title: "Video walk",
    subtitle: "Gait speed & symmetry from video",
  },
  {
    id: "cvChair",
    title: "Video chair",
    subtitle: "Count stands from video",
  },
  {
    id: "reaction",
    title: "Reaction",
    subtitle: "Quick tap test (no video)",
  },
  {
    id: "results",
    title: "Results",
    subtitle: "Trajectory & next steps",
  },
];

export function getWorkflow(path: AssessmentPath): WorkflowStep[] {
  return path === "vision" ? VISION_WORKFLOW : MANUAL_WORKFLOW;
}

const COMPLETED_KEY = "kinspan_completed";

export function loadCompleted(): Set<StepId> {
  try {
    const raw = localStorage.getItem(COMPLETED_KEY);
    return new Set(raw ? (JSON.parse(raw) as StepId[]) : []);
  } catch {
    return new Set();
  }
}

export function saveCompleted(set: Set<StepId>) {
  localStorage.setItem(COMPLETED_KEY, JSON.stringify([...set]));
}

export function markStepComplete(set: Set<StepId>, id: StepId): Set<StepId> {
  const next = new Set(set);
  next.add(id);
  saveCompleted(next);
  return next;
}

export function resetWorkflowProgress() {
  localStorage.removeItem(COMPLETED_KEY);
  localStorage.removeItem("kinspan_workflow_step");
}
