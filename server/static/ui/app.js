const SCREENS = ["welcome", "journals", "parent", "walk", "chair", "reaction", "profile", "guided", "dashboard"];
const SKIP_WELCOME_KEY = "kinspan_skip_welcome";
let profileName = "Mom/Dad";
let snapshot = null;
let currentScreen = "welcome";

function show(screen) {
  if (!SCREENS.includes(screen)) return;
  currentScreen = screen;
  SCREENS.forEach((s) => {
    document.getElementById("screen-" + s)?.classList.toggle("active", s === screen);
  });
  document.body.classList.toggle("nav-locked", screen !== "guided");
  document.body.dataset.screen = screen;

  const frame = document.getElementById("guidedFrame");
  if (screen === "guided") {
    if (frame && !String(frame.getAttribute("src") || "").includes("/classic")) {
      frame.src = "/classic?embed=1";
    }
  } else if (frame) {
    frame.removeAttribute("src");
    frame.src = "about:blank";
  }

  if (screen === "dashboard") loadSnapshot().then(renderDashboard);
  if (screen === "parent" || screen === "journals") refreshHubState();

  window.scrollTo(0, 0);
}

async function refreshHubState() {
  await loadSnapshot();
  const hasData = (snapshot?.categories?.length ?? 0) > 0;
  const tag = document.getElementById("hubTagline");
  if (tag) {
    tag.textContent = hasData
      ? "The next steps of their Longevity Journey"
      : "The first steps of their Longevity Journey";
  }
}

async function afterAssessmentSaved() {
  await loadSnapshot();
  if (currentScreen === "dashboard") renderDashboard();
  if (currentScreen === "journals" || currentScreen === "parent") {
    const p = await loadProfile();
    renderJournals(p);
  }
}

const API_FETCH = { cache: "no-store" };

async function apiGet(path) {
  const r = await fetch(path, API_FETCH);
  if (!r.ok) throw new Error(await r.text() || r.statusText);
  return r.json();
}

async function apiPost(path, body) {
  const r = await fetch(path, {
    ...API_FETCH,
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(await r.text() || r.statusText);
  return r.json();
}

async function apiPut(path, body) {
  const r = await fetch(path, {
    ...API_FETCH,
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(await r.text() || r.statusText);
  return r.json();
}

function showResult(el, text) {
  el.style.display = "block";
  el.textContent = typeof text === "string" ? text : JSON.stringify(text, null, 2);
}

function fmtDate(iso) {
  if (!iso) return "Not yet updated";
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: "2-digit", day: "2-digit", year: "numeric" });
  } catch { return "Not yet updated"; }
}

function lastUpdated(snap, profile) {
  if (snap?.categories?.length) {
    const dates = snap.categories.map((c) => c.latest_at).filter(Boolean);
    if (dates.length) return dates.sort().reverse()[0];
  }
  return profile?.created_at ?? null;
}

async function loadProfile() {
  try {
    const p = await apiGet("/api/profile");
    profileName = p.display_name || "Mom/Dad";
    document.querySelectorAll("[data-name]").forEach((el) => { el.textContent = profileName; });
    return p;
  } catch { return null; }
}

async function loadSnapshot() {
  try { snapshot = await apiGet("/api/snapshot"); return snapshot; }
  catch { snapshot = null; return null; }
}

function renderJournals(profile) {
  const last = lastUpdated(snapshot, profile);
  const carousel = document.getElementById("journalCarousel");
  carousel.innerHTML = `
    <button type="button" class="journal-card" data-go="parent">
      <div class="sprout">🌱</div>
      <strong>${profileName}</strong>
      <em>Last updated: ${fmtDate(last)}</em>
      <span style="font-size:0.78rem;color:var(--primary);font-weight:700">Open longevity dashboard →</span>
    </button>
    <button type="button" class="journal-card" data-go="profile">
      <div class="sprout">+</div>
      <strong>Add another parent</strong>
      <em>Set up a new journal</em>
    </button>
  `;
  carousel.querySelectorAll(".journal-card").forEach((btn) => {
    btn.onclick = () => {
      if (btn.dataset.go === "profile") { loadProfileForm(); show("profile"); }
      else show("parent");
    };
  });
  syncJournalDots();
}

function syncJournalDots() {
  const carousel = document.getElementById("journalCarousel");
  const dots = document.querySelectorAll(".journal-dots span");
  if (!carousel || !dots.length) return;
  carousel.onscroll = () => {
    const mid = carousel.scrollLeft + carousel.clientWidth / 2;
    let idx = 0;
    carousel.querySelectorAll(".journal-card").forEach((card, i) => {
      if (card.offsetLeft + card.offsetWidth / 2 <= mid) idx = i;
    });
    dots.forEach((d, i) => d.classList.toggle("on", i === idx));
  };
}

function renderDashboard() {
  const el = document.getElementById("dashContent");
  if (!snapshot || snapshot.overall?.overall_score == null) {
    el.innerHTML = '<p class="hub-tag">No scores yet. Run a test from the parent hub.</p>';
    return;
  }
  const score = snapshot.overall.overall_score ?? 0;
  const pct = Math.min(100, Math.max(0, score));
  const c = 2 * Math.PI * 42;
  const off = c - (pct / 100) * c;

  let catHtml = "";
  if (snapshot.categories?.length) {
    catHtml = "<ul style='margin:0.75rem 0 0;padding-left:1rem;font-size:0.88rem'>" +
      snapshot.categories.map((cat) => {
        const trend = cat.trend_detail?.trend ?? "stable";
        const arrow = trend === "improving" ? "↑" : trend === "watch_closely" ? "↓" : "→";
        return `<li><strong>${cat.label}</strong> — ${cat.score}/100 ${arrow} ${cat.trend_detail?.summary || ""}</li>`;
      }).join("") + "</ul>";
  }

  el.innerHTML = `
    <div class="summary-row">
      <div>
        <p style="margin:0 0 0.5rem">${snapshot.overall.headline || ""}</p>
        ${snapshot.insights?.summary ? `<p class="hub-tag">${snapshot.insights.summary}</p>` : ""}
        <p class="hub-tag">Functional ~${snapshot.overall.overall_functional_age} · Age ${snapshot.overall.chronological_age}</p>
      </div>
      <div class="donut-wrap">
        <svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="42" fill="none" stroke="#e8eeec" stroke-width="10"/>
        <circle cx="50" cy="50" r="42" fill="none" stroke="var(--primary)" stroke-width="10" stroke-dasharray="${c}" stroke-dashoffset="${off}" stroke-linecap="round" transform="rotate(-90 50 50)"/></svg>
        <span class="donut-pct">${Math.round(pct)}%</span>
      </div>
    </div>
    ${catHtml}
  `;

  // tasks modal
  const taskList = document.getElementById("taskList");
  if (snapshot.actions?.length) {
    taskList.innerHTML = snapshot.actions.map((a) =>
      `<li><strong>${a.title}</strong><p class="hub-tag">${a.detail}</p></li>`
    ).join("");
  }
}

// ---- Walk test ----
let walkState = "idle", walkAccum = 0, walkSegStart = 0, walkTick = null;
function walkNow() { return walkState === "running" ? walkAccum + (performance.now() - walkSegStart) / 1000 : walkAccum; }
function walkDisp() { document.getElementById("walkTimer").textContent = walkNow().toFixed(2) + "s"; }
function walkBtns() {
  document.getElementById("walkStart").disabled = walkState === "running" || walkState === "paused";
  document.getElementById("walkPause").disabled = walkState !== "running";
  document.getElementById("walkPause").style.display = walkState === "paused" ? "none" : "";
  document.getElementById("walkResume").disabled = walkState !== "paused";
  document.getElementById("walkResume").style.display = walkState === "paused" ? "" : "none";
  document.getElementById("walkStop").disabled = walkState === "idle" || walkState === "stopped";
}
document.getElementById("walkStart").onclick = () => {
  walkState = "running"; walkAccum = 0; walkSegStart = performance.now();
  document.getElementById("walkOut").style.display = "none";
  if (walkTick) clearInterval(walkTick);
  walkTick = setInterval(walkDisp, 50); walkBtns();
};
document.getElementById("walkPause").onclick = () => {
  if (walkState !== "running") return;
  walkAccum += (performance.now() - walkSegStart) / 1000;
  clearInterval(walkTick); walkTick = null; walkState = "paused"; walkDisp(); walkBtns();
};
document.getElementById("walkResume").onclick = () => {
  if (walkState !== "paused") return;
  walkSegStart = performance.now(); walkState = "running";
  walkTick = setInterval(walkDisp, 50); walkBtns();
};
document.getElementById("walkStop").onclick = () => {
  if (walkState === "running") walkAccum += (performance.now() - walkSegStart) / 1000;
  if (walkTick) clearInterval(walkTick); walkTick = null;
  walkState = "stopped"; walkDisp();
  document.getElementById("walkSec").value = walkAccum.toFixed(2); walkBtns();
};
function resetWalkUi() {
  if (walkTick) clearInterval(walkTick);
  walkTick = null;
  walkState = "idle";
  walkAccum = 0;
  document.getElementById("walkTimer").textContent = "—";
  document.getElementById("walkSec").value = "";
  document.getElementById("walkOut").style.display = "none";
  walkBtns();
}
document.getElementById("walkReset").onclick = resetWalkUi;
walkBtns();
document.getElementById("saveWalk").onclick = async () => {
  const t = walkAccum || parseFloat(document.getElementById("walkSec").value);
  if (!t || t <= 0) return;
  try {
    const res = await apiPost("/api/assessments/gait", { time_seconds: t });
    showResult(document.getElementById("walkOut"),
      res.scores.label + ": " + res.scores.score + "/100\n" + res.scores.interpretation +
      "\nSpeed: " + res.scores.raw.speed_mps + " m/s");
    await afterAssessmentSaved();
  } catch (e) { showResult(document.getElementById("walkOut"), e.message); }
};

// ---- Chair stand (single timed rise) ----
let chairState = "idle", chairAccum = 0, chairSegStart = 0, chairTick = null, chairElapsed = null;
function chairSec() {
  if (chairState === "running") return chairAccum + (performance.now() - chairSegStart) / 1000;
  return chairAccum;
}
function chairUi() {
  const el = document.getElementById("chairTimer");
  el.textContent = chairState === "idle" && !chairElapsed ? "—" : chairSec().toFixed(2) + "s";
}
document.getElementById("chairStart").onclick = () => {
  chairState = "running"; chairAccum = 0; chairElapsed = null;
  chairSegStart = performance.now();
  document.getElementById("chairStop").disabled = false;
  document.getElementById("saveChair").disabled = true;
  document.getElementById("chairOut").style.display = "none";
  if (chairTick) clearInterval(chairTick);
  chairTick = setInterval(chairUi, 50);
};
document.getElementById("chairStop").onclick = () => {
  if (chairState !== "running") return;
  chairAccum += (performance.now() - chairSegStart) / 1000;
  chairElapsed = chairAccum;
  chairState = "stopped";
  if (chairTick) clearInterval(chairTick);
  chairUi();
  document.getElementById("chairStop").disabled = true;
  document.getElementById("saveChair").disabled = false;
};
function resetChairUi() {
  chairState = "idle";
  chairAccum = 0;
  chairElapsed = null;
  if (chairTick) clearInterval(chairTick);
  chairTick = null;
  document.getElementById("chairTimer").textContent = "—";
  document.getElementById("chairStop").disabled = true;
  document.getElementById("saveChair").disabled = true;
  document.getElementById("chairOut").style.display = "none";
}
document.getElementById("chairReset").onclick = resetChairUi;
document.getElementById("saveChair").onclick = async () => {
  const t = chairElapsed || chairSec();
  if (!t || t < 0.4) {
    showResult(document.getElementById("chairOut"), "Time one full stand first.");
    return;
  }
  try {
    const res = await apiPost("/api/assessments/chair-stand", { rise_time_seconds: t });
    showResult(document.getElementById("chairOut"),
      res.scores.label + ": " + res.scores.score + "/100\n" + res.scores.interpretation);
    await afterAssessmentSaved();
  } catch (e) { showResult(document.getElementById("chairOut"), e.message); }
};

// ---- Reaction test ----
const TRIALS = 5;
let reactPhase = "idle", reactTrials = [], reactTimer = null, reactGo = 0;
const pad = document.getElementById("reactPad");
const reactRedoBtn = document.getElementById("reactRedo");

function updateReactRedo() {
  reactRedoBtn.style.display = reactTrials.length > 0 || reactPhase === "done" ? "" : "none";
}
function resetReaction() {
  clearTimeout(reactTimer); reactTimer = null;
  reactPhase = "idle"; reactTrials = [];
  pad.textContent = "Tap to start"; pad.className = "react-pad wait";
  document.getElementById("reactTrials").textContent = "";
  document.getElementById("saveReact").disabled = true;
  document.getElementById("reactOut").style.display = "none";
  updateReactRedo();
}
reactRedoBtn.onclick = resetReaction;

function startReactTrial() {
  pad.className = "react-pad wait"; pad.textContent = "Wait…"; reactPhase = "waiting";
  reactTimer = setTimeout(() => {
    reactGo = performance.now(); reactPhase = "go";
    pad.className = "react-pad go"; pad.textContent = "TAP!";
  }, 1500 + Math.random() * 2000);
}

pad.onclick = () => {
  if (reactPhase === "done") return;
  if (reactPhase === "idle") {
    reactTrials = [];
    document.getElementById("saveReact").disabled = true;
    document.getElementById("reactOut").style.display = "none";
    updateReactRedo(); startReactTrial(); return;
  }
  if (reactPhase === "waiting") {
    clearTimeout(reactTimer); reactTimer = null; reactPhase = "idle";
    pad.textContent = "Too soon — tap to restart"; pad.className = "react-pad wait";
    updateReactRedo(); return;
  }
  if (reactPhase === "go") {
    reactTrials.push(Math.round(performance.now() - reactGo));
    document.getElementById("reactTrials").textContent = "Trials (ms): " + reactTrials.join(", ");
    updateReactRedo();
    if (reactTrials.length >= TRIALS) {
      reactPhase = "done"; pad.textContent = "Done — save or redo"; pad.className = "react-pad go";
      document.getElementById("saveReact").disabled = false;
    } else { reactPhase = "waiting"; setTimeout(startReactTrial, 600); }
  }
};

document.getElementById("saveReact").onclick = async () => {
  try {
    const res = await apiPost("/api/assessments/reaction", { trials_ms: reactTrials });
    showResult(document.getElementById("reactOut"),
      res.scores.label + ": " + res.scores.score + "/100\n" + res.scores.interpretation);
    await afterAssessmentSaved();
  } catch (e) { showResult(document.getElementById("reactOut"), e.message); }
};

// ---- Profile ----
function loadProfileForm() {
  apiGet("/api/profile").then((p) => {
    document.getElementById("profName").value = p.display_name || "";
    document.getElementById("profAge").value = p.age || 68;
    document.getElementById("profSex").value = (p.sex || "female").toLowerCase().includes("male") ? "male" : "female";
  }).catch(() => {});
}

document.getElementById("saveProf").onclick = async () => {
  const out = document.getElementById("profOut");
  try {
    const body = {
      display_name: document.getElementById("profName").value,
      age: +document.getElementById("profAge").value,
      sex: document.getElementById("profSex").value,
    };
    const p = await apiPut("/api/profile", body);
    showResult(out, "Saved: " + p.display_name + ", age " + p.age);
    profileName = p.display_name;
    document.querySelectorAll("[data-name]").forEach((el) => { el.textContent = profileName; });
    await refreshHubState();
    renderJournals(p);
  } catch (e) { showResult(out, e.message); }
};

// ---- Navigation ----
document.querySelectorAll("[data-test]").forEach((btn) => {
  btn.addEventListener("click", (e) => {
    e.preventDefault();
    show(btn.dataset.test);
  });
});

document.querySelectorAll("[data-back]").forEach((btn) => {
  btn.addEventListener("click", () => show(btn.dataset.back));
});

document.getElementById("btnWelcomeSkip")?.addEventListener("click", () => {
  sessionStorage.setItem(SKIP_WELCOME_KEY, "1");
  show("journals");
});
document.getElementById("btnHubBack")?.addEventListener("click", () => show("journals"));
document.getElementById("btnViewDashboard")?.addEventListener("click", () => show("dashboard"));
document.getElementById("btnTasks")?.addEventListener("click", () => {
  document.getElementById("taskModal").style.display = "flex";
});
function closeTaskModal() {
  document.getElementById("taskModal").style.display = "none";
}
document.getElementById("closeTaskModal")?.addEventListener("click", closeTaskModal);
document.getElementById("taskModal")?.addEventListener("click", (e) => {
  if (e.target.id === "taskModal") closeTaskModal();
});

async function init() {
  const profile = await loadProfile();
  await loadSnapshot();
  renderJournals(profile);
  await refreshHubState();
  if (sessionStorage.getItem(SKIP_WELCOME_KEY) === "1") show("journals");
  else show("welcome");
}

window.addEventListener("message", (e) => {
  if (e.origin !== location.origin) return;
  if (e.data?.type === "kinspan:assessment-saved") afterAssessmentSaved();
});

apiGet("/api/health")
  .then((h) => {
    const el = document.getElementById("buildTag");
    if (el && h.build) el.textContent = h.build;
    const classic = document.getElementById("classicLink");
    if (classic) classic.href = "/classic";
  })
  .catch(() => {});

init();
