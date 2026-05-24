#!/usr/bin/env python3
"""
Optional: refine walk/chair reference profiles from labeled example videos.

Place clips in:
  server/data/reference/walk/*.mp4
  server/data/reference/chair/*.mp4

Then run:
  python scripts/build_activity_references.py

This prints mean/std per feature so you can paste into activity_reference.py.
Full RL training is not required — this is prototype matching.
"""

from __future__ import annotations

import sys
from pathlib import Path

import numpy as np

SERVER = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(SERVER))

from activity_reference import build_signature, classify_video_activity  # noqa: E402
from cv_analysis import analyze_blob_motion, _track_body, _motion_features  # noqa: E402


def _features_from_video(path: Path) -> dict[str, float]:
    blob = analyze_blob_motion(path)
    track = _track_body(path)
    feat = _motion_features(track)
    ref = classify_video_activity(
        path,
        blob=blob,
        motion=feat,
        pose_frame_ratio=track.pose_frame_ratio,
    )
    return ref["signature"]


def _aggregate(dir_path: Path) -> dict[str, tuple[float, float]]:
    rows: list[dict[str, float]] = []
    for p in sorted(dir_path.glob("*")):
        if p.suffix.lower() not in (".mp4", ".webm", ".mov"):
            continue
        try:
            rows.append(_features_from_video(p))
            print(f"  ok {p.name}")
        except Exception as e:
            print(f"  skip {p.name}: {e}")
    if not rows:
        return {}
    keys = rows[0].keys()
    out: dict[str, tuple[float, float]] = {}
    for k in keys:
        vals = [r[k] for r in rows if k in r]
        out[k] = (float(np.mean(vals)), float(max(np.std(vals), 1e-3)))
    return out


def main() -> None:
    base = SERVER / "data" / "reference"
    for label in ("walk", "chair"):
        d = base / label
        print(f"\n=== {label} ({d}) ===")
        if not d.is_dir():
            print("  (no folder — add side-view walk or chair-stand clips)")
            continue
        stats = _aggregate(d)
        for k, (mu, sigma) in sorted(stats.items()):
            print(f'    "{k}": ({mu:.4f}, {sigma:.4f}),')


if __name__ == "__main__":
    main()
