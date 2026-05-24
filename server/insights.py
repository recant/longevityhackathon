"""Compassionate AI explanations — Anthropic Claude, Ollama Cloud, or OpenAI."""

from __future__ import annotations

import json
import os
import urllib.error
import urllib.request
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
            f"{name}'s check-ins are saved. Set ANTHROPIC_API_KEY, OLLAMA_API_KEY, or OPENAI_API_KEY "
            "for personalized 'explain like a caring family member' text."
        ),
        "conversation_tip": " ",
        "what_changed": what,
        "mock": True,
    }


def _insight_prompt(profile: dict[str, Any], snapshot: dict[str, Any]) -> str:
    return f"""You help adult children understand a parent's functional aging trends.
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


def _parse_insight_json(text: str, profile: dict[str, Any], snapshot: dict[str, Any]) -> dict[str, Any]:
    try:
        start = text.index("{")
        data = json.loads(text[start:])
        data["mock"] = False
        return data
    except (ValueError, json.JSONDecodeError):
        return _mock_insight(profile, snapshot)


def _claude_chat(prompt: str) -> str:
    import anthropic

    api_key = os.environ.get("ANTHROPIC_API_KEY", "").strip()
    if not api_key:
        raise ValueError("ANTHROPIC_API_KEY not set")
    client = anthropic.Anthropic(api_key=api_key)
    model = os.environ.get("ANTHROPIC_MODEL", "claude-sonnet-4-20250514")
    msg = client.messages.create(
        model=model,
        max_tokens=500,
        messages=[{"role": "user", "content": prompt}],
    )
    return msg.content[0].text.strip()


def _ollama_chat(prompt: str) -> str:
    api_key = os.environ.get("OLLAMA_API_KEY", "").strip()
    if not api_key:
        raise ValueError("OLLAMA_API_KEY not set")
    model = os.environ.get("OLLAMA_MODEL", "gpt-oss:120b").strip()
    host = os.environ.get("OLLAMA_HOST", "https://ollama.com").rstrip("/")
    body = json.dumps(
        {
            "model": model,
            "messages": [{"role": "user", "content": prompt}],
            "stream": False,
        }
    ).encode("utf-8")
    req = urllib.request.Request(
        f"{host}/api/chat",
        data=body,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=120) as resp:
        payload = json.loads(resp.read().decode("utf-8"))
    msg_body = payload.get("message") or {}
    return (msg_body.get("content") or "").strip()


def _openai_chat(prompt: str) -> str:
    api_key = os.environ.get("OPENAI_API_KEY", "").strip()
    if not api_key:
        raise ValueError("OPENAI_API_KEY not set")
    client = OpenAI(api_key=api_key)
    model = os.environ.get("OPENAI_MODEL", "gpt-4o-mini")
    response = client.chat.completions.create(
        model=model,
        messages=[{"role": "user", "content": prompt}],
        max_tokens=400,
    )
    return (response.choices[0].message.content or "").strip()


def generate_insights(profile: dict[str, Any], snapshot: dict[str, Any]) -> dict[str, Any]:
    prompt = _insight_prompt(profile, snapshot)

    if os.environ.get("ANTHROPIC_API_KEY", "").strip():
        try:
            text = _claude_chat(prompt)
            return _parse_insight_json(text, profile, snapshot)
        except Exception:
            pass

    if os.environ.get("OLLAMA_API_KEY", "").strip():
        try:
            text = _ollama_chat(prompt)
            return _parse_insight_json(text, profile, snapshot)
        except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, ValueError, json.JSONDecodeError):
            pass

    if os.environ.get("OPENAI_API_KEY", "").strip():
        try:
            text = _openai_chat(prompt)
            return _parse_insight_json(text, profile, snapshot)
        except Exception:
            pass

    return _mock_insight(profile, snapshot)