"""Compassionate AI explanations — optional OpenAI layer on top of rule-based scores."""

from __future__ import annotations

import json
import os
from typing import Any

from openai import OpenAI


def _mock_insight(profile: dict[str, Any], snapshot: dict[str, Any]) -> dict[str, Any]:
    name = profile.get("display_name", "your parent")
    cats = snapshot.get("categories", [])
    what = "This is your baseline — re-check monthly to see what changed."
    if cats:
        parts = [f"{c['label']}: {c['score']}/100" for c in cats]
        what = "Latest: " + "; ".join(parts) + ". Trends appear after your second monthly check-in."
    return {
        "summary": (
            f"{name}'s check-ins are saved. Enable OPENAI_API_KEY for personalized "
            "'explain like a caring family member' text."
        ),
        "conversation_tip": (
            f"Try: '{name}, I found a calm app that helps our family notice energy and "
            "movement over time — not doctors, just trends. Want to do a short walk test with me?'"
        ),
        "what_changed": what,
        "mock": True,
    }


def generate_insights(profile: dict[str, Any], snapshot: dict[str, Any]) -> dict[str, Any]:
    api_key = os.environ.get("OPENAI_API_KEY", "").strip()
    if not api_key:
        return _mock_insight(profile, snapshot)

    client = OpenAI(api_key=api_key)
    prompt = f"""You help adult children understand a parent's functional aging trends.
NEVER diagnose disease. NEVER use alarming red-flag medical language.
Use warm, culturally sensitive phrasing for parents who may distrust medicine.

Evidence base (mention only in plain language, no journal jargon overload):
- Gait: Studenski JAMA 2011 (speed & survival), Bohannon Physiotherapy 2011 (norms)
- Chair stand: CDC STEADI protocol, Rikli & Jones Senior Fitness Test norms
- Reaction time: Woods Front Psychol 2015 (aging); Rosado-Antón BMC Public Health 2021 (training helps)
- Activity advice: LIFE Study JAMA 2014 (structured walking/strength reduced mobility disability)

Parent: {profile.get('display_name')}, age {profile.get('age', 'unknown')}.
Snapshot JSON:
{json.dumps(snapshot, indent=2)}

Return ONLY JSON:
{{
  "summary": "2-3 sentences, plain language, trajectory-focused not disease-focused",
  "conversation_tip": "1-2 sentences: how to talk to parent without sounding judgmental",
  "what_changed": "1 sentence on trends if any, else encourage first baseline"
}}"""

    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": prompt}],
        max_tokens=400,
    )
    text = response.choices[0].message.content or "{}"
    try:
        start = text.index("{")
        data = json.loads(text[start:])
        data["mock"] = False
        return data
    except (ValueError, json.JSONDecodeError):
        return _mock_insight(profile, snapshot)
