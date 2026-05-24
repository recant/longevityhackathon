"""Reference prototype scoring."""

from activity_reference import build_signature, score_activity_signature


def test_walk_signature_scores_highest():
    sig = build_signature(
        hip_x=[0.1, 0.2, 0.35, 0.5],
        hip_y=[0.6, 0.58, 0.62, 0.59],
        knee_deg=[95, 120, 155, 130, 100, 125, 160],
        blob={
            "walk_layout_ratio": 0.45,
            "chair_rise_norm": 0.02,
            "lower_blob_motion_norm": 0.02,
        },
        motion={"lateral_drift_ratio": 0.35, "h_span_norm": 0.3},
        pose_frame_ratio=0.5,
    )
    ref = score_activity_signature(sig)
    assert ref["walk_score"] > ref["chair_score"]
    assert ref["walk_score"] > ref["other_score"]


def test_chair_signature_scores_highest():
    sig = build_signature(
        hip_x=[0.5, 0.51, 0.49, 0.5],
        hip_y=[0.72, 0.7, 0.55, 0.52],
        knee_deg=[95, 98, 110, 140, 165, 168],
        blob={
            "walk_layout_ratio": 0.1,
            "chair_rise_norm": 0.12,
            "lower_blob_motion_norm": 0.01,
        },
        motion={"lateral_drift_ratio": 0.1, "h_span_norm": 0.05, "v_span_norm": 0.08},
        pose_frame_ratio=0.55,
    )
    ref = score_activity_signature(sig)
    assert ref["chair_score"] > ref["walk_score"]
