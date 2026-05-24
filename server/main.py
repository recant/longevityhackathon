"""Longevitree API — functional aging biomarkers for family caregivers."""

from __future__ import annotations

import os
import shutil
import uuid
from pathlib import Path
from typing import Any

# Load .env from repo root or server/ (OLLAMA_API_KEY, OPENAI_API_KEY, etc.)
try:
    from dotenv import load_dotenv

    _root = Path(__file__).resolve().parent.parent
    load_dotenv(_root / ".env")
    load_dotenv(Path(__file__).resolve().parent / ".env")
except ImportError:
    pass

from fastapi import FastAPI, File, Form, HTTPException, Query, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, HTMLResponse, RedirectResponse, Response
from fastapi.staticfiles import StaticFiles
from starlette.middleware.base import BaseHTTPMiddleware
from pydantic import BaseModel, Field

from cv_analysis import ActionMismatchError, analyze_chair_video, analyze_walk_video, reset_pose_detectors
from database import (
    DATA_DIR,
    clear_assessment_data,
    create_profile,
    get_default_profile,
    get_profile_by_id,
    get_treatment_state,
    init_db,
    list_all_sessions,
    list_profiles,
    save_chair,
    save_gait,
    save_reaction,
    save_treatment_state,
    save_treatment_toggle,
    update_profile,
)
from treatment_tracker import (
    build_treatment_items,
    build_tracker_response,
    new_custom_item,
    period_for,
)
from insights import generate_insights
from interventions import generate_interventions
from scoring import (
    TRACKING_CHECKLIST,
    compute_trend,
    overall_snapshot,
    score_chair_from_cv,
    score_chair_single_stand,
    score_chair_stand,
    score_gait,
    score_gait_from_cv,
    score_reaction,
)

STATIC_DIR = Path(__file__).parent / "static"
UI_DIR = STATIC_DIR / "ui"
V2_DIR = STATIC_DIR / "v2"
LEGACY_UI = STATIC_DIR / "index.html"
BUILD_ID = "2026-05-24-v2-integrated"

app = FastAPI(title="Longevitree API", version="0.2.0", description="Longevity translator for families")

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


@app.on_event("startup")
async def startup() -> None:
    await init_db()


class ProfileCreate(BaseModel):
    display_name: str = Field(..., min_length=1, max_length=80)
    age: int = Field(..., ge=50, le=110)
    sex: str = "female"


class ProfileUpdate(BaseModel):
    display_name: str | None = None
    age: int | None = Field(None, ge=50, le=110)
    sex: str | None = None
    lifestyle: str | None = None
    medications: str | None = None
    smoking: str | None = None
    sleep_habits: str | None = None


async def _require_profile(profile_id: int | None = None) -> dict[str, Any]:
    if profile_id is not None:
        try:
            return await get_profile_by_id(profile_id)
        except RuntimeError as e:
            raise HTTPException(404, "Profile not found") from e
    try:
        return await get_default_profile()
    except RuntimeError as e:
        raise HTTPException(404, "No parent profile yet. Add one from the journal screen.") from e


class ReactionBody(BaseModel):
    trials_ms: list[float] = Field(..., min_length=1)


class GaitBody(BaseModel):
    time_seconds: float = Field(..., gt=0, le=120)


class ChairBody(BaseModel):
    rise_time_seconds: float = Field(..., gt=0.4, le=20.0)


class ChairRepsBody(BaseModel):
    reps: int = Field(..., ge=0, le=50)


class TreatmentToggleBody(BaseModel):
    item_id: str = Field(..., min_length=1, max_length=80)
    period: str | None = None
    done: bool = True


class TreatmentCustomBody(BaseModel):
    label: str = Field(..., min_length=1, max_length=120)
    detail: str = Field("", max_length=500)
    cadence_key: str = Field("weekly", pattern="^(daily|weekly|monthly)$")


class TreatmentNoteBody(BaseModel):
    item_id: str = Field(..., min_length=1, max_length=80)
    note: str = Field("", max_length=500)


def _profile_age_sex(profile: dict[str, Any]) -> tuple[int, str | None]:
    age = int(profile.get("age") or 68)
    sex = profile.get("sex")
    return age, sex


def _actions_from_cited_interventions(interventions: list[dict[str, Any]]) -> list[dict[str, str]]:
    actions: list[dict[str, str]] = []
    for item in interventions:
        citation = item.get("citation") or {}
        if not citation.get("peer_reviewed"):
            continue
        citation_label = str(citation.get("display") or citation.get("short") or "Peer-reviewed source")
        parts = [str(item.get("suggestion") or "")]
        if item.get("rationale"):
            parts.append(f"Why: {item['rationale']}")
        parts.append(f"Evidence: {citation_label}")
        actions.append({"title": str(item.get("title") or "Suggested habit"), "detail": " ".join(p for p in parts if p)})
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
        "profile": {"id": profile["id"], "display_name": profile["display_name"], "age": age, "sex": sex},
        "overall": overall,
        "categories": categories,
        "actions": _actions_from_cited_interventions(interventions),
        "interventions": interventions,
        "tracking_checklist": TRACKING_CHECKLIST,
        "history_counts": {"reactions": len(reactions), "gaits": len(gaits), "chairs": len(chairs)},
    }


def _brand_html(text: str) -> str:
    text = text.replace("KinSpan", "Longevitree").replace("kinspan", "longevitree").replace("KINSPAN", "LONGEVITREE")
    text = text.replace("The first steps of their Longevity Journey", "")
    text = text.replace("CV engine: opencv — pip install mediapipe for better pose tracking", "")
    text = text.replace("CV engine: opencv - pip install mediapipe for better pose tracking", "")
    script = '<script src="/v2/longevitree-brand-patch.js"></script>'
    if script not in text and "</body>" in text:
        text = text.replace("</body>", f"{script}\n</body>")
    return text


def _ui_file(path: Path) -> Response:
    if path.suffix.lower() == ".html":
        return HTMLResponse(
            _brand_html(path.read_text(encoding="utf-8")),
            headers={"Cache-Control": "no-store, no-cache, must-revalidate"},
        )
    return FileResponse(path, headers={"Cache-Control": "no-store, no-cache, must-revalidate"})


@app.get("/")
async def root_ui() -> Response:
    """Longevitree v2 UI integrated with the API."""
    if (V2_DIR / "index.html").is_file():
        return _ui_file(V2_DIR / "index.html")
    if (UI_DIR / "index.html").is_file():
        return _ui_file(UI_DIR / "index.html")
    return _ui_file(LEGACY_UI)


@app.get("/classic")
async def classic_ui() -> Response:
    """Full guided test UI with video analysis."""
    return _ui_file(LEGACY_UI)


@app.get("/format-api-error.js")
async def format_api_error_js() -> FileResponse:
    return FileResponse(STATIC_DIR / "format-api-error.js", media_type="application/javascript", headers={"Cache-Control": "no-store, no-cache, must-revalidate"})


@app.get("/v2")
async def v2_ui_redirect() -> RedirectResponse:
    return RedirectResponse(url="/v2/", status_code=302)


if UI_DIR.is_dir():
    app.mount("/ui", StaticFiles(directory=UI_DIR), name="ui")

if V2_DIR.is_dir():
    app.mount("/v2", StaticFiles(directory=V2_DIR, html=True), name="v2")


@app.post("/api/reset")
async def reset_data() -> dict[str, Any]:
    reset_pose_detectors()
    counts = await clear_assessment_data()
    return {
        "ok": True,
        "cleared": counts,
        "hint": "Hard-refresh the browser (Ctrl+Shift+R). In devtools, clear Longevitree local/session storage if needed.",
    }


@app.get("/api/health")
async def health() -> dict[str, Any]:
    try:
        import mediapipe  # noqa: F401
        cv_backend = "opencv+mediapipe"
    except ImportError:
        cv_backend = "opencv"
    return {"status": "ok", "app": "longevitree", "ui": "/", "ui_v2_preview": "/v2/", "cv_backend": cv_backend, "build": BUILD_ID}


@app.get("/api/version")
async def version() -> dict[str, str]:
    return {"build": BUILD_ID, "classic": "/classic", "ui": "/"}


@app.get("/api/paths")
async def assessment_paths() -> dict[str, Any]:
    return {
        "paths": [
            {"id": "manual", "title": "At-home tests", "description": "Stopwatch, tap reaction, chair counter — no video upload.", "biomarkers": ["reaction", "gait", "chair"]},
            {"id": "computer_vision", "title": "Video analysis", "description": "Film walking and chair rises; computer vision estimates speed, gait, and reps.", "biomarkers": ["gait_video", "chair_video", "reaction_optional"]},
        ]
    }


@app.get("/api/profiles")
async def get_profiles() -> dict[str, Any]:
    return {"profiles": await list_profiles()}


@app.post("/api/profiles")
async def post_profile(body: ProfileCreate) -> dict:
    return await create_profile(body.display_name.strip(), body.age, body.sex)


@app.get("/api/profile")
async def get_profile(profile_id: int | None = Query(None)) -> dict:
    return await _require_profile(profile_id)


@app.put("/api/profile")
async def put_profile(body: ProfileUpdate, profile_id: int | None = Query(None)) -> dict:
    prof = await _require_profile(profile_id)
    data = body.model_dump(exclude_unset=True)
    return await update_profile(prof["id"], data)


@app.post("/api/assessments/reaction")
async def post_reaction(body: ReactionBody, profile_id: int | None = Query(None)) -> dict:
    prof = await _require_profile(profile_id)
    age, sex = _profile_age_sex(prof)
    trials = sorted(body.trials_ms)
    n = len(trials)
    mid = n // 2
    median = trials[mid] if n % 2 else (trials[mid - 1] + trials[mid]) / 2
    scores = score_reaction(median, age)
    session = await save_reaction(prof["id"], median, body.trials_ms, scores)
    return {"session": session, "scores": scores}


@app.post("/api/assessments/gait")
async def post_gait(body: GaitBody, profile_id: int | None = Query(None)) -> dict:
    prof = await _require_profile(profile_id)
    age, sex = _profile_age_sex(prof)
    scores = score_gait(body.time_seconds, age, sex)
    session = await save_gait(prof["id"], body.time_seconds, scores)
    return {"session": session, "scores": scores}


@app.post("/api/assessments/chair-stand")
async def post_chair(body: ChairBody, profile_id: int | None = Query(None)) -> dict:
    prof = await _require_profile(profile_id)
    age, sex = _profile_age_sex(prof)
    scores = score_chair_single_stand(body.rise_time_seconds, 0.5, age, sex)
    session = await save_chair(prof["id"], 1, scores)
    return {"session": session, "scores": scores}


@app.post("/api/assessments/chair-reps")
async def post_chair_reps(body: ChairRepsBody, profile_id: int | None = Query(None)) -> dict:
    prof = await _require_profile(profile_id)
    age, sex = _profile_age_sex(prof)
    scores = score_chair_stand(body.reps, age, sex)
    session = await save_chair(prof["id"], body.reps, scores)
    return {"session": session, "scores": scores}


@app.get("/api/snapshot")
async def snapshot(profile_id: int | None = Query(None)) -> dict[str, Any]:
    prof = await _require_profile(profile_id)
    history = await list_all_sessions(prof["id"])
    snap = _build_snapshot(prof, history)
    snap["insights"] = generate_insights(prof, snap)
    return snap


@app.get("/api/history")
async def history(profile_id: int | None = Query(None)) -> dict:
    prof = await _require_profile(profile_id)
    return await list_all_sessions(prof["id"])


async def _treatment_tracker_payload(prof: dict[str, Any]) -> dict[str, Any]:
    history = await list_all_sessions(prof["id"])
    snap = _build_snapshot(prof, history)
    state = await get_treatment_state(prof["id"])
    items = build_treatment_items(snap.get("categories") or [], prof, actions=snap.get("actions"), state=state)
    payload = build_tracker_response(items, state, history, profile=prof)
    payload["profile"] = {"id": prof["id"], "display_name": prof.get("display_name")}
    payload["interventions"] = snap.get("interventions") or []
    return payload


@app.get("/api/treatment-tracker")
async def treatment_tracker(profile_id: int | None = Query(None)) -> dict[str, Any]:
    prof = await _require_profile(profile_id)
    return await _treatment_tracker_payload(prof)


@app.post("/api/treatment-tracker/toggle")
async def treatment_tracker_toggle(body: TreatmentToggleBody, profile_id: int | None = Query(None)) -> dict[str, Any]:
    prof = await _require_profile(profile_id)
    state = await get_treatment_state(prof["id"])
    history = await list_all_sessions(prof["id"])
    snap = _build_snapshot(prof, history)
    items = build_treatment_items(snap.get("categories") or [], prof, actions=snap.get("actions"), state=state)
    item = next((i for i in items if i["id"] == body.item_id), None)
    if not item:
        raise HTTPException(404, "Checklist item not found")
    period = body.period or period_for(item["cadence_key"])
    await save_treatment_toggle(prof["id"], body.item_id, period, body.done)
    return await _treatment_tracker_payload(prof)


@app.post("/api/treatment-tracker/items")
async def treatment_tracker_add_item(body: TreatmentCustomBody, profile_id: int | None = Query(None)) -> dict[str, Any]:
    prof = await _require_profile(profile_id)
    state = await get_treatment_state(prof["id"])
    custom = list(state.get("custom_items") or [])
    custom.append(new_custom_item(body.label, body.detail, body.cadence_key))
    state["custom_items"] = custom
    await save_treatment_state(prof["id"], state)
    return await _treatment_tracker_payload(prof)


@app.delete("/api/treatment-tracker/items/{item_id}")
async def treatment_tracker_remove_item(item_id: str, profile_id: int | None = Query(None)) -> dict[str, Any]:
    prof = await _require_profile(profile_id)
    state = await get_treatment_state(prof["id"])
    if item_id.startswith("custom-"):
        state["custom_items"] = [c for c in (state.get("custom_items") or []) if str(c.get("id")) != item_id]
        completions = state.get("completions") or {}
        if item_id in completions:
            del completions[item_id]
    else:
        dismissed = list(state.get("dismissed") or [])
        if item_id not in dismissed:
            dismissed.append(item_id)
        state["dismissed"] = dismissed
    await save_treatment_state(prof["id"], state)
    return await _treatment_tracker_payload(prof)


@app.put("/api/treatment-tracker/note")
async def treatment_tracker_note(body: TreatmentNoteBody, profile_id: int | None = Query(None)) -> dict[str, Any]:
    prof = await _require_profile(profile_id)
    state = await get_treatment_state(prof["id"])
    notes = dict(state.get("notes") or {})
    note = body.note.strip()
    if note:
        notes[body.item_id] = note
    elif body.item_id in notes:
        del notes[body.item_id]
    state["notes"] = notes
    await save_treatment_state(prof["id"], state)
    return await _treatment_tracker_payload(prof)


@app.post("/api/treatment-tracker/complete-daily")
async def treatment_tracker_complete_daily(profile_id: int | None = Query(None)) -> dict[str, Any]:
    prof = await _require_profile(profile_id)
    state = await get_treatment_state(prof["id"])
    history = await list_all_sessions(prof["id"])
    snap = _build_snapshot(prof, history)
    items = build_treatment_items(snap.get("categories") or [], prof, actions=snap.get("actions"), state=state)
    period = period_for("daily")
    completions = state.setdefault("completions", {})
    for item in items:
        if item["cadence_key"] != "daily" or item.get("biomarker"):
            continue
        periods = list(completions.get(item["id"], []))
        if period not in periods:
            periods.append(period)
        completions[item["id"]] = periods
    await save_treatment_state(prof["id"], state)
    return await _treatment_tracker_payload(prof)


def _save_upload(video: UploadFile) -> Path:
    if not video.content_type or not video.content_type.startswith("video/"):
        raise HTTPException(400, "Expected a video file")
    ext = Path(video.filename or "clip.webm").suffix or ".webm"
    dest = DATA_DIR / "videos" / f"{uuid.uuid4().hex}{ext}"
    with dest.open("wb") as f:
        shutil.copyfileobj(video.file, f)
    return dest


@app.post("/api/assessments/cv/walk")
async def post_cv_walk(video: UploadFile = File(...), distance_meters: float = Form(3.048), profile_id: int | None = Query(None)) -> dict[str, Any]:
    prof = await _require_profile(profile_id)
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
async def post_cv_chair(video: UploadFile = File(...), profile_id: int | None = Query(None)) -> dict[str, Any]:
    prof = await _require_profile(profile_id)
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
