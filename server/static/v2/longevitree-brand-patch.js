(function () {
  function replaceBrandText(value) {
    return String(value || '')
      .split('LongeviTree').join('Longevitree')
      .split('KinSpan').join('Longevitree')
      .split('kinspan').join('longevitree')
      .split('KINSPAN').join('LONGEVITREE');
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
    } catch (_) {}
  }

  window.longevitreeApplyBranding = applyBranding;
  document.addEventListener('DOMContentLoaded', applyBranding);
  window.addEventListener('focus', applyBranding);
  document.addEventListener('click', () => setTimeout(applyBranding, 50));
  setInterval(applyBranding, 1000);
  applyBranding();
})();
