/**
 * ARCHIVED: 30-second CDC sit-to-stand test (not loaded by kinspan-app.js).
 * Requires: apiPost, afterAssessmentSaved, parentName, escapeHtml, goTo on window.
 */
/* eslint-disable no-unused-vars */

let ssInt = null,
  ssSec = 30,
  ssR = 0,
  selEff_ = null,
  lastChairScores = null;

function resetSitStandUi() {
  if (ssInt) clearInterval(ssInt);
  ssInt = null;
  ssSec = 30;
  ssR = 0;
  selEff_ = null;
  document.querySelectorAll(".eff-btn").forEach((b) => b.classList.remove("sel"));
  ["ssReady", "ssRunning", "ssEffort", "ssResult"].forEach((id, i) => {
    const el = document.getElementById(id);
    if (el) el.classList.toggle("show", i === 0);
  });
  const t = document.getElementById("ssTimer");
  if (t) t.textContent = "30";
  const rd = document.getElementById("ssRepsD");
  if (rd) rd.textContent = "0";
}

function startSS() {
  document.getElementById("ssReady")?.classList.remove("show");
  document.getElementById("ssRunning")?.classList.add("show");
  ssSec = 30;
  ssR = 0;
  document.getElementById("ssTimerR").textContent = "30";
  document.getElementById("ssRepsR").textContent = "0";
  ssInt = setInterval(() => {
    ssSec--;
    document.getElementById("ssTimerR").textContent = ssSec;
    if (ssSec <= 0) {
      clearInterval(ssInt);
      finishSS();
    }
  }, 1000);
}

function countRep() {
  ssR++;
  document.getElementById("ssRepsR").textContent = ssR;
}

function undoRep() {
  if (ssR > 0) {
    ssR--;
    document.getElementById("ssRepsR").textContent = ssR;
  }
}

function finishSS() {
  if (ssInt) clearInterval(ssInt);
  document.getElementById("ssRunning")?.classList.remove("show");
  document.getElementById("ssEffort")?.classList.add("show");
  const fr = document.getElementById("finalReps");
  if (fr) fr.textContent = ssR;
  const sub = document.getElementById("ssCompleteSub");
  if (sub)
    sub.innerHTML = `${escapeHtml(parentName)} completed <span class="rep-count">${ssR}</span> reps in 30 seconds`;
}

function selEff(btn, v) {
  selEff_ = v;
  document.querySelectorAll(".eff-btn").forEach((b) => b.classList.remove("sel"));
  btn.classList.add("sel");
}

async function showChairRepsResult() {
  document.getElementById("ssEffort")?.classList.remove("show");
  document.getElementById("ssResult")?.classList.add("show");
  try {
    const res = await apiPost("/api/assessments/chair-reps", { reps: ssR });
    lastChairScores = res.scores;
    const s = res.scores;
    document.getElementById("resReps").textContent = ssR;
    document.getElementById("resEffort").textContent = selEff_ || "—";
    document.getElementById("resScore").textContent = Math.round(s.score);
    const insight = document.getElementById("resInsight");
    if (insight) insight.textContent = s.interpretation;
    const title = document.getElementById("ssResultTitle");
    if (title) title.textContent = `${parentName}'s Result`;
    const expected = s.raw?.expected_reps;
    if (expected) {
      const pct = Math.min(100, (ssR / expected) * 100);
      const fill = document.querySelector("#ssResult .norm-fill");
      const marker = document.querySelector("#ssResult .norm-marker");
      if (fill) fill.style.width = `${pct}%`;
      if (marker) marker.style.left = `${pct}%`;
    }
    await afterAssessmentSaved();
  } catch (e) {
    const insight = document.getElementById("resInsight");
    if (insight) insight.textContent = e.message;
  }
}

// window.startSS = startSS;
// window.countRep = countRep;
// window.undoRep = undoRep;
// window.finishSS = finishSS;
// window.selEff = selEff;
// window.showChairRepsResult = showChairRepsResult;
