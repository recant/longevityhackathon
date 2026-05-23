"""
Rule-based functional aging scores from cheap observational biomarkers.

Not medical diagnosis — wellness trends for family caregivers.
References: gait speed <0.8 m/s frailty literature; 30s chair stand senior norms.
"""

from __future__ import annotations

from typing import Any, Literal

Trend = Literal["improving", "stable", "watch_closely"]

FEET_10_METERS = 3.048


def _clamp(x: float, lo: float = 0.0, hi: float = 100.0) -> float:
    return max(lo, min(hi, x))


def expected_reaction_ms(age: int) -> float:
    """Approximate median simple RT by age (ms)."""
    age = max(50, min(95, age))
    return 250 + (age - 50) * 4.0


def score_reaction(median_ms: float, age: int) -> dict[str, Any]:
    expected = expected_reaction_ms(age)
    ratio = median_ms / expected
    score = _clamp(100 - (ratio - 1.0) * 55)
    # Higher RT → higher functional cognitive age offset
    offset_years = round((median_ms - expected) / 12, 1)
    functional_age = max(50, age + int(offset_years))

    if score >= 75:
        band = "strong"
        line = "Response speed looks quick and steady for this age."
    elif score >= 55:
        band = "typical"
        line = "Response speed is in a typical range — worth tracking over time."
    else:
        band = "watch"
        line = "Response speed is slower than typical — gentle brain-and-body habits may help."

    return {
        "category": "cognitive_speed",
        "label": "Cognitive Speed",
        "score": round(score, 1),
        "band": band,
        "interpretation": line,
        "functional_age": functional_age,
        "raw": {"median_ms": median_ms, "expected_ms": round(expected)},
        "emoji": "brain",
    }


def gait_speed_mps(time_seconds: float) -> float:
    if time_seconds <= 0:
        return 0.0
    return FEET_10_METERS / time_seconds


def expected_gait_mps(age: int, sex: str | None) -> float:
    age = max(50, min(95, age))
    base = 1.2 - (age - 60) * 0.008
    if sex and sex.lower() in ("m", "male"):
        base += 0.05
    return max(0.75, base)


def score_gait(time_seconds: float, age: int, sex: str | None = None) -> dict[str, Any]:
    speed = gait_speed_mps(time_seconds)
    expected = expected_gait_mps(age, sex)
    score = _clamp((speed / expected) * 92)
    offset_years = round((expected - speed) * 18, 1)
    functional_age = max(50, age + int(offset_years))

    if speed >= 1.0:
        pace_note = "Walking pace looks confident."
    elif speed >= 0.8:
        pace_note = "Walking pace is moderate — regular short walks can help stamina."
    else:
        pace_note = "Walking pace is on the slower side — small daily walks may support independence."

    if score >= 75:
        band = "strong"
    elif score >= 55:
        band = "typical"
    else:
        band = "watch"

    return {
        "category": "mobility",
        "label": "Mobility",
        "score": round(score, 1),
        "band": band,
        "interpretation": pace_note,
        "functional_age": functional_age,
        "raw": {
            "time_seconds": round(time_seconds, 2),
            "speed_mps": round(speed, 3),
            "expected_mps": round(expected, 3),
        },
        "emoji": "walking",
    }


def expected_chair_reps(age: int, sex: str | None) -> float:
    age = max(60, min(89, age))
    # Simplified senior fitness norms (30s chair stand)
    table = {
        60: (15, 17),
        65: (13, 15),
        70: (12, 14),
        75: (11, 12),
        80: (9, 11),
        85: (8, 9),
    }
    decade = 60 + (age - 60) // 5 * 5
    decade = min(85, max(60, decade))
    f, m = table.get(decade, (10, 12))
    if sex and sex.lower() in ("m", "male"):
        return float(m)
    return float(f)


def score_chair_stand(reps: int, age: int, sex: str | None = None) -> dict[str, Any]:
    expected = expected_chair_reps(age, sex)
    score = _clamp((reps / expected) * 90)
    offset_years = round((expected - reps) * 1.2, 1)
    functional_age = max(50, age + int(offset_years))

    if score >= 75:
        band = "strong"
        line = "Leg strength for standing looks solid."
    elif score >= 55:
        band = "typical"
        line = "Chair rises are in a typical range — light strength work can preserve independence."
    else:
        band = "watch"
        line = "Standing from a chair takes more effort than typical — gentle leg strength habits may help."

    return {
        "category": "strength_stability",
        "label": "Strength & Stability",
        "score": round(score, 1),
        "band": band,
        "interpretation": line,
        "functional_age": functional_age,
        "raw": {"reps_30s": reps, "expected_reps": expected},
        "emoji": "chair",
    }


def compute_trend(
    current: float,
    previous: float | None,
    *,
    higher_is_better: bool = True,
) -> dict[str, Any]:
    if previous is None:
        return {"trend": "stable", "change_pct": None, "summary": "First check-in — come back monthly to see your trajectory."}

    if previous == 0:
        change_pct = 0.0
    else:
        change_pct = round((current - previous) / previous * 100, 1)

    improved = change_pct > 3 if higher_is_better else change_pct < -3
    declined = change_pct < -3 if higher_is_better else change_pct > 3

    if improved:
        trend: Trend = "improving"
        summary = f"Up about {abs(change_pct):.0f}% since last check-in."
    elif declined:
        trend = "watch_closely"
        summary = f"Down about {abs(change_pct):.0f}% since last check-in — worth a gentle conversation."
    else:
        trend = "stable"
        summary = "Holding steady since last check-in."

    return {"trend": trend, "change_pct": change_pct, "summary": summary}


def overall_snapshot(categories: list[dict[str, Any]], chronological_age: int) -> dict[str, Any]:
    scores = [c["score"] for c in categories if c.get("score") is not None]
    if not scores:
        return {
            "overall_score": None,
            "overall_functional_age": None,
            "headline": "Complete your first check-ins to see a snapshot.",
            "trend": "stable",
        }

    overall = round(sum(scores) / len(scores), 1)
    func_ages = [c.get("functional_age") for c in categories if c.get("functional_age")]
    overall_func = round(sum(func_ages) / len(func_ages)) if func_ages else chronological_age

    if overall >= 75:
        headline = "Functional health looks steady this month — keep up the gentle habits."
        trend = "stable"
    elif overall >= 55:
        headline = "Most signals are typical — tracking monthly helps catch small shifts early."
        trend = "stable"
    else:
        headline = "A few patterns suggest stamina or strength could use support — small daily habits add up."
        trend = "watch_closely"

    return {
        "overall_score": overall,
        "overall_functional_age": overall_func,
        "chronological_age": chronological_age,
        "headline": headline,
        "trend": trend,
    }


def default_actions(categories: list[dict[str, Any]]) -> list[dict[str, str]]:
    """Low-cost actionable recommendations (rule-based)."""
    actions: list[dict[str, str]] = []
    by_cat = {c["category"]: c for c in categories}

    cog = by_cat.get("cognitive_speed")
    if cog and cog.get("score", 100) < 70:
        actions.append(
            {
                "title": "Brain-and-body mini breaks",
                "detail": "10 minutes of puzzles, walking, or conversation daily supports alertness without feeling clinical.",
            }
        )

    mob = by_cat.get("mobility")
    if mob and mob.get("score", 100) < 70:
        actions.append(
            {
                "title": "Short hallway walks",
                "detail": "Two 5-minute walks per day at a comfortable pace — walk together so it feels social, not medical.",
            }
        )

    strength = by_cat.get("strength_stability")
    if strength and strength.get("score", 100) < 70:
        actions.append(
            {
                "title": "Sit-to-stand practice",
                "detail": "5 slow chair rises, twice daily, using armrests only if needed. Celebrate consistency, not speed.",
            }
        )

    if not actions:
        actions.append(
            {
                "title": "Keep the monthly rhythm",
                "detail": "Re-run these three mini activities once a month. Trends matter more than any single score.",
            }
        )

    actions.append(
        {
            "title": "Hydration & protein",
            "detail": "A glass of water with each meal and palm-sized protein portions support muscle and energy as we age.",
        }
    )
    return actions


TRACKING_CHECKLIST = [
    {"id": "reaction", "label": "Reaction speed", "cadence": "Monthly", "biomarker": True},
    {"id": "gait", "label": "10-foot walk pace", "cadence": "Monthly", "biomarker": True},
    {"id": "chair", "label": "30-second chair stand", "cadence": "Monthly", "biomarker": True},
    {"id": "sleep", "label": "Sleep quality (questions)", "cadence": "Weekly", "biomarker": False},
    {"id": "balance", "label": "One-foot balance (10 sec)", "cadence": "Monthly", "biomarker": False},
    {"id": "social", "label": "Social outings & hobbies", "cadence": "Weekly", "biomarker": False},
    {"id": "mood", "label": "Energy & mood check-in", "cadence": "Weekly", "biomarker": False},
]
