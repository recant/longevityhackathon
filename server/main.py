"""KinSpan API — functional aging biomarkers for family caregivers."""

from __future__ import annotations

import os
import shutil
import uuid
from pathlib import Path

# Load .env from repo root or server/ (OLLAMA_API_KEY, OPENAI_API_KEY, etc.)
try:
    from dotenv import load_dotenv

    _root = Path(__file__).resolve().parent.parent
    load_dotenv(_root / ".env")
    load_dotenv(Path(__file__).resolve().parent / ".env")
except ImportError:
    pass
from typing import Any

from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, RedirectResponse, Response
from fastapi.staticfiles import StaticFiles
from starlette.middleware.base import BaseHTTPMiddleware
from pydantic import BaseModel, Field

from cv_analysis import ActionMismatchError, analyze_chair_video, analyze_walk_video, reset_pose_detectors
from database import (
    DATA_DIR,
    clear_assessment_data,
    get_default_profile,
    init_db,
    list_all_sessions,
    save_chair,
    save_gait,
    save_reaction,
    update_profile,
)
from insights import generate_insights
from interventions import generate_interventions
from scoring import (
    TRACKING_CHECKLIST,
    compute_trend,
    default_actions,
    overall_snapshot,
    score_chair_from_cv,
    score_chair_single_stand,
    score_chair_stand,
    score_gait,
    score_gait_from_cv,
    score_reaction,
)
from share_auth import ShareAuthMiddleware, share_auth_enabled

STATIC_DIR = Path(__file__).parent / "static"
UI_DIR = STATIC_DIR / "ui"
V2_DIR = STATIC_DIR / "v2"
LEGACY_UI = STATIC_DIR / "index.html"
BUILD_ID = "2026-05-24-v2-integrated"

app = FastAPI(title="KinSpan API", version="0.2.0", description="Longevity translator for families")

_cors_origins = [
    o.strip()
    for o in os.getenv(
        "ALLOWED_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173",
    ).split(",")
    if o.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class NoCacheMiddleware(BaseHTTPMiddleware):
    """Prevent stale HTML/JS/API scores from browser disk cache during development."""

    async def dispatch(self, request: Request, call_next):
        response: Response = await call_next(request)
        path = request.url.path
        if path.startswith("/api") or path in ("/", "/classic") or path.startswith("/ui") or path.startswith("/v2"):
            response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
            response.headers["Pragma"] = "no-cache"
        return response


app.add_middleware(NoCacheMiddleware)
app.add_middleware(ShareAuthMiddleware)


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
    rise_time_seconds: float = Field(..., gt=0.4, le=20.0)


class ChairRepsBody(BaseModel):
    reps: int = Field(..., ge=0, le=50)


def _profile_age_sex(profile: dict[str, Any]) -> tuple[int, str | None]:
    age = int(profile.get("age") or 68)
    sex = profile.get("sex")
    return age, sex


def _actions_from_cited_interventions(interventions: list[dict[str, Any]]) -> list[dict[str, str]]:
    """Backward-compatible `actions` view derived from cited interventions.

    Older UI surfaces, including the classic guided check-in, render `snapshot.actions`
    as simple title/detail objects. Keeping this adapter means those surfaces now show
    citation-backed suggestions without deleting the original `default_actions` code.
    """
    actions: list[dict[str, str]] = []
    for item in interventions:
        citation = item.get("citation") or {}
        suggestion = str(item.get("suggestion") or "")
        rationale = str(item.get("rationale") or "")
        title = str(item.get("title") or "Suggested habit")

        evidence_bits: list[str] = []
        if citation.get("short"):
            evidence_bits.append(f"Evidence: {citation['short']}")
        if citation.get("doi"):
            evidence_bits.append(f"DOI: {citation['doi']}")
        if citation.get("url"):
            evidence_bits.append(f"Source: {citation['url']}")

        detail_parts = [suggestion]
        if rationale:
            detail_parts.append(f"Why: {rationale}")
        if evidence_bits:
            detail_parts.append(" ".join(evidence_bits))

        actions.append({"title": title, "detail": " ".join(part for part in detail_parts if part)})
    return actions


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
    interventions = generate_interventions(categories, profile)
    return {
        "profile": {
            "id": profile["id"],
            "display_name": profile["display_name"],
            "age": age,
            "sex": sex,
        },
        "overall": overall,
        "categories": categories,
        "actions": _actions_from_cited_interventions(interventions),
        "legacy_actions": default_actions(categories),
        "interventions": interventions,
        "tracking_checklist": TRACKING_CHECKLIST,
        "history_counts": {
            "reactions": len(reactions),
            "gaits": len(gaits),
            "chairs": len(chairs),
        },
    }


def _ui_file(path: Path) -> FileResponse:
    return FileResponse(path, headers={"Cache-Control": "no-store, no-cache, must-revalidate"})


@app.get("/")
async def root_ui() -> FileResponse:
    """KinSpan v2 UI (integrated with API)."""
    if (V2_DIR / "index.html").is_file():
        return _ui_file(V2_DIR / "index.html")
    if (UI_DIR / "index.html").is_file():
        return _ui_file(UI_DIR / "index.html")
    return _ui_file(LEGACY_UI)


@app.get("/classic")
async def classic_ui() -> FileResponse:
    """Full guided test UI with video analysis."""
    return _ui_file(LEGACY_UI)


@app.get("/v2")
async def v2_ui_redirect() -> RedirectResponse:
    """Longevity App v2 (same UI as /)."""
    return RedirectResponse(url="/v2/", status_code=302)


if UI_DIR.is_dir():
    app.mount("/ui", StaticFiles(directory=UI_DIR), name="ui")

if V2_DIR.is_dir():
    app.mount("/v2", StaticFiles(directory=V2_DIR, html=True), name="v2")


@app.post("/api/reset")
async def reset_data() -> dict[str, Any]:
    """Clear assessment sessions, uploaded videos, and in-memory CV pose detectors."""
    reset_pose_detectors()
    counts = await clear_assessment_data()
    return {
        "ok": True,
        "cleared": counts,
        "hint": "Hard-refresh the browser (Ctrl+Shift+R). In devtools: "
        "localStorage.removeItem('kinspan_path'); localStorage.removeItem('kinspan_completed'); "
        "localStorage.removeItem('kinspan_workflow_step');",
    }


@app.get("/api/health")
async def health() -> dict[str, str]:
    try:
        import mediapipe  # noqa: F401

        cv_backend = "opencv+mediapipe"
    except ImportError:
        cv_backend = "opencv"
    return {
        "status": "ok",
        "app": "kinspan",
        "ui": "/",
        "ui_v2_preview": "/v2/",
        "cv_backend": cv_backend,
        "build": BUILD_ID,
        "share_auth": share_auth_enabled(),
    }


@app.get("/api/version")
async def version() -> dict[str, str]:
    return {"build": BUILD_ID, "classic": "/classic", "ui": "/"}


@app.get("/api/paths")
async def assessment_paths() -> dict[str, Any]:
    return {
        "paths": [
            {
                "id": "manual",
                "title": "At-home tests",
                "description": "Stopwatch, tap reaction, chair counter — no video upload.",
                "biomarkers": ["reaction", "gait", "chair"],
            },
            {
                "id": "computer_vision",
                "title": "Video analysis",
                "description": "Film walking and chair rises; computer vision estimates speed, gait, and reps.",
                "biomarkers": ["gait_video", "chair_video", "reaction_optional"],
            },
        ]
    }


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
    scores = score_chair_single_stand(body.rise_time_seconds, 0.5, age, sex)
    session = await save_chair(prof["id"], 1, scores)
    return {"session": session, "scores": scores}


@app.post("/api/assessments/chair-reps")
async def post_chair_reps(body: ChairRepsBody) -> dict:
    """CDC STEADI 30-second chair stand — rep count scoring (Rikli norms)."""
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


def _save_upload(video: UploadFile) -> Path:
    if not video.content_type or not video.content_type.startswith("video/"):
        raise HTTPException(400, "Expected a video file")
    ext = Path(video.filename or "clip.webm").suffix or ".webm"
    dest = DATA_DIR / "videos" / f"{uuid.uuid4().hex}{ext}"
    with dest.open("wb") as f:
        shutil.copyfileobj(video.file, f)
    return dest


@app.post("/api/assessments/cv/walk")
async def post_cv_walk(
    video: UploadFile = File(...),
    distance_meters: float = Form(3.048),
) -> dict[str, Any]:
    prof = await get_default_profile()
    age, sex = _profile_age_sex(prof)
    dest = _save_upload(video)
    try:
        cv = analyze_walk_video(dest, distance_meters=distance_meters)
        scores = score_gait_from_cv(cv, age, sex)
    except ActionMismatchError as e:
        dest.unlink(missing_ok=True)
        raise HTTPException(400, str(e)) from e
    except ValueError as e:
        dest.unlink(missing_ok=True)
        raise HTTPException(400, str(e)) from e
    except Exception as e:
        dest.unlink(missing_ok=True)
        raise HTTPException(500, f"Video analysis failed: {e}") from e
    session = await save_gait(prof["id"], float(cv["time_seconds"]), scores)
    dest.unlink(missing_ok=True)
    return {"session": session, "scores": scores, "cv": cv}


@app.post("/api/assessments/cv/chair-stand")
async def post_cv_chair(video: UploadFile = File(...)) -> dict[str, Any]:
    prof = await get_default_profile()
    age, sex = _profile_age_sex(prof)
    dest = _save_upload(video)
    try:
        cv = analyze_chair_video(dest)
        scores = score_chair_from_cv(cv, age, sex)
    except ActionMismatchError as e:
        dest.unlink(missing_ok=True)
        raise HTTPException(400, str(e)) from e
    except ValueError as e:
        dest.unlink(missing_ok=True)
        raise HTTPException(400, str(e)) from e
    except Exception as e:
        dest.unlink(missing_ok=True)
        raise HTTPException(500, f"Video analysis failed: {e}") from e
    session = await save_chair(prof["id"], 1, scores)
    dest.unlink(missing_ok=True)
    return {"session": session, "scores": scores, "cv": cv}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
