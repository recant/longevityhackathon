(function () {
  const RESET_FLAG = 'longevitree_classic_reset_done';

  function safeText(value) {
    return String(value || '')
      .replace(/KinSpan/g, 'Longevitree')
      .replace(/kinspan/g, 'longevitree')
      .replace(/KINSPAN/g, 'LONGEVITREE')
      .replace(/CV engine:[^\n.]*/gi, '')
      .replace(/pip install[^\n.]*/gi, '')
      .replace(/server\/start\.ps1/gi, '')
      .replace(/ANTHROPIC_API_KEY|OLLAMA_API_KEY|OPENAI_API_KEY|API key/gi, '')
      .replace(/Cannot read properties[^.\n]*/gi, 'Something went wrong. Please try again')
      .replace(/undefined|null|traceback|stack trace/gi, '');
  }

  function sanitizePage() {
    try {
      document.title = safeText(document.title).replace('Test UI', 'Check-in');
      const walker = document.createTreeWalker(document.body || document.documentElement, NodeFilter.SHOW_TEXT);
      const nodes = [];
      while (walker.nextNode()) nodes.push(walker.currentNode);
      nodes.forEach((node) => {
        const next = safeText(node.nodeValue);
        if (next !== node.nodeValue) node.nodeValue = next;
      });

      const cv = document.getElementById('cvBackend');
      if (cv) cv.textContent = '';

      document.querySelectorAll('.notice, code').forEach((el) => {
        const txt = el.textContent || '';
        if (/server|start\.ps1|pip install|API|key/i.test(txt)) el.remove();
      });

      document.querySelectorAll('.result').forEach((el) => {
        const txt = el.textContent || '';
        if (/Family explanation|Conversation tip/i.test(txt)) {
          el.remove();
        } else {
          const next = safeText(txt);
          if (next !== txt) el.textContent = next;
        }
      });
    } catch (_) {}
  }

  function resetClassicWorkflowOnce() {
    try {
      if (sessionStorage.getItem(RESET_FLAG) === '1') return;
      sessionStorage.setItem(RESET_FLAG, '1');
      localStorage.removeItem('longevitree_completed');
      localStorage.removeItem('longevitree_workflow_step');
      localStorage.removeItem('longevitree_path');
      localStorage.removeItem('kinspan_completed');
      localStorage.removeItem('kinspan_workflow_step');
      localStorage.removeItem('kinspan_path');

      if (typeof window.resetWorkflow === 'function') {
        window.resetWorkflow();
      } else {
        setTimeout(() => {
          if (typeof window.resetWorkflow === 'function') window.resetWorkflow();
        }, 150);
      }
    } catch (_) {}
  }

  function patchShowResult() {
    try {
      if (window.__longevitreeShowResultPatched || typeof window.showResult !== 'function') return;
      window.__longevitreeShowResultPatched = true;
      const original = window.showResult;
      window.showResult = function patchedShowResult(el, data) {
        const text = typeof data === 'string' ? safeText(data) : data;
        return original.call(this, el, text);
      };
    } catch (_) {}
  }

  function patchDashboard() {
    try {
      if (window.__longevitreeDashboardPatched || typeof window.loadDashboard !== 'function') return;
      window.__longevitreeDashboardPatched = true;
      const original = window.loadDashboard;
      window.loadDashboard = async function patchedLoadDashboard() {
        await original.apply(this, arguments);
        sanitizePage();
      };
    } catch (_) {}
  }

  document.addEventListener('DOMContentLoaded', () => {
    patchShowResult();
    patchDashboard();
    resetClassicWorkflowOnce();
    sanitizePage();
  });
  document.addEventListener('click', () => setTimeout(sanitizePage, 50), true);
  setInterval(() => {
    patchShowResult();
    patchDashboard();
    sanitizePage();
  }, 500);
  patchShowResult();
  patchDashboard();
  resetClassicWorkflowOnce();
  sanitizePage();
})();
