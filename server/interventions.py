"""Short, evidence-linked, non-medication intervention ideas."""

from __future__ import annotations

from typing import Any

Citation = dict[str, str | bool]
Intervention = dict[str, Any]

CITATIONS: dict[str, Citation] = {
    "life_physical_activity": {
        "short": "Pahor — Effect of Structured Physical Activity",
        "display": "Pahor — Effect of Structured Physical Activity",
        "peer_reviewed": True,
    },
    "falls_exercise": {
        "short": "Sherrington — Exercise to Prevent Falls",
        "display": "Sherrington — Exercise to Prevent Falls",
        "peer_reviewed": True,
    },
    "protein_older_adults": {
        "short": "Bauer — Optimal Dietary Protein Intake",
        "display": "Bauer — Optimal Dietary Protein Intake",
        "peer_reviewed": True,
    },
    "aerobic_cognition": {
        "short": "Smith — Aerobic Exercise and Neurocognitive Performance",
        "display": "Smith — Aerobic Exercise and Neurocognitive Performance",
        "peer_reviewed": True,
    },
    "mediterranean_cognition": {
        "short": "Martinez-Lapiscina — Mediterranean Diet Improves Cognition",
        "display": "Martinez-Lapiscina — Mediterranean Diet Improves Cognition",
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
            "Completed check-in"
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
    """Return short, practical, cited, non-medication ideas matched to scores."""
    if not categories:
        return []

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
                title="Daily short walk",
                suggestion="Walk 5-10 minutes at an easy pace.",
                rationale="Supports mobility.",
                citation_key="life_physical_activity",
            )
        )

    if strength_score is not None and strength_score < 75:
        ideas.append(
            _make(
                id="sit-to-stand-mini-set",
                category="strength_stability",
                score=strength_score,
                title="Five chair stands",
                suggestion="Do 5 slow stands from a sturdy chair.",
                rationale="Builds leg strength and balance.",
                citation_key="falls_exercise",
            )
        )

    if strength_score is not None and strength_score < 80:
        ideas.append(
            _make(
                id="protein-at-each-meal",
                category="strength_stability",
                score=strength_score,
                title="Protein with meals",
                suggestion="Add eggs, yogurt, beans, tofu, fish, or chicken.",
                rationale="Supports muscle maintenance.",
                citation_key="protein_older_adults",
            )
        )

    if cognitive_score is not None and cognitive_score < 75:
        ideas.append(
            _make(
                id="walk-plus-brain-game",
                category="cognitive_speed",
                score=cognitive_score,
                title="Walk + brain game",
                suggestion="Take a short walk, then play a simple word or card game.",
                rationale="Pairs movement with cognitive practice.",
                citation_key="aerobic_cognition",
            )
        )

    if cognitive_score is not None and cognitive_score < 80:
        ideas.append(
            _make(
                id="mediterranean-plate-swap",
                category="cognitive_speed",
                score=cognitive_score,
                title="Mediterranean plate swap",
                suggestion="Add vegetables, beans, nuts, olive oil, or fish once daily.",
                rationale="Supports cognitive health.",
                citation_key="mediterranean_cognition",
            )
        )

    if not ideas:
        scored = [float(c["score"]) for c in categories if c.get("score") is not None]
        avg_score = sum(scored) / max(1, len(scored))
        ideas.append(
            _make(
                id="daily-walk-and-stand-routine",
                category="overall",
                score=avg_score,
                title="Walk + stand routine",
                suggestion="Walk most days; add 5 chair stands a few times weekly.",
                rationale="Helps maintain mobility.",
                citation_key="life_physical_activity",
            )
        )

    return ideas
