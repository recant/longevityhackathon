"""
Reference-based activity classification (walk side-view vs chair sit-to-stand).

Uses biomechanical prototype profiles — not full RL, but the same idea as matching
clips to known gait / sit-stand signatures. Prototypes are built from synthetic side-view
models and can be extended with real reference clips via scripts/build_activity_references.py.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

import numpy as np

# Gaussian prototypes: feature -> (mean, std)
# Tuned for side-view phone video at ~2–4 m distance.
WALK_PROFILE: dict[str, tuple[float, float]] = {
    "hip_x_span": (0.12, 0.14),
    "hip_y_std": (0.018, 0.020),
    "knee_range": (40.0, 32.0),
    "knee_std": (14.0, 12.0),
    "walk_layout_ratio": (0.32, 0.30),
    "chair_rise_norm": (0.02, 0.040),
    "lateral_drift": (0.30, 0.20),
    "lower_blob_motion": (0.020, 0.020),
    "pose_frame_ratio": (0.30, 0.30),
}

CHAIR_PROFILE: dict[str, tuple[float, float]] = {
    "hip_x_span": (0.05, 0.055),
    "hip_y_std": (0.042, 0.040),
    "knee_range": (52.0, 38.0),
    "knee_std": (16.0, 14.0),
    "walk_layout_ratio": (0.14, 0.18),
    "chair_rise_norm": (0.08, 0.070),
    "lateral_drift": (0.14, 0.14),
    "lower_blob_motion": (0.012, 0.018),
    "pose_frame_ratio": (0.35, 0.30),
}

OTHER_PROFILE: dict[str, tuple[float, float]] = {
    "hip_x_span": (0.50, 0.35),
    "hip_y_std": (0.008, 0.012),
    "knee_range": (10.0, 18.0),
    "knee_std": (4.0, 8.0),
    "walk_layout_ratio": (0.02, 0.06),
    "chair_rise_norm": (0.01, 0.025),
    "lateral_drift": (0.82, 0.20),
    "lower_blob_motion": (0.003, 0.008),
    "pose_frame_ratio": (0.04, 0.10),
}

MIN_WALK_SCORE = 0.34
MIN_CHAIR_SCORE = 0.32
SCORE_MARGIN = 0.07
MIN_COMPETING_SCORE = 0.38
OTHER_REJECT_MIN = 0.55


def _gauss_score(value: float, mean: float, std: float) -> float:
    if std <= 1e-6:
        return 1.0 if abs(value - mean) < 1e-3 else 0.0
    z = (value - mean) / std
    return float(np.exp(-0.5 * z * z))


def _profile_likelihood(features: dict[str, float], profile: dict[str, tuple[float, float]]) -> float:
    scores = []
    for key, (mu, sigma) in profile.items():
        if key not in features:
            continue
        scores.append(_gauss_score(float(features[key]), mu, sigma))
    if not scores:
        return 0.0
    return float(np.mean(scores))


def build_signature(
    *,
    hip_x: list[float] | None = None,
    hip_y: list[float] | None = None,
    knee_deg: list[float] | None = None,
    blob: dict[str, float] | None = None,
    motion: dict[str, float] | None = None,
    pose_frame_ratio: float = 0.0,
) -> dict[str, float]:
    """Aggregate pose + blob + motion into a fixed feature set for prototype matching."""
    blob = blob or {}
    motion = motion or {}
    sig: dict[str, float] = {
        "walk_layout_ratio": float(blob.get("walk_layout_ratio", 0.0)),
        "chair_rise_norm": float(blob.get("chair_rise_norm", 0.0)),
        "lower_blob_motion": float(blob.get("lower_blob_motion_norm", 0.0)),
        "lateral_drift": float(motion.get("lateral_drift_ratio", blob.get("main_h_span_norm", 0.0) * 0.5)),
        "pose_frame_ratio": float(pose_frame_ratio),
    }

    if hip_x and len(hip_x) >= 4:
        sig["hip_x_span"] = float(max(hip_x) - min(hip_x))
    else:
        sig["hip_x_span"] = float(motion.get("h_span_norm", 0.0))

    if hip_y and len(hip_y) >= 4:
        sig["hip_y_std"] = float(np.std(hip_y))
        if blob.get("chair_rise_norm") is None or blob.get("chair_rise_norm", 0) < 0.02:
            early = float(np.mean(hip_y[: max(len(hip_y) // 3, 2)]))
            late = float(np.mean(hip_y[-max(len(hip_y) // 3, 2) :]))
            sig["chair_rise_norm"] = max(sig.get("chair_rise_norm", 0.0), max(0.0, early - late))
    else:
        sig["hip_y_std"] = float(motion.get("v_span_norm", 0.0) * 0.5)

    if knee_deg and len(knee_deg) >= 4:
        knee = np.array(knee_deg, dtype=float)
        sig["knee_range"] = float(np.max(knee) - np.min(knee))
        sig["knee_std"] = float(np.std(knee))
    elif blob.get("knee_range") is not None:
        sig["knee_range"] = float(blob["knee_range"])
        sig["knee_std"] = float(blob.get("knee_std", 10.0))
        if blob.get("hip_x_span") is not None:
            sig["hip_x_span"] = float(blob["hip_x_span"])
        if blob.get("hip_y_std") is not None:
            sig["hip_y_std"] = float(blob["hip_y_std"])
    else:
        sig["knee_range"] = 20.0
        sig["knee_std"] = 8.0

    return sig


def score_activity_signature(features: dict[str, float]) -> dict[str, Any]:
    walk = _profile_likelihood(features, WALK_PROFILE)
    chair = _profile_likelihood(features, CHAIR_PROFILE)
    other = _profile_likelihood(features, OTHER_PROFILE)
    best = max(
        (("walk", walk), ("chair", chair), ("other", other)),
        key=lambda x: x[1],
    )[0]
    return {
        "detected": best,
        "walk_score": round(walk, 3),
        "chair_score": round(chair, 3),
        "other_score": round(other, 3),
        "signature": {k: round(v, 4) if isinstance(v, float) else v for k, v in features.items()},
    }


def classify_video_activity(
    video_path: Path,
    *,
    blob: dict[str, float] | None = None,
    motion: dict[str, float] | None = None,
    pose_frame_ratio: float = 0.0,
    hip_x: list[float] | None = None,
    hip_y: list[float] | None = None,
    knee_deg: list[float] | None = None,
) -> dict[str, Any]:
    """Score video against walk / chair / other reference prototypes."""
    if hip_x is None or hip_y is None or knee_deg is None:
        try:
            from chair_pose_tracker import track_chair_pose_series

            hip_x, hip_y, knee_deg, _fps, _fw, _fh = track_chair_pose_series(video_path)
            pose_frame_ratio = max(pose_frame_ratio, min(len(knee_deg) / 30.0, 1.0))
        except Exception:
            hip_x, hip_y, knee_deg = None, None, None

    sig = build_signature(
        hip_x=hip_x,
        hip_y=hip_y,
        knee_deg=knee_deg,
        blob=blob,
        motion=motion,
        pose_frame_ratio=pose_frame_ratio,
    )
    return score_activity_signature(sig)


def enforce_expected_activity(expected: str, ref: dict[str, Any]) -> None:
    """Raise ActionMismatchError when reference scores disagree with the test type."""
    from cv_analysis import ActionMismatchError

    walk_s = float(ref["walk_score"])
    chair_s = float(ref["chair_score"])
    other_s = float(ref["other_score"])
    detected = ref["detected"]

    if expected == "walk":
        if walk_s < MIN_WALK_SCORE and max(chair_s, other_s) > walk_s + 0.12:
            raise ActionMismatchError(
                "walk",
                detected,  # type: ignore[arg-type]
                f"This doesn't match a side-view walking pattern (walk confidence {walk_s:.0%}). "
                "Film 10–15 seconds walking across the frame, full body visible from the side.",
            )
        if chair_s >= MIN_COMPETING_SCORE and chair_s >= walk_s + SCORE_MARGIN:
            raise ActionMismatchError(
                "walk",
                "chair",
                "Movement looks more like a chair stand than walking. "
                "Use the walk test and cross the room on camera.",
            )
        if other_s >= OTHER_REJECT_MIN and other_s >= max(walk_s, chair_s) + 0.15:
            raise ActionMismatchError(
                "walk",
                "other",
                "This doesn't look like a person walking (objects or camera pan). "
                "Film your parent walking, not toys or still scenes.",
            )

    if expected == "chair":
        if chair_s < MIN_CHAIR_SCORE and max(walk_s, other_s) > chair_s + 0.12:
            raise ActionMismatchError(
                "chair",
                detected,  # type: ignore[arg-type]
                f"This doesn't match a sit-to-stand pattern (chair confidence {chair_s:.0%}). "
                "Film seated, then one full stand — knees and hips visible.",
            )
        if walk_s >= MIN_COMPETING_SCORE and walk_s >= chair_s + SCORE_MARGIN:
            raise ActionMismatchError(
                "chair",
                "walk",
                "Movement looks more like walking than a single chair stand. "
                "Stay in one place for the chair test.",
            )
        if other_s >= OTHER_REJECT_MIN and other_s >= max(walk_s, chair_s) + 0.15:
            raise ActionMismatchError(
                "chair",
                "other",
                "This doesn't look like a sit-to-stand (wrong subject or no rise). "
                "Film one chair stand with the full body in frame.",
            )
