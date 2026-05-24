"""Treatment checklist: habits, monitoring, and completion tracking per profile."""

from __future__ import annotations

import re
from datetime import date, datetime, timezone
from typing import Any

from scoring import TRACKING_CHECKLIST, default_actions
from interventions import generate_interventions


def _slug(text: str) -> str:
    s = re.sub(r"[^a-z0-9]+", "-", (text or "").lower()).strip("-")
    return (s[:56] or "item")


def _cadence_key(cadence: str) -> str:
    c = (cadence or "").lower()
    if "daily" in c:
        return "daily"
    if "week" in c:
        return "weekly"
    return "monthly"


def period_for(cadence_key: str, when: date | None = None) -> str:
    d = when or date.today()
    if cadence_key == "daily":
        return d.isoformat()
    if cadence_key == "weekly":
        return f"{d.isocalendar().year}-W{d.isocalendar().week:02d}"
    return d.strftime("%Y-%m")


def _session_in_period(created_at: str, cadence_key: str, period: str) -> bool:
    try:
        raw = created_at.replace("Z", "+00:00")
        dt = datetime.fromisoformat(raw)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        d = dt.date()
    except (TypeError, ValueError):
        return False
    return period_for(cadence_key, d) == period


def build_treatment_items(
    categories: list[dict[str, Any]],
    profile: dict[str, Any],
    *,
    actions: list[dict[str, str]] | None = None,
) -> list[dict[str, Any]]:
    """Merge evidence-based interventions, action plan, and monitoring checklist."""
    items: list[dict[str, Any]] = []
    seen: set[str] = set()

    def add(item: dict[str, Any]) -> None:
        if item["id"] in seen:
            return
        seen.add(item["id"])
        items.append(item)

    for inv in generate_interventions(categories, profile):
        add(
            {
                "id": str(inv["id"]),
                "group": "habits",
                "label": inv["title"],
                "detail": inv.get("suggestion") or inv.get("rationale") or "",
                "cadence": "Daily",
                "cadence_key": "daily",
                "citation": (inv.get("citation") or {}).get("short"),
                "test_route": None,
            }
        )

    for act in actions or default_actions(categories):
        aid = f"action-{_slug(act.get('title', 'habit'))}"
        add(
            {
                "id": aid,
                "group": "habits",
                "label": act["title"],
                "detail": act.get("detail", ""),
                "cadence": "Weekly",
                "cadence_key": "weekly",
                "citation": None,
                "test_route": None,
            }
        )

    test_routes = {
        "reaction": "reaction",
        "gait": "walk",
        "chair": "chair-rise",
    }
    labels = {
        "reaction": "Reaction speed test",
        "gait": "10-foot walk test",
        "chair": "Sit & stand test",
    }
    for row in TRACKING_CHECKLIST:
        cid = row["id"]
        cadence_key = _cadence_key(row.get("cadence", "Monthly"))
        add(
            {
                "id": f"track-{cid}",
                "group": "monitoring" if row.get("biomarker") else "wellness",
                "label": labels.get(cid, row["label"]),
                "detail": row["label"] if labels.get(cid) else "",
                "cadence": row.get("cadence", "Monthly"),
                "cadence_key": cadence_key,
                "citation": None,
                "test_route": test_routes.get(cid) if row.get("biomarker") else None,
                "biomarker": bool(row.get("biomarker")),
            }
        )

    if not any(i["group"] == "habits" for i in items):
        add(
            {
                "id": "habit-monthly-checkin",
                "group": "habits",
                "label": "Monthly KinSpan check-in",
                "detail": "Run walk, sit & stand, and reaction tests together once a month.",
                "cadence": "Monthly",
                "cadence_key": "monthly",
                "citation": None,
                "test_route": "guided",
            }
        )

    return items


def biomarker_done_for_period(
    item_id: str,
    period: str,
    history: dict[str, Any],
) -> bool:
    """True when a biomarker test was logged in the same cadence period."""
    mapping = {
        "track-reaction": ("reactions", "monthly"),
        "track-gait": ("gaits", "monthly"),
        "track-chair": ("chairs", "monthly"),
    }
    entry = mapping.get(item_id)
    if not entry:
        return False
    key, cadence_key = entry
    sessions = history.get(key) or []
    return any(_session_in_period(s.get("created_at", ""), cadence_key, period) for s in sessions)


def is_item_done(
    item: dict[str, Any],
    period: str,
    completions: dict[str, list[str]],
    history: dict[str, Any],
) -> bool:
    iid = item["id"]
    if iid in completions and period in completions.get(iid, []):
        return True
    if item.get("biomarker"):
        return biomarker_done_for_period(iid, period, history)
    return False


def build_tracker_response(
    items: list[dict[str, Any]],
    state: dict[str, Any],
    history: dict[str, Any],
) -> dict[str, Any]:
    completions: dict[str, list[str]] = state.get("completions") or {}
    today = date.today()
    enriched: list[dict[str, Any]] = []
    done_today = 0
    due_today = 0

    for item in items:
        ck = item["cadence_key"]
        period = period_for(ck, today)
        done = is_item_done(item, period, completions, history)
        if ck == "daily":
            due_today += 1
            if done:
                done_today += 1
        iid = item["id"]
        enriched.append(
            {
                **item,
                "period": period,
                "done": done,
                "auto": bool(
                    item.get("biomarker")
                    and done
                    and period not in completions.get(iid, [])
                ),
            }
        )

    groups = [
        {"id": "habits", "title": "Treatment & habits", "subtitle": "Evidence-based steps from scores"},
        {"id": "monitoring", "title": "Scheduled check-ins", "subtitle": "Tests and observations to repeat"},
        {"id": "wellness", "title": "Weekly wellness", "subtitle": "Sleep, mood, and social connection"},
    ]
    grouped = []
    for g in groups:
        gid = g["id"]
        section_items = [i for i in enriched if i["group"] == gid]
        if section_items:
            grouped.append({**g, "items": section_items})

    weekly_items = [i for i in enriched if i["cadence_key"] == "weekly"]
    weekly_done = sum(1 for i in weekly_items if i["done"])
    weekly_total = len(weekly_items) or 1

    return {
        "items": enriched,
        "groups": grouped,
        "completions": completions,
        "summary": {
            "done_today": done_today,
            "due_today": due_today,
            "week_done": weekly_done,
            "week_total": len(weekly_items),
            "week_pct": round(100 * weekly_done / weekly_total),
        },
    }
