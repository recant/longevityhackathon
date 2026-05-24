/**
 * LongeviTree branding patch.
 * Replaces visible KinSpan/kinspan text with LongeviTree/longevitree.
 */
(function () {
  function replaceBrandText(value) {
    return String(value || '')
      .replace(/KinSpan/g, 'LongeviTree')
      .replace(/kinspan/g, 'longevitree')
      .replace(/KINSPAN/g, 'LONGEVITREE');
  }

  function applyBranding() {
    try {
      document.title = replaceBrandText(document.title);
      const root = document.body || document.documentElement;
      if (!root) return;
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      const nodes = [];
      while (walker.nextNode()) nodes.push(walker.currentNode);
      nodes.forEach((node) => {
        const next = replaceBrandText(node.nodeValue);
        if (next !== node.nodeValue) node.nodeValue = next;
      });
    } catch (_) {
      // Best-effort visual rebrand only.
    }
  }

  window.longevitreeApplyBranding = applyBranding;
  document.addEventListener('DOMContentLoaded', applyBranding);
  window.addEventListener('focus', applyBranding);
  document.addEventListener('click', () => setTimeout(applyBranding, 50));
  setInterval(applyBranding, 1000);
  applyBranding();
})();
