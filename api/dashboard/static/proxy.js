// ARCA SENTRY — Proxy page logic
'use strict';

(async function init() {
  // Use current origin as the proxy base
  const base = window.location.origin;
  document.querySelectorAll('#proxy-base-1, #proxy-base-2, #proxy-base-5').forEach((el) => { el.textContent = base + '/v1'; });
  document.querySelectorAll('#proxy-base-3, #proxy-base-4').forEach((el) => { el.textContent = base; });

  // Tabs
  document.querySelectorAll('.snippet-tab').forEach((btn) => {
    btn.onclick = () => {
      document.querySelectorAll('.snippet-tab').forEach((b) => b.classList.remove('active'));
      document.querySelectorAll('.snippet-pane').forEach((p) => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('pane-' + btn.dataset.pane).classList.add('active');
    };
  });

  // Health pill
  try {
    const r = await fetch('/health');
    if (r.ok) {
      document.querySelector('#status-text').textContent = 'live';
      document.querySelector('.status-pill').classList.add('live');
    }
  } catch {}

  // Stats
  try {
    const r = await fetch('/proxy/status');
    if (r.ok) {
      const d = await r.json();
      const el = document.getElementById('proxy-total');
      if (el) el.textContent = d.total_proxied;
    }
  } catch {}
})();
