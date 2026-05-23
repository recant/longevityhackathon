# longevityhackathon — KinSpan

**Control Group Longevity Hackathon** · [GitHub](https://github.com/recant/longevityhackathon)

## KinSpan

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

Rule-based scores (0–100) compare results to **age/sex-adjusted norms**, then estimate a **functional age** per category (educational, not diagnostic). Trends use month-over-month score change with gentle language:

- improving ↑
- stable →
- watch closely ↓ (never harsh “high risk” red alerts)

Optional `OPENAI_API_KEY` adds “explain like a caring family member” + conversation tips.

See [HACKATHON.md](./HACKATHON.md) for pitch, demo script, and judge metrics.

## Run locally

**Server**

```powershell
cd server
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

**Client** (requires Node/npm)

```powershell
cd client
npm install
npm run dev
```

Open http://localhost:5173

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
