"""SQLite persistence for KinSpan profiles and biomarker sessions."""

from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import aiosqlite

DATA_DIR = Path(os.environ.get("PARENT_PACE_DATA_DIR", Path(__file__).parent / "data"))
DB_PATH = DATA_DIR / "kinspan.db"


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


async def _migrate_profiles(db: aiosqlite.Connection) -> None:
    cur = await db.execute("PRAGMA table_info(profiles)")
    cols = {row[1] for row in await cur.fetchall()}
    additions = [
        ("age", "INTEGER"),
        ("sex", "TEXT"),
        ("lifestyle", "TEXT"),
        ("medications", "TEXT"),
        ("smoking", "TEXT"),
        ("sleep_habits", "TEXT"),
    ]
    for name, typ in additions:
        if name not in cols:
            await db.execute(f"ALTER TABLE profiles ADD COLUMN {name} {typ}")


async def _migrate_session_mode(db: aiosqlite.Connection) -> None:
    for table in ("gait_sessions", "chair_sessions", "reaction_sessions"):
        cur = await db.execute(f"PRAGMA table_info({table})")
        cols = {row[1] for row in await cur.fetchall()}
        if "assessment_mode" not in cols:
            await db.execute(
                f"ALTER TABLE {table} ADD COLUMN assessment_mode TEXT DEFAULT 'manual'"
            )


async def init_db() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    (DATA_DIR / "videos").mkdir(exist_ok=True)
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            """
            CREATE TABLE IF NOT EXISTS profiles (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                display_name TEXT NOT NULL,
                age INTEGER,
                sex TEXT,
                lifestyle TEXT,
                medications TEXT,
                smoking TEXT,
                sleep_habits TEXT,
                created_at TEXT NOT NULL
            )
            """
        )
        await _migrate_profiles(db)
        await db.execute(
            """
            CREATE TABLE IF NOT EXISTS reaction_sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                profile_id INTEGER NOT NULL,
                median_ms REAL NOT NULL,
                trials_json TEXT NOT NULL,
                scores_json TEXT NOT NULL,
                created_at TEXT NOT NULL
            )
            """
        )
        await db.execute(
            """
            CREATE TABLE IF NOT EXISTS gait_sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                profile_id INTEGER NOT NULL,
                time_seconds REAL NOT NULL,
                scores_json TEXT NOT NULL,
                created_at TEXT NOT NULL
            )
            """
        )
        await db.execute(
            """
            CREATE TABLE IF NOT EXISTS chair_sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                profile_id INTEGER NOT NULL,
                reps INTEGER NOT NULL,
                scores_json TEXT NOT NULL,
                created_at TEXT NOT NULL
            )
            """
        )
        await _migrate_session_mode(db)
        await db.execute(
            """
            CREATE TABLE IF NOT EXISTS treatment_tracker (
                profile_id INTEGER PRIMARY KEY,
                state_json TEXT NOT NULL DEFAULT '{}',
                updated_at TEXT NOT NULL
            )
            """
        )
        await db.commit()


async def list_profiles() -> list[dict[str, Any]]:
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        cur = await db.execute("SELECT * FROM profiles ORDER BY id ASC")
        rows = await cur.fetchall()
        return [dict(r) for r in rows]


async def create_profile(
    display_name: str,
    age: int,
    sex: str,
) -> dict[str, Any]:
    created = _utc_now()
    async with aiosqlite.connect(DB_PATH) as db:
        cur = await db.execute(
            """
            INSERT INTO profiles (display_name, age, sex, created_at)
            VALUES (?, ?, ?, ?)
            """,
            (display_name, age, sex, created),
        )
        await db.commit()
        pid = cur.lastrowid
    return await get_profile_by_id(int(pid))


async def get_profile_by_id(profile_id: int) -> dict[str, Any]:
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        cur = await db.execute("SELECT * FROM profiles WHERE id = ?", (profile_id,))
        row = await cur.fetchone()
        if row is None:
            raise RuntimeError(f"Profile {profile_id} not found")
        return dict(row)


async def get_default_profile() -> dict[str, Any]:
    profiles = await list_profiles()
    if not profiles:
        raise RuntimeError("No profile found")
    return profiles[0]


async def delete_profile(profile_id: int) -> None:
    """Remove one profile and all sessions / tracker state for that profile."""
    async with aiosqlite.connect(DB_PATH) as db:
        for table in ("reaction_sessions", "gait_sessions", "chair_sessions"):
            await db.execute(f"DELETE FROM {table} WHERE profile_id = ?", (profile_id,))
        await db.execute("DELETE FROM treatment_tracker WHERE profile_id = ?", (profile_id,))
        await db.execute("DELETE FROM profiles WHERE id = ?", (profile_id,))
        await db.commit()


async def update_profile(profile_id: int, data: dict[str, Any]) -> dict[str, Any]:
    allowed = ("display_name", "age", "sex", "lifestyle", "medications", "smoking", "sleep_habits")
    sets = []
    vals: list[Any] = []
    for key in allowed:
        if key in data:
            sets.append(f"{key} = ?")
            vals.append(data[key])
    if not sets:
        return await get_profile_by_id(profile_id)
    vals.append(profile_id)
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            f"UPDATE profiles SET {', '.join(sets)} WHERE id = ?",
            vals,
        )
        await db.commit()
    return await get_profile_by_id(profile_id)


async def save_reaction(
    profile_id: int,
    median_ms: float,
    trials: list[float],
    scores: dict[str, Any],
) -> dict[str, Any]:
    created = _utc_now()
    async with aiosqlite.connect(DB_PATH) as db:
        cur = await db.execute(
            """
            INSERT INTO reaction_sessions
            (profile_id, median_ms, trials_json, scores_json, created_at)
            VALUES (?, ?, ?, ?, ?)
            """,
            (profile_id, median_ms, json.dumps(trials), json.dumps(scores), created),
        )
        await db.commit()
        sid = cur.lastrowid
    return {"id": sid, "median_ms": median_ms, "trials": trials, "scores": scores, "created_at": created}


async def save_gait(
    profile_id: int,
    time_seconds: float,
    scores: dict[str, Any],
    *,
    assessment_mode: str = "manual",
) -> dict[str, Any]:
    created = _utc_now()
    mode = scores.get("assessment_mode", assessment_mode)
    async with aiosqlite.connect(DB_PATH) as db:
        cur = await db.execute(
            """
            INSERT INTO gait_sessions (profile_id, time_seconds, scores_json, created_at, assessment_mode)
            VALUES (?, ?, ?, ?, ?)
            """,
            (profile_id, time_seconds, json.dumps(scores), created, mode),
        )
        await db.commit()
        sid = cur.lastrowid
    return {"id": sid, "time_seconds": time_seconds, "scores": scores, "created_at": created}


async def save_chair(
    profile_id: int,
    reps: int,
    scores: dict[str, Any],
    *,
    assessment_mode: str = "manual",
) -> dict[str, Any]:
    created = _utc_now()
    mode = scores.get("assessment_mode", assessment_mode)
    async with aiosqlite.connect(DB_PATH) as db:
        cur = await db.execute(
            """
            INSERT INTO chair_sessions (profile_id, reps, scores_json, created_at, assessment_mode)
            VALUES (?, ?, ?, ?, ?)
            """,
            (profile_id, reps, json.dumps(scores), created, mode),
        )
        await db.commit()
        sid = cur.lastrowid
    return {"id": sid, "reps": reps, "scores": scores, "created_at": created}


async def list_all_sessions(profile_id: int, limit: int = 24) -> dict[str, Any]:
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row

        async def reactions() -> list[dict]:
            cur = await db.execute(
                """
                SELECT id, median_ms, trials_json, scores_json, created_at
                FROM reaction_sessions WHERE profile_id = ?
                ORDER BY created_at DESC LIMIT ?
                """,
                (profile_id, limit),
            )
            out = []
            for row in await cur.fetchall():
                d = dict(row)
                d["trials"] = json.loads(d.pop("trials_json"))
                d["scores"] = json.loads(d.pop("scores_json"))
                out.append(d)
            return out

        async def gaits() -> list[dict]:
            cur = await db.execute(
                """
                SELECT id, time_seconds, scores_json, created_at
                FROM gait_sessions WHERE profile_id = ?
                ORDER BY created_at DESC LIMIT ?
                """,
                (profile_id, limit),
            )
            out = []
            for row in await cur.fetchall():
                d = dict(row)
                d["scores"] = json.loads(d.pop("scores_json"))
                out.append(d)
            return out

        async def chairs() -> list[dict]:
            cur = await db.execute(
                """
                SELECT id, reps, scores_json, created_at
                FROM chair_sessions WHERE profile_id = ?
                ORDER BY created_at DESC LIMIT ?
                """,
                (profile_id, limit),
            )
            out = []
            for row in await cur.fetchall():
                d = dict(row)
                d["scores"] = json.loads(d.pop("scores_json"))
                out.append(d)
            return out

        return {
            "reactions": await reactions(),
            "gaits": await gaits(),
            "chairs": await chairs(),
        }


async def get_treatment_state(profile_id: int) -> dict[str, Any]:
    from treatment_tracker import normalize_state

    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        cur = await db.execute(
            "SELECT state_json FROM treatment_tracker WHERE profile_id = ?",
            (profile_id,),
        )
        row = await cur.fetchone()
        if not row:
            return normalize_state(None)
        try:
            data = json.loads(row["state_json"])
        except json.JSONDecodeError:
            return normalize_state(None)
        return normalize_state(data)


async def save_treatment_state(profile_id: int, state: dict[str, Any]) -> dict[str, Any]:
    from treatment_tracker import normalize_state

    clean = normalize_state(state)
    updated = _utc_now()
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            """
            INSERT INTO treatment_tracker (profile_id, state_json, updated_at)
            VALUES (?, ?, ?)
            ON CONFLICT(profile_id) DO UPDATE SET
                state_json = excluded.state_json,
                updated_at = excluded.updated_at
            """,
            (profile_id, json.dumps(clean), updated),
        )
        await db.commit()
    return clean


async def save_treatment_toggle(
    profile_id: int,
    item_id: str,
    period: str,
    done: bool,
) -> dict[str, Any]:
    state = await get_treatment_state(profile_id)
    completions: dict[str, list[str]] = state.setdefault("completions", {})
    periods = list(completions.get(item_id, []))
    if done:
        if period not in periods:
            periods.append(period)
    else:
        periods = [p for p in periods if p != period]
    if periods:
        completions[item_id] = periods
    elif item_id in completions:
        del completions[item_id]
    return await save_treatment_state(profile_id, state)


async def clear_assessment_data() -> dict[str, int]:
    """Delete all biomarker sessions and uploaded videos (keeps profile)."""
    counts = {"reactions": 0, "gaits": 0, "chairs": 0, "videos_removed": 0}
    async with aiosqlite.connect(DB_PATH) as db:
        for table, key in (
            ("reaction_sessions", "reactions"),
            ("gait_sessions", "gaits"),
            ("chair_sessions", "chairs"),
        ):
            cur = await db.execute(f"DELETE FROM {table}")
            counts[key] = cur.rowcount
        await db.commit()

    counts["videos_removed"] = _clear_uploaded_videos()
    return counts


def _clear_uploaded_videos() -> int:
    removed = 0
    videos_dir = DATA_DIR / "videos"
    if videos_dir.is_dir():
        for f in videos_dir.iterdir():
            if f.is_file():
                f.unlink(missing_ok=True)
                removed += 1
    return removed


async def clear_all_app_data() -> dict[str, int]:
    """Delete profiles, assessments, treatment plans, and uploaded videos."""
    counts = await clear_assessment_data()
    async with aiosqlite.connect(DB_PATH) as db:
        cur = await db.execute("DELETE FROM treatment_tracker")
        counts["treatment_plans"] = cur.rowcount
        cur = await db.execute("DELETE FROM profiles")
        counts["profiles"] = cur.rowcount
        await db.commit()
    return counts
