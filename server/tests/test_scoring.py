"""Unit tests for evidence-based scoring (runs in GitHub Actions)."""

from scoring import (
    expected_gait_mps,
    expected_reaction_ms,
    gait_speed_mps,
    score_chair_stand,
    score_gait,
    score_reaction,
)


def test_gait_speed_calculation():
    assert abs(gait_speed_mps(4.0) - 0.762) < 0.01


def test_bohannon_norm_in_range():
    assert 0.9 <= expected_gait_mps(68, "female") <= 1.3


def test_studenski_band_slow_walk():
    result = score_gait(5.0, 68, "female")
    assert result["raw"]["studenski_band"] in ("0.6-0.79", "<0.6", "0.8-0.99")


def test_reaction_woods_norm():
    assert 280 <= expected_reaction_ms(68) <= 340


def test_chair_stand_returns_evidence():
    result = score_chair_stand(12, 70, "female")
    assert result["score"] > 0
    assert any("Rikli" in e or "STEADI" in e for e in result["evidence"])


def test_reaction_score_strong_when_fast():
    result = score_reaction(280, 68)
    assert result["band"] == "strong"
