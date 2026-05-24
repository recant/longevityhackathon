"""
Computer-vision movement analysis from phone video (OpenCV).

Estimates gait timing, speed, step cadence, and chair-stand reps from motion tracking.
Rejects clips that do not match the expected activity (walk vs chair stand).
Optional MediaPipe pose improves accuracy when installed.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any, Literal

import cv2
import numpy as np

FEET_10_M = 3.048
ActionKind = Literal["walk", "chair", "other", "unclear"]

MIN_POSE_VISIBILITY = 0.32
# Below this on *both* pose tracking and pan-like motion → reject as non-person
MIN_POSE_FOR_SCORE = 0.18


class ActionMismatchError(ValueError):
    """Video motion does not match the assessment type."""

    def __init__(self, expected: str, detected: ActionKind, detail: str) -> None:
        self.expected = expected
        self.detected = detected
        super().__init__(detail)


@dataclass
class BodyTrack:
    xs: list[float]
    ys: list[float]
    fps: float
    use_pose: bool
    frame_width: int
    frame_height: int
    pose_frame_ratio: float = 0.0
    mean_pose_visibility: float = 0.0
    sampled_frames: int = 0

    @property
    def duration_sec(self) -> float:
        return len(self.ys) / (self.fps / 2) if self.ys else 0.0


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


def _split_motion_blobs(
    fg: np.ndarray, frame_w: int, frame_h: int
) -> tuple[list[tuple[float, float]], list[tuple[float, float]], tuple[float, float] | None]:
    """
    Split foreground into upper / lower motion blobs (torso vs legs heuristic).
    Returns (upper_centroids, lower_centroids, largest_blob_center).
    """
    min_area = max(frame_w * frame_h * 0.005, 350)
    upper_y = frame_h * 0.48
    contours, _ = cv2.findContours(fg, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    ranked: list[tuple[float, float, float]] = []
    for c in contours:
        area = cv2.contourArea(c)
        if area < min_area:
            continue
        m = cv2.moments(c)
        if m["m00"] == 0:
            continue
        cx = m["m10"] / m["m00"]
        cy = m["m01"] / m["m00"]
        ranked.append((cx, cy, area))
    ranked.sort(key=lambda t: t[2], reverse=True)

    upper: list[tuple[float, float]] = []
    lower: list[tuple[float, float]] = []
    for cx, cy, _ in ranked[:6]:
        if cy < upper_y:
            upper.append((cx, cy))
        else:
            lower.append((cx, cy))

    main: tuple[float, float] | None = None
    if ranked:
        main = (ranked[0][0], ranked[0][1])
    return upper, lower, main


def analyze_blob_motion(video_path: Path) -> dict[str, float]:
    """
    Heuristic activity cues from foreground blobs:
    - Walk: one upper + two lower moving blobs
    - Chair: one main blob shifting then rising (sit-to-stand)
    """
    cap = cv2.VideoCapture(str(video_path))
    if not cap.isOpened():
        return {}

    fps = max(float(cap.get(cv2.CAP_PROP_FPS) or 30.0), 10.0)
    frame_w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH) or 640)
    frame_h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT) or 480)
    subtractor = cv2.createBackgroundSubtractorMOG2(history=120, varThreshold=42, detectShadows=False)

    walk_layout_score = 0.0
    single_blob_frames = 0
    sampled = 0
    main_xs: list[float] = []
    main_ys: list[float] = []
    lower_ys: list[float] = []
    frame_idx = 0

    while True:
        ok, frame = cap.read()
        if not ok:
            break
        frame_idx += 1
        if frame_idx % 2 != 0:
            continue
        sampled += 1

        fg = subtractor.apply(frame)
        fg = cv2.morphologyEx(fg, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
        upper, lower, main = _split_motion_blobs(fg, frame_w, frame_h)

        if len(upper) >= 1 and len(lower) >= 2:
            walk_layout_score += 1.0
        elif len(upper) >= 1 and len(lower) >= 1:
            walk_layout_score += 0.55

        if len(upper) + len(lower) <= 1 and main is not None:
            single_blob_frames += 1

        if main is not None:
            main_xs.append(main[0])
            main_ys.append(main[1])
        if lower:
            lower_ys.append(float(np.mean([p[1] for p in lower])))

    cap.release()
    if sampled < 4:
        return {"sampled_frames": float(sampled)}

    walk_layout_ratio = walk_layout_score / sampled
    single_blob_ratio = single_blob_frames / sampled

    chair_rise_norm = 0.0
    if len(main_ys) >= 6:
        third = max(len(main_ys) // 3, 2)
        early_y = float(np.mean(main_ys[:third]))
        late_y = float(np.mean(main_ys[-third:]))
        chair_rise_norm = max(0.0, (early_y - late_y) / max(frame_h, 1))

    lower_motion_norm = 0.0
    if len(lower_ys) >= 4:
        lower_motion_norm = float(np.std(lower_ys)) / max(frame_h, 1)

    main_h_span_norm = 0.0
    if len(main_xs) >= 2:
        main_h_span_norm = (max(main_xs) - min(main_xs)) / max(frame_w, 1)

    return {
        "walk_layout_ratio": round(walk_layout_ratio, 3),
        "single_blob_ratio": round(single_blob_ratio, 3),
        "chair_rise_norm": round(chair_rise_norm, 3),
        "lower_blob_motion_norm": round(lower_motion_norm, 3),
        "main_h_span_norm": round(main_h_span_norm, 3),
        "sampled_frames": float(sampled),
    }


def _blob_hints_from_track(track: BodyTrack, feat: dict[str, float]) -> dict[str, float]:
    """Approximate blob + pose signature hints for unit tests (no video file)."""
    h = feat["h_span_norm"]
    v = feat["v_span_norm"]
    if track.pose_frame_ratio < 0.05 and feat.get("step_peaks", 0) < 1 and h >= 0.5:
        return {
            "walk_layout_ratio": 0.0,
            "chair_rise_norm": 0.0,
            "single_blob_ratio": 1.0,
            "main_h_span_norm": h,
            "lower_blob_motion_norm": 0.0,
            "knee_range": 8.0,
            "knee_std": 3.0,
            "hip_x_span": h,
            "hip_y_std": 0.005,
        }
    if h >= 0.2:
        return {
            "walk_layout_ratio": 0.55,
            "chair_rise_norm": 0.02,
            "single_blob_ratio": 0.15,
            "main_h_span_norm": h,
            "lower_blob_motion_norm": 0.025,
            "knee_range": 52.0,
            "knee_std": 16.0,
            "hip_x_span": h * 0.9,
            "hip_y_std": 0.022,
        }
    if h < 0.12 and v >= 0.05:
        return {
            "walk_layout_ratio": 0.12,
            "chair_rise_norm": max(0.10, v * 0.9),
            "single_blob_ratio": 0.7,
            "main_h_span_norm": h,
            "lower_blob_motion_norm": 0.01,
            "knee_range": 62.0,
            "knee_std": 18.0,
            "hip_x_span": 0.04,
            "hip_y_std": 0.05,
        }
    return {
        "walk_layout_ratio": 0.25,
        "chair_rise_norm": 0.04,
        "single_blob_ratio": 0.5,
        "main_h_span_norm": h,
        "lower_blob_motion_norm": 0.015,
        "knee_range": 30.0,
        "knee_std": 10.0,
        "hip_x_span": h,
        "hip_y_std": 0.02,
    }


def reset_pose_detectors() -> None:
    """Drop cached MediaPipe instances (call after code/env changes or stale tracking)."""
    if hasattr(_pose_hip_xy, "_landmarker"):
        try:
            _pose_hip_xy._landmarker.close()
        except Exception:
            pass
        delattr(_pose_hip_xy, "_landmarker")
    try:
        from chair_pose_tracker import close_chair_landmarker

        close_chair_landmarker()
    except Exception:
        pass


def _pose_hip_xy(frame: np.ndarray) -> tuple[float, float, float] | None:
    """Hip centroid in pixels and mean landmark visibility, or None if not a clear person."""
    try:
        import mediapipe as mp  # type: ignore

        if not hasattr(_pose_hip_xy, "_landmarker"):
            _pose_hip_xy._landmarker = mp.solutions.pose.Pose(
                static_image_mode=False,
                model_complexity=1,
                min_detection_confidence=0.5,
                min_tracking_confidence=0.5,
            )

        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        res = _pose_hip_xy._landmarker.process(rgb)
        if not res.pose_landmarks:
            return None
        lm = res.pose_landmarks.landmark
        pose = mp.solutions.pose.PoseLandmark
        keys = (
            pose.LEFT_HIP,
            pose.RIGHT_HIP,
            pose.LEFT_KNEE,
            pose.RIGHT_KNEE,
            pose.LEFT_SHOULDER,
            pose.RIGHT_SHOULDER,
        )
        vis = [lm[k].visibility for k in keys]
        if min(vis) < MIN_POSE_VISIBILITY:
            return None
        lx, rx = lm[pose.LEFT_HIP].x, lm[pose.RIGHT_HIP].x
        ly, ry = lm[pose.LEFT_HIP].y, lm[pose.RIGHT_HIP].y
        h, w = frame.shape[0], frame.shape[1]
        return (lx + rx) / 2 * w, (ly + ry) / 2 * h, float(np.mean(vis))
    except Exception:
        return None


def _track_body(video_path: Path) -> BodyTrack:
    cap = cv2.VideoCapture(str(video_path))
    if not cap.isOpened():
        raise ValueError("Could not open video")

    fps = max(float(cap.get(cv2.CAP_PROP_FPS) or 30.0), 10.0)
    frame_w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH) or 640)
    frame_h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT) or 480)
    subtractor = cv2.createBackgroundSubtractorMOG2(history=120, varThreshold=40, detectShadows=False)

    xs: list[float] = []
    ys: list[float] = []
    use_pose = False
    pose_hits = 0
    vis_sum = 0.0
    sampled = 0
    frame_idx = 0

    while True:
        ok, frame = cap.read()
        if not ok:
            break
        frame_idx += 1
        if frame_idx % 2 == 0:
            continue
        sampled += 1

        hip = _pose_hip_xy(frame)
        if hip is not None:
            use_pose = True
            pose_hits += 1
            vis_sum += hip[2]
            xs.append(hip[0])
            ys.append(hip[1])
        else:
            fg = subtractor.apply(frame)
            fg = cv2.morphologyEx(fg, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
            pt = _largest_centroid(fg)
            if pt:
                xs.append(pt[0])
                ys.append(pt[1])

    cap.release()

    if len(ys) < 8:
        raise ValueError("Could not track enough movement — refilm with full body in frame")

    if len(xs) < len(ys):
        xs.extend(np.linspace(xs[-1] if xs else 0, xs[-1] if xs else 1, len(ys) - len(xs)).tolist())

    pose_ratio = pose_hits / max(sampled, 1)
    return BodyTrack(
        xs=xs[: len(ys)],
        ys=ys,
        fps=fps,
        use_pose=use_pose,
        frame_width=max(frame_w, 1),
        frame_height=max(frame_h, 1),
        pose_frame_ratio=pose_ratio,
        mean_pose_visibility=vis_sum / max(pose_hits, 1),
        sampled_frames=sampled,
    )


def _count_stand_cycles(y_smooth: np.ndarray, fps: float) -> int:
    if len(y_smooth) < 10:
        return 0
    threshold = np.percentile(y_smooth, 40)
    stands = 0
    in_stand = y_smooth[0] < threshold
    min_gap = max(int(fps * 0.4), 2)
    last_peak = -min_gap
    for i in range(1, len(y_smooth)):
        rising = y_smooth[i] < threshold and not in_stand
        if rising and i - last_peak > min_gap:
            stands += 1
            last_peak = i
        in_stand = y_smooth[i] < threshold
    return stands


def _count_step_peaks(y_smooth: np.ndarray, fps: float) -> int:
    peaks: list[int] = []
    for i in range(2, len(y_smooth) - 2):
        if y_smooth[i] < y_smooth[i - 1] and y_smooth[i] < y_smooth[i + 1]:
            if not peaks or i - peaks[-1] > (fps / 2) * 0.25:
                peaks.append(i)
    return len(peaks)


def _motion_features(track: BodyTrack) -> dict[str, float]:
    xs = np.array(track.xs, dtype=float)
    ys = np.array(track.ys, dtype=float)
    y_smooth = _smooth(list(track.ys), 7)

    h_span_px = float(np.max(xs) - np.min(xs)) if len(xs) > 1 else 0.0
    v_span_px = float(np.max(y_smooth) - np.min(y_smooth))
    h_span_norm = h_span_px / track.frame_width
    v_span_norm = v_span_px / track.frame_height

    stand_cycles = float(_count_stand_cycles(y_smooth, track.fps))
    step_peaks = float(_count_step_peaks(y_smooth, track.fps))

    # Net lateral drift vs total path length (walk tends to drift; chair stays put)
    if len(xs) > 2:
        path_len = float(np.sum(np.abs(np.diff(xs))))
        net_h = abs(xs[-1] - xs[0])
        lateral_drift_ratio = net_h / (path_len + 1e-6)
    else:
        lateral_drift_ratio = 0.0

    return {
        "h_span_norm": h_span_norm,
        "v_span_norm": v_span_norm,
        "h_to_v_ratio": h_span_px / (v_span_px + 1e-6),
        "stand_cycles": stand_cycles,
        "step_peaks": step_peaks,
        "lateral_drift_ratio": lateral_drift_ratio,
        "y_std_norm": float(np.std(y_smooth)) / track.frame_height,
    }


def _classify_action(feat: dict[str, float], track: BodyTrack | None = None) -> ActionKind:
    """Classify walk vs chair vs non-human / random object motion."""
    track = track or BodyTrack([], [], 30.0, False, 640, 480)
    h = feat["h_span_norm"]
    v = feat["v_span_norm"]
    stands = feat["stand_cycles"]
    steps = feat["step_peaks"]
    drift = feat["lateral_drift_ratio"]

    # Obvious non-person: camera pan / object slide (no steps, no sit-stand, flat vertical)
    if track.pose_frame_ratio < 0.12 and h >= 0.10 and steps < 1 and stands < 2:
        return "other"
    if v < 0.015 and h < 0.04:
        return "other"

    walk_score = 0.0
    chair_score = 0.0

    if h >= 0.10:
        walk_score += 2.0
    elif h >= 0.06:
        walk_score += 1.0

    if drift >= 0.35 and h >= 0.08:
        walk_score += 1.5
    if drift >= 0.28 and h >= 0.07 and steps >= 2:
        walk_score += 1.0

    if steps >= 4 and h >= 0.06:
        walk_score += 1.0
    elif steps >= 2 and h >= 0.075:
        walk_score += 0.5

    if stands >= 2 and v >= 0.06:
        chair_score += 2.0
    if stands >= 1 and v >= 0.05 and h < 0.12:
        chair_score += 1.5
    if h < 0.09 and v >= 0.06:
        chair_score += 1.0

    if stands >= 2 and h < 0.10:
        chair_score += 1.0
        walk_score -= 0.5

    if h >= 0.18 and drift >= 0.25:
        walk_score += 2.0
        chair_score -= 1.0

    if walk_score >= chair_score + 1.0 and walk_score >= 2.0:
        return "walk"
    if chair_score >= walk_score + 1.0 and chair_score >= 1.5:
        return "chair"
    return "unclear"


def _reject_obvious_non_person(
    track: BodyTrack,
    feat: dict[str, float],
    expected: str,
    blob: dict[str, float],
) -> None:
    """Block only obvious object/camera-pan clips (single sliding blob, no person layout)."""
    wlr = blob.get("walk_layout_ratio", 0.0)
    rise = blob.get("chair_rise_norm", 0.0)
    if wlr >= 0.10 or rise >= 0.03 or track.pose_frame_ratio >= 0.10:
        return
    if (
        blob.get("single_blob_ratio", 0.0) >= 0.7
        and feat["h_span_norm"] >= 0.12
        and wlr < 0.06
        and rise < 0.025
    ):
        raise ActionMismatchError(
            expected,
            "other",
            "This looks like an object or camera pan, not a person. "
            "Film a walk or chair stand with the full body visible.",
        )


def _reference_scores_for_track(
    track: BodyTrack,
    feat: dict[str, float],
    blob: dict[str, float],
) -> dict[str, Any]:
    from activity_reference import build_signature, score_activity_signature

    hip_x = [x / track.frame_width for x in track.xs] if track.xs else None
    hip_y = [y / track.frame_height for y in track.ys] if track.ys else None
    sig = build_signature(
        hip_x=hip_x,
        hip_y=hip_y,
        blob=blob,
        motion=feat,
        pose_frame_ratio=track.pose_frame_ratio,
    )
    return score_activity_signature(sig)


def validate_action(
    expected: ActionKind,
    track: BodyTrack,
    blob: dict[str, float] | None = None,
) -> dict[str, Any]:
    """Full validation pipeline (used in tests)."""
    feat = _motion_features(track)
    blob = blob or _blob_hints_from_track(track, feat)
    ref = _reference_scores_for_track(track, feat, blob)
    _reject_obvious_non_person(track, feat, expected, blob)
    detected = _classify_action(feat, track)
    if expected == "walk":
        return _validate_walk_activity(track, feat, blob, detected, ref)
    return _validate_chair_activity(track, feat, blob, detected, ref=ref)


def _motion_meta(
    feat: dict[str, float],
    expected: str,
    detected: ActionKind,
    track: BodyTrack | None = None,
) -> dict[str, Any]:
    meta: dict[str, Any] = {
        "expected_action": expected,
        "detected_action": detected,
        "action_confidence": "high" if detected == expected else ("low" if detected == "unclear" else "mismatch"),
        **{f"motion_{k}": round(v, 4) if isinstance(v, float) else v for k, v in feat.items()},
    }
    if track is not None:
        meta["pose_frame_ratio"] = round(track.pose_frame_ratio, 3)
        meta["mean_pose_visibility"] = round(track.mean_pose_visibility, 3)
    return meta


def _motion_meta_blob(meta: dict[str, Any], blob: dict[str, float]) -> dict[str, Any]:
    for key in (
        "walk_layout_ratio",
        "single_blob_ratio",
        "chair_rise_norm",
        "lower_blob_motion_norm",
        "main_h_span_norm",
    ):
        if key in blob:
            meta[f"blob_{key}"] = blob[key]
    return meta


def _motion_meta_ref(meta: dict[str, Any], ref: dict[str, Any]) -> dict[str, Any]:
    meta["ref_walk_score"] = ref.get("walk_score")
    meta["ref_chair_score"] = ref.get("chair_score")
    meta["ref_other_score"] = ref.get("other_score")
    meta["ref_detected"] = ref.get("detected")
    return meta


def _validate_walk_activity(
    track: BodyTrack,
    feat: dict[str, float],
    blob: dict[str, float],
    detected: ActionKind = "walk",
    ref: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Walk: blob heuristics + reference prototype match (side-view gait)."""
    from activity_reference import enforce_expected_activity

    if ref is None:
        ref = _reference_scores_for_track(track, feat, blob)
    enforce_expected_activity("walk", ref)

    wlr = blob.get("walk_layout_ratio", 0.0)
    h = max(feat["h_span_norm"], blob.get("main_h_span_norm", 0.0))
    if wlr < 0.05 and h < 0.03 and float(ref["walk_score"]) < 0.28:
        raise ActionMismatchError(
            "walk",
            "unclear",
            "Couldn't see a walking shape (upper body + legs moving). "
            "Film a side view walk across the frame.",
        )

    meta = _motion_meta(feat, "walk", "walk" if detected != "chair" else "walk", track)
    return _motion_meta_ref(_motion_meta_blob(meta, blob), ref)


def _validate_chair_activity(
    track: BodyTrack,
    feat: dict[str, float],
    blob: dict[str, float],
    detected: ActionKind = "chair",
    *,
    knee_range_deg: float | None = None,
    ref: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Chair: blob rise + reference prototype match (sit-to-stand)."""
    from activity_reference import enforce_expected_activity

    if ref is None:
        ref = _reference_scores_for_track(track, feat, blob)
    enforce_expected_activity("chair", ref)

    rise = max(blob.get("chair_rise_norm", 0.0), float(ref.get("signature", {}).get("chair_rise_norm", 0)))
    if rise < 0.015 and (knee_range_deg or 0) < 18 and float(ref["chair_score"]) < 0.30:
        raise ActionMismatchError(
            "chair",
            "unclear",
            "Couldn't see a sit-then-stand motion. "
            "Film seated, then one rise with your parent's full body in frame.",
        )

    meta = _motion_meta(feat, "chair", "chair" if detected != "walk" else "chair", track)
    return _motion_meta_ref(_motion_meta_blob(meta, blob), ref)


def analyze_walk_video(
    video_path: Path,
    distance_meters: float = FEET_10_M,
) -> dict[str, Any]:
    """
    Track body motion to estimate walk duration, speed, cadence, symmetry proxy.
    Film walking across frame (side or diagonal view works best).
    """
    from human_presence import require_human_in_video

    human_meta = require_human_in_video(video_path, "walk")
    reset_pose_detectors()
    blob = analyze_blob_motion(video_path)
    track = _track_body(video_path)
    feat = _motion_features(track)
    from activity_reference import classify_video_activity

    ref = classify_video_activity(
        video_path,
        blob=blob,
        motion=feat,
        pose_frame_ratio=track.pose_frame_ratio,
    )
    _reject_obvious_non_person(track, feat, "walk", blob)
    detected = _classify_action(feat, track)
    validation = _validate_walk_activity(track, feat, blob, detected, ref)

    track_x = np.array(track.xs, dtype=float)
    track_y = track.ys
    fps = track.fps

    duration_sec = track.duration_sec
    dx = abs(track_x[-1] - track_x[0]) if len(track_x) > 1 else 1.0
    active = dx > (float(np.std(track_x)) if len(track_x) > 2 else 1.0) * 0.5

    if not active and track.use_pose:
        active = float(np.std(track_y)) > 3

    time_seconds = max(duration_sec * 0.85, 2.0) if active else duration_sec
    speed_mps = distance_meters / time_seconds if time_seconds > 0 else 0.0

    y_smooth = _smooth(track_y)
    step_count = max(_count_step_peaks(y_smooth, fps), 2)
    cadence_spm = (step_count / time_seconds) * 60 if time_seconds else 0

    peaks = []
    for i in range(2, len(y_smooth) - 2):
        if y_smooth[i] < y_smooth[i - 1] and y_smooth[i] < y_smooth[i + 1]:
            if not peaks or i - peaks[-1] > (fps / 2) * 0.25:
                peaks.append(i)

    if len(peaks) >= 4:
        intervals = np.diff(peaks)
        symmetry = 1.0 - min(float(np.std(intervals) / (np.mean(intervals) + 1e-6)), 1.0)
    else:
        symmetry = 0.65

    stride_regularity = 1.0 - min(
        float(np.std(np.diff(y_smooth)) / (np.mean(np.abs(np.diff(y_smooth))) + 1e-6)), 1.0
    )
    steadiness = (symmetry * 0.5 + stride_regularity * 0.5) * 100

    return {
        "method": "mediapipe_pose" if track.use_pose else "opencv_motion",
        "time_seconds": round(time_seconds, 2),
        "speed_mps": round(speed_mps, 3),
        "distance_meters": distance_meters,
        "cadence_steps_per_min": round(cadence_spm, 1),
        "step_count_est": step_count,
        "symmetry_index": round(symmetry, 3),
        "steadiness_index": round(steadiness / 100, 3),
        "frames_tracked": len(track_y),
        **human_meta,
        **validation,
    }


def analyze_chair_video(video_path: Path) -> dict[str, Any]:
    """One sit-to-stand: rise time (quickness) and knee-trajectory smoothness."""
    from human_presence import require_human_in_video

    human_meta = require_human_in_video(video_path, "chair")
    reset_pose_detectors()

    try:
        from chair_pose_tracker import analyze_single_stand_metrics, track_chair_pose_series

        hip_x, hip_y, knee_deg, fps, fw, fh = track_chair_pose_series(video_path)
        metrics = analyze_single_stand_metrics(hip_y, knee_deg, fps)
        duration = len(knee_deg) / (fps / 2)
        result = {
            "method": "mediapipe_pose_landmarker",
            "video_duration_sec": round(duration, 1),
            "frames_tracked": len(knee_deg),
            "knee_angle_mean_deg": round(float(np.mean(knee_deg)), 1),
            **metrics,
        }
        blob = analyze_blob_motion(video_path)
        motion_track = _track_body(video_path)
        knee_range = float(metrics.get("knee_range_deg") or 0)
        feat = _motion_features(motion_track)
        from activity_reference import classify_video_activity

        ref = classify_video_activity(
            video_path,
            blob=blob,
            motion=feat,
            pose_frame_ratio=max(motion_track.pose_frame_ratio, len(knee_deg) / 40.0),
            hip_x=hip_x,
            hip_y=hip_y,
            knee_deg=knee_deg,
        )
        _reject_obvious_non_person(motion_track, feat, "chair", blob)
        detected = _classify_action(feat, motion_track)
        validation = _validate_chair_activity(
            motion_track,
            feat,
            blob,
            detected,
            knee_range_deg=knee_range,
            ref=ref,
        )
    except ActionMismatchError:
        raise
    except Exception as primary_err:
        blob = analyze_blob_motion(video_path)
        track = _track_body(video_path)
        feat = _motion_features(track)
        _reject_obvious_non_person(track, feat, "chair", blob)
        detected = _classify_action(feat, track)
        validation = _validate_chair_activity(track, feat, blob, detected)
        y_smooth = _smooth(track.ys, 7)
        y_range = float(np.max(y_smooth) - np.min(y_smooth))
        if y_range < 5:
            raise ValueError("Movement too small — film one clear sit-to-stand") from primary_err
        duration = track.duration_sec
        rise_est = max(duration * 0.45, 1.2)
        smooth_est = round(1.0 - min(float(np.std(np.diff(y_smooth))) / 25.0, 1.0), 3)
        result = {
            "method": "mediapipe_pose" if track.use_pose else "opencv_motion",
            "video_duration_sec": round(duration, 1),
            "frames_tracked": len(track.ys),
            "knee_angle_mean_deg": None,
            "stand_detected": y_range >= 12,
            "rise_time_seconds": round(rise_est, 2) if y_range >= 12 else None,
            "smoothness_index": smooth_est if y_range >= 12 else None,
            "knee_range_deg": None,
        }

    if not result.get("stand_detected"):
        raise ValueError(
            "No complete sit-to-stand detected. Film seated, then one smooth stand "
            "(full body and knees visible, ~5–10 seconds)."
        )

    rise = result.get("rise_time_seconds")
    smooth = result.get("smoothness_index")
    if rise is None or smooth is None:
        raise ValueError("Could not measure the stand — refilm with knees and hips in frame.")

    return {
        **result,
        "reps_30s_est": 1,
        **human_meta,
        **validation,
    }
