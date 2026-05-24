(function () {
  let slide = 0;
  let reaction = { trials: [], waiting: false, armedAt: 0, timer: null };
  let walkStart = 0;
  let walkTimer = null;
  let standStart = 0;
  let standTimer = null;

  function $(id) { return document.getElementById(id); }

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function showToast(message) {
    const toast = $('toastDash') || $('toast2') || $('toast3') || $('toast4');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2200);
  }

  function api(path, options) {
    const opts = options || {};
    const headers = opts.body && !(opts.body instanceof FormData) ? { 'Content-Type': 'application/json' } : undefined;
    return fetch(path, {
      cache: 'no-store',
      ...opts,
      headers,
      body: opts.body && typeof opts.body === 'object' && !(opts.body instanceof FormData) ? JSON.stringify(opts.body) : opts.body,
    }).then(async (res) => {
      const text = await res.text();
      if (!res.ok) throw new Error('Could not save. Please try again.');
      return text ? JSON.parse(text) : {};
    });
  }

  function cleanClassicState() {
    try {
      ['longevitree_completed', 'longevitree_workflow_step', 'longevitree_path'].forEach((k) => localStorage.removeItem(k));
      [['k', 'in', 'span'].join('') + '_completed', ['k', 'in', 'span'].join('') + '_workflow_step', ['k', 'in', 'span'].join('') + '_path'].forEach((k) => localStorage.removeItem(k));
      sessionStorage.removeItem('longevitree_classic_reset_done');
    } catch (_) {}
  }

  function goTo(id) {
    try {
      if (id === 'sit-stand') id = 'chair-rise';
      document.querySelectorAll('.screen').forEach((screen) => screen.classList.remove('active'));
      const screen = $(id);
      if (screen) screen.classList.add('active');
      document.querySelectorAll('.nav-item').forEach((item) => item.classList.toggle('active', item.dataset.nav === id));
      if (id === 'guided') {
        cleanClassicState();
        const frame = $('guidedFrame');
        if (frame) frame.src = '/classic?embed=1&reset=1&t=' + Date.now();
      }
      if (id === 'reaction') resetReaction(true);
      if (id === 'walk') resetWalk(false);
      if (id === 'chair-rise') resetStand(false);
      window.scrollTo(0, 0);
    } catch (err) {
      console.warn('navigation recovered', err);
    }
  }

  function goSlide(n) {
    slide = Math.max(0, Math.min(3, Number(n) || 0));
    document.querySelectorAll('.ob-slide').forEach((el, i) => el.classList.toggle('active', i === slide));
    document.querySelectorAll('.ob-dot').forEach((el, i) => el.classList.toggle('active', i === slide));
    const btn = $('obBtn');
    if (btn) btn.textContent = slide === 3 ? 'Start first test →' : 'Next';
  }

  function obNext() {
    if (slide < 3) goSlide(slide + 1);
    else goTo('reaction');
  }

  function skipOnboarding() { goTo('reaction'); }
  function openTasks() { const el = $('tasksOverlay'); if (el) el.classList.add('show'); }
  function closeTasks() { const el = $('tasksOverlay'); if (el) el.classList.remove('show'); }
  function showMilestone() { const el = $('msOverlay'); if (el) el.classList.add('show'); }
  function closeMilestone() { const el = $('msOverlay'); if (el) el.classList.remove('show'); }
  function t(_id, message) { showToast(message); }

  function resultHtml(scores, chronologicalAge) {
    const score = scores && scores.score != null ? Math.round(scores.score) : '—';
    const label = scores && scores.label ? scores.label : 'Result';
    const interp = scores && scores.interpretation ? scores.interpretation : '';
    const biologicalAge = scores && scores.functional_age ? scores.functional_age : '—';
    const chron = chronologicalAge || '—';
    return '<div class="result-card lt-result-card">'
      + '<h3>' + escapeHtml(label) + '</h3>'
      + '<div class="score-big">' + escapeHtml(score) + '<span>/100</span></div>'
      + '<div class="lt-age-results">'
      + '<div class="lt-age-pill"><span>Chronological age</span><strong>' + escapeHtml(chron) + '</strong></div>'
      + '<div class="lt-age-pill lt-age-pill-main"><span>Biological age</span><strong>' + escapeHtml(biologicalAge) + '</strong></div>'
      + '</div>'
      + '<p>' + escapeHtml(interp) + '</p>'
      + '</div>';
  }

  function ensureAgeStyles() {
    if ($('ltButtonRescueStyles')) return;
    const style = document.createElement('style');
    style.id = 'ltButtonRescueStyles';
    style.textContent = `
      .lt-result-card{overflow:hidden}
      .lt-age-results{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:14px 0}
      .lt-age-pill{background:#F7F0EA;border:1px solid rgba(176,117,96,.22);border-radius:14px;padding:12px;text-align:center}
      .lt-age-pill span{display:block;font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:#7A8C82;margin-bottom:4px}
      .lt-age-pill strong{display:block;font-size:28px;line-height:1;color:#2C3530}
      .lt-age-pill-main{background:#E8EFE9;border-color:rgba(107,143,113,.28)}
      .lt-age-pill-main strong{color:#6B8F71}
    `;
    document.head.appendChild(style);
  }

  function showResult(id, scores) {
    const out = $(id);
    if (!out) return;
    ensureAgeStyles();
    out.innerHTML = resultHtml(scores, '—');
    out.style.display = 'block';
    api('/api/profile').then((prof) => {
      out.innerHTML = resultHtml(scores, prof && prof.age);
      out.style.display = 'block';
    }).catch(() => null);
  }

  function resetReaction(clear) {
    clearTimeout(reaction.timer);
    reaction = { trials: [], waiting: false, armedAt: 0, timer: null };
    const pad = $('reactPad');
    if (pad) { pad.className = 'react-pad wait'; pad.textContent = 'Tap to start'; pad.removeAttribute('aria-disabled'); }
    const line = $('reactTrialsLine');
    if (line) line.textContent = '';
    const save = $('saveReact');
    if (save) save.disabled = true;
    if (clear !== false && $('reactOut')) $('reactOut').innerHTML = '';
  }

  function tapReaction(event) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
      if (event.stopImmediatePropagation) event.stopImmediatePropagation();
    }
    const pad = $('reactPad');
    if (!pad) return;
    if (!reaction.waiting) {
      reaction.waiting = true;
      reaction.armedAt = 0;
      pad.className = 'react-pad wait';
      pad.textContent = 'Wait for green…';
      reaction.timer = setTimeout(() => {
        reaction.armedAt = performance.now();
        pad.className = 'react-pad go';
        pad.textContent = 'Tap!';
      }, 700 + Math.random() * 1000);
      return;
    }
    if (!reaction.armedAt) {
      clearTimeout(reaction.timer);
      reaction.waiting = false;
      pad.className = 'react-pad wait';
      pad.textContent = 'Too soon. Tap to try again.';
      return;
    }
    const ms = Math.round(performance.now() - reaction.armedAt);
    reaction.trials.push(ms);
    reaction.waiting = false;
    reaction.armedAt = 0;
    const line = $('reactTrialsLine');
    if (line) line.textContent = 'Trials: ' + reaction.trials.join(' ms, ') + ' ms';
    if (reaction.trials.length >= 5) {
      pad.className = 'react-pad wait';
      pad.textContent = 'Done — save results';
      const save = $('saveReact');
      if (save) save.disabled = false;
    } else {
      pad.className = 'react-pad wait';
      pad.textContent = 'Trial ' + reaction.trials.length + '/5 saved. Tap for next.';
    }
  }

  function saveReaction(event) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
      if (event.stopImmediatePropagation) event.stopImmediatePropagation();
    }
    if (reaction.trials.length < 1) return showToast('Do the reaction test first.');
    api('/api/assessments/reaction', { method: 'POST', body: { trials_ms: reaction.trials } })
      .then((res) => { showResult('reactOut', res.scores); showToast('Reaction saved'); })
      .catch(() => showToast('Could not save reaction test. Try again.'));
  }

  function resetWalk(clear) {
    clearInterval(walkTimer);
    walkStart = 0;
    if ($('walkTimer')) $('walkTimer').textContent = '—';
    if ($('walkSec') && clear !== false) $('walkSec').value = '';
    if ($('walkOut') && clear !== false) $('walkOut').innerHTML = '';
  }

  function startWalk() {
    walkStart = performance.now();
    clearInterval(walkTimer);
    walkTimer = setInterval(() => {
      if ($('walkTimer')) $('walkTimer').textContent = ((performance.now() - walkStart) / 1000).toFixed(1);
    }, 100);
  }

  function stopWalk() {
    if (!walkStart) return;
    clearInterval(walkTimer);
    const sec = ((performance.now() - walkStart) / 1000).toFixed(1);
    if ($('walkTimer')) $('walkTimer').textContent = sec;
    if ($('walkSec')) $('walkSec').value = sec;
    walkStart = 0;
  }

  function saveWalk() {
    const sec = Number(($('walkSec') && $('walkSec').value) || ($('walkTimer') && $('walkTimer').textContent) || 0);
    if (!sec || sec < 0.5) return showToast('Time the walk first.');
    api('/api/assessments/gait', { method: 'POST', body: { time_seconds: sec } })
      .then((res) => { showResult('walkOut', res.scores); showToast('Walk saved'); })
      .catch(() => showToast('Could not save walk test. Try again.'));
  }

  function resetStand(clear) {
    clearInterval(standTimer);
    standStart = 0;
    if ($('crTimer')) $('crTimer').textContent = '—';
    if ($('crStop')) $('crStop').disabled = true;
    if ($('saveChairRise')) $('saveChairRise').disabled = true;
    if ($('crOut') && clear !== false) $('crOut').innerHTML = '';
  }

  function startStand() {
    standStart = performance.now();
    if ($('crStop')) $('crStop').disabled = false;
    if ($('saveChairRise')) $('saveChairRise').disabled = true;
    clearInterval(standTimer);
    standTimer = setInterval(() => {
      if ($('crTimer')) $('crTimer').textContent = ((performance.now() - standStart) / 1000).toFixed(2);
    }, 50);
  }

  function stopStand() {
    if (!standStart) return;
    clearInterval(standTimer);
    if ($('crTimer')) $('crTimer').textContent = ((performance.now() - standStart) / 1000).toFixed(2);
    standStart = 0;
    if ($('crStop')) $('crStop').disabled = true;
    if ($('saveChairRise')) $('saveChairRise').disabled = false;
  }

  function saveStand() {
    const sec = Number(($('crTimer') && $('crTimer').textContent) || 0);
    if (!sec || sec < 0.4) return showToast('Time one stand first.');
    api('/api/assessments/chair-stand', { method: 'POST', body: { rise_time_seconds: sec } })
      .then((res) => { showResult('crOut', res.scores); showToast('Quick Stand saved'); })
      .catch(() => showToast('Could not save Quick Stand. Try again.'));
  }

  function saveProfile() {
    api('/api/profile', {
      method: 'PUT',
      body: {
        display_name: ($('profName') && $('profName').value) || 'Mom/Dad',
        age: Number(($('profAge') && $('profAge').value) || 68),
        sex: ($('profSex') && $('profSex').value) || 'female',
      },
    }).then(() => { showToast('Profile saved'); goTo('dashboard'); })
      .catch(() => showToast('Could not save profile. Try again.'));
  }

  function addCapture(id, eventName, fn) {
    const el = $(id);
    if (!el || el.dataset.rescueV2Bound === '1') return;
    el.dataset.rescueV2Bound = '1';
    el.addEventListener(eventName, fn, true);
  }

  function addBubble(id, eventName, fn) {
    const el = $(id);
    if (!el || el.dataset.rescueV2BubbleBound === '1') return;
    el.dataset.rescueV2BubbleBound = '1';
    el.addEventListener(eventName, fn);
  }

  function attach() {
    ensureAgeStyles();
    addCapture('reactPad', 'click', tapReaction);
    addCapture('saveReact', 'click', saveReaction);
    addCapture('reactRedo', 'click', (event) => { event.preventDefault(); event.stopPropagation(); if (event.stopImmediatePropagation) event.stopImmediatePropagation(); resetReaction(true); });
    addBubble('walkStart', 'click', startWalk);
    addBubble('walkStop', 'click', stopWalk);
    addBubble('walkReset', 'click', () => resetWalk(true));
    addBubble('saveWalk', 'click', saveWalk);
    addBubble('crStart', 'click', startStand);
    addBubble('crStop', 'click', stopStand);
    addBubble('crReset', 'click', () => resetStand(true));
    addBubble('saveChairRise', 'click', saveStand);
    addBubble('saveProf', 'click', saveProfile);
  }

  window.goTo = goTo;
  window.goSlide = goSlide;
  window.obNext = obNext;
  window.skipOnboarding = skipOnboarding;
  window.openTasks = openTasks;
  window.closeTasks = closeTasks;
  window.showMilestone = showMilestone;
  window.closeMilestone = closeMilestone;
  window.t = t;

  document.addEventListener('DOMContentLoaded', () => { goSlide(0); attach(); });
  document.addEventListener('click', () => setTimeout(attach, 20), true);
  setInterval(attach, 1000);
  attach();
})();
