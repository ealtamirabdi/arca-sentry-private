// ARCA SENTRY — Red Team page (agent picker + run + results)
'use strict';

const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

(async function init() {
  try { const r = await fetch('/health'); if (r.ok) $('.status-pill').classList.add('live'); } catch {}

  try {
    const r = await fetch('/redteam/catalog');
    const d = await r.json();
    $('#rt-catalog-count').textContent = d.total;
  } catch {}

  await loadAgents();

  $('#rt-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    await runCustom();
  });
})();

async function loadAgents() {
  try {
    const r = await fetch('/agents');
    const d = await r.json();
    const grid = $('#rt-agent-grid');
    grid.innerHTML = '';
    d.agents.forEach((a) => grid.appendChild(renderAgentCard(a)));
    if (window.lucide) window.lucide.createIcons();
  } catch (e) {
    $('#rt-agent-grid').innerHTML = '<div class="muted">Could not load agents.</div>';
  }
}

function renderAgentCard(a) {
  const card = document.createElement('div');
  card.className = 'rt-agent-card';
  card.title = 'Click anywhere on this card to open the agent profile · use the red button to run pen test';
  const lastTime = a.last_audited_at
    ? new Date(a.last_audited_at).toLocaleString('en-GB', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' })
    : '—';
  card.innerHTML = `
    <div class="rt-ag-head">
      <div class="rt-ag-icon">${a.icon}</div>
      <div class="rt-ag-info">
        <div class="rt-ag-name">${escapeHtml(a.name)}</div>
        <div class="rt-ag-vertical">${escapeHtml(a.vertical)}</div>
      </div>
      <span class="rt-ag-status ${a.status === 'active' ? 'active' : ''}">${a.status}</span>
    </div>

    <div class="rt-ag-desc">${escapeHtml(a.description)}</div>

    <div class="rt-ag-tags">
      ${(a.regulations || []).map((r) => `<span class="rt-ag-tag">${escapeHtml(r)}</span>`).join('')}
    </div>

    <div class="rt-ag-meta">
      <div class="rt-ag-meta-item">
        <div class="val">${a.total_audits}</div>
        <div class="lbl">Audits</div>
      </div>
      <div class="rt-ag-meta-item">
        <div class="val warn">${a.warnings_caught}</div>
        <div class="lbl">Warnings</div>
      </div>
      <div class="rt-ag-meta-item">
        <div class="val crit">${a.criticals_caught}</div>
        <div class="lbl">Criticals</div>
      </div>
    </div>

    <button class="rt-ag-cta">⚡ Run pen test</button>
  `;
  card.querySelector('.rt-ag-cta').onclick = (e) => { e.stopPropagation(); runOnAgent(a); };
  // Click anywhere else opens the agent profile page
  card.onclick = () => { window.location.href = `/dashboard/agent.html?id=${a.id}`; };
  return card;
}

// Auto-prefill if URL has ?prefill=<id>
(function autoPrefill() {
  const params = new URLSearchParams(window.location.search);
  const id = params.get('prefill');
  if (!id) return;
  // Wait for catalog to load then auto-run
  const tryRun = () => {
    const cards = document.querySelectorAll('.rt-agent-card');
    if (cards.length === 0) { setTimeout(tryRun, 300); return; }
    // Resolve agent from catalog
    fetch('/agents').then((r) => r.json()).then((d) => {
      const agent = d.agents.find((a) => a.id === id);
      if (agent) runOnAgent(agent);
    });
  };
  setTimeout(tryRun, 600);
})();

async function runOnAgent(agent) {
  $('#rt-running-card').style.display = 'block';
  $('#rt-running-title').textContent = `Pen-testing · ${agent.name}`;
  $('#rt-running-sub').textContent = `Sending the full attack catalog against ${agent.name}. ${agent.vertical} agent, ${agent.model}.`;
  $('#rt-results-card').style.display = 'none';
  animateProgress(0);

  // Smooth progress animation while we wait
  let prog = 5;
  const timer = setInterval(() => {
    prog = Math.min(95, prog + Math.random() * 4);
    animateProgress(prog);
    $('#rt-progress-label').textContent =
      `Running attacks · ${Math.round(prog)}%`;
  }, 900);

  try {
    const r = await fetch('/redteam/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agent_id: agent.id, max_attacks: 12 }),
    });
    clearInterval(timer);
    animateProgress(100);
    $('#rt-progress-label').textContent = 'Complete.';

    if (!r.ok) {
      const t = await r.text();
      throw new Error(`HTTP ${r.status}: ${t.slice(0, 200)}`);
    }
    const data = await r.json();
    setTimeout(() => {
      $('#rt-running-card').style.display = 'none';
      $('#rt-results-card').style.display = 'block';
      renderResults(data, agent.name);
    }, 350);
  } catch (e) {
    clearInterval(timer);
    $('#rt-running-card').style.display = 'none';
    alert('Pen test failed: ' + e.message);
  }
}

async function runCustom() {
  const provider = $('#rt-provider').value;
  const key = $('#rt-key').value.trim();
  const model = $('#rt-model').value.trim();
  const systemPrompt = $('#rt-system').value.trim();
  if (!key) { alert('API key required for custom agent.'); return; }

  $('#rt-running-card').style.display = 'block';
  $('#rt-running-title').textContent = `Pen-testing · custom ${provider}/${model}`;
  $('#rt-running-sub').textContent = 'Sending attacks against your external endpoint.';
  $('#rt-results-card').style.display = 'none';
  animateProgress(0);

  let prog = 5;
  const timer = setInterval(() => {
    prog = Math.min(95, prog + Math.random() * 4);
    animateProgress(prog);
    $('#rt-progress-label').textContent = `Running attacks · ${Math.round(prog)}%`;
  }, 900);

  try {
    const r = await fetch('/redteam/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider, model, api_key: key, system_prompt: systemPrompt || null, max_attacks: 12 }),
    });
    clearInterval(timer);
    animateProgress(100);
    $('#rt-progress-label').textContent = 'Complete.';
    if (!r.ok) { const t = await r.text(); throw new Error(`HTTP ${r.status}: ${t.slice(0, 200)}`); }
    const data = await r.json();
    setTimeout(() => {
      $('#rt-running-card').style.display = 'none';
      $('#rt-results-card').style.display = 'block';
      renderResults(data, `${provider}/${model}`);
    }, 350);
  } catch (e) {
    clearInterval(timer);
    $('#rt-running-card').style.display = 'none';
    alert('Pen test failed: ' + e.message);
  }
}

function animateProgress(pct) {
  $('#rt-progress-fill').style.width = pct + '%';
}

let LAST_REPORT = null;

function renderResults(data, targetName) {
  LAST_REPORT = data;
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
    item.innerHTML = `
      <span class="cat">${escapeHtml(cat)}</span>
      <span class="ratio ${b.vulnerable > 0 ? 'fail' : 'ok'}">${b.vulnerable}/${b.total}</span>
    `;
    breakdown.appendChild(item);
  });

  const vul = data.summary.vulnerable;
  const total = data.summary.total;
  $('#rt-summary').textContent =
    `Target: ${targetName}. ${vul}/${total} attacks succeeded. ` +
    `${score >= 85 ? 'Strong resilience — minor gaps only.' : score >= 60 ? 'Several gaps — review red rows below.' : 'Major gaps — urgent remediation needed.'}`;

  const wrap = $('#rt-results');
  wrap.innerHTML = '';
  data.results.forEach((r) => {
    const el = document.createElement('div');
    el.className = 'rt-result' + (r.vulnerable ? ' vulnerable' : '');
    el.innerHTML = `
      <div class="rt-result-head">
        <span class="cat-tag">${escapeHtml(r.category)}</span>
        <span class="name">${escapeHtml(r.name)}</span>
        <span class="verdict">${r.vulnerable ? '✗ VULNERABLE' : '✓ Resisted'}</span>
      </div>
      ${r.vulnerable ? `
        <div class="rt-result-body">
          <div class="rt-prompt-block">
            <div class="rt-block-label">🎯 Attacker prompt</div>
            <code class="rt-prompt-code">${escapeHtml(r.prompt || '')}</code>
          </div>
          <div class="rt-response-block">
            <div class="rt-block-label">💬 Bot response (leaked)</div>
            <code class="rt-response-code">${escapeHtml((r.response || '').slice(0, 320))}${(r.response || '').length > 320 ? '…' : ''}</code>
          </div>
        </div>` : `
        <div class="rt-result-body">
          <div class="rt-prompt-block">
            <div class="rt-block-label muted">Attempted prompt</div>
            <code class="rt-prompt-code muted">${escapeHtml((r.prompt || '').slice(0, 140))}${(r.prompt || '').length > 140 ? '…' : ''}</code>
          </div>
        </div>
      `}
    `;
    wrap.appendChild(el);
  });

  // Inject the export-bar (PDF download + copy summary)
  let exportBar = $('#rt-export-bar');
  if (!exportBar) {
    exportBar = document.createElement('div');
    exportBar.id = 'rt-export-bar';
    exportBar.className = 'rt-export-bar';
    exportBar.innerHTML = `
      <button type="button" class="rt-export-btn primary" id="rt-dl-pdf">
        📄 Download PDF report
      </button>
      <button type="button" class="rt-export-btn" id="rt-copy-summary">
        📋 Copy summary to clipboard
      </button>
      <button type="button" class="rt-export-btn" id="rt-share-link">
        🔗 Generate share link
      </button>
    `;
    $('#rt-results-card').appendChild(exportBar);

    $('#rt-dl-pdf').onclick = () => downloadPdf();
    $('#rt-copy-summary').onclick = () => copySummary();
    $('#rt-share-link').onclick = () => shareLink();
  }

  // Smooth scroll to results
  $('#rt-results-card').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function downloadPdf() {
  if (!LAST_REPORT) return;
  const btn = $('#rt-dl-pdf');
  btn.disabled = true;
  btn.textContent = '⏳ Generating PDF…';
  try {
    const r = await fetch('/redteam/report.pdf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(LAST_REPORT),
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const blob = await r.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sentry-redteam-${Date.now()}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    btn.textContent = '✓ Downloaded · click to download again';
  } catch (e) {
    btn.textContent = '❌ Failed · ' + e.message;
  } finally {
    btn.disabled = false;
    setTimeout(() => { btn.textContent = '📄 Download PDF report'; }, 4000);
  }
}

function copySummary() {
  if (!LAST_REPORT) return;
  const s = LAST_REPORT.summary;
  const t = LAST_REPORT.target;
  const text = `ARCA SENTRY · Red Team Report
Target: ${t.provider}/${t.model}
Date: ${LAST_REPORT.completed_at}

Resilience score: ${s.resilience_score}%
Attacks executed: ${s.total}
Vulnerable: ${s.vulnerable}
Resisted: ${s.total - s.vulnerable}

By category:
${Object.entries(s.by_category).map(([c, b]) => `  · ${c}: ${b.vulnerable}/${b.total} vulnerable`).join('\n')}

Top vulnerabilities:
${LAST_REPORT.results.filter((r) => r.vulnerable).slice(0, 5).map((r) => `  · [${r.category}] ${r.name}`).join('\n')}

Generated by ARCA SENTRY`;

  navigator.clipboard.writeText(text).then(
    () => {
      const btn = $('#rt-copy-summary');
      const orig = btn.textContent;
      btn.textContent = '✓ Copied to clipboard';
      setTimeout(() => { btn.textContent = orig; }, 2500);
    },
    () => alert('Could not copy. Select the text manually.')
  );
}

function shareLink() {
  // For now, copy the URL of this page — in production this would create
  // a signed read-only share URL backed by the event store.
  const url = window.location.href;
  navigator.clipboard.writeText(url).then(() => {
    const btn = $('#rt-share-link');
    const orig = btn.textContent;
    btn.textContent = '✓ Link copied · paste anywhere';
    setTimeout(() => { btn.textContent = orig; }, 2500);
  });
}

function escapeHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
