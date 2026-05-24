"""Tests for single chair-stand pose metrics (no video file)."""

import numpy as np

from chair_pose_tracker import analyze_single_stand_metrics


def _synthetic_single_stand() -> tuple[list[float], list[float]]:
    hip: list[float] = []
    knee: list[float] = []
    for i in range(40):
        hip.append(0.72)
        knee.append(95.0)
    for i in range(18):
        t = (i + 1) / 18
        hip.append(0.72 - 0.12 * t)
        knee.append(95.0 + 70.0 * t)
    for _ in range(12):
        hip.append(0.58)
        knee.append(168.0)
    return hip, knee


def test_single_stand_detected():
    hip, knee = _synthetic_single_stand()
    m = analyze_single_stand_metrics(hip, knee, fps=30.0)
    assert m["stand_detected"] is True
    assert m["rise_time_seconds"] is not None
    assert 0.3 <= m["rise_time_seconds"] <= 4.5
    assert m["smoothness_index"] is not None
    assert m["smoothness_index"] > 0.4


def test_no_stand_when_knee_static():
    hip = [0.7] * 30
    knee = [160.0] * 30
    m = analyze_single_stand_metrics(hip, knee, fps=30.0)
    assert m["stand_detected"] is False
