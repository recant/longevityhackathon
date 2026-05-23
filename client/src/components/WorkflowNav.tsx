type Props = {
  stepIndex: number;
  totalSteps: number;
  canContinue: boolean;
  continueLabel?: string;
  onBack: () => void;
  onContinue: () => void;
};

export default function WorkflowNav({
  stepIndex,
  totalSteps,
  canContinue,
  continueLabel = "Continue",
  onBack,
  onContinue,
}: Props) {
  const isFirst = stepIndex === 0;
  const isLast = stepIndex >= totalSteps - 1;

  return (
    <div className="workflow-nav">
      <button type="button" className="btn secondary" disabled={isFirst} onClick={onBack}>
        Back
      </button>
      <span className="muted workflow-progress-text">
        Step {stepIndex + 1} of {totalSteps}
      </span>
      <button type="button" className="btn" disabled={!canContinue} onClick={onContinue}>
        {isLast ? "Finish" : continueLabel}
      </button>
    </div>
  );
}
