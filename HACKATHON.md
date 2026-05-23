# KinSpan — Hackathon pitch kit

## One-liner

**An early-warning system for functional aging using simple at-home tests — explained like a caring family member, not a hospital.**

## Positioning

- **Not:** diagnosis, lifespan prediction, or replacing clinicians
- **Is:** longevity translator — observations → trends → gentle actions
- **User:** adult child caregiver (parent may join for activities)
- **Audience fit:** parents who are medically superstitious or distrustful — non-threatening language throughout

## Demo narrative (3 min)

1. Son opens KinSpan, sets Mom’s profile (age 68).
2. They do three mini activities together: tap-when-green, 10-foot walk, 30s chair stand.
3. Dashboard shows functional ages vs chronological 68, three category cards, overall snapshot.
4. AI block: “Mobility is trending slightly downward — short evening walks together work better than calling it exercise.”
5. Action plan: hallway walks, chair rises, hydration.
6. (Stretch) “One month later” — re-run walk, trend shows ↑ improving.

## MVP scope (built)

- [x] Parent profile
- [x] Reaction time
- [x] Gait speed (10-foot walk)
- [x] Sit-to-stand (30s reps)
- [x] Rule-based scoring + functional age estimates
- [x] Trend arrows (improving / stable / watch closely)
- [x] Action plan
- [x] Tracking checklist (future biomarkers listed)
- [x] Conversation mode (AI or mock)

## Post-MVP (slide as roadmap)

- Sleep questionnaire
- One-foot balance
- Social engagement log
- Grip strength (dynamometer or proxy questions)
- Resting heart rate, waist-to-height

## Business / judge metrics

| Metric | Definition | Why it matters |
|--------|------------|----------------|
| **North star: Functional Health Stability** | % of families maintaining or improving overall score over 90 days | Mission-aligned |
| Weekly active families | 1+ check-in per week | Engagement |
| Repeat assessments | Avg check-ins per parent per quarter | Longitudinal value |
| Early trend detection | % users with “watch closely” who re-test within 30 days | Preventive behavior |
| Behavior adoption | Self-reported habit completion (future) | Outcomes |

## Evidence base

Full citations in [REFERENCES.md](./REFERENCES.md).

| Biomarker | Norms / protocol | Interpretation / actions |
|-----------|------------------|---------------------------|
| Gait speed | Bohannon & Andrews, *Physiotherapy* 2011 | Studenski et al., *JAMA* 2011 survival bands (≥1.0, ≥0.8, ≥0.6 m/s) |
| Chair stand | CDC STEADI + Rikli & Jones Senior Fitness Test | LIFE Study, *JAMA* 2014 for activity recommendations |
| Reaction time | Woods et al., *Front Psychol* 2015 | Rosado-Antón et al., *BMC Public Health* 2021 for cognitive-motor habits |

## Scoring factors (what we actually measure)

### Cognitive Speed — reaction time

- **Raw:** median milliseconds over 5 trials
- **Derived:** score vs Woods et al. age-stratified simple RT norms
- **Signals (plain language):** alertness, processing speed — *not* dementia screening

### Mobility — gait

- **Raw:** seconds to walk 10 feet (3.048 m)
- **Derived:** speed (m/s), score vs Bohannon & Andrews comfortable gait norms
- **Interpretation:** Studenski JAMA 2011 population bands in plain language

### Strength & Stability — chair stand

- **Raw:** full stands in 30 seconds (CDC STEADI protocol)
- **Derived:** score vs Rikli & Jones normative reps
- **Actions:** LIFE Study–style structured walking when scores are low

### Overall

- Mean of available category scores
- Blended functional age (educational average of category functional ages)

## Language guide (UX)

| Avoid | Use |
|-------|-----|
| High frailty risk | Mobility trending downward |
| Cardiovascular disease | Stamina and circulation patterns |
| Your parent is declining | May tire more easily over time |
| Failed test | Let’s try again when rested |

## Tech stack

- **Frontend:** React + Vite (web; Expo/RN for mobile later)
- **Backend:** FastAPI + SQLite
- **AI:** OpenAI for explanations only; biomarker math is rule-based

## Why not Motion-IQ / VueMotion for hackathon?

Excellent for lab-grade kinematics with controlled 20m sprint capture and enterprise API — overkill for MVP. Our objective timers and rep counts are demo-ready, scientifically legible, and work in a hallway.

## Team name ideas

KinSpan (current), EverKin, VitalPath, Hearth Health
