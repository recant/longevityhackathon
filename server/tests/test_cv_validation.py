"""Unit tests for CV action validation (synthetic motion, no video files)."""

import numpy as np
import pytest

from cv_analysis import (
    ActionMismatchError,
    BodyTrack,
    _blob_hints_from_track,
    _classify_action,
    _motion_features,
    validate_action,
)


def _walk_track(n: int = 80) -> BodyTrack:
    xs = np.linspace(80, 560, n).tolist()
    ys = (240 + 12 * np.sin(np.linspace(0, 10 * np.pi, n))).tolist()
    return BodyTrack(
        xs=xs,
        ys=ys,
        fps=30.0,
        use_pose=True,
        frame_width=640,
        frame_height=480,
        pose_frame_ratio=0.85,
        mean_pose_visibility=0.75,
        sampled_frames=n,
    )


def _chair_track(n: int = 90, stands: int = 5) -> BodyTrack:
    xs = (320 + np.random.default_rng(0).normal(0, 3, n)).tolist()
    ys = []
    segment = max(n // (stands * 2), 1)
    for i in range(n):
        phase = (i // segment) % 2
        ys.append(380.0 if phase else 300.0)
    return BodyTrack(
        xs=xs,
        ys=ys,
        fps=30.0,
        use_pose=True,
        frame_width=640,
        frame_height=480,
        pose_frame_ratio=0.82,
        mean_pose_visibility=0.72,
        sampled_frames=n,
    )


def _lego_pan_track(n: int = 60) -> BodyTrack:
    xs = np.linspace(50, 590, n).tolist()
    ys = [300.0] * n
    return BodyTrack(
        xs=xs,
        ys=ys,
        fps=30.0,
        use_pose=False,
        frame_width=640,
        frame_height=480,
        pose_frame_ratio=0.0,
        mean_pose_visibility=0.0,
        sampled_frames=n,
    )


def test_classify_walk_vs_chair():
    walk_feat = _motion_features(_walk_track())
    chair_feat = _motion_features(_chair_track())
    assert _classify_action(walk_feat, _walk_track()) == "walk"
    assert _classify_action(chair_feat, _chair_track()) == "chair"


def test_walk_with_blob_layout_passes():
    track = _walk_track()
    feat = _motion_features(track)
    blob = _blob_hints_from_track(track, feat)
    meta = validate_action("walk", track, blob)
    assert meta["expected_action"] == "walk"
    assert meta.get("blob_walk_layout_ratio", 0) >= 0.12


def test_walk_rejects_lego_pan():
    track = _lego_pan_track()
    feat = _motion_features(track)
    blob = _blob_hints_from_track(track, feat)
    with pytest.raises(ActionMismatchError) as exc:
        validate_action("walk", track, blob)
    assert exc.value.detected == "other"


def test_walk_allows_partial_pose():
    partial = _walk_track()
    partial.pose_frame_ratio = 0.15
    feat = _motion_features(partial)
    blob = _blob_hints_from_track(partial, feat)
    meta = validate_action("walk", partial, blob)
    assert meta["expected_action"] == "walk"


def test_chair_endpoint_rejects_walk_motion():
    track = _walk_track()
    feat = _motion_features(track)
    blob = _blob_hints_from_track(track, feat)
    with pytest.raises(ActionMismatchError) as exc:
        validate_action("chair", track, blob)
    assert exc.value.expected == "chair"


def test_chair_passes_with_rise_blob():
    track = _chair_track(stands=1)
    feat = _motion_features(track)
    blob = _blob_hints_from_track(track, feat)
    meta = validate_action("chair", track, blob)
    assert meta["expected_action"] == "chair"
