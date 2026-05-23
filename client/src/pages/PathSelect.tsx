import { useState } from "react";
import { getPath, setPath, type AssessmentPath } from "../path";

type Props = {
  value: AssessmentPath;
  onChange: (p: AssessmentPath) => void;
};

export default function PathSelect({ value, onChange }: Props) {
  const select = (p: AssessmentPath) => {
    setPath(p);
    onChange(p);
  };

  return (
    <section className="card">
      <h2>Choose assessment path</h2>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
        <button
          type="button"
          className="activity-tile"
          style={{
            border: value === "manual" ? "2px solid var(--primary)" : "2px solid transparent",
            cursor: "pointer",
            textAlign: "left",
            width: "100%",
            background: value === "manual" ? "var(--primary-soft)" : undefined,
          }}
          onClick={() => select("manual")}
        >
          <h3>At-home tests</h3>
          <p className="muted">Stopwatch walk, tap reaction, chair counter.</p>
        </button>
        <button
          type="button"
          className="activity-tile"
          style={{
            border: value === "vision" ? "2px solid var(--primary)" : "2px solid transparent",
            cursor: "pointer",
            textAlign: "left",
            width: "100%",
            background: value === "vision" ? "var(--primary-soft)" : undefined,
          }}
          onClick={() => select("vision")}
        >
          <h3>Video analysis</h3>
          <p className="muted">CV for walk &amp; chair; reaction test still available.</p>
        </button>
      </div>
    </section>
  );
}

export function useStoredPath(): [AssessmentPath, (p: AssessmentPath) => void] {
  const [path, setPathState] = useState<AssessmentPath>(getPath());
  const update = (p: AssessmentPath) => {
    setPath(p);
    setPathState(p);
  };
  return [path, update];
}
