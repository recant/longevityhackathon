"""Evidence-linked, non-medication intervention ideas for functional aging scores.

The scoring layer tells families what changed. This module turns those scores into
small, practical next steps. Every suggestion carries a peer-reviewed citation so
UI copy can show the evidence source directly beside the recommendation.
"""

from __future__ import annotations

from typing import Any

from citations import CITATIONS, Citation, get_citation

Intervention = dict[str, Any]


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
        "citation": get_citation(citation_key),
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
