(function () {
  const OLD_BRAND_PASCAL = ['K', 'in', 'Span'].join('');
  const OLD_BRAND_LOWER = ['k', 'in', 'span'].join('');
  const OLD_BRAND_UPPER = ['K', 'IN', 'SPAN'].join('');

  function replaceBrandText(value) {
    return String(value || '')
      .split('LongeviTree').join('Longevitree')
      .split(OLD_BRAND_PASCAL).join('Longevitree')
      .split(OLD_BRAND_LOWER).join('longevitree')
      .split(OLD_BRAND_UPPER).join('LONGEVITREE')
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
      .join("We'll start with the Quick Stand test. Grab a chair — it takes under a minute");
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

  function forceFullCheckinOnBoot() {
    if (window.__longevitreeForcedFullCheckin) return;
    window.__longevitreeForcedFullCheckin = true;
    const open = () => {
      try {
        if (typeof window.goTo === 'function') {
          window.goTo('guided');
          const frame = document.getElementById('guidedFrame');
          if (frame && !String(frame.getAttribute('src') || '').includes('/classic')) {
            frame.src = '/classic?embed=1';
          }
        }
      } catch (_) {}
    };
    setTimeout(open, 150);
    setTimeout(open, 600);
    setTimeout(open, 1200);
  }

  function applyBranding() {
    try {
      installQuickStandGridStyles();
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
          window.goTo('guided');
          return;
        }
        return originalObNext.apply(this, arguments);
      };
    }
  }

  window.longevitreeApplyBranding = applyBranding;
  document.addEventListener('DOMContentLoaded', () => {
    installQuickStandGridStyles();
    patchNavigation();
    applyBranding();
    forceFullCheckinOnBoot();
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
  forceFullCheckinOnBoot();
})();
