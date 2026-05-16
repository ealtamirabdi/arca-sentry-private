// Agent profile page logic
'use strict';

const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

const params = new URLSearchParams(window.location.search);
const AGENT_ID = params.get('id');

const REG_LABELS = {
  eu_ai_act: 'EU AI Act',
  gdpr: 'GDPR',
  dora: 'DORA',
  pii_leak: 'PII Leak',
  prompt_injection: 'Prompt Injection',
};
const REG_COLORS = {
  eu_ai_act: '#2563eb', gdpr: '#b91c1c', dora: '#0369a1',
  pii_leak: '#6d28d9', prompt_injection: '#334155',
};

(async function init() {
  if (!AGENT_ID) {
    $('#ag-name').textContent = 'No agent ID provided';
    return;
  }
  try { const r = await fetch('/health'); if (r.ok) $('.status-pill').classList.add('live'); } catch {}

  try {
    const r = await fetch(`/agents/${AGENT_ID}/details`);
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const d = await r.json();
    render(d);
  } catch (e) {
    $('#ag-name').textContent = 'Could not load agent';
    $('#ag-desc').textContent = e.message;
  }

  $('#ag-run-redteam').onclick = () => {
    window.location.href = `/dashboard/redteam.html?prefill=${AGENT_ID}`;
  };
})();

function render(d) {
  const a = d.agent;
  $('#ag-name').textContent = `${a.icon || '🤖'}  ${a.name}`;
  $('#ag-vertical').textContent = a.vertical || 'Agent';
  $('#ag-desc').textContent = a.description || `Audited by SENTRY. ${d.stats.total_interactions} interactions seen.`;
  $('#ag-total').textContent = d.stats.total_interactions;
  $('#ag-criticals').textContent = d.stats.by_severity.critical || 0;
  $('#ag-warnings').textContent = d.stats.by_severity.warning || 0;
  $('#ag-status').textContent = d.stats.total_interactions > 0 ? 'active' : 'idle';

  // Regulations breakdown
  const grid = $('#ag-reg-grid');
  grid.innerHTML = '';
  const regs = Object.entries(d.stats.by_regulation);
  if (regs.length === 0) {
    grid.innerHTML = '<div class="muted" style="padding:14px;">No findings yet against this agent.</div>';
  } else {
    regs.forEach(([reg, count]) => {
      const item = document.createElement('div');
      item.className = 'ag-reg-item';
      item.style.borderLeftColor = REG_COLORS[reg] || '#888';
      item.innerHTML = `
        <div class="ag-reg-name">${REG_LABELS[reg] || reg}</div>
        <div class="ag-reg-count">${count}</div>
        <div class="ag-reg-sub">findings</div>
      `;
      grid.appendChild(item);
    });
  }

  // Interactions table
  const body = $('#ag-interactions');
  body.innerHTML = '';
  if (d.recent_interactions.length === 0) {
    body.innerHTML = '<tr><td colspan="6" class="muted" style="padding:24px;text-align:center;">No interactions audited yet for this agent.</td></tr>';
    return;
  }
  d.recent_interactions.forEach((i) => {
    const tr = document.createElement('tr');
    tr.style.cursor = 'pointer';
    tr.onclick = () => window.open(`/reports/${i.interaction_id}`, '_blank');
    const time = new Date(i.created_at).toLocaleString('en-GB', { hour:'2-digit', minute:'2-digit', day:'2-digit', month:'short' });
    tr.innerHTML = `
      <td class="time-cell">${time}</td>
      <td><span class="sev-pill ${i.severity}">${i.severity}</span></td>
      <td>${i.channel}</td>
      <td class="snippet-cell">${escapeHtml(i.request || '')}</td>
      <td class="snippet-cell">${escapeHtml(i.response || '')}</td>
      <td class="action-cell ${i.action_taken}">${i.action_taken}</td>
    `;
    body.appendChild(tr);
  });
}

function escapeHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
