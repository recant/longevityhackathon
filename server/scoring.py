"""
Evidence-informed functional aging scores (rule-based).

Norms: Bohannon & Andrews 2011 (gait); Rikli & Jones Senior Fitness Test (chair stand);
Woods et al. 2015 (reaction time). Interpretation bands: Studenski et al. JAMA 2011 (gait speed).
Protocol: CDC STEADI 30-second chair stand. Actions informed by LIFE Study JAMA 2014.
"""

from __future__ import annotations

from typing import Any, Literal

Trend = Literal["improving", "stable", "watch_closely"]

FEET_10_METERS = 3.048  # 10-foot walk → m/s (common short timed walk)

# Bohannon & Andrews 2011 — comfortable gait velocity (m/s), 5-year bands
BOHANNON_GAIT_MPS: dict[tuple[str, int], float] = {
    ("male", 60): 1.24,
    ("male", 65): 1.21,
    ("male", 70): 1.13,
    ("male", 75): 1.08,
    ("male", 80): 0.97,
    ("male", 85): 0.94,
    ("female", 60): 1.22,
    ("female", 65): 1.18,
    ("female", 70): 1.10,
    ("female", 75): 1.05,
    ("female", 80): 0.94,
    ("female", 85): 0.91,
}

# Rikli & Jones — 30-second chair stand mean norms (reps)
RIKLI_CHAIR_REPS: dict[tuple[str, int], float] = {
    ("male", 60): 16.4,
    ("male", 65): 14.8,
    ("male", 70): 13.3,
    ("male", 75): 12.3,
    ("male", 80): 11.0,
    ("male", 85): 10.2,
    ("female", 60): 15.4,
    ("female", 65): 13.5,
    ("female", 70): 12.6,
    ("female", 75): 11.4,
    ("female", 80): 10.0,
    ("female", 85): 9.0,
}

# Woods et al. 2015 — approximate simple reaction time (ms) by age band
WOODS_RT_MS: dict[int, float] = {
    55: 265,
    60: 285,
    65: 305,
    70: 325,
    75: 345,
    80: 365,
    85: 385,
    90: 400,
}


def _sex_key(sex: str | None) -> str:
    if sex and sex.lower() in ("m", "male"):
        return "male"
    return "female"


def _age_band(age: int, *, lo: int = 60, hi: int = 85, step: int = 5) -> int:
    age = max(lo, min(hi, age))
    return lo + ((age - lo) // step) * step


def _clamp(x: float, lo: float = 0.0, hi: float = 100.0) -> float:
    return max(lo, min(hi, x))


def _lookup_table(table: dict[tuple[str, int], float], age: int, sex: str | None) -> float:
    sk = _sex_key(sex)
    band = _age_band(age)
    if (sk, band) in table:
        return table[(sk, band)]
    # Interpolate between adjacent bands if missing
    lower = band - 5
    upper = band + 5
    lo_val = table.get((sk, lower))
    hi_val = table.get((sk, upper))
    if lo_val is not None and hi_val is not None:
        t = (age - lower) / 5.0
        return lo_val + t * (hi_val - lo_val)
    return table.get((sk, 85), table.get((sk, 60), 1.0))


def expected_reaction_ms(age: int) -> float:
    """Woods et al. 2015 — age-stratified simple RT expectations."""
    age = max(55, min(90, age))
    band = _age_band(age, lo=55, hi=90, step=5)
    base = WOODS_RT_MS.get(band, 300)
    if age % 5 != 0:
        lower = band
        upper = min(90, band + 5)
        lo_v = WOODS_RT_MS.get(lower, base)
        hi_v = WOODS_RT_MS.get(upper, base)
        t = (age - lower) / 5.0
        return lo_v + t * (hi_v - lo_v)
    return base


def score_reaction(median_ms: float, age: int) -> dict[str, Any]:
    expected = expected_reaction_ms(age)
    ratio = median_ms / expected
    score = _clamp(100 - (ratio - 1.0) * 55)
    offset_years = round((median_ms - expected) / 12, 1)
    functional_age = max(50, age + int(offset_years))

    if score >= 75:
        band = "strong"
        line = (
            "Response speed looks quick for this age — in line with healthy cognitive-motor aging "
            "(Woods et al., 2015)."
        )
    elif score >= 55:
        band = "typical"
        line = (
            "Response speed is typical for age. Tracking monthly helps spot gradual shifts."
        )
    else:
        band = "watch"
        line = (
            "Response speed is slower than age norms. Short brain-and-body activities "
            "(walks, games, dual-task play) can support function (Rosado-Antón et al., 2021)."
        )

    return {
        "category": "cognitive_speed",
        "label": "Cognitive Speed",
        "score": round(score, 1),
        "band": band,
        "interpretation": line,
        "functional_age": functional_age,
        "raw": {"median_ms": median_ms, "expected_ms": round(expected)},
        "evidence": ["Woods et al., Front Psychol 2015", "Rosado-Antón et al., BMC Public Health 2021"],
        "emoji": "brain",
    }


def gait_speed_mps(time_seconds: float) -> float:
    if time_seconds <= 0:
        return 0.0
    return FEET_10_METERS / time_seconds


def expected_gait_mps(age: int, sex: str | None) -> float:
    """Bohannon & Andrews 2011 comfortable gait speed norms."""
    return _lookup_table(BOHANNON_GAIT_MPS, age, sex)


def _studenski_pace_note(speed: float) -> str:
    """Studenski et al. JAMA 2011 — population survival associations, plain language."""
    if speed >= 1.0:
        return (
            "Walking pace is at or above about 1.0 m/s — a range linked to stronger "
            "survival in large population studies (Studenski et al., JAMA 2011)."
        )
    if speed >= 0.8:
        return (
            "Walking pace is moderate (about 0.8–1.0 m/s). Regular short walks may "
            "help stamina and independence."
        )
    if speed >= 0.6:
        return (
            "Walking pace is slower than about 0.8 m/s — a range where many older adults "
            "benefit from gentle walking and strength habits (Studenski et al., 2011)."
        )
    return (
        "Walking pace is quite slow. Consider supportive daily movement and talking with "
        "a clinician if the family has concerns — framed as stamina, not alarm."
    )


def score_gait(time_seconds: float, age: int, sex: str | None = None) -> dict[str, Any]:
    speed = gait_speed_mps(time_seconds)
    expected = expected_gait_mps(age, sex)
    score = _clamp((speed / expected) * 92)
    offset_years = round((expected - speed) * 18, 1)
    functional_age = max(50, age + int(offset_years))
    pace_note = _studenski_pace_note(speed)

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
            "studenski_band": (
                "≥1.0" if speed >= 1.0 else "0.8-0.99" if speed >= 0.8 else "0.6-0.79" if speed >= 0.6 else "<0.6"
            ),
        },
        "evidence": [
            "Bohannon & Andrews, Physiotherapy 2011",
            "Studenski et al., JAMA 2011",
        ],
        "emoji": "walking",
    }


def expected_chair_reps(age: int, sex: str | None) -> float:
    """Rikli & Jones Senior Fitness Test — 30s chair stand norms."""
    return _lookup_table(RIKLI_CHAIR_REPS, max(60, min(89, age)), sex)


def score_chair_stand(reps: int, age: int, sex: str | None = None) -> dict[str, Any]:
    expected = expected_chair_reps(age, sex)
    score = _clamp((reps / expected) * 90)
    offset_years = round((expected - reps) * 1.2, 1)
    functional_age = max(50, age + int(offset_years))

    if score >= 75:
        band = "strong"
        line = (
            f"Leg strength looks solid ({reps} stands in 30s vs ~{expected:.0f} typical for age/sex, "
            "Rikli & Jones Senior Fitness Test)."
        )
    elif score >= 55:
        band = "typical"
        line = (
            "Chair rises are in a typical range for age. Light sit-to-stand practice can "
            "preserve independence (CDC STEADI protocol)."
        )
    else:
        band = "watch"
        line = (
            "Fewer chair stands than age norms — gentle leg-strength habits and the LIFE Study-style "
            "walking program may help mobility and independence."
        )

    return {
        "category": "strength_stability",
        "label": "Strength & Stability",
        "score": round(score, 1),
        "band": band,
        "interpretation": line,
        "functional_age": functional_age,
        "raw": {"reps_30s": reps, "expected_reps": round(expected, 1)},
        "evidence": [
            "CDC STEADI 30-second Chair Stand",
            "Rikli & Jones, Senior Fitness Test",
            "LIFE Study, JAMA 2014",
        ],
        "emoji": "chair",
    }


def compute_trend(
    current: float,
    previous: float | None,
    *,
    higher_is_better: bool = True,
) -> dict[str, Any]:
    if previous is None:
        return {
            "trend": "stable",
            "change_pct": None,
            "summary": "First check-in — come back monthly to see your trajectory.",
        }

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
        headline = (
            "Some patterns suggest stamina or strength could use support — "
            "evidence-based walking and strength habits often help (LIFE Study, 2014)."
        )
        trend = "watch_closely"

    return {
        "overall_score": overall,
        "overall_functional_age": overall_func,
        "chronological_age": chronological_age,
        "headline": headline,
        "trend": trend,
    }


def default_actions(categories: list[dict[str, Any]]) -> list[dict[str, str]]:
    """Recommendations aligned with LIFE Study (structured physical activity)."""
    actions: list[dict[str, str]] = []
    by_cat = {c["category"]: c for c in categories}

    cog = by_cat.get("cognitive_speed")
    if cog and cog.get("score", 100) < 70:
        actions.append(
            {
                "title": "Brain-and-body activities",
                "detail": (
                    "10–15 minutes daily of conversation, light puzzles, or walking while counting "
                    "supports cognitive-motor speed (Rosado-Antón et al., 2021)."
                ),
            }
        )

    mob = by_cat.get("mobility")
    if mob and mob.get("score", 100) < 70:
        actions.append(
            {
                "title": "Structured walking (LIFE-style)",
                "detail": (
                    "Build toward 20–30 minutes of walking most days at a comfortable pace — "
                    "the LIFE trial showed structured activity reduced major mobility disability "
                    "(Pahor et al., JAMA 2014). Walk together so it feels social."
                ),
            }
        )

    strength = by_cat.get("strength_stability")
    if strength and strength.get("score", 100) < 70:
        actions.append(
            {
                "title": "CDC STEADI chair-stand practice",
                "detail": (
                    "5 slow sit-to-stands, twice daily, arms crossed on chest when safe. "
                    "Matches fall-prevention screening habits (CDC STEADI)."
                ),
            }
        )

    if not actions:
        actions.append(
            {
                "title": "Keep the monthly rhythm",
                "detail": "Re-run these three check-ins monthly. Trends matter more than any single score.",
            }
        )

    actions.append(
        {
            "title": "Protein & hydration",
            "detail": "Palm-sized protein each meal and water with meals support muscle maintenance as we age.",
        }
    )
    return actions


TRACKING_CHECKLIST = [
    {"id": "reaction", "label": "Reaction speed", "cadence": "Monthly", "biomarker": True},
    {"id": "gait", "label": "10-foot walk pace", "cadence": "Monthly", "biomarker": True},
    {"id": "chair", "label": "30-second chair stand (STEADI)", "cadence": "Monthly", "biomarker": True},
    {"id": "sleep", "label": "Sleep quality (questions)", "cadence": "Weekly", "biomarker": False},
    {"id": "balance", "label": "One-foot balance (10 sec)", "cadence": "Monthly", "biomarker": False},
    {"id": "social", "label": "Social outings & hobbies", "cadence": "Weekly", "biomarker": False},
    {"id": "mood", "label": "Energy & mood check-in", "cadence": "Weekly", "biomarker": False},
]
