// ARCA SENTRY — dashboard front-end (vanilla JS, no framework)

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

async function ping() {
  try {
    const r = await fetch('/health');
    if (r.ok) {
      $('#status').textContent = 'live';
      $('#status').classList.add('live');
    }
  } catch (e) {
    $('#status').textContent = 'offline';
  }
}

async function loadScenarios() {
  const r = await fetch('/demo/scenarios');
  const data = await r.json();
  const container = $('#scenarios');
  container.innerHTML = '';
  data.scenarios.forEach(name => {
    const btn = document.createElement('button');
    btn.className = 'scenario-btn';
    btn.textContent = name;
    btn.onclick = () => runScenario(name, btn);
    container.appendChild(btn);
  });
}

function setAgentState(name, state, flagged = false) {
  const el = document.querySelector(`.agent[data-name="${name}"]`);
  if (!el) return;
  el.querySelector('.agent-state').textContent = state;
  el.classList.toggle('active', state !== 'idle' && state !== 'done');
  el.classList.toggle('flagged', flagged);
}

function resetAgents() {
  $$('.agent').forEach(el => {
    el.classList.remove('active', 'flagged');
    el.querySelector('.agent-state').textContent = 'idle';
  });
}

async function runScenario(name, btn) {
  btn.disabled = true;
  resetAgents();
  $$('.agent').forEach(el => setAgentState(el.dataset.name, 'auditing…'));

  $('#verdict').className = 'verdict empty';
  $('#verdict').innerHTML = 'auditing…';

  try {
    const r = await fetch('/demo/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scenario: name }),
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const decision = await r.json();
    renderVerdict(decision);
    reflectFindings(decision.findings);
  } catch (e) {
    $('#verdict').className = 'verdict critical';
    $('#verdict').textContent = 'Audit failed: ' + e.message;
  } finally {
    btn.disabled = false;
    loadAlerts();
  }
}

function reflectFindings(findings) {
  // Mark agents that produced findings as flagged.
  const flagged = new Set(findings.map(f => f.agent));
  $$('.agent').forEach(el => {
    const name = el.dataset.name;
    if (flagged.has(name)) {
      setAgentState(name, 'flagged', true);
    } else {
      setAgentState(name, 'clean', false);
    }
  });
}

function renderVerdict(decision) {
  const sev = decision.severity;
  const v = $('#verdict');
  v.className = 'verdict ' + sev;

  const header = {
    advisory: 'ADVISORY · logged',
    warning:  'WARNING · compliance team notified',
    critical: 'CRITICAL · response BLOCKED',
  }[sev] || sev.toUpperCase();

  let html = `<div class="verdict-header ${sev}">${header}</div>`;
  html += `<div><strong>Interaction:</strong> <code>${decision.interaction_id.slice(0, 8)}…</code></div>`;
  if (decision.summary) {
    html += `<div style="margin-top:8px">${decision.summary}</div>`;
  }
  if (decision.findings.length > 0) {
    html += '<ul class="findings-list">';
    decision.findings.forEach(f => {
      html += `<li>
        <span class="agent-tag">${f.agent}</span>
        <strong>${f.regulation}</strong>
        ${f.article ? `(${f.article})` : ''}
        — conf ${(f.confidence * 100).toFixed(0)}%
        <br><small>${escapeHtml(f.rationale)}</small>
      </li>`;
    });
    html += '</ul>';
  }
  html += `<div style="margin-top:10px">
    <a href="/reports/${decision.interaction_id}" target="_blank">View full report (HTML)</a>
    · <a href="/reports/${decision.interaction_id}.pdf" target="_blank">PDF</a>
    · <a href="/reports/${decision.interaction_id}.json" target="_blank">JSON</a>
  </div>`;
  v.innerHTML = html;
}

async function loadAlerts() {
  try {
    const r = await fetch('/alerts?limit=10');
    const data = await r.json();
    const body = $('#alerts-body');
    body.innerHTML = '';
    data.alerts.forEach(a => {
      const tr = document.createElement('tr');
      const t = new Date(a.created_at).toLocaleTimeString();
      tr.innerHTML = `
        <td>${t}</td>
        <td><span class="sev ${a.decision.severity}">${a.decision.severity}</span></td>
        <td><code>${a.interaction_id.slice(0, 8)}…</code></td>
        <td>${a.decision.action_taken}</td>
      `;
      body.appendChild(tr);
    });
    if (data.alerts.length === 0) {
      body.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--ink-2)">No alerts yet</td></tr>';
    }
  } catch (e) {
    /* ignore */
  }
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

(async function init() {
  await ping();
  await loadScenarios();
  await loadAlerts();
  setInterval(loadAlerts, 5000);
})();
