(function () {
  const BOOT_RESET_KEY = 'longevitree_boot_reset_done';

  function replaceBrandText(value) {
    return String(value || '')
      .split('LongeviTree').join('Longevitree')
      .split('Quick Sit & Stand').join('Quick Stand')
      .split('Quick Sit &amp; Stand').join('Quick Stand')
      .split('Sit & Stand').join('Quick Stand')
      .split('Sit &amp; Stand').join('Quick Stand')
      .split('sit & stand').join('quick stand')
      .split('sit-to-stand').join('stand')
      .split('Sit-to-stand').join('Stand')
      .split('30-second CDC rep count').join('Single stand timer')
      .split('CDC 30-second rep count').join('Quick Stand')
      .split('Single sit-to-stand timer').join('Single stand timer')
      .split("We'll start with the Quick Stand test. Grab a chair — it takes 90 seconds")
      .join("We'll start with the Reaction Time test. It takes under a minute and gives us a quick first signal.");
  }

  function clearOldBrowserMemory() {
    try {
      const removeKeys = [];
      for (let i = 0; i < localStorage.length; i += 1) {
        const key = localStorage.key(i);
        if (key && /longevitree/i.test(key)) removeKeys.push(key);
      }
      removeKeys.forEach((key) => localStorage.removeItem(key));
    } catch (_) {}

    try {
      const removeKeys = [];
      for (let i = 0; i < sessionStorage.length; i += 1) {
        const key = sessionStorage.key(i);
        if (key && /longevitree/i.test(key) && key !== BOOT_RESET_KEY) removeKeys.push(key);
      }
      removeKeys.forEach((key) => sessionStorage.removeItem(key));
    } catch (_) {}
  }

  async function resetServerMemoryForFreshTab() {
    try {
      if (sessionStorage.getItem(BOOT_RESET_KEY) === '1') return;
      sessionStorage.setItem(BOOT_RESET_KEY, '1');
      clearOldBrowserMemory();
      await fetch('/api/reset', { method: 'POST', cache: 'no-store' }).catch(() => null);
      await fetch('/api/profile', {
        method: 'PUT',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ display_name: 'Mom/Dad', age: 68, sex: 'female' }),
      }).catch(() => null);
      location.replace(location.pathname + location.search + location.hash);
    } catch (_) {}
  }

  function installQuickStandGridStyles() {
    if (document.getElementById('longevitreeGridPatchStyles')) return;
    const style = document.createElement('style');
    style.id = 'longevitreeGridPatchStyles';
    style.textContent = `
      #tests .test-tiles{grid-template-columns:1fr 1fr!important;align-items:stretch!important}
      #tests .test-tile{min-height:104px!important;height:104px!important;display:flex!important;flex-direction:column!important}
      #tests .test-tile.t-sage{grid-column:auto!important}
      #tests .ttile-hdr{height:46px!important;min-height:46px!important;max-height:46px!important}
      #tests .ttile-body{flex:1!important;min-height:58px!important;display:flex!important;align-items:center!important}
    `;
    document.head.appendChild(style);
  }

  function showIntroScreen() {
    try {
      if (typeof window.goSlide === 'function') window.goSlide(0);
      if (typeof window.goTo === 'function') window.goTo('onboarding');
    } catch (_) {}
  }

  function applyBranding() {
    try {
      installQuickStandGridStyles();
      document.title = replaceBrandText(document.title).replace('Longevity App v2', 'Longevitree');
      const root = document.body || document.documentElement;
      if (!root) return;
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      const nodes = [];
      while (walker.nextNode()) nodes.push(walker.currentNode);
      nodes.forEach((node) => {
        const next = replaceBrandText(node.nodeValue);
        if (next !== node.nodeValue) node.nodeValue = next;
      });
      root.querySelectorAll('[title],[aria-label],[alt],[placeholder]').forEach((el) => {
        ['title', 'aria-label', 'alt', 'placeholder'].forEach((attr) => {
          if (!el.hasAttribute(attr)) return;
          const next = replaceBrandText(el.getAttribute(attr));
          if (next !== el.getAttribute(attr)) el.setAttribute(attr, next);
        });
      });
      removeOldSitStandEntryPoints();
    } catch (_) {}
  }

  function removeOldSitStandEntryPoints() {
    try {
      document.querySelectorAll("[onclick*='sit-stand'], [onclick*=\"sit-stand\"]").forEach((el) => {
        const isTile = el.classList.contains('test-tile');
        const isLink = el.tagName === 'A';
        if (isTile || isLink) {
          el.remove();
          return;
        }
        el.setAttribute('onclick', "goTo('chair-rise')");
      });

      document.querySelectorAll('.test-tile').forEach((tile) => {
        const text = tile.textContent || '';
        const onclick = tile.getAttribute('onclick') || '';
        if (/30-second|rep count/i.test(text) || /sit-stand/i.test(onclick)) {
          tile.remove();
        }
      });

      const quickTile = [...document.querySelectorAll('.test-tile')].find((tile) => {
        const onclick = tile.getAttribute('onclick') || '';
        return onclick.includes('chair-rise') || /Quick Stand/i.test(tile.textContent || '');
      });
      if (quickTile) {
        quickTile.setAttribute('onclick', "goTo('chair-rise')");
        quickTile.style.gridColumn = 'auto';
        const hdr = quickTile.querySelector('.ttile-hdr');
        const body = quickTile.querySelector('.ttile-body');
        if (hdr) hdr.textContent = 'Quick Stand ›';
        if (body) body.textContent = 'Single stand timer';
      }

      const quickScreen = document.getElementById('chair-rise');
      if (quickScreen) {
        const h2 = quickScreen.querySelector('h2');
        const p = quickScreen.querySelector('.test-header p');
        if (h2) h2.textContent = 'Quick Stand';
        if (p) p.textContent = 'One rise · time upward phase';
        quickScreen.querySelectorAll('.info-box-link').forEach((el) => el.remove());
      }
    } catch (_) {}
  }

  function patchNavigation() {
    if (window.__longevitreeQuickStandPatched) return;
    window.__longevitreeQuickStandPatched = true;

    const originalGoTo = window.goTo;
    if (typeof originalGoTo === 'function') {
      window.goTo = function patchedGoTo(id) {
        return originalGoTo.call(this, id === 'sit-stand' ? 'chair-rise' : id);
      };
    }

    const originalObNext = window.obNext;
    if (typeof originalObNext === 'function') {
      window.obNext = function patchedObNext() {
        const btn = document.getElementById('obBtn');
        const isFinal = btn && /Start first test/i.test(btn.textContent || '');
        if (isFinal && typeof window.goTo === 'function') {
          window.goTo('reaction');
          return;
        }
        return originalObNext.apply(this, arguments);
      };
    }
  }

  window.longevitreeApplyBranding = applyBranding;
  resetServerMemoryForFreshTab();
  document.addEventListener('DOMContentLoaded', () => {
    installQuickStandGridStyles();
    patchNavigation();
    applyBranding();
    setTimeout(showIntroScreen, 150);
  });
  window.addEventListener('focus', () => {
    installQuickStandGridStyles();
    patchNavigation();
    applyBranding();
  });
  document.addEventListener('click', () => setTimeout(() => {
    installQuickStandGridStyles();
    patchNavigation();
    applyBranding();
  }, 50));
  setInterval(() => {
    installQuickStandGridStyles();
    patchNavigation();
    applyBranding();
  }, 1000);
  installQuickStandGridStyles();
  patchNavigation();
  applyBranding();
})();
