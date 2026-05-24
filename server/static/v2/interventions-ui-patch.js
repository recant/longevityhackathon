/**
 * Reversible UI patch: prefer citation-backed /api/snapshot.interventions
 * over the legacy /api/snapshot.actions display without deleting the old code.
 *
 * Also supports pitch demo mode with seeded graph data when the URL includes ?demo=1.
 *
 * Remove this file and its script tag to return to the old actions-only UI.
 */
(function () {
  const FETCH_OPTS = { cache: 'no-store' };
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

  function citationHtml(citation) {
    if (!citation) return '';
    const label = citation.short || citation.full || 'Peer-reviewed citation';
    const doi = citation.doi
      ? ` <span class="task-sub">DOI: <a href="${escapeHtml(citation.url || `https://doi.org/${citation.doi}`)}" target="_blank" rel="noreferrer">${escapeHtml(citation.doi)}</a></span>`
      : '';
    return `<p class="task-sub"><strong>Evidence:</strong> ${escapeHtml(label)}${doi}</p>`;
  }

  function interventionHtml(item) {
    return `
      <li class="task-item-static" data-source="intervention">
        <strong>${escapeHtml(item.title)}</strong>
        <p class="task-sub">${escapeHtml(item.suggestion)}</p>
        ${item.rationale ? `<p class="task-sub"><strong>Why:</strong> ${escapeHtml(item.rationale)}</p>` : ''}
        ${citationHtml(item.citation)}
      </li>
    `;
  }

  function fallbackActionHtml(action) {
    return `
      <li class="task-item-static" data-source="legacy-action">
        <strong>${escapeHtml(action.title)}</strong>
        <p class="task-sub">${escapeHtml(action.detail)}</p>
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

    const taskList = document.getElementById('taskList');
    if (taskList) {
      const interventions = snap.interventions || [];
      if (interventions.length) {
        taskList.innerHTML = interventions.map(interventionHtml).join('');
      } else if (!taskList.children.length && snap.actions?.length) {
        taskList.innerHTML = snap.actions.map(fallbackActionHtml).join('');
      }
    }

    const digestAction = document.getElementById('digestAction');
    const first = snap.interventions?.[0];
    if (digestAction && first) {
      digestAction.innerHTML = `
        ${escapeHtml(first.suggestion)}
        <br><br><span style="font-size:11px;opacity:.78"><strong>Evidence:</strong> ${escapeHtml(first.citation?.short || 'Peer-reviewed citation')}${first.citation?.doi ? ` · DOI: ${escapeHtml(first.citation.doi)}` : ''}</span>
      `;
    }
  }

  function demoInterventionHtml() {
    return `
      <li class="task-item-static" data-source="demo-intervention">
        <strong>Demo intervention: daily walk + breakfast sit-to-stands</strong>
        <p class="task-sub">Started after Week 4. The graph shows an observed improvement after this habit began; for the pitch, describe this as a trajectory signal, not proof of causation.</p>
        <p class="task-sub"><strong>Evidence:</strong> Pahor et al., JAMA 2014 · DOI: 10.1001/jama.2014.5616</p>
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
    note.className = 'graph-card';
    note.innerHTML = `
      <h3>Intervention started after Week 4</h3>
      <p class="g-sub">Daily walk + breakfast sit-to-stands</p>
      <div class="bio-exp">Demo narrative: the family began one comfortable walk around the block most days plus 5 slow sit-to-stands after breakfast. The score improved over later check-ins. Say “after the intervention,” not “because of the intervention.”</div>
    `;
    graphSection.insertBefore(note, graphSection.children[1] || null);
  }

  function drawDemoMarker(chart) {
    const idx = DEMO_POINTS.findIndex((p) => p.intervention);
    if (idx < 0) return;
    const point = chart.getDatasetMeta(0)?.data?.[idx];
    if (!point) return;
    const ctx = chart.ctx;
    const area = chart.chartArea;
    ctx.save();
    ctx.strokeStyle = '#B07560';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(point.x, area.top + 8);
    ctx.lineTo(point.x, area.bottom);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#B07560';
    ctx.font = '11px DM Sans, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Intervention', point.x, area.top + 2);
    ctx.restore();
  }

  const demoMarkerPlugin = {
    id: 'demoInterventionMarker',
    afterDatasetsDraw: drawDemoMarker,
  };

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
        datasets: [
          {
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
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const pt = DEMO_POINTS[ctx.dataIndex];
                return pt.intervention
                  ? ` Score: ${pt.score} — intervention started`
                  : ` Score: ${pt.score}`;
              },
            },
          },
        },
        scales: {
          y: {
            min: 45,
            max: 90,
            ticks: { color: '#7A8C82', font: { size: 10 } },
            grid: { color: 'rgba(0,0,0,0.04)' },
          },
          x: {
            ticks: { color: '#7A8C82', font: { size: 10 } },
            grid: { display: false },
          },
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
    if (bioExp) {
      bioExp.innerHTML = 'Demo narrative: after the family began a simple daily walking + sit-to-stand habit, the functional score moved from the high 50s to the high 70s over the following check-ins.';
    }
    const fill = document.getElementById('bioFill');
    if (fill) {
      fill.style.width = '0%';
      setTimeout(() => {
        fill.style.width = '77%';
      }, 150);
    }
  }

  function renderDemoTasks() {
    if (!DEMO_MODE) return;
    const taskList = document.getElementById('taskList');
    if (taskList) {
      taskList.insertAdjacentHTML('afterbegin', demoInterventionHtml());
    }
    const digestAction = document.getElementById('digestAction');
    if (digestAction) {
      digestAction.innerHTML = 'Continue the daily walk + breakfast sit-to-stand habit this week.<br><br><span style="font-size:11px;opacity:.78"><strong>Demo evidence:</strong> Pahor et al., JAMA 2014 · DOI: 10.1001/jama.2014.5616</span>';
    }
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
      if (id === 'graphs') scheduleDemoGraph();
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

  window.addEventListener('message', (event) => {
    if (event.origin === location.origin && event.data?.type === 'kinspan:assessment-saved') {
      scheduleRender();
      scheduleDemoGraph();
    }
  });

  document.addEventListener('DOMContentLoaded', () => {
    scheduleRender();
    installDemoTag();
    scheduleDemoGraph();
  });
  window.addEventListener('focus', () => {
    scheduleRender();
    scheduleDemoGraph();
  });
  scheduleRender();
  installDemoTag();
})();
