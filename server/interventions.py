"""Evidence-linked, non-medication intervention ideas for functional aging scores.

The scoring layer tells families what changed. This module turns those scores into
small, practical next steps. Every suggestion carries a peer-reviewed citation so
UI copy can show the evidence source directly beside the recommendation.
"""

from __future__ import annotations

from typing import Any

Citation = dict[str, str | bool]
Intervention = dict[str, Any]

CITATIONS: dict[str, Citation] = {
    "life_physical_activity": {
        "short": "Pahor et al., JAMA 2014",
        "full": (
            "Pahor M, Guralnik JM, Ambrosius WT, et al. Effect of structured physical "
            "activity on prevention of major mobility disability in older adults: the LIFE "
            "study randomized clinical trial. JAMA. 2014;311(23):2387-2396."
        ),
        "doi": "10.1001/jama.2014.5616",
        "url": "https://doi.org/10.1001/jama.2014.5616",
        "peer_reviewed": True,
    },
    "falls_exercise": {
        "short": "Sherrington et al., Br J Sports Med 2017",
        "full": (
            "Sherrington C, Michaleff ZA, Fairhall N, et al. Exercise to prevent falls "
            "in older adults: an updated systematic review and meta-analysis. British "
            "Journal of Sports Medicine. 2017;51(24):1750-1758."
        ),
        "doi": "10.1136/bjsports-2016-096547",
        "url": "https://doi.org/10.1136/bjsports-2016-096547",
        "peer_reviewed": True,
    },
    "protein_older_adults": {
        "short": "Bauer et al., J Am Med Dir Assoc 2013",
        "full": (
            "Bauer J, Biolo G, Cederholm T, et al. Evidence-based recommendations for "
            "optimal dietary protein intake in older people: a position paper from the "
            "PROT-AGE Study Group. Journal of the American Medical Directors Association. "
            "2013;14(8):542-559."
        ),
        "doi": "10.1016/j.jamda.2013.05.021",
        "url": "https://doi.org/10.1016/j.jamda.2013.05.021",
        "peer_reviewed": True,
    },
    "aerobic_cognition": {
        "short": "Smith et al., Psychosom Med 2010",
        "full": (
            "Smith PJ, Blumenthal JA, Hoffman BM, et al. Aerobic exercise and "
            "neurocognitive performance: a meta-analytic review of randomized controlled "
            "trials. Psychosomatic Medicine. 2010;72(3):239-252."
        ),
        "doi": "10.1097/PSY.0b013e3181d14633",
        "url": "https://doi.org/10.1097/PSY.0b013e3181d14633",
        "peer_reviewed": True,
    },
    "mediterranean_cognition": {
        "short": "Martinez-Lapiscina et al., JNNP 2013",
        "full": (
            "Martinez-Lapiscina EH, Clavero P, Toledo E, et al. Mediterranean diet "
            "improves cognition: the PREDIMED-NAVARRA randomised trial. Journal of "
            "Neurology, Neurosurgery & Psychiatry. 2013;84(12):1318-1325."
        ),
        "doi": "10.1136/jnnp-2012-304792",
        "url": "https://doi.org/10.1136/jnnp-2012-304792",
        "peer_reviewed": True,
    },
}


def _find_category(categories: list[dict[str, Any]], category: str) -> dict[str, Any] | None:
    for cat in categories:
        if cat.get("category") == category:
            return cat
    return None


def _score(cat: dict[str, Any] | None) -> float | None:
    if not cat:
        return None
    try:
        return float(cat.get("score"))
    except (TypeError, ValueError):
        return None


def _severity(score: float | None) -> str:
    if score is None:
        return "not_measured"
    if score < 55:
        return "watch"
    if score < 70:
        return "support"
    return "maintenance"


def _make(
    *,
    id: str,
    category: str,
    score: float | None,
    title: str,
    suggestion: str,
    rationale: str,
    citation_key: str,
) -> Intervention:
    return {
        "id": id,
        "category": category,
        "score": score,
        "severity": _severity(score),
        "trigger": (
            "No score recorded yet"
            if score is None
            else f"{category.replace('_', ' ').title()} score {score:.1f}/100"
        ),
        "title": title,
        "suggestion": suggestion,
        "rationale": rationale,
        "citation": CITATIONS[citation_key],
    }


def generate_interventions(
    categories: list[dict[str, Any]],
    profile: dict[str, Any] | None = None,
) -> list[Intervention]:
    """Return practical, non-medication ideas matched to the latest scores.

    Conservative thresholding is intentional: this is a family wellness product,
    so recommendations stay small, behavior-based, and non-diagnostic.
    """
    if not categories:
        return []

    profile = profile or {}
    name = profile.get("display_name") or "your parent"

    cognitive = _find_category(categories, "cognitive_speed")
    mobility = _find_category(categories, "mobility")
    strength = _find_category(categories, "strength_stability")

    cognitive_score = _score(cognitive)
    mobility_score = _score(mobility)
    strength_score = _score(strength)

    ideas: list[Intervention] = []

    if mobility_score is not None and mobility_score < 75:
        ideas.append(
            _make(
                id="daily-comfortable-walk",
                category="mobility",
                score=mobility_score,
                title="Walk around the block once a day",
                suggestion=(
                    "Start with one comfortable walk around the block, or 5-10 minutes if a "
                    "full block is too much. Keep the pace conversational and build gradually."
                ),
                rationale=(
                    "The LIFE randomized trial used structured physical activity centered on "
                    "walking, strength, balance, and flexibility to reduce major mobility "
                    "disability in sedentary older adults."
                ),
                citation_key="life_physical_activity",
            )
        )

    if strength_score is not None and strength_score < 75:
        ideas.append(
            _make(
                id="sit-to-stand-mini-set",
                category="strength_stability",
                score=strength_score,
                title="Do a tiny sit-to-stand set after breakfast",
                suggestion=(
                    "Try 5 slow sit-to-stands from a sturdy chair after breakfast, using hands "
                    "for support if needed. Stop if there is pain, dizziness, or unsafe balance."
                ),
                rationale=(
                    "Exercise programs that challenge balance and functional strength reduce "
                    "falls in older adults; sit-to-stand practice is a simple home version of "
                    "functional lower-body strengthening."
                ),
                citation_key="falls_exercise",
            )
        )

    if strength_score is not None and strength_score < 80:
        ideas.append(
            _make(
                id="protein-at-each-meal",
                category="strength_stability",
                score=strength_score,
                title="Add a protein anchor to each meal",
                suggestion=(
                    "Include a palm-sized protein source at breakfast, lunch, and dinner - for "
                    "example eggs, yogurt, tofu, beans, fish, chicken, or lentils. Ask a clinician "
                    "first if kidney disease or a protein restriction is present."
                ),
                rationale=(
                    "The PROT-AGE position paper recommends attention to higher-quality, "
                    "adequately distributed protein intake in older adults to support muscle "
                    "maintenance and function."
                ),
                citation_key="protein_older_adults",
            )
        )

    if cognitive_score is not None and cognitive_score < 75:
        ideas.append(
            _make(
                id="walk-plus-brain-game",
                category="cognitive_speed",
                score=cognitive_score,
                title="Pair a short walk with a light brain game",
                suggestion=(
                    "Do a 10-minute easy walk, then a simple mentally engaging activity like a "
                    "card game, word game, or recalling a family story together. Keep it playful, "
                    "not like a test."
                ),
                rationale=(
                    "A meta-analysis of randomized trials found aerobic exercise was associated "
                    "with improvements in neurocognitive performance, supporting gentle movement "
                    "as a cognitive-motor habit."
                ),
                citation_key="aerobic_cognition",
            )
        )

    if cognitive_score is not None and cognitive_score < 80:
        ideas.append(
            _make(
                id="mediterranean-plate-swap",
                category="cognitive_speed",
                score=cognitive_score,
                title="Make one Mediterranean-style plate swap",
                suggestion=(
                    "Once per day, make the meal more Mediterranean-style: vegetables or fruit, "
                    "beans or whole grains, nuts or olive oil, and fish/lean protein when possible."
                ),
                rationale=(
                    "The PREDIMED-NAVARRA randomized trial reported cognitive benefits from a "
                    "Mediterranean dietary pattern in older adults at cardiovascular risk."
                ),
                citation_key="mediterranean_cognition",
            )
        )

    if not ideas:
        avg_score = sum(float(c["score"]) for c in categories if c.get("score") is not None) / len(categories)
        ideas.append(
            _make(
                id="maintenance-walk-strength-rhythm",
                category="overall",
                score=avg_score,
                title="Keep a weekly movement rhythm",
                suggestion=(
                    f"Because {name}'s current scores look steady, keep the habit simple: "
                    "walk most days and do a short strength/balance routine two or three times "
                    "per week."
                ),
                rationale=(
                    "Structured physical activity programs emphasizing walking plus strength, "
                    "balance, and flexibility have randomized-trial evidence for preserving "
                    "mobility in older adults."
                ),
                citation_key="life_physical_activity",
            )
        )

    return ideas
