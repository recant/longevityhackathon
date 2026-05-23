"""Sample video frames and analyze with OpenAI vision (or mock)."""

from __future__ import annotations

import base64
import json
import os
import re
from io import BytesIO
from pathlib import Path
from typing import Any

import cv2
from openai import OpenAI
from PIL import Image

TASK_PROMPTS = {
    "walk": (
        "You are assisting a family wellness app (not medical diagnosis). "
        "These frames are from a short video of an older adult walking toward or across the camera. "
        "Estimate observable gait qualities on a 0–100 scale where 100 is steady, symmetric, confident. "
        "Return ONLY valid JSON with keys: "
        "steadiness_score (number), stride_symmetry_score (number), "
        "pace_notes (string, child-friendly), flags (array of short strings, e.g. 'uneven step'), "
        "confidence (number 0-1 how sure you are from these frames)."
    ),
    "sit_stand": (
        "You are assisting a family wellness app (not medical diagnosis). "
        "These frames show an older adult standing up from a chair (sit-to-stand). "
        "Return ONLY valid JSON with keys: "
        "ease_score (number 0-100, higher = smoother rise), "
        "estimated_seconds_to_stand (number or null), "
        "arm_use_notes (string, child-friendly), flags (array of strings), "
        "confidence (number 0-1)."
    ),
}


def extract_frames(video_path: Path, max_frames: int = 8) -> list[bytes]:
    cap = cv2.VideoCapture(str(video_path))
    if not cap.isOpened():
        raise ValueError("Could not open video file")
    total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT)) or 1
    step = max(1, total // max_frames)
    frames: list[bytes] = []
    idx = 0
    while len(frames) < max_frames:
        cap.set(cv2.CAP_PROP_POS_FRAMES, idx)
        ok, frame = cap.read()
        if not ok:
            break
        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        img = Image.fromarray(rgb)
        img.thumbnail((768, 768))
        buf = BytesIO()
        img.save(buf, format="JPEG", quality=85)
        frames.append(buf.getvalue())
        idx += step
    cap.release()
    if not frames:
        raise ValueError("No frames extracted from video")
    return frames


def _parse_json_response(text: str) -> dict[str, Any]:
    text = text.strip()
    match = re.search(r"\{[\s\S]*\}", text)
    if match:
        text = match.group(0)
    return json.loads(text)


def mock_analysis(task_type: str) -> dict[str, Any]:
    if task_type == "walk":
        return {
            "steadiness_score": 72,
            "stride_symmetry_score": 68,
            "pace_notes": "Mock mode: enable OPENAI_API_KEY for real analysis.",
            "flags": ["demo_data"],
            "confidence": 0.3,
            "mock": True,
        }
    return {
        "ease_score": 70,
        "estimated_seconds_to_stand": 2.8,
        "arm_use_notes": "Mock mode: enable OPENAI_API_KEY for real analysis.",
        "flags": ["demo_data"],
        "confidence": 0.3,
        "mock": True,
    }


def analyze_video(video_path: Path, task_type: str) -> dict[str, Any]:
    if task_type not in TASK_PROMPTS:
        raise ValueError(f"Unknown task_type: {task_type}")

    api_key = os.environ.get("OPENAI_API_KEY", "").strip()
    if not api_key:
        return mock_analysis(task_type)

    frames = extract_frames(video_path)
    client = OpenAI(api_key=api_key)
    content: list[dict[str, Any]] = [{"type": "text", "text": TASK_PROMPTS[task_type]}]
    for raw in frames:
        b64 = base64.standard_b64encode(raw).decode("ascii")
        content.append(
            {
                "type": "image_url",
                "image_url": {"url": f"data:image/jpeg;base64,{b64}"},
            }
        )

    response = client.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": content}],
        max_tokens=500,
    )
    text = response.choices[0].message.content or "{}"
    result = _parse_json_response(text)
    result["mock"] = False
    result["frame_count"] = len(frames)
    return result


def summary_for_child(task_type: str, analysis: dict[str, Any]) -> str:
    if task_type == "walk":
        s = analysis.get("steadiness_score", "?")
        sym = analysis.get("stride_symmetry_score", "?")
        notes = analysis.get("pace_notes", "")
        return f"Walking check-in: steadiness {s}/100, symmetry {sym}/100. {notes}"
    ease = analysis.get("ease_score", "?")
    secs = analysis.get("estimated_seconds_to_stand")
    arm = analysis.get("arm_use_notes", "")
    time_part = f" About {secs}s to stand." if secs else ""
    return f"Chair rise check-in: ease {ease}/100.{time_part} {arm}"
