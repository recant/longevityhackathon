(function () {
  function setText(el, text) {
    if (el) el.textContent = text;
  }

  function startCheckin(path) {
    const mode = path === 'vision' ? 'vision' : 'manual';
    try {
      localStorage.setItem('kinspan_path', mode);
      localStorage.setItem('longevitree_path', mode);
      localStorage.removeItem('kinspan_workflow_step');
      localStorage.removeItem('kinspan_completed');
    } catch (_) {}

    if (typeof window.goTo === 'function') window.goTo('guided');

    setTimeout(() => {
      const frame = document.getElementById('guidedFrame');
      if (frame) frame.src = `/classic?embed=1&path=${encodeURIComponent(mode)}&t=${Date.now()}`;
      const title = document.querySelector('#guided h2');
      const sub = document.querySelector('#guided p');
      if (mode === 'vision') {
        setText(title, 'Video-based check-in');
        setText(sub, 'Computer-vision walk + chair tests, then reaction time');
      } else {
        setText(title, 'Manual full check-in');
        setText(sub, 'Timer-based walk, chair, and reaction tests');
      }
    }, 50);
  }

  function patchTestsScreen() {
    const tiles = document.querySelector('#tests .test-tiles');
    if (!tiles || document.getElementById('ltVideoCheckinTile')) return;

    const fullTile = [...tiles.querySelectorAll('.test-tile')].find((tile) =>
      /Full check-in/i.test(tile.textContent || '')
    );

    if (fullTile) {
      fullTile.onclick = () => startCheckin('manual');
      const hdr = fullTile.querySelector('.ttile-hdr');
      const body = fullTile.querySelector('.ttile-body');
      setText(hdr, 'Manual full check-in ›');
      setText(body, 'Timer-based walk, chair, and reaction tests');
    }

    const videoTile = document.createElement('div');
    videoTile.id = 'ltVideoCheckinTile';
    videoTile.className = 'test-tile t-dark';
    videoTile.setAttribute('role', 'button');
    videoTile.setAttribute('tabindex', '0');
    videoTile.innerHTML = '<div class="ttile-hdr">Video-based check-in ›</div><div class="ttile-body">AI/computer-vision walk + chair scoring from phone video</div>';
    videoTile.addEventListener('click', () => startCheckin('vision'));
    videoTile.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        startCheckin('vision');
      }
    });

    if (fullTile && fullTile.parentNode) fullTile.parentNode.insertBefore(videoTile, fullTile.nextSibling);
    else tiles.appendChild(videoTile);
  }

  function patchClassicPathFromUrl() {
    try {
      const params = new URLSearchParams(location.search);
      const path = params.get('path');
      if (path === 'vision' || path === 'manual') {
        localStorage.setItem('kinspan_path', path);
        localStorage.setItem('longevitree_path', path);
      }
    } catch (_) {}
  }

  window.startLongevitreeCheckin = startCheckin;

  document.addEventListener('DOMContentLoaded', () => {
    patchClassicPathFromUrl();
    patchTestsScreen();
  });
  document.addEventListener('click', () => setTimeout(patchTestsScreen, 80));
  window.addEventListener('focus', patchTestsScreen);
  setInterval(patchTestsScreen, 1000);
  patchClassicPathFromUrl();
  patchTestsScreen();
})();
