/**
 * KinSpan v2 — full app wired to API (v1 features, v2 design).
 */
const SKIP_ONBOARDING_KEY = "kinspan_v2_skip_onboarding";
const CAREGIVER_NAME_KEY = "kinspan_caregiver_name";
const ACTIVE_PROFILE_KEY = "kinspan_active_profile_id";

const SCREENS_WITH_NAV = ["dashboard", "tests", "graphs"];
const API_FETCH = { cache: "no-store" };

let snapshot = null;
let profile = null;
let profiles = [];
let history = null;
let profileEditingId = null;
let profileCreateMode = false;
let currentScreen = "onboarding";
let parentName = "Mom/Dad";
let ringChart = null;
let vitalityChart = null;
let ringBuilt = false;
let graphsBuilt = false;

// ---- API ----
function activeProfileId() {
  return localStorage.getItem(ACTIVE_PROFILE_KEY);
}

function setActiveProfileId(id) {
  if (id == null || id === "") localStorage.removeItem(ACTIVE_PROFILE_KEY);
  else localStorage.setItem(ACTIVE_PROFILE_KEY, String(id));
}

function withProfile(path) {
  const id = activeProfileId();
  if (!id || !path.startsWith("/api/")) return path;
  if (
    path.startsWith("/api/health") ||
    path.startsWith("/api/profiles") ||
    path.startsWith("/api/version") ||
    path.startsWith("/api/paths") ||
    path.startsWith("/api/reset")
  ) {
    return path;
  }
  const sep = path.includes("?") ? "&" : "?";
  return `${path}${sep}profile_id=${encodeURIComponent(id)}`;
}

function apiErrorMessage(raw) {
  return typeof formatApiError === "function" ? formatApiError(raw) : String(raw || "");
}

async function apiGet(path) {
  const r = await fetch(withProfile(path), API_FETCH);
  const text = await r.text();
  if (!r.ok) throw new Error(apiErrorMessage(text || r.statusText));
  return text ? JSON.parse(text) : {};
}

async function apiPost(path, body) {
  const r = await fetch(withProfile(path), {
    ...API_FETCH,
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await r.text();
  if (!r.ok) throw new Error(apiErrorMessage(text || r.statusText));
  return text ? JSON.parse(text) : {};
}

async function apiPut(path, body) {
  const r = await fetch(withProfile(path), {
    ...API_FETCH,
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await r.text();
  if (!r.ok) throw new Error(apiErrorMessage(text || r.statusText));
  return text ? JSON.parse(text) : {};
}

function fmtDate(iso) {
  if (!iso) return "Not yet updated";
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return "Not yet updated";
  }
}

function daysAgo(iso) {
  if (!iso) return null;
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (d <= 0) return "today";
  if (d === 1) return "1 day ago";
  return `${d} days ago`;
}

function caregiverName() {
  return localStorage.getItem(CAREGIVER_NAME_KEY) || "Friend";
}

function applyNames() {
  document.querySelectorAll("[data-parent-name]").forEach((el) => {
    el.textContent = parentName;
  });
  document.querySelectorAll("[data-caregiver-name]").forEach((el) => {
    el.textContent = caregiverName();
  });
}

async function loadProfiles() {
  const data = await apiGet("/api/profiles");
  profiles = data.profiles || [];
  return profiles;
}

async function loadProfile() {
  if (!activeProfileId() && !profiles.length) {
    profile = null;
    parentName = "Parent";
    applyNames();
    return null;
  }
  profile = await apiGet("/api/profile");
  parentName = profile.display_name || "Parent";
  if (profile.id) setActiveProfileId(profile.id);
  applyNames();
  return profile;
}

async function loadSnapshot() {
  snapshot = await apiGet("/api/snapshot");
  return snapshot;
}

async function loadHistory() {
  history = await apiGet("/api/history");
  return history;
}

async function afterAssessmentSaved() {
  await loadSnapshot();
  await loadHistory();
  if (currentScreen === "dashboard") renderDashboard();
  if (["journal-select", "tests"].includes(currentScreen)) renderJournals();
  if (currentScreen === "weekly-digest") renderDigest();
  if (currentScreen === "doctor-export") renderDoctorExport();
  if (currentScreen === "graphs") renderGraphs(true);
}

async function finishGuidedCheckin() {
  try {
    await afterAssessmentSaved();
  } catch (_) {
    /* refresh optional */
  }
  goTo("tests");
}

function isKinspanMessageEvent(e) {
  if (!e?.data?.type || !String(e.data.type).startsWith("kinspan:")) return false;
  try {
    return new URL(e.origin).host === location.host;
  } catch {
    return false;
  }
}

// ---- Navigation ----
function goTo(id) {
  document.querySelectorAll(".screen").forEach((s) => s.classList.remove("active"));
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.add("active");
  currentScreen = id;

  document.querySelectorAll(".nav-bar .nav-item").forEach((n) => {
    n.classList.toggle("active", n.dataset.nav === id);
  });

  const frame = document.getElementById("guidedFrame");
  if (id === "guided") {
    if (frame && !String(frame.getAttribute("src") || "").includes("/classic")) {
      frame.src = "/classic?embed=1";
    }
  } else if (frame) {
    frame.removeAttribute("src");
    frame.src = "about:blank";
  }

  if (id === "dashboard") renderDashboard();
  if (id === "journal-select") renderJournals();
  if (id === "tests") renderTestsHub();
  if (id === "weekly-digest") renderDigest();
  if (id === "doctor-export") renderDoctorExport();
  if (id === "graphs") renderGraphs();
  if (id === "walk") resetWalkUi();
  if (id === "chair-rise") resetChairRiseUi();
  if (id === "reaction") resetReactionUi();
  if (id === "profile") loadProfileForm(profileEditingId, profileCreateMode);

  window.scrollTo(0, 0);
}

function t(id, msg) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = msg;
  el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 2400);
}

// ---- Onboarding ----
let obN = 0;
function goSlide(n) {
  document.querySelectorAll(".ob-slide").forEach((s, i) => {
    s.classList.remove("active", "past");
    if (i < n) s.classList.add("past");
    else if (i === n) s.classList.add("active");
  });
  document.querySelectorAll(".ob-dot").forEach((d, i) => d.classList.toggle("active", i === n));
  obN = n;
  const btn = document.getElementById("obBtn");
  if (btn) btn.textContent = n === 3 ? "Go to home →" : "Next";
  const p = document.getElementById("obParentHint");
  if (p) p.textContent = parentName;
}

function obNext() {
  if (obN < 3) goSlide(obN + 1);
  else finishOnboarding();
}

function finishOnboarding() {
  sessionStorage.setItem(SKIP_ONBOARDING_KEY, "1");
  routeAfterAuth();
}

function routeAfterAuth() {
  if (!profiles.length) {
    profileCreateMode = true;
    profileEditingId = null;
    goTo("journal-select");
  } else {
    goTo("dashboard");
  }
}

function skipOnboarding() {
  finishOnboarding();
}

// ---- Journals ----
function lastUpdatedIso() {
  if (snapshot?.categories?.length) {
    const dates = snapshot.categories.map((c) => c.latest_at).filter(Boolean);
    if (dates.length) return dates.sort().reverse()[0];
  }
  return profile?.created_at;
}

function openProfileEditor(id, create) {
  profileCreateMode = !!create;
  profileEditingId = create ? null : id;
  goTo("profile");
}

function renderJournals() {
  const area = document.getElementById("journalCarousel");
  if (!area) return;

  if (!profiles.length) {
    area.innerHTML = `
      <div class="journal-card journal-card--solo" data-add-parent>
        <div class="journal-avatar journal-avatar--add">+</div>
        <h3>Add your first parent</h3>
        <div class="j-updated">Name, age, and sex for fair comparisons</div>
        <button type="button" class="go-btn">Create profile →</button>
      </div>`;
    area.querySelector("[data-add-parent]")?.addEventListener("click", (e) => {
      e.stopPropagation();
      openProfileEditor(null, true);
    });
    const splashSub = document.getElementById("splashSub");
    if (splashSub) splashSub.textContent = "Create a profile to begin";
    return;
  }

  const cards = profiles
    .map((p) => {
      const isActive = String(p.id) === String(activeProfileId());
      return `
    <div class="journal-card${isActive ? " journal-card--active" : ""}" data-profile-id="${p.id}">
      <button type="button" class="journal-edit" data-edit-id="${p.id}">Edit</button>
      <div class="journal-avatar">${leafSvg("#6B8F71")}</div>
      <h3>${escapeHtml(p.display_name || "Parent")}</h3>
      <div class="j-updated">Age ${p.age || "—"} · ${escapeHtml((p.sex || "").toString())}</div>
      <button type="button" class="go-btn">${isActive ? "Open dashboard →" : "Select →"}</button>
    </div>`;
    })
    .join("");

  area.innerHTML = `
    ${profiles.length > 1 ? '<div class="ghost-card ghost-left"></div>' : ""}
    ${cards}
    <div class="journal-card journal-card--add" data-add-parent>
      <div class="journal-avatar journal-avatar--add">+</div>
      <h3>Add another parent</h3>
      <div class="j-updated">Separate journal per parent</div>
      <button type="button" class="go-btn">New profile →</button>
    </div>
    ${profiles.length > 1 ? '<div class="ghost-card ghost-right"></div>' : ""}
  `;

  area.querySelectorAll("[data-profile-id]").forEach((card) => {
    card.addEventListener("click", async (e) => {
      if (e.target.closest(".journal-edit")) return;
      const id = card.getAttribute("data-profile-id");
      setActiveProfileId(id);
      await loadProfile();
      try {
        await loadSnapshot();
        await loadHistory();
      } catch {
        snapshot = null;
        history = null;
      }
      goTo("dashboard");
    });
  });

  area.querySelectorAll(".journal-edit").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      openProfileEditor(btn.getAttribute("data-edit-id"), false);
    });
  });

  area.querySelector("[data-add-parent]")?.addEventListener("click", (e) => {
    e.stopPropagation();
    openProfileEditor(null, true);
  });

  const active = profiles.find((p) => String(p.id) === String(activeProfileId()));
  const splashSub = document.getElementById("splashSub");
  if (splashSub) {
    splashSub.textContent = active
      ? `${active.display_name}'s journal is waiting`
      : "Select a journal to continue";
  }
  const splashAgo = document.getElementById("splashLastCheckin");
  if (splashAgo) {
    const last = lastUpdatedIso();
    const ago = daysAgo(last);
    splashAgo.textContent = last ? `Last check-in: ${ago || fmtDate(last)}` : "No check-ins yet";
  }
}

function leafSvg(fill) {
  return `<svg class="leaf" viewBox="0 0 36 36" fill="none"><path d="M18 6C18 6 8 12 8 22C8 28 13 32 18 32C23 32 28 28 28 22C28 12 18 6 18 6Z" fill="${fill}"/><path d="M18 6C18 6 18 16 14 24" stroke="#4A6B51" stroke-width="1.5" stroke-linecap="round"/></svg>`;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// ---- Dashboard ----
function renderDashboard() {
  const pctEl = document.getElementById("ringPct");
  const descEl = document.getElementById("lcDesc");
  const linesEl = document.getElementById("lcLines");
  const msgEl = document.getElementById("dailyMsg");
  const taskList = document.getElementById("taskList");

  const overall = snapshot?.overall?.overall_score;
  const pct = overall != null ? Math.min(100, Math.max(0, overall)) : null;

  if (pctEl) pctEl.textContent = pct != null ? `${Math.round(pct)}%` : "—";
  if (descEl) {
    descEl.textContent =
      snapshot?.overall?.headline ||
      snapshot?.insights?.summary?.slice(0, 80) ||
      "Run a test to see your longevity summary.";
  }
  if (msgEl) {
    msgEl.textContent =
      snapshot?.insights?.conversation_tip?.slice(0, 90) ||
      '"Small steps today build a steadier tomorrow."';
  }

  if (linesEl && snapshot?.categories?.length) {
    const max = 100;
    linesEl.innerHTML = snapshot.categories
      .map((c) => {
        const w = Math.round((c.score / max) * 100);
        return `<div class="lc-line" style="width:${w}%"></div>`;
      })
      .join("");
  }

  if (taskList) {
    const actions = snapshot?.actions || [];
    if (!actions.length) {
      taskList.innerHTML = "<li>Complete a check-in to see your action plan.</li>";
    } else {
      taskList.innerHTML = actions
        .map(
          (a) =>
            `<li class="task-item-static"><strong>${escapeHtml(a.title)}</strong><p class="task-sub">${escapeHtml(a.detail)}</p></li>`
        )
        .join("");
    }
  }

  const counts = snapshot?.history_counts || {};
  const total =
    (counts.reactions || 0) + (counts.gaits || 0) + (counts.chairs || 0);
  const msTitle = document.getElementById("msStripTitle");
  if (msTitle && total >= 5) {
    msTitle.textContent = `${parentName} — ${total} check-ins logged`;
  }

  initRing(pct ?? 0);
  updateNavForScreen("dashboard");
}

function initRing(pct) {
  const canvas = document.getElementById("ringChart");
  if (!canvas || typeof Chart === "undefined") return;
  const v = pct || 0;
  if (ringChart) {
    ringChart.data.datasets[0].data = [v, 100 - v];
    ringChart.update();
    return;
  }
  ringChart = new Chart(canvas, {
    type: "doughnut",
    data: {
      datasets: [{ data: [v, 100 - v], backgroundColor: ["#6B8F71", "#E8F0E9"], borderWidth: 0 }],
    },
    options: {
      cutout: "76%",
      responsive: false,
      plugins: { legend: { display: false }, tooltip: { enabled: false } },
      animation: { duration: 800 },
    },
  });
  ringBuilt = true;
}

function renderTestsHub() {
  const sub = document.getElementById("testsSub");
  if (sub) {
    sub.textContent = snapshot?.categories?.length
      ? "The next steps of their Longevity Journey"
      : "The first steps of their Longevity Journey";
  }
  updateNavForScreen("tests");
}

function updateNavForScreen(id) {
  document.querySelectorAll(".nav-bar .nav-item").forEach((n) => {
    n.classList.toggle("active", n.dataset.nav === id);
  });
}

// ---- Tasks / milestone ----
function openTasks() {
  document.getElementById("tasksOverlay")?.classList.add("open");
  document.getElementById("tasksSheet")?.classList.add("open");
}
function closeTasks() {
  document.getElementById("tasksOverlay")?.classList.remove("open");
  document.getElementById("tasksSheet")?.classList.remove("open");
}
function toggleTask(el) {
  const c = el.querySelector(".task-check");
  const tx = el.querySelector(".task-text");
  const done = c.classList.toggle("done");
  tx.classList.toggle("done", done);
  c.innerHTML = done
    ? '<svg width="11" height="11" viewBox="0 0 12 12" fill="none"><polyline points="2,6 5,9 10,3" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>'
    : "";
}

function showMilestone() {
  document.getElementById("msOverlay")?.classList.add("open");
  const a = document.getElementById("confArea");
  if (!a) return;
  a.innerHTML = "";
  ["#6B8F71", "#C9A84C", "#B07560", "#5B7A8A"].forEach((c) => {
    for (let i = 0; i < 5; i++) {
      const p = document.createElement("div");
      p.className = "cp";
      p.style.cssText = `left:${Math.random() * 80}%;background:${c};animation-delay:${Math.random() * 0.35}s`;
      a.appendChild(p);
    }
  });
}
function closeMilestone() {
  document.getElementById("msOverlay")?.classList.remove("open");
}

// ---- Walk ----
let walkState = "idle",
  walkAccum = 0,
  walkSegStart = 0,
  walkTick = null;

function walkNow() {
  return walkState === "running" ? walkAccum + (performance.now() - walkSegStart) / 1000 : walkAccum;
}
function walkDisp() {
  const el = document.getElementById("walkTimer");
  if (el) el.textContent = walkNow().toFixed(2) + "s";
}
function resetWalkUi() {
  if (walkTick) clearInterval(walkTick);
  walkTick = null;
  walkState = "idle";
  walkAccum = 0;
  const t = document.getElementById("walkTimer");
  if (t) t.textContent = "—";
  const inp = document.getElementById("walkSec");
  if (inp) inp.value = "";
  const out = document.getElementById("walkOut");
  if (out) out.classList.remove("show");
}

function setupWalk() {
  document.getElementById("walkStart")?.addEventListener("click", () => {
    walkState = "running";
    walkAccum = 0;
    walkSegStart = performance.now();
    document.getElementById("walkOut")?.classList.remove("show");
    if (walkTick) clearInterval(walkTick);
    walkTick = setInterval(walkDisp, 50);
  });
  document.getElementById("walkStop")?.addEventListener("click", () => {
    if (walkState === "running") walkAccum += (performance.now() - walkSegStart) / 1000;
    if (walkTick) clearInterval(walkTick);
    walkState = "stopped";
    walkDisp();
    const inp = document.getElementById("walkSec");
    if (inp) inp.value = walkAccum.toFixed(2);
  });
  document.getElementById("walkReset")?.addEventListener("click", resetWalkUi);
  document.getElementById("saveWalk")?.addEventListener("click", async () => {
    const inp = document.getElementById("walkSec");
    const t = walkAccum || parseFloat(inp?.value || "0");
    const out = document.getElementById("walkOut");
    if (!t || t <= 0) {
      if (out) {
        out.textContent = "Time the 10-foot walk first.";
        out.classList.add("show");
      }
      return;
    }
    try {
      const res = await apiPost("/api/assessments/gait", { time_seconds: t });
      if (out) {
        out.textContent = `${res.scores.label}: ${res.scores.score}/100\n${res.scores.interpretation}\nSpeed: ${res.scores.raw.speed_mps} m/s`;
        out.classList.add("show");
      }
      await afterAssessmentSaved();
    } catch (e) {
      if (out) {
        out.textContent = apiErrorMessage(e.message);
        out.classList.add("show");
      }
    }
  });
}

// ---- Chair single rise ----
let crState = "idle",
  crAccum = 0,
  crSeg = 0,
  crTick = null,
  crElapsed = null;

function chairRiseSec() {
  if (crState === "running") return crAccum + (performance.now() - crSeg) / 1000;
  return crAccum;
}
function resetChairRiseUi() {
  crState = "idle";
  crAccum = 0;
  crElapsed = null;
  if (crTick) clearInterval(crTick);
  crTick = null;
  const t = document.getElementById("crTimer");
  if (t) t.textContent = "—";
  const stop = document.getElementById("crStop");
  const save = document.getElementById("saveChairRise");
  if (stop) stop.disabled = true;
  if (save) save.disabled = true;
  document.getElementById("crOut")?.classList.remove("show");
}

function setupChairRise() {
  document.getElementById("crStart")?.addEventListener("click", () => {
    crState = "running";
    crAccum = 0;
    crElapsed = null;
    crSeg = performance.now();
    document.getElementById("crStop").disabled = false;
    document.getElementById("saveChairRise").disabled = true;
    if (crTick) clearInterval(crTick);
    crTick = setInterval(() => {
      const el = document.getElementById("crTimer");
      if (el) el.textContent = chairRiseSec().toFixed(2) + "s";
    }, 50);
  });
  document.getElementById("crStop")?.addEventListener("click", () => {
    if (crState !== "running") return;
    crAccum += (performance.now() - crSeg) / 1000;
    crElapsed = crAccum;
    crState = "stopped";
    if (crTick) clearInterval(crTick);
    document.getElementById("crTimer").textContent = crElapsed.toFixed(2) + "s";
    document.getElementById("crStop").disabled = true;
    document.getElementById("saveChairRise").disabled = false;
  });
  document.getElementById("crReset")?.addEventListener("click", resetChairRiseUi);
  document.getElementById("saveChairRise")?.addEventListener("click", async () => {
    const t = crElapsed || chairRiseSec();
    const out = document.getElementById("crOut");
    if (!t || t < 0.4) {
      if (out) {
        out.textContent = "Time one full stand first.";
        out.classList.add("show");
      }
      return;
    }
    try {
      const res = await apiPost("/api/assessments/chair-stand", { rise_time_seconds: t });
      if (out) {
        out.textContent = `${res.scores.label}: ${res.scores.score}/100\n${res.scores.interpretation}`;
        out.classList.add("show");
      }
      await afterAssessmentSaved();
    } catch (e) {
      if (out) {
        out.textContent = apiErrorMessage(e.message);
        out.classList.add("show");
      }
    }
  });
}

// 30s sit-to-stand UI/logic archived in v2/archived/sit-stand-30s.{html,js}

// ---- Reaction ----
const TRIALS = 5;
let reactPhase = "idle",
  reactTrials = [],
  reactTimer = null,
  reactGo = 0;

function resetReactionUi() {
  clearTimeout(reactTimer);
  reactPhase = "idle";
  reactTrials = [];
  const pad = document.getElementById("reactPad");
  if (pad) {
    pad.textContent = "Tap to start";
    pad.className = "react-pad wait";
  }
  document.getElementById("reactTrialsLine").textContent = "";
  document.getElementById("saveReact").disabled = true;
  document.getElementById("reactOut")?.classList.remove("show");
}

function setupReaction() {
  const pad = document.getElementById("reactPad");
  if (!pad) return;

  function startTrial() {
    pad.className = "react-pad wait";
    pad.textContent = "Wait…";
    reactPhase = "waiting";
    reactTimer = setTimeout(() => {
      reactGo = performance.now();
      reactPhase = "go";
      pad.className = "react-pad go";
      pad.textContent = "TAP!";
    }, 1500 + Math.random() * 2000);
  }

  pad.onclick = () => {
    if (reactPhase === "done") return;
    if (reactPhase === "idle") {
      reactTrials = [];
      document.getElementById("saveReact").disabled = true;
      document.getElementById("reactOut")?.classList.remove("show");
      startTrial();
      return;
    }
    if (reactPhase === "waiting") {
      clearTimeout(reactTimer);
      reactPhase = "idle";
      pad.textContent = "Too soon — tap to restart";
      return;
    }
    if (reactPhase === "go") {
      reactTrials.push(Math.round(performance.now() - reactGo));
      document.getElementById("reactTrialsLine").textContent =
        "Trials (ms): " + reactTrials.join(", ");
      if (reactTrials.length >= TRIALS) {
        reactPhase = "done";
        pad.textContent = "Done — save results";
        document.getElementById("saveReact").disabled = false;
      } else {
        reactPhase = "waiting";
        setTimeout(startTrial, 600);
      }
    }
  };

  document.getElementById("reactRedo")?.addEventListener("click", resetReactionUi);
  document.getElementById("saveReact")?.addEventListener("click", async () => {
    const out = document.getElementById("reactOut");
    try {
      const res = await apiPost("/api/assessments/reaction", { trials_ms: reactTrials });
      if (out) {
        out.textContent = `${res.scores.label}: ${res.scores.score}/100\n${res.scores.interpretation}`;
        out.classList.add("show");
      }
      await afterAssessmentSaved();
    } catch (e) {
      if (out) {
        out.textContent = apiErrorMessage(e.message);
        out.classList.add("show");
      }
    }
  });
}

// ---- Profile ----
function loadProfileForm(editId, creating) {
  const title = document.getElementById("profTitle");
  const sub = document.getElementById("profSub");
  const saveBtn = document.getElementById("saveProf");
  if (creating) {
    if (title) title.textContent = "Add parent";
    if (sub) sub.textContent = "Set up their profile for fair comparisons";
    if (saveBtn) saveBtn.textContent = "Create profile";
    document.getElementById("profName").value = "";
    document.getElementById("profAge").value = 68;
    document.getElementById("profSex").value = "female";
  } else {
    if (title) title.textContent = "Parent profile";
    if (sub) sub.textContent = "Age & sex for fair norm comparison";
    if (saveBtn) saveBtn.textContent = "Save profile";
    const id = editId || activeProfileId();
    if (id) {
      apiGet(`/api/profile?profile_id=${encodeURIComponent(id)}`)
        .then((p) => {
          document.getElementById("profName").value = p.display_name || "";
          document.getElementById("profAge").value = p.age || 68;
          document.getElementById("profSex").value = (p.sex || "female")
            .toLowerCase()
            .includes("male")
            ? "male"
            : "female";
        })
        .catch(() => {});
    }
  }
  const cg = document.getElementById("caregiverName");
  if (cg) cg.value = caregiverName();
  const out = document.getElementById("profOut");
  if (out) out.classList.remove("show");
}

function setupProfile() {
  document.getElementById("saveProf")?.addEventListener("click", async () => {
    const out = document.getElementById("profOut");
    const cg = document.getElementById("caregiverName")?.value?.trim();
    if (cg) localStorage.setItem(CAREGIVER_NAME_KEY, cg);
    const body = {
      display_name: document.getElementById("profName").value.trim(),
      age: +document.getElementById("profAge").value,
      sex: document.getElementById("profSex").value,
    };
    if (!body.display_name) {
      if (out) {
        out.textContent = "Please enter a name.";
        out.classList.add("show");
      }
      return;
    }
    try {
      let p;
      if (profileCreateMode) {
        const r = await fetch("/api/profiles", {
          ...API_FETCH,
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const text = await r.text();
        if (!r.ok) throw new Error(apiErrorMessage(text || r.statusText));
        p = text ? JSON.parse(text) : {};
        setActiveProfileId(p.id);
        profileCreateMode = false;
        profileEditingId = null;
      } else {
        const q = profileEditingId || activeProfileId();
        p = await apiPut(`/api/profile${q ? `?profile_id=${q}` : ""}`, body);
      }
      parentName = p.display_name;
      profile = p;
      applyNames();
      await loadProfiles();
      if (out) {
        out.textContent = `Saved: ${p.display_name}, age ${p.age}`;
        out.classList.add("show");
      }
      try {
        await loadSnapshot();
        await loadHistory();
      } catch {
        snapshot = null;
        history = null;
      }
      renderJournals();
      setTimeout(() => goTo("dashboard"), 600);
    } catch (e) {
      if (out) {
        out.textContent = apiErrorMessage(e.message);
        out.classList.add("show");
      }
    }
  });
}

// ---- Digest / export / graphs ----
function catByType(type) {
  return snapshot?.categories?.find((c) => c.category === type);
}

function renderDigest() {
  const intro = document.getElementById("digestIntro");
  const insights = document.getElementById("digestInsights");
  const action = document.getElementById("digestAction");
  const sub = document.getElementById("digestHeaderSub");
  if (sub) sub.textContent = `${new Date().toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })} · ${parentName}`;

  if (intro) {
    intro.innerHTML = snapshot?.insights?.summary
      ? `<strong>${escapeHtml(parentName)}:</strong> ${escapeHtml(snapshot.insights.summary)}`
      : `<strong>Start with a check-in.</strong> Run walk, chair, or reaction tests to build your first digest.`;
  }

  const gait = catByType("mobility");
  const chair = catByType("strength_stability");
  const cog = catByType("cognitive_speed");
  const setStat = (id, val, delta) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
    const d = document.getElementById(id + "Delta");
    if (d && delta) d.textContent = delta;
  };
  setStat("dWalk", gait ? `${gait.score}` : "—", gait?.trend_detail?.summary);
  setStat("dChair", chair ? `${chair.score}` : "—", chair?.trend_detail?.summary);
  setStat(
    "dCheckins",
    snapshot?.history_counts
      ? `${(snapshot.history_counts.gaits || 0) + (snapshot.history_counts.chairs || 0) + (snapshot.history_counts.reactions || 0)}`
      : "0",
    ""
  );

  if (insights) {
    const cards = [];
    if (snapshot?.insights?.what_changed) {
      cards.push(
        `<div class="insight-card"><div class="i-dot sage"></div><div class="i-text">${escapeHtml(snapshot.insights.what_changed)}</div></div>`
      );
    }
    snapshot?.categories?.forEach((c) => {
      cards.push(
        `<div class="insight-card"><div class="i-dot slate"></div><div class="i-text"><strong>${escapeHtml(c.label)}</strong> — ${c.score}/100. ${escapeHtml(c.trend_detail?.summary || c.interpretation || "")}</div></div>`
      );
    });
    insights.innerHTML = cards.length ? cards.join("") : "<p class='digest-empty'>More insights after your next check-in.</p>";
  }

  if (action && snapshot?.actions?.[0]) {
    action.textContent = snapshot.actions[0].detail;
  }
}

function renderDoctorExport() {
  const root = document.getElementById("exportPreview");
  if (!root || !snapshot) return;
  const age = snapshot.profile?.age || profile?.age || "—";
  const overall = snapshot.overall?.overall_score ?? "—";
  const funcAge = snapshot.overall?.overall_functional_age ?? "—";
  const gait = catByType("mobility");
  const chair = catByType("strength_stability");
  const cog = catByType("cognitive_speed");
  const counts = snapshot.history_counts || {};
  const total = (counts.reactions || 0) + (counts.gaits || 0) + (counts.chairs || 0);

  root.innerHTML = `
    <div class="doc-strip"><h3>Longevity Health Summary</h3><span>${fmtDate(new Date().toISOString())}</span></div>
    <div class="doc-patient">
      <div class="doc-avatar">${leafSvg("#A8C5AD")}</div>
      <div class="doc-patient-info"><h4>${escapeHtml(parentName)}, ${age}</h4><p>${total} check-ins logged · KinSpan trends only</p></div>
    </div>
    <div class="doc-section"><h4>Functional movement</h4><div class="doc-grid">
      <div class="doc-metric"><div class="doc-metric-lbl">Mobility</div><div class="doc-metric-val">${gait ? gait.score + "/100" : "—"}</div><div class="doc-metric-trend">${gait?.trend_detail?.summary || ""}</div></div>
      <div class="doc-metric"><div class="doc-metric-lbl">Strength</div><div class="doc-metric-val">${chair ? chair.score + "/100" : "—"}</div><div class="doc-metric-trend">${chair?.trend_detail?.summary || ""}</div></div>
      <div class="doc-metric"><div class="doc-metric-lbl">Cognitive speed</div><div class="doc-metric-val">${cog ? cog.score + "/100" : "—"}</div><div class="doc-metric-trend">${cog?.trend_detail?.summary || ""}</div></div>
    </div></div>
    <div class="doc-section"><h4>Vitality</h4><div class="doc-grid">
      <div class="doc-metric"><div class="doc-metric-lbl">Overall score</div><div class="doc-metric-val">${overall} / 100</div></div>
      <div class="doc-metric"><div class="doc-metric-lbl">Functional age est.</div><div class="doc-metric-val">${funcAge} yrs</div></div>
    </div></div>
    <div class="doc-section"><h4>Caregiver note</h4><div class="doc-note">${escapeHtml(snapshot.insights?.conversation_tip || "No additional notes.")}</div></div>
  `;
}

function renderGraphs(force) {
  if (!history) return;
  const age = snapshot?.profile?.age || profile?.age || 68;
  const funcAge = snapshot?.overall?.overall_functional_age || age;
  document.querySelector("#graphs .graphs-header h2").textContent = `${parentName}'s Progress`;
  document.getElementById("bioActual").textContent = age;
  document.getElementById("bioEst").textContent = funcAge;
  const exp = document.getElementById("bioExpText");
  if (exp) {
    const diff = age - funcAge;
    exp.innerHTML =
      diff > 0
        ? `${escapeHtml(parentName)}'s signals suggest function closer to someone about <strong>${diff} years younger</strong> than chronological age.`
        : `Keep logging check-ins to refine the biological age estimate.`;
  }

  const scores = [];
  const labels = [];
  [...(history.gaits || [])].reverse().forEach((g, i) => {
    labels.push(`G${i + 1}`);
    scores.push(g.scores?.score ?? 0);
  });
  if (!scores.length && snapshot?.overall?.overall_score) {
    labels.push("Now");
    scores.push(snapshot.overall.overall_score);
  }

  const canvas = document.getElementById("vitalityChart");
  if (canvas && typeof Chart !== "undefined") {
    if (vitalityChart) vitalityChart.destroy();
    vitalityChart = new Chart(canvas, {
      type: "line",
      data: {
        labels: labels.length ? labels : ["—"],
        datasets: [
          {
            label: "Score",
            data: scores.length ? scores : [0],
            borderColor: "#6B8F71",
            backgroundColor: "rgba(107,143,113,0.09)",
            borderWidth: 2.5,
            tension: 0.4,
            fill: true,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { min: 0, max: 100, ticks: { color: "#7A8C82", font: { size: 10 } } },
          x: { ticks: { color: "#7A8C82" } },
        },
      },
    });
  }

  const fill = document.getElementById("bioFill");
  if (fill) {
    const pct = Math.min(100, Math.max(0, (scores[scores.length - 1] || 50)));
    fill.style.width = "0%";
    setTimeout(() => {
      fill.style.width = `${pct}%`;
    }, 200);
  }
  updateNavForScreen("graphs");
  graphsBuilt = true;
}

// ---- Init ----
async function init() {
  setupWalk();
  setupChairRise();
  setupReaction();
  setupProfile();

  try {
    await loadProfiles();
    if (profiles.length) {
      const stored = activeProfileId();
      const match = profiles.find((p) => String(p.id) === stored);
      if (!match) setActiveProfileId(profiles[0].id);
      await loadProfile();
      try {
        await loadSnapshot();
        await loadHistory();
      } catch {
        snapshot = null;
        history = null;
      }
    }
    renderJournals();
  } catch (e) {
    console.warn("KinSpan init:", e);
    t("toastDash", "API offline — start server on port 8003");
  }

  if (sessionStorage.getItem(SKIP_ONBOARDING_KEY) === "1") {
    routeAfterAuth();
  } else {
    goTo("onboarding");
  }

  apiGet("/api/health")
    .then((h) => {
      const tag = document.getElementById("buildTag");
      if (tag && h.build) tag.textContent = h.build;
    })
    .catch(() => {});
}

window.addEventListener("message", (e) => {
  if (!isKinspanMessageEvent(e)) return;
  if (e.data.type === "kinspan:assessment-saved") afterAssessmentSaved().catch(() => {});
  if (e.data.type === "kinspan:workflow-finished") finishGuidedCheckin();
});

// Expose for inline handlers in HTML
window.goTo = goTo;
window.finishGuidedCheckin = finishGuidedCheckin;
window.goSlide = goSlide;
window.obNext = obNext;
window.skipOnboarding = skipOnboarding;
window.openTasks = openTasks;
window.closeTasks = closeTasks;
window.toggleTask = toggleTask;
window.showMilestone = showMilestone;
window.closeMilestone = closeMilestone;
window.t = t;

init();
