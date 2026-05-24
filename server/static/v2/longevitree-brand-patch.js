(function () {
  const PLAN_KEY = 'longevitree_committed_interventions_v1';

  function cleanText(value) {
    return String(value || '')
      .split('LongeviTree').join('Longevitree')
      .split('KinSpan').join('Longevitree')
      .split('kinspan').join('longevitree')
      .split('KINSPAN').join('LONGEVITREE')
      .split('The first steps of their Longevity Journey').join('')
      .split('The next steps of their Longevity Journey').join('')
      .split('CV engine: opencv — pip install mediapipe for better pose tracking').join('')
      .split('CV engine: opencv - pip install mediapipe for better pose tracking').join('')
      .replace(/Complete this step to unlock Continue\.?/gi, '')
      .replace(/Set ANTHROPIC_API_KEY, OLLAMA_API_KEY, or OPENAI_API_KEY[^.]*\./gi, '')
      .replace(/Try: '\w*[^']*'/gi, '')
      .replace(/\{[^{}]*(?:api|key|mock|detail)[^{}]*\}/gi, '');
  }

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function readPlan() {
    try {
      const parsed = JSON.parse(localStorage.getItem(PLAN_KEY) || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch (_) {
      return [];
    }
  }

  function writePlan(plan) {
    localStorage.setItem(PLAN_KEY, JSON.stringify(plan));
    try {
      if (window.parent && window.parent !== window) {
        window.parent.postMessage({ type: 'longevitree:treatment-committed', plan }, '*');
      }
    } catch (_) {}
  }

  function cleanAttributes(el) {
    for (const attr of ['title', 'aria-label', 'alt', 'placeholder']) {
      if (el.hasAttribute && el.hasAttribute(attr)) {
        const next = cleanText(el.getAttribute(attr));
        if (next !== el.getAttribute(attr)) el.setAttribute(attr, next);
      }
    }
  }

  function removeBadBlocks() {
    const unlock = document.getElementById('workflowUnlockHint');
    if (unlock) unlock.remove();

    document.querySelectorAll('.result, .digest-intro, .doc-note, .daily-msg').forEach((el) => {
      const text = el.textContent || '';
      if (/Family explanation|Conversation tip|ANTHROPIC_API_KEY|OPENAI_API_KEY|OLLAMA_API_KEY|explain like a caring family member/i.test(text)) {
        el.textContent = '';
        el.style.display = 'none';
      }
      if (/Small steps today build a steadier tomorrow/i.test(text)) {
        el.textContent = '';
      }
    });

    const msg = document.getElementById('dailyMsg');
    if (msg && /Small steps|API_KEY|Try:|doctors, just trends/i.test(msg.textContent || '')) msg.textContent = '';

    const testsSub = document.getElementById('testsSub');
    if (testsSub) {
      testsSub.textContent = '';
      testsSub.style.display = 'none';
    }

    const cvBackend = document.getElementById('cvBackend');
    if (cvBackend && /pip install|CV engine/i.test(cvBackend.textContent || '')) cvBackend.textContent = '';
  }

  function applyBranding() {
    try {
      document.title = cleanText(document.title).replace('Longevity App v2', 'Longevitree');
      const root = document.body || document.documentElement;
      if (!root) return;
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      const nodes = [];
      while (walker.nextNode()) nodes.push(walker.currentNode);
      nodes.forEach((node) => {
        const next = cleanText(node.nodeValue);
        if (next !== node.nodeValue) node.nodeValue = next;
      });
      root.querySelectorAll('*').forEach(cleanAttributes);
      removeBadBlocks();
    } catch (_) {}
  }

  function compactCitation(citation) {
    if (!citation) return 'Peer-reviewed source';
    if (citation.display) return citation.display;
    if (citation.short) return citation.short;
    if (citation.full) {
      const parts = String(citation.full).split('.');
      const authors = parts[0] || 'Peer-reviewed source';
      const title = parts[1] || '';
      return title ? `${authors}, ${title}` : authors;
    }
    return 'Peer-reviewed source';
  }

  async function fetchSnapshot() {
    const res = await fetch('/api/snapshot', { cache: 'no-store' });
    if (!res.ok) throw new Error('Could not load results.');
    return res.json();
  }

  function totalCheckins(snap) {
    const c = snap?.history_counts || {};
    return (c.reactions || 0) + (c.gaits || 0) + (c.chairs || 0);
  }

  function graphPointCount() {
    const canvas = document.getElementById('vitalityChart');
    const chart = window.Chart && canvas ? Chart.getChart(canvas) : null;
    const data = chart?.data?.datasets?.[0]?.data || [];
    return data.length ? Math.max(0, data.length - 1) : 0;
  }

  function interventionCardHtml(item, index) {
    return `
      <label class="lt-intervention-card">
        <input type="checkbox" data-lt-intervention-choice="1" data-index="${index}" />
        <span class="lt-intervention-copy">
          <strong>${escapeHtml(item.title)}</strong>
          <small>${escapeHtml(item.suggestion || '')}</small>
          ${item.rationale ? `<small><b>Why:</b> ${escapeHtml(item.rationale)}</small>` : ''}
          <em>Evidence: ${escapeHtml(compactCitation(item.citation))}</em>
        </span>
      </label>
    `;
  }

  function renderInterventionChooser(container, snap) {
    const interventions = snap?.interventions || [];
    if (!container || !interventions.length) return;
    let box = container.querySelector('.lt-intervention-chooser');
    if (!box) {
      box = document.createElement('div');
      box.className = 'lt-intervention-chooser';
      container.appendChild(box);
    }
    box.innerHTML = `
      <h3>Choose a treatment to start</h3>
      <p>Select the intervention you want to commit to. Longevitree will mark this point on your progress graph.</p>
      <div class="lt-intervention-list">${interventions.map(interventionCardHtml).join('')}</div>
      <button type="button" class="lt-commit-btn">Commit selected treatments</button>
      <p class="lt-commit-status" aria-live="polite"></p>
    `;
    box.querySelector('.lt-commit-btn')?.addEventListener('click', () => {
      const chosen = [...box.querySelectorAll('[data-lt-intervention-choice]:checked')]
        .map((input) => interventions[Number(input.dataset.index)])
        .filter(Boolean);
      const status = box.querySelector('.lt-commit-status');
      if (!chosen.length) {
        if (status) status.textContent = 'Select at least one treatment first.';
        return;
      }
      const currentCount = totalCheckins(snap);
      const currentGraphIndex = graphPointCount();
      const now = new Date().toISOString();
      const existing = readPlan();
      const existingIds = new Set(existing.map((x) => x.id));
      chosen.forEach((item) => {
        const id = String(item.id || item.title || 'intervention').toLowerCase().replace(/[^a-z0-9]+/g, '-');
        if (!existingIds.has(id)) {
          existing.push({
            id,
            title: item.title,
            suggestion: item.suggestion || '',
            citation: compactCitation(item.citation),
            startedAt: now,
            startCheckinCount: currentCount,
            startGraphIndex: currentGraphIndex,
          });
        }
      });
      writePlan(existing);
      if (status) status.textContent = 'Treatment saved. Check the Progress graph to see the start marker.';
      setTimeout(drawTreatmentMarkers, 150);
    });
  }

  function categoryRowsHtml(categories) {
    return (categories || []).map((c) => `
      <div class="lt-result-row">
        <strong>${escapeHtml(c.label || c.category || 'Score')}</strong>
        <span>${escapeHtml(c.score)}/100</span>
        <small>${escapeHtml(c.interpretation || '')}</small>
      </div>
    `).join('');
  }

  function renderFullResults(container, snap) {
    if (!container || !snap) return;
    const overall = snap.overall || {};
    const categories = snap.categories || [];
    const hasAllThree = categories.length >= 3 && overall.overall_functional_age != null;
    const scoreHtml = overall.overall_score != null
      ? `<div class="lt-score-big">${escapeHtml(overall.overall_score)}<span>/100</span></div>`
      : `<p class="hint">Complete a check-in to see your score.</p>`;
    const ageHtml = hasAllThree
      ? `<div class="lt-age-box"><strong>Functional age estimate</strong><span>${escapeHtml(overall.overall_functional_age)}</span><small>Actual age: ${escapeHtml(overall.chronological_age)}</small></div>`
      : `<p class="hint">Complete all three tests to unlock the functional age estimate.</p>`;

    container.innerHTML = `
      <div class="lt-results-summary">
        ${scoreHtml}
        <p>${escapeHtml(overall.headline || 'Your completed check-ins are saved.')}</p>
        ${ageHtml}
      </div>
      ${categoryRowsHtml(categories)}
    `;
    renderInterventionChooser(container, snap);
    applyBranding();
  }

  async function ensureFullCheckinResults() {
    const dash = document.getElementById('dash');
    const out = document.getElementById('dashOut');
    if (!dash || !out || !dash.classList.contains('show')) return;
    const visibleText = (out.textContent || '').trim();
    if (visibleText && !/^Loading/i.test(visibleText)) return;
    try {
      if (typeof window.loadDashboard === 'function') {
        window.loadDashboard();
      }
    } catch (_) {}
    setTimeout(async () => {
      const after = (out.textContent || '').trim();
      if (after && !/Family explanation|Conversation tip|API_KEY|Loading/i.test(after)) {
        try {
          const snap = await fetchSnapshot();
          if (snap?.interventions?.length) renderInterventionChooser(out, snap);
        } catch (_) {}
        return;
      }
      try {
        const snap = await fetchSnapshot();
        renderFullResults(out, snap);
      } catch (_) {
        out.innerHTML = '<p class="err">Could not load results. Tap Refresh or run another check-in.</p>';
      }
    }, 500);
  }

  async function showPostTestInterventions(targetEl) {
    try {
      const snap = await fetchSnapshot();
      if (!snap?.categories?.length || !snap?.interventions?.length) return;
      renderInterventionChooser(targetEl?.parentElement || targetEl || document.body, snap);
    } catch (_) {}
  }

  function patchResultElements() {
    ['walkOut', 'reactOut', 'crOut', 'chairOut', 'cvWalkOut', 'cvChairOut', 'dashOut'].forEach((id) => {
      const el = document.getElementById(id);
      if (!el || el.dataset.ltObserved === '1') return;
      el.dataset.ltObserved = '1';
      const obs = new MutationObserver(() => {
        applyBranding();
        const txt = el.textContent || '';
        if (id === 'dashOut') ensureFullCheckinResults();
        if (el.style.display !== 'none' && !/error|offline|Time one|first/i.test(txt)) {
          setTimeout(() => showPostTestInterventions(el), 250);
        }
      });
      obs.observe(el, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['style', 'class'] });
    });
  }

  function drawTreatmentMarkers() {
    const plan = readPlan();
    const canvas = document.getElementById('vitalityChart');
    const wrap = canvas?.closest('.vitality-chart-wrap');
    if (!wrap) return;
    wrap.querySelectorAll('.lt-treatment-line, .lt-treatment-label').forEach((el) => el.remove());
    if (!plan.length) return;

    wrap.style.position = 'relative';
    const chart = window.Chart && canvas ? Chart.getChart(canvas) : null;
    const data = chart?.data?.datasets?.[0]?.data || [];
    const denominator = Math.max(1, data.length - 1);
    plan.forEach((item, i) => {
      const idx = Math.min(Math.max(0, Number(item.startGraphIndex || 0)), denominator);
      const pct = data.length > 1 ? 8 + (idx / denominator) * 84 : 50;
      const line = document.createElement('div');
      line.className = 'lt-treatment-line';
      line.style.left = `${pct}%`;
      const label = document.createElement('div');
      label.className = 'lt-treatment-label';
      label.style.left = `${pct}%`;
      label.textContent = i === 0 ? 'Treatment started' : `Treatment ${i + 1}`;
      wrap.appendChild(line);
      wrap.appendChild(label);
    });

    const graphSection = document.querySelector('#graphs .graph-section');
    if (graphSection) {
      let note = document.getElementById('ltTreatmentSummary');
      if (!note) {
        note = document.createElement('div');
        note.id = 'ltTreatmentSummary';
        note.className = 'graph-card lt-marker-summary';
        graphSection.insertBefore(note, graphSection.children[1] || null);
      }
      note.innerHTML = `<h3>Treatment markers</h3><p>Vertical lines show when a selected treatment started. They show timing, not proof of causation.</p><ul>${plan.map((p) => `<li><strong>${escapeHtml(p.title)}</strong> — ${escapeHtml(p.citation || 'Peer-reviewed source')}</li>`).join('')}</ul>`;
    }
  }

  function patchNavigation() {
    if (window.__ltNavPatched) return;
    window.__ltNavPatched = true;
    const oldGoTo = window.goTo;
    if (typeof oldGoTo === 'function') {
      window.goTo = function patchedGoTo(id) {
        const result = oldGoTo.apply(this, arguments);
        setTimeout(() => {
          applyBranding();
          patchResultElements();
          if (id === 'graphs') drawTreatmentMarkers();
          ensureFullCheckinResults();
        }, 120);
        setTimeout(ensureFullCheckinResults, 650);
        return result;
      };
    }

    const oldShowWorkflowStep = window.showWorkflowStep;
    if (typeof oldShowWorkflowStep === 'function' && !window.__ltWorkflowPatched) {
      window.__ltWorkflowPatched = true;
      window.showWorkflowStep = function patchedShowWorkflowStep() {
        const result = oldShowWorkflowStep.apply(this, arguments);
        setTimeout(ensureFullCheckinResults, 250);
        setTimeout(ensureFullCheckinResults, 800);
        return result;
      };
    }
  }

  function installStyles() {
    if (document.getElementById('ltHumanPatchStyles')) return;
    const style = document.createElement('style');
    style.id = 'ltHumanPatchStyles';
    style.textContent = `
      #workflowUnlockHint{display:none!important}
      .lt-results-summary{background:linear-gradient(135deg,#E8EFE9,#F9F0EC);border-radius:14px;padding:14px;margin:10px 0 12px;overflow:hidden}
      .lt-results-summary p{margin:6px 0;font-size:13px;line-height:1.45;color:#4f5d56}
      .lt-score-big{font-size:38px;font-weight:800;color:#6B8F71;line-height:1}
      .lt-score-big span{font-size:15px;font-weight:700;color:#7A8C82;margin-left:2px}
      .lt-age-box{display:flex;flex-direction:column;gap:3px;background:rgba(255,255,255,.72);border-radius:12px;padding:10px;margin-top:10px}
      .lt-age-box strong{font-size:12px;color:#7A8C82;text-transform:uppercase;letter-spacing:.04em}
      .lt-age-box span{font-size:28px;font-weight:800;color:#B07560}
      .lt-age-box small{font-size:12px;color:#7A8C82}
      .lt-result-row{border-left:4px solid #6E8FA3;background:#E8EFE9;border-radius:0 10px 10px 0;padding:10px 12px;margin:8px 0;display:flex;flex-direction:column;gap:3px;overflow-wrap:anywhere}
      .lt-result-row strong{font-size:13px;color:#2C3530}.lt-result-row span{font-weight:800;color:#6B8F71}.lt-result-row small{font-size:12px;color:#4f5d56;line-height:1.4}
      .lt-intervention-chooser{margin-top:14px;padding:14px;border-radius:16px;background:#fffdf9;border:1px solid rgba(176,117,96,.25);box-shadow:0 8px 24px rgba(0,0,0,.05);max-width:100%;overflow:hidden}
      .lt-intervention-chooser h3{margin:0 0 6px;font-size:16px;color:#2C3530}
      .lt-intervention-chooser p{margin:0 0 10px;font-size:12px;line-height:1.45;color:#7A8C82}
      .lt-intervention-list{display:flex;flex-direction:column;gap:8px}
      .lt-intervention-card{display:flex;gap:9px;align-items:flex-start;padding:10px;border-radius:12px;background:rgba(107,143,113,.09);max-width:100%;overflow:hidden}
      .lt-intervention-card input{margin-top:3px;accent-color:#6B8F71;flex-shrink:0}
      .lt-intervention-copy{min-width:0;display:flex;flex-direction:column;gap:3px;font-size:12px;line-height:1.35;overflow-wrap:anywhere}
      .lt-intervention-copy strong{font-size:13px;color:#2C3530}
      .lt-intervention-copy small{color:#4f5d56}
      .lt-intervention-copy em{font-size:10.5px;color:#7A8C82;font-style:normal}
      .lt-commit-btn{border:0;border-radius:12px;background:#6B8F71;color:white;padding:10px 12px;font-weight:700;margin-top:10px;width:100%;font-family:inherit}
      .lt-commit-status{font-size:12px;color:#4A6B51;margin-top:8px!important}
      .lt-treatment-line{position:absolute;top:8%;bottom:8%;width:2px;background:#B07560;z-index:5;border-radius:999px;box-shadow:0 0 0 1px rgba(255,255,255,.8)}
      .lt-treatment-label{position:absolute;top:0;transform:translateX(-50%);font-size:10px;font-weight:700;color:#B07560;z-index:6;white-space:nowrap;background:rgba(255,255,255,.85);border-radius:6px;padding:1px 4px}
      .lt-marker-summary ul{font-size:12px;line-height:1.45;color:#2C3530;padding-left:18px;margin:8px 0 0;overflow-wrap:anywhere}
    `;
    document.head.appendChild(style);
  }

  window.longevitreeApplyBranding = applyBranding;
  window.longevitreeDrawTreatmentMarkers = drawTreatmentMarkers;
  window.longevitreeEnsureFullCheckinResults = ensureFullCheckinResults;

  document.addEventListener('DOMContentLoaded', () => {
    installStyles();
    applyBranding();
    patchNavigation();
    patchResultElements();
    setTimeout(ensureFullCheckinResults, 300);
    setTimeout(drawTreatmentMarkers, 500);
  });
  window.addEventListener('focus', () => {
    installStyles();
    applyBranding();
    patchNavigation();
    patchResultElements();
    ensureFullCheckinResults();
    drawTreatmentMarkers();
  });
  document.addEventListener('click', () => setTimeout(() => {
    applyBranding();
    patchNavigation();
    patchResultElements();
    ensureFullCheckinResults();
    drawTreatmentMarkers();
  }, 80));
  window.addEventListener('message', (event) => {
    if (String(event.data?.type || '').includes('assessment-saved') || String(event.data?.type || '').includes('workflow-finished') || String(event.data?.type || '').includes('treatment-committed')) {
      setTimeout(ensureFullCheckinResults, 500);
      setTimeout(() => fetchSnapshot().then((snap) => renderInterventionChooser(document.querySelector('#tests .tests-scroll') || document.body, snap)).catch(() => {}), 700);
      setTimeout(drawTreatmentMarkers, 900);
    }
  });
  setInterval(() => {
    applyBranding();
    patchNavigation();
    patchResultElements();
    ensureFullCheckinResults();
  }, 1000);
  installStyles();
  applyBranding();
  patchNavigation();
  patchResultElements();
  ensureFullCheckinResults();
})();
