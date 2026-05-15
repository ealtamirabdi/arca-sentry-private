// ARCA SENTRY — Auto-Fix page
'use strict';

const $ = (s) => document.querySelector(s);

let totalSession = 0;

(async function init() {
  try { const r = await fetch('/health'); if (r.ok) $('.status-pill').classList.add('live'); } catch {}

  await loadSettings();
  await loadHistory();
  setInterval(loadHistory, 8000);

  $('#af-enable').addEventListener('change', saveSettings);
  $('#af-severity').addEventListener('change', saveSettings);
  $('#af-run').addEventListener('click', doRewrite);
})();

async function loadSettings() {
  try {
    const r = await fetch('/autofix/settings');
    const d = await r.json();
    $('#af-enable').checked = d.enabled;
    $('#af-severity').value = d.min_severity || 'warning';
    $('#af-mode').textContent = d.enabled ? 'ON' : 'OFF';
  } catch {}
}

async function saveSettings() {
  try {
    const r = await fetch('/autofix/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        enabled: $('#af-enable').checked,
        min_severity: $('#af-severity').value,
      }),
    });
    if (r.ok) {
      const d = await r.json();
      $('#af-mode').textContent = d.enabled ? 'ON' : 'OFF';
    }
  } catch {}
}

async function doRewrite() {
  const original = $('#af-original').value.trim();
  const rationale = $('#af-rationale').value.trim();
  const reg = $('#af-reg').value;
  const article = $('#af-article').value.trim();
  const lang = $('#af-lang').value;

  if (!original || !rationale) {
    alert('Need both the original response and a rationale.');
    return;
  }

  $('#af-run').disabled = true;
  $('#af-run').textContent = '⏳ Rewriting with Gemini Pro…';
  try {
    const r = await fetch('/autofix/rewrite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        original_response: original,
        finding_rationale: rationale,
        regulation: reg,
        article: article || null,
        language_hint: lang || null,
      }),
    });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const d = await r.json();
    $('#af-before').textContent = d.original;
    $('#af-after').textContent = d.rewritten;
    $('#af-result').style.display = 'block';
    totalSession += 1;
    $('#af-total').textContent = totalSession;
    await loadHistory();
  } catch (e) {
    alert('Rewrite failed: ' + e.message);
  } finally {
    $('#af-run').disabled = false;
    $('#af-run').textContent = '✨ Rewrite with Gemini Pro';
  }
}

async function loadHistory() {
  try {
    const r = await fetch('/autofix/history?limit=20');
    const d = await r.json();
    const wrap = $('#af-history');
    if (!d.items || d.items.length === 0) {
      wrap.innerHTML = '<div class="muted" style="padding:24px;text-align:center;">No rewrites yet.</div>';
      return;
    }
    wrap.innerHTML = '';
    d.items.forEach((it) => {
      const el = document.createElement('div');
      el.className = 'af-hist-item';
      const time = new Date(it.created_at).toLocaleTimeString('en-GB');
      el.innerHTML = `
        <div class="af-hist-head">
          <div>
            <strong>${escapeHtml(it.regulation)}</strong>
            ${it.article ? `<span class="muted small"> · ${escapeHtml(it.article)}</span>` : ''}
          </div>
          <span class="af-hist-meta">${time} · ${(it.record_id || '').slice(0, 8)}</span>
        </div>
        <div class="af-hist-snippet">${escapeHtml((it.rewritten || '').slice(0, 200))}…</div>
      `;
      el.onclick = () => {
        $('#af-before').textContent = it.original;
        $('#af-after').textContent = it.rewritten;
        $('#af-result').style.display = 'block';
        $('#af-result').scrollIntoView({ behavior: 'smooth' });
      };
      wrap.appendChild(el);
    });
  } catch {}
}

function escapeHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
