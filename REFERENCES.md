# Evidence base for KinSpan biomarkers

KinSpan uses **observational, functional tests** scored against published norms. It does **not** diagnose disease or predict individual lifespan.

| Topic | Source | Role in KinSpan |
|-------|--------|-----------------|
| Gait speed & longevity | Studenski S, et al. *JAMA*. 2011;305(1):50-59 | Survival thresholds (≥0.8, ≥1.0 m/s) inform **plain-language** mobility interpretation |
| Walking speed norms | Bohannon RW, Andrews AW. *Physiotherapy*. 2011;97(4):372-377 | Age/sex **comfortable gait speed** targets for scoring |
| Chair stand protocol | CDC STEADI — [30-second Chair Stand](https://www.cdc.gov/steadi/pdf/STEADI-Assessment-ChairStand-508.pdf) | Standard **30s chair stand** activity instructions |
| Chair stand norms | Rikli RC, Jones CJ. *Senior Fitness Test Manual* (2nd ed.) | Age/sex **rep count** norms for scoring |
| Exercise & mobility | LIFE Study Group. *JAMA*. 2014;311(23):2387-2396 | **Action plan** cites structured walking + strength as evidence-based habits |
| Reaction time & aging | Woods DL, et al. *Front Psychol*. 2015;6:713 | Age-related **simple RT** expectations for cognitive-speed scoring |
| Cognitive-motor training | Rosado-Antón N, et al. *BMC Public Health*. 2021;21:2350 | Supports **brain-and-body** recommendations when RT is below norm |

## Studenski gait-speed bands (interpretation only)

In a pooled analysis (n≈34,000), faster gait speed was associated with better survival. KinSpan uses these **educational** cutoffs in copy, not to label disease:

| Speed (m/s) | KinSpan framing |
|-------------|-----------------|
| ≥ 1.0 | Confident pace; aligns with stronger survival association in population studies |
| 0.8 – 0.99 | Moderate; often cited minimum for “meaningful” community mobility |
| 0.6 – 0.79 | Slower; stamina and leg strength habits may help |
| &lt; 0.6 | Quite slow; gentle support and clinician conversation if the family is worried |

## Implementation

Norm tables and thresholds are coded in [`server/scoring.py`](server/scoring.py).

- **Walk / mobility:** Bohannon & Andrews 2011 comfortable gait speed (10-foot timed walk → m/s), blended with Studenski et al. 2011 speed bands for the 0–100 score.
- **Chair / strength:** Rikli & Jones 30-second chair-stand rep norms (CDC STEADI protocol). A single sit-to-stand rise is converted to an equivalent 30s rep count (rise phase ≈ half of a full cycle) and scored on the same scale.
- **Video uploads (optional):** [`server/human_presence.py`](server/human_presence.py) can gate uploads on person detection; currently **disabled** (`ENABLE_HUMAN_PRESENCE_GATE = False`).

Optional OpenAI text in [`server/insights.py`](server/insights.py) is instructed to stay consistent with this evidence and avoid diagnostic language.
