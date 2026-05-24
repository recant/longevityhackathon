"""Chair scoring aligned to Rikli & Jones 30s norms (REFERENCES.md)."""

from scoring import (
    expected_chair_reps,
    expected_chair_rise_seconds,
    rise_time_to_equivalent_reps_30s,
    score_chair_single_stand,
    score_chair_stand,
)


def test_expected_rise_derived_from_rikli_female_68():
    reps = expected_chair_reps(68, "female")
    rise = expected_chair_rise_seconds(68, "female")
    assert 12 <= reps <= 14
    assert 1.0 <= rise <= 1.3
    assert abs(rise - (30.0 / reps) * 0.5) < 0.05


def test_23s_maps_below_typical_rikli_equivalent():
    reps_eq = rise_time_to_equivalent_reps_30s(2.3, 68, "female")
    assert reps_eq < expected_chair_reps(68, "female")


def test_faster_stand_scores_higher():
    fast = score_chair_single_stand(1.3, 0.0, 68, "female")
    slow = score_chair_single_stand(2.3, 0.0, 68, "female")
    assert fast["score"] > slow["score"]
    assert fast["score"] - slow["score"] >= 18


def test_23s_not_inflated_at_age_68():
    s = score_chair_single_stand(2.3, 0.0, 68, "female")
    assert 42 <= s["score"] <= 58
    assert "Rikli" in " ".join(s["evidence"])


def test_13s_rewards_quick_rise():
    s = score_chair_single_stand(1.3, 0.0, 68, "female")
    assert s["score"] >= 72


def test_single_stand_matches_rikli_rep_scoring_order():
    """~2.3s single stand ≈ slower than 12 reps in 30s manual test."""
    single = score_chair_single_stand(2.3, 0.0, 70, "female")["score"]
    manual = score_chair_stand(12, 70, "female")["score"]
    assert single < manual + 8
