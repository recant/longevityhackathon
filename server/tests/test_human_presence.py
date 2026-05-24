"""Human presence gate — unit tests (no video files required)."""

from types import SimpleNamespace

import pytest

from cv_analysis import ActionMismatchError
from human_presence import (
    HumanPresenceReport,
    _landmarks_show_person,
    detect_human_presence,
    require_human_in_video,
)


def _lm(vis: float):
    return SimpleNamespace(visibility=vis)


def _fake_landmarks(
    hip=0.9,
    shoulder=0.85,
    knee=0.8,
) -> list:
    n = 33
    landmarks = [_lm(0.1) for _ in range(n)]
    for i in (11, 12):
        landmarks[i] = _lm(shoulder)
    for i in (23, 24):
        landmarks[i] = _lm(hip)
    for i in (25, 26):
        landmarks[i] = _lm(knee)
    return landmarks


def test_landmarks_show_person_accepts_torso():
    ok, vis = _landmarks_show_person(_fake_landmarks())
    assert ok is True
    assert vis > 0.5


def test_landmarks_show_person_rejects_low_visibility():
    ok, _ = _landmarks_show_person(_fake_landmarks(hip=0.2, shoulder=0.2, knee=0.2))
    assert ok is False


def test_report_accepts_pose_threshold():
    report = HumanPresenceReport(
        human_present=True,
        frames_sampled=20,
        pose_hit_frames=5,
        pose_frame_ratio=0.25,
        mean_pose_visibility=0.7,
        hog_hit_frames=0,
        hog_frame_ratio=0.0,
        method="test",
        message="ok",
    )
    assert report.as_dict()["human_present"] is True


def test_require_human_skipped_when_gate_disabled(tmp_path):
    import human_presence

    assert human_presence.ENABLE_HUMAN_PRESENCE_GATE is False
    meta = require_human_in_video(tmp_path / "nope.mp4", "walk")
    assert meta["human_presence_gate"] == "disabled"


def test_require_human_raises_on_missing_file_when_enabled(tmp_path, monkeypatch):
    import human_presence

    monkeypatch.setattr(human_presence, "ENABLE_HUMAN_PRESENCE_GATE", True)
    missing = tmp_path / "nope.mp4"
    with pytest.raises(ActionMismatchError) as exc:
        require_human_in_video(missing, "walk")
    assert exc.value.detected == "other"


def test_detect_human_rejects_empty_video(tmp_path):
    import cv2
    import numpy as np

    path = tmp_path / "blank.mp4"
    h, w = 240, 320
    out = cv2.VideoWriter(str(path), cv2.VideoWriter_fourcc(*"mp4v"), 10.0, (w, h))
    for _ in range(8):
        out.write(np.zeros((h, w, 3), dtype=np.uint8))
    out.release()

    report = detect_human_presence(path)
    assert report.human_present is False
    assert report.pose_hit_frames == 0
