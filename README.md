# longevityhackathon — Longevitree

**Control Group Longevity Hackathon** · [GitHub](https://github.com/recant/longevityhackathon)

## Longevitree

**Longevity translator for families** — a hackathon MVP that turns cheap, at-home observational biomarkers into plain-language aging trajectory insights for adult children worried about their parents.

> Not a medical device. Wellness trends and functional aging only.

## The problem

“I know my parents are aging — but I don’t know what’s normal, what’s urgent, or how to help without fighting cultural beliefs or medical distrust.”

## The solution

Three respected biomarkers → three intuitive categories → trajectory dashboard + compassionate AI copy + actionable habits.

| Category | Biomarker | What families understand |
|----------|-----------|--------------------------|
| Cognitive Speed | Reaction time (5 taps) | Mental sharpness & responsiveness |
| Mobility | 10-foot walk time → gait speed | Movement health & independence |
| Strength & Stability | 30s chair stand count | Leg strength & fall resilience |

## Scoring philosophy

Rule-based scores (0–100) compare results to **published age/sex norms** (see [REFERENCES.md](./REFERENCES.md)), then estimate a **functional age** per category (educational, not diagnostic). Trends use month-over-month score change with gentle language:

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
| **At-home tests** | Stopwatch, tap pad, chair counter | Reaction, 10-ft walk, 30s chair stand |
| **Video analysis** | OpenCV (+ optional MediaPipe) on uploaded video | Walk gait (speed, cadence, symmetry), chair reps from video; reaction still manual |

Choose your path at the top of the UI, then follow the **guided check-in** (stepper, Back/Continue) — each path has its own step order. For better pose tracking: `pip install -r requirements-cv.txt`

**Chair-stand video** uses the MediaPipe **Pose Landmarker full** model (`pose_landmarker_full.task`, same stack as `workshop/walking`). It counts reps from **knee extension + hip rise**, not raw pixel motion alone. Walking CV is unchanged.

## Run locally (basic test UI — recommended)

One command serves API + UI:

```powershell
cd server
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

Open **http://localhost:8000** — **new home screen** (Welcome → Journals → Tests → Dashboard).

**Classic guided UI** (all tests + video): **http://localhost:8000/classic**

**At-home path:** Profile → Reaction → Walk → Chair → Results  
**Video path:** Profile → Video walk → Video chair → Reaction → Results

## Run React client (optional)

```powershell
cd client
npm install
npm run dev
```

Open http://localhost:5173 (proxies API to port 8000; keep server running).

**New mobile UI flow:** Welcome → Journal picker → Parent test hub → Longevity dashboard (matches design mockups). Legacy guided check-in: `/guided`, full detail: `/dashboard/detail`.

## API (MVP)

| Endpoint | Purpose |
|----------|---------|
| `GET/PUT /api/profile` | Parent age, lifestyle, etc. |
| `POST /api/assessments/reaction` | Reaction trials → scored session |
| `POST /api/assessments/gait` | 10-ft time (seconds) → scored session |
| `POST /api/assessments/chair-stand` | Reps in 30s → scored session |
| `GET /api/snapshot` | Dashboard: scores, trends, actions, AI insights |

## Project layout

```
client/          React + Vite UI
server/
  scoring.py     Rule-based functional aging scores
  insights.py    Compassionate AI layer (optional)
  database.py    SQLite
  main.py        FastAPI
HACKATHON.md     Pitch & metrics
SAFETY.md        Disclaimers
```
