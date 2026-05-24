"""Treatment checklist: habits, monitoring, completion tracking, and custom items."""

from __future__ import annotations

import re
import uuid
from datetime import date, datetime, timedelta, timezone
from typing import Any

from interventions import generate_interventions
from scoring import TRACKING_CHECKLIST, default_actions

CADENCE_LABELS = {"daily": "Daily", "weekly": "Weekly", "monthly": "Monthly"}


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


def period_label(cadence_key: str, period: str) -> str:
    if cadence_key == "daily":
        try:
            d = date.fromisoformat(period)
            return d.strftime("%a, %b %d")
        except ValueError:
            return period
    if cadence_key == "weekly":
        return f"Week {period.split('-W')[-1]}" if "-W" in period else period
    try:
        y, m = period.split("-")
        return date(int(y), int(m), 1).strftime("%B %Y")
    except (ValueError, IndexError):
        return period


def normalize_state(raw: dict[str, Any] | None) -> dict[str, Any]:
    data = raw if isinstance(raw, dict) else {}
    completions = data.get("completions")
    if not isinstance(completions, dict):
        completions = {}
    clean_completions: dict[str, list[str]] = {}
    for key, val in completions.items():
        if isinstance(val, list):
            clean_completions[str(key)] = [str(p) for p in val]

    custom = data.get("custom_items")
    if not isinstance(custom, list):
        custom = []

    dismissed = data.get("dismissed")
    if not isinstance(dismissed, list):
        dismissed = []

    notes = data.get("notes")
    if not isinstance(notes, dict):
        notes = {}

    return {
        "completions": clean_completions,
        "custom_items": custom,
        "dismissed": [str(x) for x in dismissed],
        "notes": {str(k): str(v) for k, v in notes.items()},
    }


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
    state: dict[str, Any] | None = None,
) -> list[dict[str, Any]]:
    """Merge interventions, action plan, monitoring checklist, and custom habits."""
    state = normalize_state(state)
    dismissed = set(state.get("dismissed") or [])
    items: list[dict[str, Any]] = []
    seen: set[str] = set()

    def add(item: dict[str, Any]) -> None:
        if item["id"] in seen or item["id"] in dismissed:
            return
        seen.add(item["id"])
        items.append(item)

    for inv in generate_interventions(categories, profile):
        cit = inv.get("citation") or {}
        add(
            {
                "id": str(inv["id"]),
                "group": "habits",
                "label": inv["title"],
                "detail": inv.get("suggestion") or "",
                "rationale": inv.get("rationale") or "",
                "cadence": "Daily",
                "cadence_key": "daily",
                "citation": cit.get("short"),
                "citation_url": cit.get("url"),
                "severity": inv.get("severity"),
                "category": inv.get("category"),
                "test_route": None,
                "custom": False,
                "priority": 1 if inv.get("severity") == "support" else 2,
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
                "rationale": "",
                "cadence": "Weekly",
                "cadence_key": "weekly",
                "citation": None,
                "citation_url": None,
                "severity": None,
                "category": None,
                "test_route": None,
                "custom": False,
                "priority": 3,
            }
        )

    test_routes = {"reaction": "reaction", "gait": "walk", "chair": "chair-rise"}
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
                "rationale": "Repeat on schedule to spot trends between doctor visits.",
                "cadence": row.get("cadence", "Monthly"),
                "cadence_key": cadence_key,
                "citation": None,
                "citation_url": None,
                "severity": None,
                "category": cid,
                "test_route": test_routes.get(cid) if row.get("biomarker") else None,
                "biomarker": bool(row.get("biomarker")),
                "custom": False,
                "priority": 0 if row.get("biomarker") else 4,
            }
        )

    if not any(i["group"] == "habits" for i in items):
        add(
            {
                "id": "habit-monthly-checkin",
                "group": "habits",
                "label": "Monthly KinSpan check-in",
                "detail": "Run walk, sit & stand, and reaction tests together once a month.",
                "rationale": "Monthly biomarkers build a trajectory families can discuss with clinicians.",
                "cadence": "Monthly",
                "cadence_key": "monthly",
                "citation": None,
                "citation_url": None,
                "test_route": "guided",
                "custom": False,
                "priority": 2,
            }
        )

    for raw in state.get("custom_items") or []:
        if not isinstance(raw, dict):
            continue
        iid = str(raw.get("id") or "")
        if not iid or iid in dismissed:
            continue
        ck = raw.get("cadence_key") or "weekly"
        if ck not in CADENCE_LABELS:
            ck = "weekly"
        add(
            {
                "id": iid,
                "group": "custom",
                "label": str(raw.get("label") or "Custom habit"),
                "detail": str(raw.get("detail") or ""),
                "rationale": "",
                "cadence": raw.get("cadence") or CADENCE_LABELS[ck],
                "cadence_key": ck,
                "citation": None,
                "citation_url": None,
                "custom": True,
                "priority": 5,
            }
        )

    items.sort(key=lambda i: (i.get("priority", 9), i.get("label", "")))
    return items


def biomarker_done_for_period(
    item_id: str,
    period: str,
    history: dict[str, Any],
) -> bool:
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
    if period in completions.get(iid, []):
        return True
    if item.get("biomarker"):
        return biomarker_done_for_period(iid, period, history)
    return False


def compute_streak(
    item_id: str,
    cadence_key: str,
    completions: dict[str, list[str]],
    today: date,
) -> int:
    periods = set(completions.get(item_id, []))
    if not periods:
        return 0
    streak = 0
    if cadence_key == "daily":
        d = today
        while period_for("daily", d) in periods:
            streak += 1
            d -= timedelta(days=1)
        return streak
    if cadence_key == "weekly":
        d = today
        for _ in range(52):
            if period_for("weekly", d) in periods:
                streak += 1
                d -= timedelta(days=7)
            else:
                break
        return streak
    d = today.replace(day=1)
    for _ in range(24):
        if period_for("monthly", d) in periods:
            streak += 1
            if d.month == 1:
                d = d.replace(year=d.year - 1, month=12)
            else:
                d = d.replace(month=d.month - 1)
        else:
            break
    return streak


def last_seven_days(
    item_id: str,
    completions: dict[str, list[str]],
    today: date,
) -> list[dict[str, str | bool]]:
    periods = set(completions.get(item_id, []))
    out: list[dict[str, str | bool]] = []
    for offset in range(6, -1, -1):
        d = today - timedelta(days=offset)
        p = period_for("daily", d)
        out.append(
            {
                "date": p,
                "label": d.strftime("%a")[0],
                "done": p in periods,
            }
        )
    return out


def build_tracker_response(
    items: list[dict[str, Any]],
    state: dict[str, Any],
    history: dict[str, Any],
    *,
    profile: dict[str, Any] | None = None,
) -> dict[str, Any]:
    state = normalize_state(state)
    completions = state["completions"]
    notes = state["notes"]
    today = date.today()
    enriched: list[dict[str, Any]] = []

    daily_items = [i for i in items if i["cadence_key"] == "daily"]
    weekly_items = [i for i in items if i["cadence_key"] == "weekly"]
    monthly_items = [i for i in items if i["cadence_key"] == "monthly"]

    done_today = 0
    for item in items:
        ck = item["cadence_key"]
        period = period_for(ck, today)
        done = is_item_done(item, period, completions, history)
        if ck == "daily":
            if done:
                done_today += 1
        streak = compute_streak(item["id"], ck, completions, today)
        iid = item["id"]
        row = {
            **item,
            "period": period,
            "period_label": period_label(ck, period),
            "done": done,
            "auto": bool(
                item.get("biomarker") and done and period not in completions.get(iid, [])
            ),
            "streak": streak,
            "note": notes.get(iid, ""),
        }
        if ck == "daily":
            row["week_dots"] = last_seven_days(iid, completions, today)
        enriched.append(row)

    weekly_done = sum(1 for i in weekly_items if is_item_done(i, period_for("weekly", today), completions, history))
    monthly_done = sum(
        1 for i in monthly_items if is_item_done(i, period_for("monthly", today), completions, history)
    )
    weekly_total = len(weekly_items) or 1
    monthly_total = len(monthly_items) or 1
    daily_total = len(daily_items) or 1

    due_items = [i for i in enriched if not i["done"]]
    due_today = [i for i in enriched if i["cadence_key"] == "daily" and not i["done"]]

    groups_meta = [
        {
            "id": "habits",
            "title": "Treatment & habits",
            "subtitle": "Evidence-based steps from your parent's scores",
        },
        {
            "id": "monitoring",
            "title": "Scheduled check-ins",
            "subtitle": "Home tests — auto-checked when you log results",
        },
        {
            "id": "wellness",
            "title": "Weekly wellness",
            "subtitle": "Sleep, balance, mood, and connection",
        },
        {
            "id": "custom",
            "title": "Your family's habits",
            "subtitle": "Goals you added together",
        },
    ]
    grouped = []
    for g in groups_meta:
        section_items = [i for i in enriched if i["group"] == g["id"]]
        if section_items:
            grouped.append({**g, "items": section_items})

    name = (profile or {}).get("display_name") or "your parent"
    if done_today == daily_total and daily_total > 0:
        headline = f"All daily habits done for {name} today."
    elif due_today:
        headline = f"{len(due_today)} daily habit{'s' if len(due_today) != 1 else ''} left for today."
    elif weekly_done < weekly_total:
        headline = f"{weekly_total - weekly_done} weekly item{'s' if weekly_total - weekly_done != 1 else ''} still open this week."
    else:
        headline = "Great consistency — keep the gentle rhythm going."

    return {
        "items": enriched,
        "groups": grouped,
        "completions": completions,
        "custom_items": state.get("custom_items") or [],
        "summary": {
            "done_today": done_today,
            "due_today": len(due_today),
            "daily_total": daily_total,
            "week_done": weekly_done,
            "week_total": len(weekly_items),
            "week_pct": round(100 * weekly_done / weekly_total),
            "month_done": monthly_done,
            "month_total": len(monthly_items),
            "month_pct": round(100 * monthly_done / monthly_total),
            "due_count": len(due_items),
            "headline": headline,
        },
    }


def new_custom_item(
    label: str,
    detail: str = "",
    cadence_key: str = "weekly",
) -> dict[str, Any]:
    ck = cadence_key if cadence_key in CADENCE_LABELS else "weekly"
    return {
        "id": f"custom-{uuid.uuid4().hex[:12]}",
        "label": label.strip(),
        "detail": detail.strip(),
        "cadence_key": ck,
        "cadence": CADENCE_LABELS[ck],
        "group": "custom",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
