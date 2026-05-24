(function () {
  function loadVideoPathPatch() {
    try {
      if (document.getElementById('ltVideoCheckinPathPatchScript')) return;
      const script = document.createElement('script');
      script.id = 'ltVideoCheckinPathPatchScript';
      script.src = '/v2/video-checkin-path-patch.js';
      script.defer = true;
      document.head.appendChild(script);
    } catch (_) {}
  }

  function applyRequestedClassicPath() {
    try {
      const params = new URLSearchParams(location.search);
      const path = params.get('path');
      if (path === 'vision' || path === 'manual') {
        localStorage.setItem('kinspan_path', path);
        localStorage.setItem('longevitree_path', path);
      }
    } catch (_) {}
  }

  function ensureWorkflowUnlockHint() {
    try {
      let hint = document.getElementById('workflowUnlockHint');
      const nav = document.querySelector('.workflow-nav');
      if (!hint && nav) {
        hint = document.createElement('p');
        hint.id = 'workflowUnlockHint';
        hint.className = 'workflow-hint';
        nav.parentNode.insertBefore(hint, nav);
      }
      if (hint) {
        hint.textContent = '';
        hint.style.display = 'none';
        hint.setAttribute('aria-hidden', 'true');
      }
    } catch (_) {}
  }

  function isFinalWorkflowStep() {
    try {
      const progress = document.getElementById('wfProgress');
      const match = (progress?.textContent || '').match(/Step\s+(\d+)\s+of\s+(\d+)/i);
      if (!match) return false;
      return Number(match[1]) >= Number(match[2]);
    } catch (_) {
      return false;
    }
  }

  function leaveEmbeddedWorkflow() {
    try {
      if (window.parent && window.parent !== window) {
        if (typeof window.parent.finishGuidedCheckin === 'function') {
          window.parent.finishGuidedCheckin();
          return;
        }
        if (typeof window.parent.goTo === 'function') {
          window.parent.goTo('tests');
          return;
        }
        window.parent.postMessage({ type: 'longevitree:workflow-finished' }, '*');
        window.parent.postMessage({ type: 'kinspan:workflow-finished' }, '*');
        return;
      }
    } catch (_) {
      try {
        window.parent?.postMessage?.({ type: 'longevitree:workflow-finished' }, '*');
        window.parent?.postMessage?.({ type: 'kinspan:workflow-finished' }, '*');
        return;
      } catch (_) {}
    }
    window.location.href = '/';
  }

  function patchFinishButton() {
    try {
      const btn = document.getElementById('wfContinue');
      if (!btn || btn.dataset.longevitreeFinishGuard === '1') return;
      btn.dataset.longevitreeFinishGuard = '1';
      btn.addEventListener('click', (event) => {
        const label = String(btn.textContent || '').trim().toLowerCase();
        if (label !== 'finish' && !isFinalWorkflowStep()) return;
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        leaveEmbeddedWorkflow();
      }, true);
    } catch (_) {}
  }

  const originalRemove = Element.prototype.remove;
  Element.prototype.remove = function guardedRemove() {
    if (this && this.id === 'workflowUnlockHint') {
      this.textContent = '';
      this.style.display = 'none';
      this.setAttribute('aria-hidden', 'true');
      return;
    }
    return originalRemove.call(this);
  };

  document.addEventListener('DOMContentLoaded', () => {
    applyRequestedClassicPath();
    loadVideoPathPatch();
    ensureWorkflowUnlockHint();
    patchFinishButton();
  });
  document.addEventListener('click', () => {
    setTimeout(ensureWorkflowUnlockHint, 20);
    setTimeout(patchFinishButton, 20);
    setTimeout(loadVideoPathPatch, 20);
  }, true);
  window.addEventListener('focus', () => {
    applyRequestedClassicPath();
    loadVideoPathPatch();
    ensureWorkflowUnlockHint();
    patchFinishButton();
  });
  setInterval(() => {
    applyRequestedClassicPath();
    loadVideoPathPatch();
    ensureWorkflowUnlockHint();
    patchFinishButton();
  }, 500);
  applyRequestedClassicPath();
  loadVideoPathPatch();
  ensureWorkflowUnlockHint();
  patchFinishButton();
})();
