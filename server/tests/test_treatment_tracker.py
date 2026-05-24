"""Tests for treatment checklist periods and completion logic."""

from datetime import date

from treatment_tracker import (
    biomarker_done_for_period,
    build_treatment_items,
    build_tracker_response,
    compute_streak,
    is_item_done,
    new_custom_item,
    normalize_state,
    period_for,
)


def test_period_for_cadences():
    d = date(2026, 5, 23)
    assert period_for("daily", d) == "2026-05-23"
    assert period_for("weekly", d) == "2026-W21"
    assert period_for("monthly", d) == "2026-05"


def test_biomarker_auto_complete_from_history():
    history = {
        "reactions": [{"created_at": "2026-05-20T12:00:00+00:00"}],
        "gaits": [],
        "chairs": [],
    }
    period = "2026-05"
    assert biomarker_done_for_period("track-reaction", period, history)
    assert not biomarker_done_for_period("track-gait", period, history)


def test_build_items_includes_interventions_and_tracking():
    categories = [
        {"category": "mobility", "score": 60, "label": "Mobility"},
    ]
    profile = {"display_name": "Mom", "age": 72, "sex": "female"}
    items = build_treatment_items(categories, profile, actions=[])
    ids = {i["id"] for i in items}
    assert "track-reaction" in ids
    assert "track-gait" in ids
    assert any(i["group"] == "habits" for i in items)


def test_custom_item_in_plan():
    state = normalize_state(
        {"custom_items": [new_custom_item("Walk after dinner", "10 min", "daily")]}
    )
    items = build_treatment_items([], {"display_name": "Dad"}, state=state)
    assert any(i["id"].startswith("custom-") and i["label"] == "Walk after dinner" for i in items)


def test_dismissed_item_hidden():
    state = normalize_state({"dismissed": ["track-mood"]})
    items = build_treatment_items([], {"display_name": "Dad"}, state=state)
    assert "track-mood" not in {i["id"] for i in items}


def test_manual_toggle_and_streak():
    items = [
        {
            "id": "track-sleep",
            "group": "wellness",
            "cadence_key": "weekly",
            "biomarker": False,
        }
    ]
    period = period_for("weekly")
    state = normalize_state({"completions": {"track-sleep": [period]}})
    row = items[0]
    assert is_item_done(row, period, state["completions"], {})
    payload = build_tracker_response(items, state, {}, profile={"display_name": "Mom"})
    assert payload["summary"]["week_done"] == 1
    assert "headline" in payload["summary"]


def test_daily_streak():
    today = date(2026, 5, 23)
    completions = {
        "habit-a": [
            period_for("daily", today),
            period_for("daily", today.replace(day=22)),
        ]
    }
    assert compute_streak("habit-a", "daily", completions, today) == 2
