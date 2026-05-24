/**
 * Reversible pitch-demo patch.
 *
 * This file does not mutate stored check-ins. It only changes the client-side graph
 * when the URL includes ?demo=1, so production behavior remains real-data-only.
 *
 * Demo URL: /?demo=1
 */
(function () {
  const params = new URLSearchParams(window.location.search);
  const demoMode = params.get('demo') === '1' || params.get('demo') === 'true';
  if (!demoMode) return;

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

  const INTERVENTION_COPY = {
    title: 'Intervention started after Week 4',
    body:
      'Demo story: the family started one comfortable walk around the block most days plus 5 slow sit-to-stands after breakfast. The graph shows the score trend after that point; phrase this as an observed improvement after the habit began, not proof of causation.',
  };

  function installBuildTag() {
    const tag = document.getElementById('buildTag');
    if (tag) tag.textContent = 'DEMO MODE · seeded graph';
  }

  function ensureDemoNote() {
    const graphSection = document.querySelector('#graphs .graph-section');
    if (!graphSection || document.getElementById('demoInterventionNote')) return;
    const note = document.createElement('div');
    note.id = 'demoInterventionNote';
    note.className = 'graph-card';
    note.innerHTML = `
      <h3>${INTERVENTION_COPY.title}</h3>
      <p class="g-sub">Daily walk + breakfast sit-to-stands</p>
      <div class="bio-exp">${INTERVENTION_COPY.body}</div>
    `;
    graphSection.insertBefore(note, graphSection.children[1] || null);
  }

  function drawInterventionMarker(chart) {
    const interventionIndex = DEMO_POINTS.findIndex((p) => p.intervention);
    if (interventionIndex < 0) return;
    const meta = chart.getDatasetMeta(0);
    const point = meta?.data?.[interventionIndex];
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

  const interventionMarkerPlugin = {
    id: 'demoInterventionMarker',
    afterDatasetsDraw: drawInterventionMarker,
  };

  function renderDemoGraph() {
    installBuildTag();
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
      plugins: [interventionMarkerPlugin],
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
      bioExp.innerHTML =
        'Demo narrative: after the family began a simple daily walking + sit-to-stand habit, the functional score moved from the high 50s to the high 70s over the following check-ins.';
    }
    const fill = document.getElementById('bioFill');
    if (fill) {
      fill.style.width = '0%';
      setTimeout(() => {
        fill.style.width = '77%';
      }, 150);
    }
  }

  const oldGoTo = window.goTo;
  if (typeof oldGoTo === 'function') {
    window.goTo = function demoPatchedGoTo(id) {
      const result = oldGoTo.apply(this, arguments);
      if (id === 'graphs') {
        setTimeout(renderDemoGraph, 120);
        setTimeout(renderDemoGraph, 500);
      }
      return result;
    };
  }

  document.addEventListener('DOMContentLoaded', () => {
    installBuildTag();
    setTimeout(() => {
      if (document.getElementById('graphs')?.classList.contains('active')) renderDemoGraph();
    }, 600);
  });
})();
