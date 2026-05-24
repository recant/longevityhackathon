# Longevitree

Longevitree is a hackathon prototype for family-friendly functional aging check-ins. It uses quick at-home tests to estimate functional aging signals and suggest simple, evidence-linked non-medication interventions.

This is a wellness demo, not a medical device or diagnostic tool.

## What it does

The app includes:

- Reaction Time
- Walking Pace
- Quick Stand
- Full Check-in
- Functional/biological age estimate
- Chronological age display
- Evidence-linked intervention suggestions

Each intervention includes a short citation using the paper title and lead author.

## Run locally

From the project root:

```powershell
cd server
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
