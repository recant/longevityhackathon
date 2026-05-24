"""
Human recognition gate for KinSpan video assessments.

Samples frames from an upload and requires evidence of a person (pose landmarks)
before walk/chair scoring runs. Rejects object slides, empty scenes, and camera pans
with no body in frame.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any

import cv2
import numpy as np

# MediaPipe Pose Landmarker indices (same topology as BlazePose)
_L_SHOULDER, _R_SHOULDER = 11, 12
_L_HIP, _R_HIP = 23, 24
_L_KNEE, _R_KNEE = 25, 26

MIN_TORSO_VISIBILITY = 0.32
MIN_POSE_FRAME_RATIO = 0.18
MIN_POSE_HIT_FRAMES = 4
MIN_HOG_FRAME_RATIO = 0.28
MIN_HOG_HIT_FRAMES = 5
MAX_SAMPLES = 40

# Set True to block CV scoring when no person is detected in sampled frames.
ENABLE_HUMAN_PRESENCE_GATE = False


@dataclass
class HumanPresenceReport:
    human_present: bool
    frames_sampled: int
    pose_hit_frames: int
    pose_frame_ratio: float
    mean_pose_visibility: float
    hog_hit_frames: int
    hog_frame_ratio: float
    method: str
    message: str

    def as_dict(self) -> dict[str, Any]:
        return {
            "human_present": self.human_present,
            "frames_sampled": self.frames_sampled,
            "pose_hit_frames": self.pose_hit_frames,
            "pose_frame_ratio": round(self.pose_frame_ratio, 3),
            "mean_pose_visibility": round(self.mean_pose_visibility, 3),
            "hog_hit_frames": self.hog_hit_frames,
            "hog_frame_ratio": round(self.hog_frame_ratio, 3),
            "human_detection_method": self.method,
            "human_detection_note": self.message,
        }


def _landmarks_show_person(landmarks, *, min_vis: float = MIN_TORSO_VISIBILITY) -> tuple[bool, float]:
    """True when hips and at least one shoulder are visible with stable confidence."""
    idx = (_L_SHOULDER, _R_SHOULDER, _L_HIP, _R_HIP, _L_KNEE, _R_KNEE)
    vis = [landmarks[i].visibility for i in idx]
    mean_vis = float(np.mean(vis))
    hips_ok = min(landmarks[_L_HIP].visibility, landmarks[_R_HIP].visibility) >= min_vis
    shoulders = (
        landmarks[_L_SHOULDER].visibility >= min_vis * 0.85
        or landmarks[_R_SHOULDER].visibility >= min_vis * 0.85
    )
    knees_ok = (
        landmarks[_L_KNEE].visibility >= min_vis * 0.75
        or landmarks[_R_KNEE].visibility >= min_vis * 0.75
    )
    return hips_ok and shoulders and knees_ok, mean_vis


def _sample_frame_indices(total: int, max_samples: int = MAX_SAMPLES) -> list[int]:
    if total <= 0:
        return []
    if total <= max_samples:
        return list(range(0, total, max(1, total // max(max_samples, 1))))
    step = total / max_samples
    return [min(int(i * step), total - 1) for i in range(max_samples)]


def _read_sampled_frames(video_path: Path, indices: list[int]) -> list[np.ndarray]:
    cap = cv2.VideoCapture(str(video_path))
    if not cap.isOpened():
        return []
    frames: list[np.ndarray] = []
    want = set(indices)
    idx = 0
    while True:
        ok, frame = cap.read()
        if not ok:
            break
        if idx in want:
            frames.append(frame)
        idx += 1
    cap.release()
    return frames


def _scan_pose_landmarker(frames: list[np.ndarray], fps: float) -> tuple[int, float, int]:
    import mediapipe as mp
    from mediapipe.tasks import python
    from mediapipe.tasks.python import vision

    from chair_pose_tracker import close_chair_landmarker, resolve_pose_model_path

    options = vision.PoseLandmarkerOptions(
        base_options=python.BaseOptions(model_asset_path=str(resolve_pose_model_path())),
        running_mode=vision.RunningMode.VIDEO,
    )
    close_chair_landmarker()
    landmarker = vision.PoseLandmarker.create_from_options(options)
    hits = 0
    vis_sum = 0.0
    try:
        for i, frame in enumerate(frames):
            rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
            ts_ms = int((i / max(fps, 10.0)) * 1000)
            result = landmarker.detect_for_video(mp_image, ts_ms)
            if not result.pose_landmarks:
                continue
            ok, vis = _landmarks_show_person(result.pose_landmarks[0])
            if ok:
                hits += 1
                vis_sum += vis
    finally:
        close_chair_landmarker()
    return hits, vis_sum, len(frames)


def _scan_legacy_pose(frames: list[np.ndarray]) -> tuple[int, float, int]:
    import mediapipe as mp

    pose = mp.solutions.pose.Pose(
        static_image_mode=True,
        model_complexity=1,
        min_detection_confidence=0.5,
        min_tracking_confidence=0.5,
    )
    hits = 0
    vis_sum = 0.0
    try:
        for frame in frames:
            rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            res = pose.process(rgb)
            if not res.pose_landmarks:
                continue
            lm = res.pose_landmarks.landmark
            plm = mp.solutions.pose.PoseLandmark
            vis = [
                lm[plm.LEFT_HIP].visibility,
                lm[plm.RIGHT_HIP].visibility,
                lm[plm.LEFT_SHOULDER].visibility,
                lm[plm.RIGHT_SHOULDER].visibility,
                lm[plm.LEFT_KNEE].visibility,
                lm[plm.RIGHT_KNEE].visibility,
            ]
            mean_vis = float(np.mean(vis))
            hips_ok = min(lm[plm.LEFT_HIP].visibility, lm[plm.RIGHT_HIP].visibility) >= MIN_TORSO_VISIBILITY
            shoulders = (
                lm[plm.LEFT_SHOULDER].visibility >= MIN_TORSO_VISIBILITY * 0.85
                or lm[plm.RIGHT_SHOULDER].visibility >= MIN_TORSO_VISIBILITY * 0.85
            )
            knees = (
                lm[plm.LEFT_KNEE].visibility >= MIN_TORSO_VISIBILITY * 0.75
                or lm[plm.RIGHT_KNEE].visibility >= MIN_TORSO_VISIBILITY * 0.75
            )
            if hips_ok and shoulders and knees:
                hits += 1
                vis_sum += mean_vis
    finally:
        pose.close()
    return hits, vis_sum, len(frames)


def _scan_hog_person(frames: list[np.ndarray]) -> tuple[int, int]:
    hog = cv2.HOGDescriptor()
    hog.setSVMDetector(cv2.HOGDescriptor_getDefaultPeopleDetector())
    hits = 0
    for frame in frames:
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        rects, weights = hog.detectMultiScale(
            gray,
            winStride=(8, 8),
            padding=(16, 16),
            scale=1.04,
        )
        if len(rects) == 0:
            continue
        if len(weights) and float(weights[0]) >= 0.45:
            hits += 1
        elif len(rects) > 0:
            hits += 1
    return hits, len(frames)


def detect_human_presence(video_path: Path, *, max_samples: int = MAX_SAMPLES) -> HumanPresenceReport:
    """
    Sample video frames and estimate whether a person is visible.

    Primary: MediaPipe pose (torso + legs). Fallback: OpenCV HOG person detector.
    """
    cap = cv2.VideoCapture(str(video_path))
    if not cap.isOpened():
        return HumanPresenceReport(
            human_present=False,
            frames_sampled=0,
            pose_hit_frames=0,
            pose_frame_ratio=0.0,
            mean_pose_visibility=0.0,
            hog_hit_frames=0,
            hog_frame_ratio=0.0,
            method="none",
            message="Could not open video file.",
        )
    total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
    fps = max(float(cap.get(cv2.CAP_PROP_FPS) or 30.0), 10.0)
    cap.release()

    indices = _sample_frame_indices(max(total, 1), max_samples)
    frames = _read_sampled_frames(video_path, indices)
    if not frames:
        return HumanPresenceReport(
            human_present=False,
            frames_sampled=0,
            pose_hit_frames=0,
            pose_frame_ratio=0.0,
            mean_pose_visibility=0.0,
            hog_hit_frames=0,
            hog_frame_ratio=0.0,
            method="none",
            message="Video has no readable frames.",
        )

    n = len(frames)
    pose_hits = 0
    vis_sum = 0.0
    method = "opencv_hog"

    try:
        pose_hits, vis_sum, _ = _scan_pose_landmarker(frames, fps)
        method = "mediapipe_pose_landmarker"
    except Exception:
        try:
            pose_hits, vis_sum, _ = _scan_legacy_pose(frames)
            method = "mediapipe_pose"
        except Exception:
            pose_hits = 0
            vis_sum = 0.0

    hog_hits, _ = _scan_hog_person(frames)
    pose_ratio = pose_hits / n
    hog_ratio = hog_hits / n
    mean_vis = vis_sum / max(pose_hits, 1)

    pose_ok = pose_hits >= MIN_POSE_HIT_FRAMES and pose_ratio >= MIN_POSE_FRAME_RATIO
    hog_ok = hog_hits >= MIN_HOG_HIT_FRAMES and hog_ratio >= MIN_HOG_FRAME_RATIO
    # Allow HOG only when pose is weak but non-zero (partial body / distance)
    human_present = pose_ok or (hog_ok and pose_ratio >= 0.06)

    if human_present:
        msg = (
            f"Person detected in ~{pose_hits}/{n} sampled frames "
            f"(pose {pose_ratio:.0%}, method {method})."
        )
    else:
        msg = (
            "No person detected in this video. Film a walk or chair stand with the "
            "full body visible — we could not find stable human pose landmarks "
            f"({pose_hits}/{n} pose frames, {hog_hits}/{n} HOG hits)."
        )

    return HumanPresenceReport(
        human_present=human_present,
        frames_sampled=n,
        pose_hit_frames=pose_hits,
        pose_frame_ratio=pose_ratio,
        mean_pose_visibility=mean_vis if pose_hits else 0.0,
        hog_hit_frames=hog_hits,
        hog_frame_ratio=hog_ratio,
        method=method,
        message=msg,
    )


def require_human_in_video(video_path: Path, expected: str) -> dict[str, Any]:
    """Raise ActionMismatchError when the clip does not contain a scorable person."""
    if not ENABLE_HUMAN_PRESENCE_GATE:
        return {"human_presence_gate": "disabled"}

    from cv_analysis import ActionMismatchError

    report = detect_human_presence(video_path)
    if not report.human_present:
        raise ActionMismatchError(
            expected,
            "other",
            report.message,
        )
    return report.as_dict()
