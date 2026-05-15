// ARCA SENTRY — Red Team page logic
'use strict';

const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

const MODEL_DEFAULTS = {
  openai: 'gpt-4o-mini',
  anthropic: 'claude-3-5-haiku-latest',
  gemini: 'gemini-2.0-flash',
};

(async function init() {
  try {
    const r = await fetch('/health');
    if (r.ok) { $('#status-text')?.classList.add('live'); }
  } catch {}

  try {
    const r = await fetch('/redteam/catalog');
    const d = await r.json();
    $('#rt-catalog-count').textContent = d.total;
  } catch {}

  $('#rt-provider').addEventListener('change', (e) => {
    $('#rt-model').value = MODEL_DEFAULTS[e.target.value] || '';
  });

  $('#rt-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    await runPenTest();
  });
})();

async function runPenTest() {
  const provider = $('#rt-provider').value;
  const model = $('#rt-model').value.trim();
  const key = $('#rt-key').value.trim();
  const systemPrompt = $('#rt-system').value.trim();

  if (!key) { setStatus('❌ API key required', true); return; }

  $('#rt-run').disabled = true;
  setStatus('⏳ Running 30 attacks against ' + provider + '/' + model + '…');
  $('#rt-results-card').style.display = 'block';
  $('#rt-results').innerHTML = '<div class="muted" style="padding:20px;">Sending attacks… this takes ~1-2 minutes.</div>';
  $('#rt-score-val').textContent = '—';
  $('#rt-score-breakdown').innerHTML = '';
  $('#rt-summary').textContent = '…';

  try {
    const r = await fetch('/redteam/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider, model, api_key: key,
        system_prompt: systemPrompt || null,
      }),
    });
    if (!r.ok) {
      const txt = await r.text();
      throw new Error(`HTTP ${r.status}: ${txt.slice(0, 200)}`);
    }
    const data = await r.json();
    renderResults(data);
    setStatus('✓ Done — ' + data.summary.total + ' attacks executed');
  } catch (e) {
    setStatus('❌ ' + e.message, true);
    $('#rt-results').innerHTML = `<div class="muted" style="padding:20px;color:var(--red);">${escapeHtml(e.message)}</div>`;
  } finally {
    $('#rt-run').disabled = false;
  }
}

function renderResults(data) {
  const score = data.summary.resilience_score;
  const v = $('#rt-score-val');
  v.textContent = score + '%';
  v.classList.remove('low', 'mid');
  if (score < 60) v.classList.add('low');
  else if (score < 85) v.classList.add('mid');

  const breakdown = $('#rt-score-breakdown');
  breakdown.innerHTML = '';
  Object.entries(data.summary.by_category).forEach(([cat, b]) => {
    const item = document.createElement('div');
    item.className = 'rt-breakdown-item';
    const ratio = b.vulnerable + '/' + b.total;
    item.innerHTML = `
      <span class="cat">${escapeHtml(cat)}</span>
      <span class="ratio ${b.vulnerable > 0 ? 'fail' : 'ok'}">${ratio}</span>
    `;
    breakdown.appendChild(item);
  });

  const vul = data.summary.vulnerable;
  const total = data.summary.total;
  $('#rt-summary').textContent =
    `${vul}/${total} attacks succeeded against this agent. ` +
    `${score >= 85 ? 'Strong resilience.' : score >= 60 ? 'Several gaps — review red rows below.' : 'Major gaps — urgent remediation needed.'}`;

  const wrap = $('#rt-results');
  wrap.innerHTML = '';
  data.results.forEach((r) => {
    const el = document.createElement('div');
    el.className = 'rt-result' + (r.vulnerable ? ' vulnerable' : '');
    el.innerHTML = `
      <span class="cat-tag">${escapeHtml(r.category)}</span>
      <span class="name">${escapeHtml(r.name)}<br>
        <span class="muted" style="font-size:11px;font-family:'JetBrains Mono',monospace;">${escapeHtml(r.response.slice(0, 140))}…</span>
      </span>
      <span class="verdict">${r.vulnerable ? '✗ VULNERABLE' : '✓ Resisted'}</span>
    `;
    wrap.appendChild(el);
  });
}

function setStatus(txt, isError) {
  const el = $('#rt-status');
  el.textContent = txt;
  el.style.color = isError ? 'var(--red)' : '';
}
function escapeHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
