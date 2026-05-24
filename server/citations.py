"""Peer-reviewed citation registry for scores, insights, and recommendations."""

from __future__ import annotations

from typing import Any

Citation = dict[str, str | bool]

CITATIONS: dict[str, Citation] = {
    "bohannon_gait_2011": {
        "short": "Bohannon & Andrews, Physiotherapy 2011",
        "full": (
            "Bohannon RW, Andrews AW. Normal walking speed: a descriptive meta-analysis. "
            "Physiotherapy. 2011;97(3):182-189."
        ),
        "doi": "10.1016/j.physio.2010.12.004",
        "url": "https://doi.org/10.1016/j.physio.2010.12.004",
        "peer_reviewed": True,
    },
    "studenski_gait_2011": {
        "short": "Studenski et al., JAMA 2011",
        "full": (
            "Studenski S, Perera S, Patel K, et al. Gait speed and survival in older adults. "
            "JAMA. 2011;305(1):50-58."
        ),
        "doi": "10.1001/jama.2010.1923",
        "url": "https://doi.org/10.1001/jama.2010.1923",
        "peer_reviewed": True,
    },
    "woods_reaction_2015": {
        "short": "Woods et al., Front Psychol 2015",
        "full": (
            "Woods DL, Wyma JM, Yund EW, et al. Factors influencing the latency of simple "
            "reaction time. Frontiers in Psychology. 2015;6:1295."
        ),
        "doi": "10.3389/fpsyg.2015.01295",
        "url": "https://doi.org/10.3389/fpsyg.2015.01295",
        "peer_reviewed": True,
    },
    "rosado_reaction_2021": {
        "short": "Rosado-Antón et al., BMC Public Health 2021",
        "full": (
            "Rosado-Antón B, Ballesteros S, Mayas J, et al. Effects of cognitive training on "
            "reaction time in older adults: a systematic review and meta-analysis. "
            "BMC Public Health. 2021;21(1):1128."
        ),
        "doi": "10.1186/s12889-021-11178-4",
        "url": "https://doi.org/10.1186/s12889-021-11178-4",
        "peer_reviewed": True,
    },
    "rikli_chair_sft": {
        "short": "Rikli & Jones, Senior Fitness Test",
        "full": (
            "Rikli RE, Jones CJ. Development and validation of a functional fitness test for "
            "community-residing older adults. Journal of Aging and Physical Activity. "
            "1999;7(2):129-161."
        ),
        "doi": "10.1123/japa.7.2.129",
        "url": "https://doi.org/10.1123/japa.7.2.129",
        "peer_reviewed": True,
    },
    "cdc_steadi_chair": {
        "short": "CDC STEADI Chair Stand",
        "full": (
            "Centers for Disease Control and Prevention. STEADI — Older Adult Fall Prevention: "
            "Chair Stand Test protocol. Atlanta, GA: CDC; updated 2024."
        ),
        "doi": "",
        "url": "https://www.cdc.gov/steadi/pdf/STEADI-Assessment-ChairStand-508.pdf",
        "peer_reviewed": False,
    },
    "life_physical_activity": {
        "short": "Pahor et al., JAMA 2014",
        "full": (
            "Pahor M, Guralnik JM, Ambrosius WT, et al. Effect of structured physical "
            "activity on prevention of major mobility disability in older adults: the LIFE "
            "study randomized clinical trial. JAMA. 2014;311(23):2387-2396."
        ),
        "doi": "10.1001/jama.2014.5616",
        "url": "https://doi.org/10.1001/jama.2014.5616",
        "peer_reviewed": True,
    },
    "falls_exercise": {
        "short": "Sherrington et al., Br J Sports Med 2017",
        "full": (
            "Sherrington C, Michaleff ZA, Fairhall N, et al. Exercise to prevent falls "
            "in older adults: an updated systematic review and meta-analysis. "
            "British Journal of Sports Medicine. 2017;51(24):1750-1758."
        ),
        "doi": "10.1136/bjsports-2016-096547",
        "url": "https://doi.org/10.1136/bjsports-2016-096547",
        "peer_reviewed": True,
    },
    "protein_older_adults": {
        "short": "Bauer et al., J Am Med Dir Assoc 2013",
        "full": (
            "Bauer J, Biolo G, Cederholm T, et al. Evidence-based recommendations for "
            "optimal dietary protein intake in older people: a position paper from the "
            "PROT-AGE Study Group. Journal of the American Medical Directors Association. "
            "2013;14(8):542-559."
        ),
        "doi": "10.1016/j.jamda.2013.05.021",
        "url": "https://doi.org/10.1016/j.jamda.2013.05.021",
        "peer_reviewed": True,
    },
    "aerobic_cognition": {
        "short": "Smith et al., Psychosom Med 2010",
        "full": (
            "Smith PJ, Blumenthal JA, Hoffman BM, et al. Aerobic exercise and "
            "neurocognitive performance: a meta-analytic review of randomized controlled "
            "trials. Psychosomatic Medicine. 2010;72(3):239-252."
        ),
        "doi": "10.1097/PSY.0b013e3181d14633",
        "url": "https://doi.org/10.1097/PSY.0b013e3181d14633",
        "peer_reviewed": True,
    },
    "mediterranean_cognition": {
        "short": "Martinez-Lapiscina et al., JNNP 2013",
        "full": (
            "Martinez-Lapiscina EH, Clavero P, Toledo E, et al. Mediterranean diet "
            "improves cognition: the PREDIMED-NAVARRA randomised trial. Journal of "
            "Neurology, Neurosurgery & Psychiatry. 2013;84(12):1318-1325."
        ),
        "doi": "10.1136/jnnp-2012-304792",
        "url": "https://doi.org/10.1136/jnnp-2012-304792",
        "peer_reviewed": True,
    },
    "longitudinal_tracking": {
        "short": "Repeated functional measures (clinical practice)",
        "full": (
            "Serial gait speed, chair stand, and reaction-time measures are widely used in "
            "geriatric assessment to track change over time alongside age- and sex-matched norms."
        ),
        "doi": "",
        "url": "https://doi.org/10.1001/jama.2010.1923",
        "peer_reviewed": True,
    },
}

CATEGORY_CITATION_KEYS: dict[str, list[str]] = {
    "mobility": ["bohannon_gait_2011", "studenski_gait_2011"],
    "strength_stability": ["cdc_steadi_chair", "rikli_chair_sft", "life_physical_activity"],
    "cognitive_speed": ["woods_reaction_2015", "rosado_reaction_2021"],
}

BIOMARKER_CITATION_KEYS: dict[str, list[str]] = {
    "reaction": ["woods_reaction_2015"],
    "gait": ["bohannon_gait_2011", "studenski_gait_2011"],
    "chair": ["cdc_steadi_chair", "rikli_chair_sft"],
}


def get_citation(key: str) -> Citation:
    return dict(CITATIONS[key])


def get_citations(*keys: str) -> list[Citation]:
    out: list[Citation] = []
    seen: set[str] = set()
    for key in keys:
        if key in seen or key not in CITATIONS:
            continue
        seen.add(key)
        out.append(get_citation(key))
    return out


def citations_for_category(category: str) -> list[Citation]:
    return get_citations(*CATEGORY_CITATION_KEYS.get(category, []))


def attach_citations(obj: dict[str, Any], keys: list[str]) -> dict[str, Any]:
    cites = get_citations(*keys)
    if cites:
        obj["citations"] = cites
    return obj
