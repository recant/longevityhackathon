(function () {
  function cleanText(value) {
    return String(value || '')
      .split('LongeviTree').join('Longevitree')
      .split('KinSpan').join('Longevitree')
      .split('kinspan').join('longevitree')
      .split('KINSPAN').join('LONGEVITREE')
      .split('The first steps of their Longevity Journey').join('')
      .split('CV engine: opencv — pip install mediapipe for better pose tracking').join('')
      .split('CV engine: opencv - pip install mediapipe for better pose tracking').join('');
  }

  function cleanAttributes(el) {
    for (const attr of ['title', 'aria-label', 'alt', 'placeholder']) {
      if (el.hasAttribute && el.hasAttribute(attr)) {
        const next = cleanText(el.getAttribute(attr));
        if (next !== el.getAttribute(attr)) el.setAttribute(attr, next);
      }
    }
  }

  function applyBranding() {
    try {
      document.title = cleanText(document.title);
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
      const testsSub = document.getElementById('testsSub');
      if (testsSub && testsSub.textContent.trim() === '') testsSub.style.display = 'none';
    } catch (_) {}
  }

  window.longevitreeApplyBranding = applyBranding;
  document.addEventListener('DOMContentLoaded', applyBranding);
  window.addEventListener('focus', applyBranding);
  document.addEventListener('click', () => setTimeout(applyBranding, 50));
  setInterval(applyBranding, 1000);
  applyBranding();
})();
