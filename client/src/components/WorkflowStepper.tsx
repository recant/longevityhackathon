import type { WorkflowStep } from "../workflow";

type Props = {
  steps: WorkflowStep[];
  currentIndex: number;
  completed: Set<string>;
};

export default function WorkflowStepper({ steps, currentIndex, completed }: Props) {
  return (
    <div className="workflow-stepper" aria-label="Check-in progress">
      {steps.map((step, i) => {
        const done = completed.has(step.id);
        const active = i === currentIndex;
        const upcoming = i > currentIndex && !done;
        return (
          <div
            key={step.id}
            className={`workflow-step${active ? " active" : ""}${done ? " done" : ""}${upcoming ? " upcoming" : ""}`}
          >
            <div className="workflow-step-num">{done ? "✓" : i + 1}</div>
            <div className="workflow-step-label">{step.title}</div>
          </div>
        );
      })}
    </div>
  );
}
