(function () {
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

  document.addEventListener('DOMContentLoaded', ensureWorkflowUnlockHint);
  document.addEventListener('click', () => setTimeout(ensureWorkflowUnlockHint, 20), true);
  window.addEventListener('focus', ensureWorkflowUnlockHint);
  setInterval(ensureWorkflowUnlockHint, 250);
  ensureWorkflowUnlockHint();
})();
