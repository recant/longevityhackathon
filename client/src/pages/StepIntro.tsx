import type { AssessmentPath } from "../path";

export default function StepIntro({ path }: { path: AssessmentPath }) {
  if (path === "vision") {
    return (
      <div className="workflow-intro">
        <h2>Video analysis path</h2>
        <p className="muted">You will:</p>
        <ol className="workflow-list">
          <li>Set up your parent&apos;s profile</li>
          <li>Film a short <strong>walking</strong> clip (side view, ~10–15 seconds)</li>
          <li>Film <strong>chair stand</strong> reps for ~30 seconds</li>
          <li>Do a quick <strong>reaction</strong> tap test together</li>
          <li>Review trajectory and gentle recommendations</li>
        </ol>
        <p className="muted">Tip: good lighting, full body in frame, phone held steady.</p>
      </div>
    );
  }

  return (
    <div className="workflow-intro">
      <h2>At-home tests path</h2>
      <p className="muted">You will:</p>
      <ol className="workflow-list">
        <li>Set up your parent&apos;s profile</li>
        <li>
          <strong>Reaction</strong> — tap when the screen turns green (5 times)
        </li>
        <li>
          <strong>Walk</strong> — time a normal 10-foot walk (stopwatch with pause if needed)
        </li>
        <li>
          <strong>Chair stand</strong> — count stands in 30 seconds (CDC STEADI style)
        </li>
        <li>See results, trends, and conversation tips</li>
      </ol>
      <p className="muted">No video upload — just a hallway and a sturdy chair.</p>
    </div>
  );
}
