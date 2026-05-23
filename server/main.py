"""KinSpan API — functional aging biomarkers for family caregivers."""

from __future__ import annotations

from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from database import get_default_profile, init_db, list_all_sessions, save_chair, save_gait, save_reaction, update_profile
from insights import generate_insights
from scoring import (
    TRACKING_CHECKLIST,
    compute_trend,
    default_actions,
    overall_snapshot,
    score_chair_stand,
    score_gait,
    score_reaction,
)

app = FastAPI(title="KinSpan API", version="0.2.0", description="Longevity translator for families")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup() -> None:
    await init_db()


class ProfileUpdate(BaseModel):
    display_name: str | None = None
    age: int | None = Field(None, ge=50, le=110)
    sex: str | None = None
    lifestyle: str | None = None
    medications: str | None = None
    smoking: str | None = None
    sleep_habits: str | None = None


class ReactionBody(BaseModel):
    trials_ms: list[float] = Field(..., min_length=1)


class GaitBody(BaseModel):
    time_seconds: float = Field(..., gt=0, le=120)


class ChairBody(BaseModel):
    reps: int = Field(..., ge=0, le=50)


def _profile_age_sex(profile: dict[str, Any]) -> tuple[int, str | None]:
    age = int(profile.get("age") or 68)
    sex = profile.get("sex")
    return age, sex


def _build_snapshot(profile: dict[str, Any], history: dict[str, Any]) -> dict[str, Any]:
    age, sex = _profile_age_sex(profile)
    categories: list[dict[str, Any]] = []

    reactions = history.get("reactions", [])
    gaits = history.get("gaits", [])
    chairs = history.get("chairs", [])

    if reactions:
        latest = reactions[0]
        prev = reactions[1]["scores"]["score"] if len(reactions) > 1 else None
        cat = {**latest["scores"], "latest_at": latest["created_at"]}
        cat["trend_detail"] = compute_trend(cat["score"], prev)
        categories.append(cat)

    if gaits:
        latest = gaits[0]
        prev = gaits[1]["scores"]["score"] if len(gaits) > 1 else None
        cat = {**latest["scores"], "latest_at": latest["created_at"]}
        cat["trend_detail"] = compute_trend(cat["score"], prev)
        categories.append(cat)

    if chairs:
        latest = chairs[0]
        prev = chairs[1]["scores"]["score"] if len(chairs) > 1 else None
        cat = {**latest["scores"], "latest_at": latest["created_at"]}
        cat["trend_detail"] = compute_trend(cat["score"], prev)
        categories.append(cat)

    overall = overall_snapshot(categories, age)
    return {
        "profile": {
            "id": profile["id"],
            "display_name": profile["display_name"],
            "age": age,
            "sex": sex,
        },
        "overall": overall,
        "categories": categories,
        "actions": default_actions(categories),
        "tracking_checklist": TRACKING_CHECKLIST,
        "history_counts": {
            "reactions": len(reactions),
            "gaits": len(gaits),
            "chairs": len(chairs),
        },
    }


@app.get("/api/health")
async def health() -> dict[str, str]:
    return {"status": "ok", "app": "kinspan"}


@app.get("/api/profile")
async def get_profile() -> dict:
    return await get_default_profile()


@app.put("/api/profile")
async def put_profile(body: ProfileUpdate) -> dict:
    prof = await get_default_profile()
    data = body.model_dump(exclude_unset=True)
    return await update_profile(prof["id"], data)


@app.post("/api/assessments/reaction")
async def post_reaction(body: ReactionBody) -> dict:
    prof = await get_default_profile()
    age, sex = _profile_age_sex(prof)
    trials = sorted(body.trials_ms)
    n = len(trials)
    mid = n // 2
    median = trials[mid] if n % 2 else (trials[mid - 1] + trials[mid]) / 2
    scores = score_reaction(median, age)
    session = await save_reaction(prof["id"], median, body.trials_ms, scores)
    return {"session": session, "scores": scores}


@app.post("/api/assessments/gait")
async def post_gait(body: GaitBody) -> dict:
    prof = await get_default_profile()
    age, sex = _profile_age_sex(prof)
    scores = score_gait(body.time_seconds, age, sex)
    session = await save_gait(prof["id"], body.time_seconds, scores)
    return {"session": session, "scores": scores}


@app.post("/api/assessments/chair-stand")
async def post_chair(body: ChairBody) -> dict:
    prof = await get_default_profile()
    age, sex = _profile_age_sex(prof)
    scores = score_chair_stand(body.reps, age, sex)
    session = await save_chair(prof["id"], body.reps, scores)
    return {"session": session, "scores": scores}


@app.get("/api/snapshot")
async def snapshot() -> dict[str, Any]:
    prof = await get_default_profile()
    history = await list_all_sessions(prof["id"])
    snap = _build_snapshot(prof, history)
    snap["insights"] = generate_insights(prof, snap)
    return snap


@app.get("/api/history")
async def history() -> dict:
    prof = await get_default_profile()
    return await list_all_sessions(prof["id"])


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
