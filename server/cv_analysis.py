"""
Computer-vision movement analysis from phone video (OpenCV).

Estimates gait timing, speed, step cadence, and chair-stand reps from motion tracking.
Optional MediaPipe pose improves accuracy when installed.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

import cv2
import numpy as np

FEET_10_M = 3.048


def _smooth(series: list[float], window: int = 5) -> np.ndarray:
    if len(series) < 3:
        return np.array(series, dtype=float)
    arr = np.array(series, dtype=float)
    w = min(window, len(arr))
    kernel = np.ones(w) / w
    return np.convolve(arr, kernel, mode="same")


def _largest_centroid(mask: np.ndarray) -> tuple[float, float] | None:
    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        return None
    c = max(contours, key=cv2.contourArea)
    if cv2.contourArea(c) < 500:
        return None
    m = cv2.moments(c)
    if m["m00"] == 0:
        return None
    return m["m10"] / m["m00"], m["m01"] / m["m00"]


def _pose_hip_y(frame: np.ndarray) -> float | None:
    try:
        import mediapipe as mp  # type: ignore

        if not hasattr(_pose_hip_y, "_landmarker"):
            _pose_hip_y._landmarker = mp.solutions.pose.Pose(
                static_image_mode=False,
                model_complexity=1,
                min_detection_confidence=0.5,
                min_tracking_confidence=0.5,
            )

        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        res = _pose_hip_y._landmarker.process(rgb)
        if not res.pose_landmarks:
            return None
        lm = res.pose_landmarks.landmark
        ly = lm[mp.solutions.pose.PoseLandmark.LEFT_HIP].y
        ry = lm[mp.solutions.pose.PoseLandmark.RIGHT_HIP].y
        return (ly + ry) / 2 * frame.shape[0]
    except Exception:
        return None


def analyze_walk_video(
    video_path: Path,
    distance_meters: float = FEET_10_M,
) -> dict[str, Any]:
    """
    Track body motion to estimate walk duration, speed, cadence, symmetry proxy.
    Film walking across frame (side or diagonal view works best).
    """
    cap = cv2.VideoCapture(str(video_path))
    if not cap.isOpened():
        raise ValueError("Could not open video")

    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    fps = max(float(fps), 10.0)
    subtractor = cv2.createBackgroundSubtractorMOG2(history=120, varThreshold=40, detectShadows=False)

    xs: list[float] = []
    ys: list[float] = []
    hip_ys: list[float] = []
    frame_idx = 0
    use_pose = False

    while True:
        ok, frame = cap.read()
        if not ok:
            break
        frame_idx += 1
        if frame_idx % 2 == 0:
            continue

        hip = _pose_hip_y(frame)
        if hip is not None:
            use_pose = True
            hip_ys.append(hip)
            ys.append(hip)
        else:
            fg = subtractor.apply(frame)
            fg = cv2.morphologyEx(fg, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
            pt = _largest_centroid(fg)
            if pt:
                xs.append(pt[0])
                ys.append(pt[1])

    cap.release()

    if len(xs) < 8 and len(hip_ys) < 8:
        raise ValueError("Could not track enough movement — refilm with full body in frame")

    track_y = hip_ys if use_pose else ys
    track_x = xs if xs else list(range(len(track_y)))

    if len(track_x) < 8:
        track_x = list(np.linspace(0, 1, len(track_y)))

    duration_sec = len(track_y) / (fps / 2)
    dx = abs(track_x[-1] - track_x[0]) if len(track_x) > 1 else 1.0
    active = dx > (np.std(track_x) if len(track_x) > 2 else 1) * 0.5

    if not active and use_pose:
        y_arr = np.array(track_y)
        active = np.std(y_arr) > 3

    time_seconds = max(duration_sec * 0.85, 2.0) if active else duration_sec
    speed_mps = distance_meters / time_seconds if time_seconds > 0 else 0.0

    y_smooth = _smooth(track_y)
    peaks: list[int] = []
    for i in range(2, len(y_smooth) - 2):
        if y_smooth[i] < y_smooth[i - 1] and y_smooth[i] < y_smooth[i + 1]:
            if not peaks or i - peaks[-1] > (fps / 2) * 0.25:
                peaks.append(i)

    step_count = max(len(peaks), 2)
    cadence_spm = (step_count / time_seconds) * 60 if time_seconds else 0

    if len(peaks) >= 4:
        intervals = np.diff(peaks)
        symmetry = 1.0 - min(float(np.std(intervals) / (np.mean(intervals) + 1e-6)), 1.0)
    else:
        symmetry = 0.65

    stride_regularity = 1.0 - min(float(np.std(np.diff(y_smooth)) / (np.mean(np.abs(np.diff(y_smooth))) + 1e-6)), 1.0)
    steadiness = (symmetry * 0.5 + stride_regularity * 0.5) * 100

    return {
        "method": "mediapipe_pose" if use_pose else "opencv_motion",
        "time_seconds": round(time_seconds, 2),
        "speed_mps": round(speed_mps, 3),
        "distance_meters": distance_meters,
        "cadence_steps_per_min": round(cadence_spm, 1),
        "step_count_est": step_count,
        "symmetry_index": round(symmetry, 3),
        "steadiness_index": round(steadiness / 100, 3),
        "frames_tracked": len(track_y),
    }


def analyze_chair_video(video_path: Path) -> dict[str, Any]:
    """Count sit-to-stand cycles from vertical body motion."""
    cap = cv2.VideoCapture(str(video_path))
    if not cap.isOpened():
        raise ValueError("Could not open video")

    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    fps = max(float(fps), 10.0)
    subtractor = cv2.createBackgroundSubtractorMOG2(history=90, varThreshold=35, detectShadows=False)

    ys: list[float] = []
    frame_idx = 0
    use_pose = False

    while True:
        ok, frame = cap.read()
        if not ok:
            break
        frame_idx += 1
        if frame_idx % 2:
            continue

        hip = _pose_hip_y(frame)
        if hip is not None:
            use_pose = True
            ys.append(hip)
        else:
            fg = subtractor.apply(frame)
            pt = _largest_centroid(fg)
            if pt:
                ys.append(pt[1])

    cap.release()

    if len(ys) < 10:
        raise ValueError("Could not track body — keep full torso in frame")

    y_smooth = _smooth(ys, 7)
    y_range = float(np.max(y_smooth) - np.min(y_smooth))
    if y_range < 5:
        raise ValueError("Movement too small — film a clear sit-to-stand")

    # Standing = lower y value (higher on screen)
    threshold = np.percentile(y_smooth, 40)
    stands = 0
    in_stand = y_smooth[0] < threshold
    min_gap = int(fps * 0.4)

    last_peak = -min_gap
    for i in range(1, len(y_smooth)):
        rising = y_smooth[i] < threshold and not in_stand
        if rising and i - last_peak > min_gap:
            stands += 1
            last_peak = i
        in_stand = y_smooth[i] < threshold

    duration = len(ys) / (fps / 2)
    return {
        "method": "mediapipe_pose" if use_pose else "opencv_motion",
        "reps_30s_est": stands,
        "video_duration_sec": round(duration, 1),
        "avg_seconds_per_stand": round(duration / stands, 2) if stands else None,
        "frames_tracked": len(ys),
    }
