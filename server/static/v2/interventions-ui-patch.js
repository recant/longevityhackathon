/**
 * Reversible UI patch for the v2 app.
 * - Prefer citation-backed /api/snapshot.interventions over legacy actions.
 * - Show compact citations only: author + paper title, no DOI/URL in the UI.
 * - Add local intervention selection/adherence tracking and graph markers.
 * - Support pitch demo mode with ?demo=1.
 *
 * Remove this file and its script tag to return to the original UI behavior.
 */
(function () {
  const FETCH_OPTS = { cache: 'no-store' };
  const PLAN_KEY = 'kinspan_selected_interventions_v1';
  const SESSION_PROMPT_KEY = 'kinspan_intervention_prompted_this_session';
  const params = new URLSearchParams(window.location.search);
  const DEMO_MODE = params.get('demo') === '1' || params.get('demo') === 'true';

  const DEMO_POINTS = [
    { label: 'Baseline', score: 58 },
    { label: 'Week 2', score: 59 },
    { label: 'Week 4', score: 57 },
    { label: 'Started plan', score: 60, intervention: true },
    { label: 'Week 8', score: 64 },
    { label: 'Week 10', score: 69 },
    { label: 'Week 12', score: 73 },
    { label: 'Today', score: 77 },
  ];

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function readJson(key, fallback) {
    try {
      return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback));
    } catch (_) {
      return fallback;
    }
  }

  function writeJson(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function getPlan() {
    const plan = readJson(PLAN_KEY, []);
    return Array.isArray(plan) ? plan : [];
  }

  function savePlan(plan) {
    writeJson(PLAN_KEY, plan);
  }

  function totalCheckins(snap) {
    const counts = snap?.history_counts || {};
    return (counts.reactions || 0) + (counts.gaits || 0) + (counts.chairs || 0);
  }

  function graphPointCount() {
    const canvas = document.getElementById('vitalityChart');
    const chart = typeof Chart !== 'undefined' && canvas ? Chart.getChart(canvas) : null;
    const data = chart?.data?.datasets?.[0]?.data || [];
    return data.length || 0;
  }

  function interventionId(item) {
    const raw = `${item.id || item.title || 'intervention'}|${item.citation?.short || ''}`;
    return raw.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80);
  }

  function activePlanIds() {
    return new Set(getPlan().filter((p) => !p.stoppedAt).map((p) => p.id));
  }

  function compactCitation(citation) {
    if (!citation) return 'Peer-reviewed source';
    if (citation.display) return citation.display;
    if (citation.short) return citation.short;
    if (citation.full) {
      const parts = String(citation.full).split('.');
      const authors = parts[0]?.trim() || 'Peer-reviewed source';
      const title = parts[1]?.trim();
      return title ? `${authors}, ${title}` : authors;
    }
    return 'Peer-reviewed source';
  }

  function citationHtml(citation) {
    return `<p class="ks-citation"><strong>Evidence:</strong> ${escapeHtml(compactCitation(citation))}</p>`;
  }

  function interventionHtml(item) {
    return `
      <li class="task-item-static ks-intervention-card" data-source="intervention">
        <strong>${escapeHtml(item.title)}</strong>
        <p class="task-sub">${escapeHtml(item.suggestion)}</p>
        ${item.rationale ? `<p class="task-sub"><strong>Why:</strong> ${escapeHtml(item.rationale)}</p>` : ''}
        ${citationHtml(item.citation)}
      </li>
    `;
  }

  function fallbackActionHtml(action) {
    const detail = String(action.detail || '')
      .replace(/\s*DOI:\s*[^\s]+/gi, '')
      .replace(/\s*Source:\s*https?:\/\/\S+/gi, '');
    return `
      <li class="task-item-static ks-intervention-card" data-source="legacy-action">
        <strong>${escapeHtml(action.title)}</strong>
        <p class="task-sub">${escapeHtml(detail)}</p>
      </li>
    `;
  }

  function interventionChecklistHtml(interventions, snap) {
    if (!interventions?.length) return '';
    const active = activePlanIds();
    const plan = getPlan().filter((p) => !p.stoppedAt);
    const rows = interventions.map((item, index) => {
      const id = interventionId(item);
      const already = active.has(id);
      return `
        <label class="ks-plan-option">
          <input type="checkbox" data-ks-intervention-choice="1" data-index="${index}" ${already ? 'checked' : ''} />
          <span>
            <strong>${escapeHtml(item.title)}</strong>
            <small>${already ? 'Already in current plan' : 'Start tracking this intervention'}</small>
          </span>
        </label>
      `;
    }).join('');

    const activeSummary = plan.length
      ? `<div class="ks-plan-active"><strong>Currently tracking:</strong> ${plan.map((p) => escapeHtml(p.title)).join(', ')}<br><small>Confirmed adherence appears as a vertical marker on the Progress graph.</small></div>`
      : '';

    return `
      <li class="task-item-static ks-plan-box" data-source="intervention-selector">
        <strong>Choose interventions to start</strong>
        <p class="task-sub">Select one or more habits. Next time you begin a test session, the app will ask whether you actually did them since the previous check-in.</p>
        <div class="ks-plan-options" data-current-count="${totalCheckins(snap)}">${rows}</div>
        <button type="button" class="ks-plan-btn" id="ksStartInterventions">Start selected interventions</button>
        <button type="button" class="ks-plan-clear" id="ksClearInterventions">Clear tracked interventions</button>
        <p class="task-sub" id="ksPlanStatus"></p>
        ${activeSummary}
      </li>
    `;
  }

  async function loadSnapshot() {
    const res = await fetch('/api/snapshot', FETCH_OPTS);
    if (!res.ok) throw new Error(await res.text() || res.statusText);
    return res.json();
  }

  async function renderCitedInterventions() {
    let snap;
    try {
      snap = await loadSnapshot();
    } catch (err) {
      console.warn('Intervention UI patch could not load snapshot:', err);
      return;
    }

    window.__ksLatestSnapshot = snap;
    window.__ksLatestInterventions = snap.interventions || [];

    const taskList = document.getElementById('taskList');
    if (taskList) {
      const interventions = snap.interventions || [];
      if (interventions.length) {
        taskList.innerHTML = interventions.map(interventionHtml).join('') + interventionChecklistHtml(interventions, snap);
      } else if (!taskList.children.length && snap.actions?.length) {
        taskList.innerHTML = snap.actions.map(fallbackActionHtml).join('');
      }
    }

    const digestAction = document.getElementById('digestAction');
    const first = snap.interventions?.[0];
    if (digestAction && first) {
      digestAction.innerHTML = `
        ${escapeHtml(first.suggestion)}
        <br><br><span class="ks-citation"><strong>Evidence:</strong> ${escapeHtml(compactCitation(first.citation))}</span>
      `;
    }
  }

  function startSelectedInterventions() {
    const interventions = window.__ksLatestInterventions || [];
    const snap = window.__ksLatestSnapshot || null;
    const selected = [...document.querySelectorAll('[data-ks-intervention-choice]:checked')]
      .map((input) => interventions[Number(input.dataset.index)])
      .filter(Boolean);
    const status = document.getElementById('ksPlanStatus');

    if (!selected.length) {
      if (status) status.textContent = 'Select at least one intervention first.';
      return;
    }

    const now = new Date().toISOString();
    const existing = getPlan().filter((p) => !p.stoppedAt);
    const existingById = new Map(existing.map((p) => [p.id, p]));
    const currentCount = totalCheckins(snap);
    const startGraphIndex = graphPointCount();

    const nextPlan = selected.map((item) => {
      const id = interventionId(item);
      const old = existingById.get(id);
      if (old) return old;
      return {
        id,
        title: item.title || 'Intervention',
        suggestion: item.suggestion || '',
        citationLabel: compactCitation(item.citation),
        startedAt: now,
        startCheckinCount: currentCount,
        startGraphIndex,
        adherenceLog: [],
      };
    });

    savePlan(nextPlan);
    sessionStorage.removeItem(SESSION_PROMPT_KEY);
    if (status) status.textContent = `Started tracking ${nextPlan.length} intervention${nextPlan.length === 1 ? '' : 's'}.`;
    setTimeout(scheduleRender, 150);
    setTimeout(schedulePlanGraphMarkers, 300);
  }

  function clearSelectedInterventions() {
    savePlan([]);
    sessionStorage.removeItem(SESSION_PROMPT_KEY);
    setTimeout(scheduleRender, 50);
    setTimeout(schedulePlanGraphMarkers, 200);
  }

  function demoInterventionHtml() {
    return `
      <li class="task-item-static ks-intervention-card" data-source="demo-intervention" id="demoInterventionTask">
        <strong>Demo intervention: daily walk + breakfast sit-to-stands</strong>
        <p class="task-sub">Started after Week 4. The graph shows an observed improvement after this habit began; describe this as a trajectory signal, not proof of causation.</p>
        <p class="ks-citation"><strong>Evidence:</strong> Pahor et al., Effect of Structured Physical Activity</p>
      </li>
    `;
  }

  function installDemoTag() {
    if (!DEMO_MODE) return;
    const tag = document.getElementById('buildTag');
    if (tag) tag.textContent = 'DEMO MODE · seeded graph';
  }

  function ensureDemoNote() {
    if (!DEMO_MODE) return;
    const graphSection = document.querySelector('#graphs .graph-section');
    if (!graphSection || document.getElementById('demoInterventionNote')) return;
    const note = document.createElement('div');
    note.id = 'demoInterventionNote';
    note.className = 'graph-card ks-wrap-card';
    note.innerHTML = `
      <h3>Intervention started after Week 4</h3>
      <p class="g-sub">Daily walk + breakfast sit-to-stands</p>
      <div class="bio-exp">Demo narrative: the family began one comfortable walk around the block most days plus 5 slow sit-to-stands after breakfast. The score improved over later check-ins. Say “after the intervention,” not “because of the intervention.”</div>
    `;
    graphSection.insertBefore(note, graphSection.children[1] || null);
  }

  function drawVerticalMarker(chart, x, label, color) {
    const area = chart.chartArea;
    const ctx = chart.ctx;
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(x, area.top + 8);
    ctx.lineTo(x, area.bottom);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = color;
    ctx.font = '11px DM Sans, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(label, x, area.top + 2);
    ctx.restore();
  }

  function drawDemoMarker(chart) {
    const idx = DEMO_POINTS.findIndex((p) => p.intervention);
    const point = chart.getDatasetMeta(0)?.data?.[idx];
    if (point) drawVerticalMarker(chart, point.x, 'Intervention', '#B07560');
  }

  const demoMarkerPlugin = { id: 'demoInterventionMarker', afterDatasetsDraw: drawDemoMarker };

  function renderDemoGraph() {
    if (!DEMO_MODE) return;
    installDemoTag();
    ensureDemoNote();
    const canvas = document.getElementById('vitalityChart');
    if (!canvas || typeof Chart === 'undefined') return;
    const existing = Chart.getChart(canvas);
    if (existing) existing.destroy();

    new Chart(canvas, {
      type: 'line',
      data: {
        labels: DEMO_POINTS.map((p) => p.label),
        datasets: [{
          label: 'Demo functional score',
          data: DEMO_POINTS.map((p) => p.score),
          borderColor: '#6B8F71',
          backgroundColor: 'rgba(107,143,113,0.09)',
          pointBackgroundColor: DEMO_POINTS.map((p) => (p.intervention ? '#B07560' : '#6B8F71')),
          pointBorderColor: '#ffffff',
          pointBorderWidth: 2,
          pointRadius: DEMO_POINTS.map((p) => (p.intervention ? 7 : 5)),
          borderWidth: 2.5,
          tension: 0.35,
          fill: true,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { min: 45, max: 90, ticks: { color: '#7A8C82', font: { size: 10 } }, grid: { color: 'rgba(0,0,0,0.04)' } },
          x: { ticks: { color: '#7A8C82', font: { size: 10 } }, grid: { display: false } },
        },
      },
      plugins: [demoMarkerPlugin],
    });

    const metricVals = document.querySelectorAll('#graphs .m-val');
    if (metricVals[0]) metricVals[0].textContent = '77';
    if (metricVals[1]) metricVals[1].textContent = '77';
    if (metricVals[2]) metricVals[2].textContent = '+19';
    const metricDeltas = document.querySelectorAll('#graphs .m-delta');
    if (metricDeltas[0]) metricDeltas[0].textContent = '+4 ↑';
    if (metricDeltas[1]) metricDeltas[1].textContent = 'Today';
    if (metricDeltas[2]) metricDeltas[2].textContent = 'after plan';
    const bioExp = document.getElementById('bioExpText');
    if (bioExp) bioExp.innerHTML = 'Demo narrative: after the family began a simple daily walking + sit-to-stand habit, the functional score moved from the high 50s to the high 70s over the following check-ins.';
    const fill = document.getElementById('bioFill');
    if (fill) {
      fill.style.width = '0%';
      setTimeout(() => { fill.style.width = '77%'; }, 150);
    }
  }

  function renderDemoTasks() {
    if (!DEMO_MODE) return;
    const taskList = document.getElementById('taskList');
    if (taskList && !document.getElementById('demoInterventionTask')) {
      taskList.insertAdjacentHTML('afterbegin', demoInterventionHtml());
    }
    const digestAction = document.getElementById('digestAction');
    if (digestAction) {
      digestAction.innerHTML = 'Continue the daily walk + breakfast sit-to-stand habit this week.<br><br><span class="ks-citation"><strong>Evidence:</strong> Pahor et al., Effect of Structured Physical Activity</span>';
    }
  }

  function confirmedPlanItems() {
    return getPlan().filter((p) => !p.stoppedAt && (p.adherenceLog || []).some((log) => log.kept));
  }

  function ensurePlanProgressNote(items, chart) {
    const graphSection = document.querySelector('#graphs .graph-section');
    if (!graphSection) return;
    let note = document.getElementById('ksPlanProgressNote');
    if (!items.length) { note?.remove(); return; }
    if (!note) {
      note = document.createElement('div');
      note.id = 'ksPlanProgressNote';
      note.className = 'graph-card ks-wrap-card';
      graphSection.insertBefore(note, graphSection.children[1] || null);
    }
    const data = chart?.data?.datasets?.[0]?.data || [];
    const rows = items.map((item) => {
      const idx = Math.max(0, Math.min(Number(item.startGraphIndex || 0), Math.max(0, data.length - 1)));
      const start = data[idx];
      const latest = data[data.length - 1];
      const delta = Number.isFinite(Number(start)) && Number.isFinite(Number(latest)) ? Math.round(Number(latest) - Number(start)) : null;
      return `<li><strong>${escapeHtml(item.title)}</strong> — started ${new Date(item.startedAt).toLocaleDateString()}${delta == null ? '' : `; score change after start: ${delta >= 0 ? '+' : ''}${delta}`}</li>`;
    }).join('');
    note.innerHTML = `
      <h3>Intervention markers</h3>
      <p class="g-sub">Vertical lines show when a selected habit plan started. They show timing, not proof of causation.</p>
      <ul class="ks-plan-progress-list">${rows}</ul>
    `;
  }

  function drawPlanMarkers() {
    if (DEMO_MODE) return;
    const canvas = document.getElementById('vitalityChart');
    const chart = typeof Chart !== 'undefined' && canvas ? Chart.getChart(canvas) : null;
    const items = confirmedPlanItems();
    ensurePlanProgressNote(items, chart);
    if (!chart || !items.length) return;
    const data = chart.data?.datasets?.[0]?.data || [];
    if (!data.length) return;
    items.forEach((item, i) => {
      const idx = Math.max(0, Math.min(Number(item.startGraphIndex || 0), data.length - 1));
      const point = chart.getDatasetMeta(0)?.data?.[idx];
      if (point) drawVerticalMarker(chart, point.x, i === 0 ? 'Started' : `Start ${i + 1}`, '#B07560');
    });
  }

  function schedulePlanGraphMarkers() {
    setTimeout(drawPlanMarkers, 250);
    setTimeout(drawPlanMarkers, 700);
  }

  function adherencePromptNeeded(snap) {
    if (sessionStorage.getItem(SESSION_PROMPT_KEY) === '1') return false;
    const currentCount = totalCheckins(snap || window.__ksLatestSnapshot);
    return getPlan().some((p) => !p.stoppedAt && p.lastAskedCheckinCount !== currentCount);
  }

  async function maybeAskAdherence() {
    let snap = window.__ksLatestSnapshot;
    try {
      snap = await loadSnapshot();
      window.__ksLatestSnapshot = snap;
    } catch (_) {}
    if (!adherencePromptNeeded(snap)) return;
    const plan = getPlan().filter((p) => !p.stoppedAt);
    if (!plan.length || document.getElementById('ksAdherenceOverlay')) return;

    const rows = plan.map((item, index) => `
      <label class="ks-adherence-option">
        <input type="checkbox" data-ks-adherence-choice="1" data-index="${index}" />
        <span><strong>${escapeHtml(item.title)}</strong><small>I did this since the previous session</small></span>
      </label>
    `).join('');

    const overlay = document.createElement('div');
    overlay.id = 'ksAdherenceOverlay';
    overlay.innerHTML = `
      <div class="ks-adherence-card">
        <h3>Since your last session…</h3>
        <p>Which selected interventions have you actually been doing? Confirmed interventions appear as vertical markers on the Progress graph.</p>
        <div>${rows}</div>
        <div class="ks-adherence-actions">
          <button type="button" id="ksSaveAdherence">Save</button>
          <button type="button" id="ksSkipAdherence">Not yet</button>
        </div>
      </div>
    `;
    document.querySelector('.phone-frame')?.appendChild(overlay);
  }

  function saveAdherenceFromPrompt(keptAny) {
    const overlay = document.getElementById('ksAdherenceOverlay');
    const currentCount = totalCheckins(window.__ksLatestSnapshot || null);
    const now = new Date().toISOString();
    const kept = new Set(keptAny ? [...document.querySelectorAll('[data-ks-adherence-choice]:checked')].map((input) => Number(input.dataset.index)) : []);
    const plan = getPlan().filter((p) => !p.stoppedAt).map((item, index) => ({
      ...item,
      lastAskedAt: now,
      lastAskedCheckinCount: currentCount,
      adherenceLog: [...(item.adherenceLog || []), { at: now, checkinCount: currentCount, kept: kept.has(index) }],
    }));
    savePlan(plan);
    sessionStorage.setItem(SESSION_PROMPT_KEY, '1');
    overlay?.remove();
    schedulePlanGraphMarkers();
  }

  function installStyles() {
    if (document.getElementById('ksInterventionPatchStyles')) return;
    const style = document.createElement('style');
    style.id = 'ksInterventionPatchStyles';
    style.textContent = `
      .task-list-api,.task-list-api *,.ks-wrap-card,.ks-wrap-card *{max-width:100%;box-sizing:border-box;overflow-wrap:anywhere;word-break:normal;white-space:normal}
      .ks-intervention-card{overflow:hidden;max-width:100%}
      .ks-intervention-card strong{display:block;line-height:1.35}
      .ks-intervention-card .task-sub{font-size:12px;line-height:1.5;overflow-wrap:anywhere;word-break:normal}
      .ks-citation{display:block;margin-top:7px;font-size:10.5px!important;line-height:1.35;color:var(--text-muted,#7A8C82);overflow-wrap:anywhere;word-break:normal}
      .ks-plan-box{background:#fffdf9;border-left:4px solid #B07560!important;overflow:hidden}
      .ks-plan-options{display:flex;flex-direction:column;gap:8px;margin:10px 0;max-width:100%}
      .ks-plan-option,.ks-adherence-option{display:flex;gap:9px;align-items:flex-start;background:rgba(107,143,113,.09);border-radius:12px;padding:9px 10px;font-size:12px;color:var(--text,#2C3530);max-width:100%;overflow:hidden}
      .ks-plan-option input,.ks-adherence-option input{margin-top:3px;accent-color:#6B8F71;flex-shrink:0}
      .ks-plan-option span,.ks-adherence-option span{display:flex;flex-direction:column;gap:2px;line-height:1.35;min-width:0;max-width:100%}
      .ks-plan-option small,.ks-adherence-option small{color:var(--text-muted,#7A8C82);font-size:11px;overflow-wrap:anywhere}
      .ks-plan-btn,.ks-plan-clear,.ks-adherence-actions button{border:0;border-radius:12px;padding:9px 12px;font-family:'DM Sans',sans-serif;font-size:12px;font-weight:600;cursor:pointer;margin:4px 6px 0 0;max-width:100%}
      .ks-plan-btn,.ks-adherence-actions button:first-child{background:#6B8F71;color:white}
      .ks-plan-clear,.ks-adherence-actions button:last-child{background:#E8F0E9;color:#4A6B51}
      .ks-plan-active{margin-top:10px;border-radius:12px;background:#E8F0E9;padding:10px 11px;font-size:12px;line-height:1.45;color:#4A6B51;overflow-wrap:anywhere}
      #ksAdherenceOverlay{position:absolute;inset:0;background:rgba(0,0,0,.45);z-index:60;display:flex;align-items:center;justify-content:center;padding:22px}
      .ks-adherence-card{background:white;border-radius:24px;padding:22px;box-shadow:0 24px 70px rgba(0,0,0,.25);max-width:340px;width:100%;overflow:hidden}
      .ks-adherence-card h3{font-family:'Lora',serif;font-size:20px;margin:0 0 8px;color:var(--text,#2C3530)}
      .ks-adherence-card p{font-size:13px;color:var(--text-muted,#7A8C82);line-height:1.55;margin:0 0 12px;overflow-wrap:anywhere}
      .ks-adherence-actions{display:flex;gap:8px;margin-top:12px}
      .ks-adherence-actions button{flex:1;margin:0;padding:12px}
      .ks-plan-progress-list{padding-left:18px;margin:8px 0 0;color:var(--text,#2C3530);font-size:12px;line-height:1.55;overflow-wrap:anywhere}
    `;
    document.head.appendChild(style);
  }

  function completeEmbeddedGuidedCheckin() {
    try { window.postMessage({ type: 'kinspan:assessment-saved' }, location.origin); } catch (_) {}
    Promise.resolve().then(() => loadSnapshot()).catch(() => null).finally(() => {
      if (typeof window.goTo === 'function') window.goTo('dashboard');
    });
  }

  function patchGuidedFinishButton() {
    const frame = document.getElementById('guidedFrame');
    if (!frame) return;
    const apply = () => {
      let doc;
      try { doc = frame.contentDocument || frame.contentWindow?.document; } catch (_) { return; }
      if (!doc) return;
      const btn = doc.getElementById('wfContinue');
      if (!btn || btn.dataset.parentFinishPatch === '1') return;
      btn.dataset.parentFinishPatch = '1';
      btn.addEventListener('click', (event) => {
        const label = String(btn.textContent || '').trim().toLowerCase();
        const resultsShown = doc.getElementById('dash')?.classList.contains('show');
        if (label !== 'finish' && !resultsShown) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        completeEmbeddedGuidedCheckin();
      }, true);
    };
    frame.addEventListener('load', () => { setTimeout(apply, 150); setTimeout(apply, 600); });
    setTimeout(apply, 150);
    setTimeout(apply, 600);
  }

  function scheduleRender() {
    setTimeout(renderCitedInterventions, 0);
    setTimeout(renderCitedInterventions, 350);
    setTimeout(renderDemoTasks, 500);
  }

  function scheduleDemoGraph() {
    setTimeout(renderDemoGraph, 120);
    setTimeout(renderDemoGraph, 500);
  }

  const oldGoTo = window.goTo;
  if (typeof oldGoTo === 'function') {
    window.goTo = function patchedGoTo(id) {
      const result = oldGoTo.apply(this, arguments);
      if (id === 'dashboard' || id === 'weekly-digest') scheduleRender();
      if (id === 'graphs') { scheduleDemoGraph(); schedulePlanGraphMarkers(); }
      if (id === 'guided') patchGuidedFinishButton();
      if (['tests', 'walk', 'sit-stand', 'reaction', 'chair-rise', 'guided'].includes(id)) {
        setTimeout(maybeAskAdherence, 250);
      }
      return result;
    };
  }

  const oldOpenTasks = window.openTasks;
  if (typeof oldOpenTasks === 'function') {
    window.openTasks = function patchedOpenTasks() {
      const result = oldOpenTasks.apply(this, arguments);
      scheduleRender();
      return result;
    };
  }

  document.addEventListener('click', (event) => {
    if (event.target?.id === 'ksStartInterventions') startSelectedInterventions();
    if (event.target?.id === 'ksClearInterventions') clearSelectedInterventions();
    if (event.target?.id === 'ksSaveAdherence') saveAdherenceFromPrompt(true);
    if (event.target?.id === 'ksSkipAdherence') saveAdherenceFromPrompt(false);
  });

  window.addEventListener('message', (event) => {
    if (event.origin === location.origin && event.data?.type === 'kinspan:assessment-saved') {
      scheduleRender();
      scheduleDemoGraph();
      schedulePlanGraphMarkers();
    }
  });

  document.addEventListener('DOMContentLoaded', () => {
    installStyles(); scheduleRender(); installDemoTag(); scheduleDemoGraph(); schedulePlanGraphMarkers(); patchGuidedFinishButton();
  });
  window.addEventListener('focus', () => {
    installStyles(); scheduleRender(); scheduleDemoGraph(); schedulePlanGraphMarkers(); patchGuidedFinishButton();
  });
  installStyles();
  scheduleRender();
  installDemoTag();
  patchGuidedFinishButton();
})();
