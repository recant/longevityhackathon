import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import type { CategoryScore } from "../api";

type Props = { embedded?: boolean; onSaved?: () => void };

export default function VideoChair({ embedded, onSaved }: Props = {}) {
  const [uploading, setUploading] = useState(false);
  const [scores, setScores] = useState<CategoryScore | null>(null);
  const [cv, setCv] = useState<Record<string, unknown> | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);

  const onFile = (f: File | undefined) => {
    if (!f) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setScores(null);
  };

  const upload = async () => {
    if (!file) return;
    setUploading(true);
    const form = new FormData();
    form.append("video", file, "chair.webm");
    try {
      const res = await fetch("/api/assessments/cv/chair-stand", { method: "POST", body: form });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setScores(data.scores);
      setCv(data.cv);
      onSaved?.();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const Tag = embedded ? "div" : "section";
  return (
    <Tag className={embedded ? "" : "card"}>
      <h2>Video — chair stand</h2>
      <p className="muted">
        Film one sit-to-stand in place (~5–10 seconds). We measure how quick and smooth the rise is.
        Walking clips are rejected.
      </p>
      <div className="video-wrap">
        <video src={preview ?? undefined} playsInline muted controls={!!preview} />
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="video/*"
        capture="environment"
        style={{ display: "none" }}
        onChange={(e) => onFile(e.target.files?.[0])}
      />
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
        <button type="button" className="btn secondary" onClick={() => fileRef.current?.click()}>
          Record / choose video
        </button>
        <button type="button" className="btn" disabled={!file || uploading} onClick={upload}>
          {uploading ? "Analyzing…" : "Analyze chair"}
        </button>
      </div>
      {scores && (
        <div className="result-panel">
          <strong>{scores.label}</strong> — {scores.score}/100
          <p>{scores.interpretation}</p>
          {cv && (
            <p className="muted">
              Rise {String(cv.rise_time_seconds)}s · smoothness {String(
                Math.round(Number(cv.smoothness_index) * 100)
              )}
              % ({String(cv.method)})
            </p>
          )}
          {!embedded && (
            <Link className="btn secondary" to="/dashboard" style={{ marginTop: "0.75rem" }}>
              View trajectory
            </Link>
          )}
        </div>
      )}
    </Tag>
  );
}
