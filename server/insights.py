"""Plain-language result summary support."""

from __future__ import annotations

from typing import Any


def generate_insights(profile: dict[str, Any], snapshot: dict[str, Any]) -> dict[str, Any]:
    """Return empty insight fields so the UI does not show extra explanation panels."""
    cats = snapshot.get("categories", [])
    if cats:
        parts = [f"{c.get('label', 'Score')}: {c.get('score')}/100" for c in cats]
        what_changed = "; ".join(parts)
    else:
        what_changed = "Complete a test to see results."
    return {
        "summary": "",
        "conversation_tip": "",
        "what_changed": what_changed,
        "mock": False,
    }
