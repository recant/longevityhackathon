export type AssessmentPath = "manual" | "vision";

const KEY = "kinspan_path";

export function getPath(): AssessmentPath {
  const v = localStorage.getItem(KEY);
  return v === "vision" ? "vision" : "manual";
}

export function setPath(path: AssessmentPath) {
  localStorage.setItem(KEY, path);
}
