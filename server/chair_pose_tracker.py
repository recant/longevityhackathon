"""
Single chair-stand analysis via MediaPipe Pose Landmarker (full model).

Measures one sit-to-stand: rise time (quickness) and motion smoothness (knee trajectory).
Walking analysis in cv_analysis.py is intentionally unchanged.
"""

from __future__ import annotations

import urllib.request
from pathlib import Path
from typing import Any

import cv2
import numpy as np

MODEL_NAME = "pose_landmarker_full.task"
MODEL_URL = (
    "https://storage.googleapis.com/mediapipe-models/pose_landmarker/"
    "pose_landmarker_full/float16/1/pose_landmarker_full.task"
)

_L_HIP, _R_HIP = 23, 24
_L_KNEE, _R_KNEE = 25, 26
_L_ANKLE, _R_ANKLE = 27, 28

_landmarker_holder: dict[str, object] = {}


def close_chair_landmarker() -> None:
    lm = _landmarker_holder.pop("landmarker", None)
    if lm is not None:
        try:
            lm.close()  # type: ignore[union-attr]
        except Exception:
            pass


def resolve_pose_model_path() -> Path:
    server_dir = Path(__file__).resolve().parent
    candidates = [
        server_dir / "models" / MODEL_NAME,
        server_dir.parent.parent / MODEL_NAME,
    ]
    for path in candidates:
        if path.is_file():
            return path
    dest = server_dir / "models" / MODEL_NAME
    dest.parent.mkdir(parents=True, exist_ok=True)
    urllib.request.urlretrieve(MODEL_URL, dest)
    return dest


def _angle_at_joint(a: np.ndarray, b: np.ndarray, c: np.ndarray) -> float:
    ba = a - b
    bc = c - b
    cos = float(np.dot(ba, bc) / (np.linalg.norm(ba) * np.linalg.norm(bc) + 1e-9))
    return float(np.degrees(np.arccos(np.clip(cos, -1.0, 1.0))))


def _landmarks_to_metrics(
    landmarks, frame_h: int, frame_w: int
) -> tuple[float, float, float] | None:
    def pt(idx: int) -> np.ndarray:
        lm = landmarks[idx]
        return np.array([lm.x * frame_w, lm.y * frame_h], dtype=float)

    vis = [landmarks[i].visibility for i in (_L_HIP, _R_HIP, _L_KNEE, _R_KNEE, _L_ANKLE, _R_ANKLE)]
    if min(vis) < 0.35:
        return None

    l_hip, r_hip = pt(_L_HIP), pt(_R_HIP)
    hip_x_norm = ((l_hip[0] + r_hip[0]) / 2.0) / max(frame_w, 1)
    hip_y_norm = ((l_hip[1] + r_hip[1]) / 2.0) / max(frame_h, 1)
    knee_angles = [
        _angle_at_joint(pt(_L_HIP), pt(_L_KNEE), pt(_L_ANKLE)),
        _angle_at_joint(pt(_R_HIP), pt(_R_KNEE), pt(_R_ANKLE)),
    ]
    return hip_x_norm, hip_y_norm, float(np.mean(knee_angles))


def track_chair_pose_series(video_path: Path) -> tuple[list[float], list[float], float, int, int]:
    import mediapipe as mp
    from mediapipe.tasks import python
    from mediapipe.tasks.python import vision

    cap = cv2.VideoCapture(str(video_path))
    if not cap.isOpened():
        raise ValueError("Could not open video")

    fps = max(float(cap.get(cv2.CAP_PROP_FPS) or 30.0), 10.0)
    frame_w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH) or 640)
    frame_h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT) or 480)

    options = vision.PoseLandmarkerOptions(
        base_options=python.BaseOptions(model_asset_path=str(resolve_pose_model_path())),
        running_mode=vision.RunningMode.VIDEO,
    )
    close_chair_landmarker()
    landmarker = vision.PoseLandmarker.create_from_options(options)
    _landmarker_holder["landmarker"] = landmarker

    hip_x: list[float] = []
    hip_y: list[float] = []
    knee_deg: list[float] = []
    frame_idx = 0

    while True:
        ok, frame = cap.read()
        if not ok:
            break
        frame_idx += 1
        if frame_idx % 2 != 0:
            continue

        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
        ts_ms = int((frame_idx / fps) * 1000)
        result = landmarker.detect_for_video(mp_image, ts_ms)
        if not result.pose_landmarks:
            continue
        metrics = _landmarks_to_metrics(result.pose_landmarks[0], frame_h, frame_w)
        if metrics is None:
            continue
        hx, hy, ka = metrics
        hip_x.append(hx)
        hip_y.append(hy)
        knee_deg.append(ka)

    cap.release()
    close_chair_landmarker()

    if len(knee_deg) < 10:
        raise ValueError("Could not track pose for chair stand — keep full body in frame")

    return hip_x, hip_y, knee_deg, fps, frame_w, frame_h


def _smooth_series(arr: np.ndarray, window: int = 5) -> np.ndarray:
    if len(arr) < window:
        return arr
    kernel = np.ones(window) / window
    return np.convolve(arr, kernel, mode="same")


def analyze_single_stand_metrics(
    hip_y: list[float],
    knee_deg: list[float],
    fps: float,
    *,
    sit_knee: float = 118.0,
    stand_knee: float = 152.0,
) -> dict[str, Any]:
    """First complete sit-to-stand: rise duration and smoothness (0–1)."""
    knee = _smooth_series(np.array(knee_deg, dtype=float))
    hip = _smooth_series(np.array(hip_y, dtype=float))
    sample_rate = fps / 2.0

    knee_range = float(np.max(knee) - np.min(knee))
    if knee_range < 35:
        return {
            "stand_detected": False,
            "rise_time_seconds": None,
            "smoothness_index": None,
            "knee_range_deg": round(knee_range, 1),
        }

    peak_i = int(np.argmax(knee))
    search_lo = max(0, peak_i - int(sample_rate * 3))
    sit_i = search_lo + int(np.argmin(knee[search_lo : peak_i + 1]))
    rise_start = max(0, sit_i)
    rise_end = peak_i
    if rise_end <= rise_start:
        return {
            "stand_detected": False,
            "rise_time_seconds": None,
            "smoothness_index": None,
            "knee_range_deg": round(knee_range, 1),
        }

    rise_time = (rise_end - rise_start) / sample_rate
    segment = knee[rise_start : rise_end + 1]
    if len(segment) < 4:
        return {
            "stand_detected": False,
            "rise_time_seconds": None,
            "smoothness_index": None,
            "knee_range_deg": round(knee_range, 1),
        }

    vel = np.diff(segment)
    # Coefficient-of-variation of knee velocity (gentler than jerk — fewer 0% readings)
    cv_vel = float(np.std(vel) / (np.mean(np.abs(vel)) + 1e-6))
    smoothness_raw = 1.0 - min(cv_vel / 3.5, 0.85)
    smoothness = round(max(0.4, smoothness_raw), 3)
    hip_rise = float(hip[sit_i] - hip[rise_end]) if rise_end < len(hip) else 0.0

    return {
        "stand_detected": True,
        "rise_time_seconds": round(max(rise_time, 0.35), 2),
        "smoothness_index": smoothness,
        "knee_range_deg": round(knee_range, 1),
        "hip_rise_norm": round(hip_rise, 4),
        "rise_frame_start": rise_start,
        "rise_frame_end": rise_end,
    }


def analyze_single_chair_stand_video(video_path: Path) -> dict[str, Any]:
    _hx, hip_y, knee_deg, fps, _fw, _fh = track_chair_pose_series(video_path)
    metrics = analyze_single_stand_metrics(hip_y, knee_deg, fps)
    duration = len(knee_deg) / (fps / 2)
    return {
        "method": "mediapipe_pose_landmarker",
        "video_duration_sec": round(duration, 1),
        "frames_tracked": len(knee_deg),
        "knee_angle_mean_deg": round(float(np.mean(knee_deg)), 1),
        **metrics,
    }
