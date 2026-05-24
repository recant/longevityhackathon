/**
 * Reversible UI patch: prefer citation-backed /api/snapshot.interventions
 * over the legacy /api/snapshot.actions display without deleting the old code.
 *
 * Remove this file and its script tag to return to the old actions-only UI.
 */
(function () {
  const FETCH_OPTS = { cache: 'no-store' };

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

  function scheduleRender() {
    setTimeout(renderCitedInterventions, 0);
    setTimeout(renderCitedInterventions, 350);
  }

  const oldGoTo = window.goTo;
  if (typeof oldGoTo === 'function') {
    window.goTo = function patchedGoTo(id) {
      const result = oldGoTo.apply(this, arguments);
      if (id === 'dashboard' || id === 'weekly-digest') scheduleRender();
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
    }
  });

  document.addEventListener('DOMContentLoaded', scheduleRender);
  window.addEventListener('focus', scheduleRender);
  scheduleRender();
})();
