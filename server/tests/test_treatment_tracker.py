"""Tests for treatment checklist periods and completion logic."""

from datetime import date

from treatment_tracker import (
    biomarker_done_for_period,
    build_treatment_items,
    build_tracker_response,
    is_item_done,
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


def test_manual_toggle_persists_in_response():
    items = [
        {
            "id": "track-sleep",
            "group": "wellness",
            "cadence_key": "weekly",
            "biomarker": False,
        }
    ]
    period = period_for("weekly")
    state = {"completions": {"track-sleep": [period]}}
    row = items[0]
    assert is_item_done(row, period, state["completions"], {})
    payload = build_tracker_response(items, state, {})
    assert payload["summary"]["week_done"] == 1
