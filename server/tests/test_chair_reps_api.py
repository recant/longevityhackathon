"""Chair 30s rep count API."""

from scoring import score_chair_stand


def test_chair_reps_scoring_in_range():
    s = score_chair_stand(12, 70, "female")
    assert 40 <= s["score"] <= 95
    assert "Rikli" in " ".join(s["evidence"])
