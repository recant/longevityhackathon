# longevityhackathon — Longevitree

**Control Group Longevity Hackathon** · [GitHub](https://github.com/recant/longevityhackathon)

## Longevitree (KinSpan)

**Longevity translator for families** — a hackathon MVP that turns cheap, at-home observational biomarkers into plain-language aging trajectory insights for adult children worried about their parents.

> Not a medical device. Wellness trends and functional aging only.

## The problem

“I know my parents are aging — but I don’t know what’s normal, what’s urgent, or how to help without fighting cultural beliefs or medical distrust.”

## The solution

Three respected biomarkers → three intuitive categories → trajectory dashboard + compassionate copy + evidence-linked habits.

| Category | Biomarker | What families understand |
|----------|-----------|--------------------------|
| Cognitive Speed | Reaction time (5 taps) | Mental sharpness & responsiveness |
| Mobility | 10-foot walk time → gait speed | Movement health & independence |
| Strength & Stability | Timed chair stand (single rise) | Leg strength & fall resilience |

Scores and advice include **inline citations** to published norms and intervention studies (see [REFERENCES.md](./REFERENCES.md)).

## Scoring philosophy

Rule-based scores (0–100) compare results to **published age/sex norms**, then estimate a **functional age** per category (educational, not diagnostic). Trends use month-over-month score change with gentle language:

- improving ↑
- stable →
- watch closely ↓ (never harsh “high risk” red alerts)

Optional `OPENAI_API_KEY` adds “explain like a caring family member” + conversation tips.

| Evidence | Citation |
|----------|----------|
| Gait & longevity | Studenski et al., JAMA 2011 |
| Gait norms | Bohannon & Andrews, Physiotherapy 2011 |
| Chair stand | CDC STEADI; Rikli & Jones Senior Fitness Test |
| Reaction time | Woods et al., Front Psychol 2015 |
| Interventions | LIFE Study, JAMA 2014; Rosado-Antón et al., BMC Public Health 2021 |

See [HACKATHON.md](./HACKATHON.md) for pitch and [REFERENCES.md](./REFERENCES.md) for full bibliography.

## App features (current)

| Feature | Description |
|---------|-------------|
| **v2 mobile UI** (`/`) | Onboarding → parent profile → Tests, Dashboard, Treatment plan, Progress, Weekly digest |
| **Guided check-in** | Embedded full workflow at `/classic` (At-home vs Video path switch) |
| **Treatment plan** | Family habits with check-offs, filters, custom items, scrollable list |
| **Citations** | Sources on scores, trends, insights, actions, interventions, and post-check-in summaries |
| **Multi-profile** | Switch between parents; data stored per profile in SQLite |
| **Demo reset** | In-app reset (top-right) + `POST /api/reset?full=1` wipes local DB for demos |
| **Video CV** | Optional walk/chair analysis via OpenCV (+ MediaPipe for chair pose) |

**First-time flow:** intro slides → create parent profile → guided video check-in (video path marked preferred). Returning users land on the dashboard.

## Deploy on Render

Teammates can deploy from the private repo using the root [`render.yaml`](./render.yaml) blueprint (Render → **New** → **Blueprint**).

## Run / test via GitHub

### Automated tests (GitHub Actions)

Every push to `main` runs CI: [Actions tab](https://github.com/recant/longevityhackathon/actions)

1. Open **https://github.com/recant/longevityhackathon**
2. Click **Actions** → workflow **CI** → latest run
3. Green check = scoring tests + client build passed

To trigger manually: **Actions** → **CI** → **Run workflow**.

### Clone and run on your machine

```powershell
git clone https://github.com/recant/longevityhackathon.git
cd longevityhackathon
```

Then follow **Run locally** below.

### Quick API check (no UI)

```powershell
cd server
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt pytest
pytest tests/ -v
uvicorn main:app --port 8000
```

In another terminal: open http://127.0.0.1:8000/api/health — should return `{"status":"ok","app":"kinspan"}`.

## Two assessment paths

| Path | What it uses | Biomarkers |
|------|----------------|------------|
| **At-home tests** | Stopwatch, tap pad, timed chair rise | Reaction, 10-ft walk, single chair stand |
| **Video analysis** | OpenCV (+ optional MediaPipe) on uploaded video | Walk gait (speed, cadence, symmetry), chair from video; reaction still manual |

Choose your path at the top of the **classic** UI, then follow the **guided check-in** (stepper, Back/Continue). For better pose tracking: `pip install -r requirements-cv.txt`

**Chair-stand video** uses the MediaPipe **Pose Landmarker full** model (`pose_landmarker_full.task`). It counts reps from **knee extension + hip rise**, not raw pixel motion alone.

## Run locally (recommended)

Use the start script so you always get the latest build on a known port:

```powershell
cd server
.venv\Scripts\activate   # create venv + pip install -r requirements.txt first time
.\start.ps1              # opens http://127.0.0.1:8003/ and http://127.0.0.1:8003/v2/
```

`.\start.ps1 -Fresh` wipes `data/kinspan.db` once for a clean demo.

| URL | UI |
|-----|-----|
| http://localhost:8003/ | **v2** — primary Longevity Journal (Tests, Treatment plan, Dashboard, …) |
| http://localhost:8003/classic | Full guided check-in (at-home + video paths) |
| http://localhost:8003/v2/ | Same v2 app (alias) |

Manual server (any port):

```powershell
cd server
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

## Run React client (optional)

```powershell
cd client
npm install
npm run dev
```

Open http://localhost:5173 (proxies API to port 8000; keep server running).

Legacy routes: `/guided`, `/dashboard/detail`.

## API (MVP)

| Endpoint | Purpose |
|----------|---------|
| `GET/POST /api/profiles` | List / create parent profiles |
| `GET/PUT /api/profile` | Parent age, lifestyle, etc. (`profile_id` query) |
| `POST /api/assessments/reaction` | Reaction trials → scored session |
| `POST /api/assessments/gait` | 10-ft time (seconds) → scored session |
| `POST /api/assessments/chair-stand` | Single rise time (seconds) → scored session |
| `POST /api/assessments/chair-reps` | Legacy 30s rep count (CDC STEADI) |
| `POST /api/assessments/cv/walk` | Video gait analysis |
| `POST /api/assessments/cv/chair-stand` | Video chair analysis |
| `GET /api/snapshot` | Dashboard: scores, trends, actions, insights, interventions |
| `GET /api/history` | Time series for charts |
| `GET /api/treatment-tracker` | Habits + completion state |
| `POST /api/treatment-tracker/*` | Toggle items, add habits, daily completion |
| `POST /api/reset?full=1` | Wipe DB (demo) |
| `GET /api/health` | Liveness check |

Responses include `citations` arrays where advice or scores are norm-based; the UI renders them via `citations-ui.js`.

## Project layout

```
client/                    React + Vite UI (optional)
server/
  main.py                  FastAPI + static routes
  scoring.py               Rule-based functional aging scores
  insights.py              Compassionate AI layer (optional)
  interventions.py         Evidence-based habit suggestions
  citations.py             Citation metadata for API payloads
  treatment_tracker.py     Treatment plan persistence
  database.py              SQLite
  static/
    v2/                    Primary mobile UI (kinspan-app.js, v2.css)
    index.html             Classic guided check-in
    citations-ui.js        Shared citation rendering
HACKATHON.md               Pitch & metrics
REFERENCES.md              Bibliography
SAFETY.md                  Disclaimers
```
