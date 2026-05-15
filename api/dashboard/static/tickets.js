// ARCA SENTRY — Tickets page
'use strict';

const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

const REG_LABELS = {
  eu_ai_act: 'EU AI Act',
  gdpr: 'GDPR',
  dora: 'DORA',
  pii_leak: 'PII Leak',
  prompt_injection: 'Prompt Injection',
};

let currentStatus = '';

(async function init() {
  await pingHealth();
  await refreshSummary();
  await refreshTickets();
  setInterval(refreshSummary, 5000);
  setInterval(refreshTickets, 6000);
  bindFilters();
})();

async function pingHealth() {
  try {
    const r = await fetch('/health');
    if (r.ok) {
      $('#status-text').textContent = 'live';
      document.querySelector('.status-pill').classList.add('live');
    }
  } catch {
    $('#status-text').textContent = 'offline';
  }
}

async function refreshSummary() {
  try {
    const r = await fetch('/tickets/summary');
    if (!r.ok) return;
    const d = await r.json();
    animateNumber('#kpi-open', d.open_count);
    $('#kpi-exposure').textContent = d.total_open_exposure_label;
    animateNumber('#kpi-resolved', d.by_status.resolved || 0);
    animateNumber('#kpi-total', d.total_tickets);
  } catch {}
}

async function refreshTickets() {
  const url = currentStatus
    ? `/tickets?status=${currentStatus}&limit=100`
    : `/tickets?limit=100`;
  try {
    const r = await fetch(url);
    if (!r.ok) return;
    const data = await r.json();
    renderTickets(data.tickets || []);
  } catch (e) {
    console.error(e);
  }
}

function renderTickets(tickets) {
  const list = $('#tickets-list');
  list.innerHTML = '';
  if (tickets.length === 0) {
    list.innerHTML = '<div class="muted" style="padding:24px;text-align:center;">No tickets in this filter.</div>';
    return;
  }
  tickets.forEach((t) => list.appendChild(renderTicket(t)));
  if (window.lucide) window.lucide.createIcons();
}

function renderTicket(t) {
  const el = document.createElement('div');
  el.className = `ticket-card ${t.severity}`;
  const reg = REG_LABELS[t.regulation] || t.regulation;
  const created = new Date(t.created_at).toLocaleString();
  const findingsList = (t.findings || []).map((f) => `
    <li><span class="reg-chip ${f.regulation}">${REG_LABELS[f.regulation] || f.regulation}</span>
        ${escapeHtml(f.rationale || '').slice(0, 200)}</li>
  `).join('');

  el.innerHTML = `
    <div class="ticket-head">
      <div style="flex:1;">
        <div class="ticket-id">${t.ticket_id} · <span class="muted">${escapeHtml(t.actor || '')}</span> · ${escapeHtml(t.channel)} · ${created}</div>
        <div class="ticket-title">${escapeHtml(t.title)}</div>
        <div style="margin-top:4px;">
          <span class="reg-chip ${t.regulation}">${reg}</span>
          <span class="sev-pill ${t.severity}">${t.severity}</span>
          <span class="muted small" style="margin-left:6px;">${escapeHtml(t.regulation_long || '')}</span>
        </div>
      </div>
      <span class="ticket-status ${t.status}">${t.status.replace('_', ' ')}</span>
    </div>

    <div class="ticket-cost">
      <i data-lucide="alert-triangle"></i>
      <div>
        <div class="cost-label">Estimated cost if not remediated</div>
        <div class="cost-value">${escapeHtml(t.estimated_exposure_label)}
          <span style="font-size:11px;font-weight:500;color:var(--ink-3);">
            · max fine: ${escapeHtml(t.max_fine_label)}
          </span>
        </div>
      </div>
    </div>

    <details style="margin-top:8px;">
      <summary style="cursor:pointer;font-size:12px;color:var(--ink-3);font-weight:600;">View transcript & findings</summary>
      <div style="margin-top:10px;padding:10px 12px;background:var(--bg-elev);border-radius:var(--r-sm);border:1px solid var(--line);">
        <div style="font-size:11px;color:var(--blue-700);font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">User</div>
        <div style="font-size:12px;color:var(--ink-2);">${escapeHtml(t.user_request || '')}</div>
        <div style="font-size:11px;color:var(--slate);font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-top:8px;margin-bottom:4px;">Bot</div>
        <div style="font-size:12px;color:var(--ink-2);">${escapeHtml(t.ai_response || '')}</div>
      </div>
      <ul style="margin-top:10px;list-style:none;font-size:12px;line-height:1.6;">${findingsList}</ul>
    </details>

    <div class="ticket-suggestion">
      <div class="ticket-suggestion-label">💡 Suggested remediation</div>
      <div style="margin-top:4px;color:var(--ink-2);">Apply the change below to the system prompt of the affected agent.</div>
      <code>${escapeHtml(t.remediation_suggestion || '')}</code>
      <button class="ticket-actions" style="margin-top:8px;" onclick="regenSuggestion('${t.interaction_id}', this)">
        <span>↻ Regenerate with Gemini (tailored to this case)</span>
      </button>
    </div>

    <div class="ticket-actions">
      ${t.status !== 'in_progress' ? `<button onclick="setStatus('${t.interaction_id}','in_progress')">Mark in progress</button>` : ''}
      ${t.status !== 'resolved' ? `<button class="primary" onclick="setStatus('${t.interaction_id}','resolved')">Mark resolved</button>` : ''}
      ${t.status !== 'dismissed' ? `<button onclick="setStatus('${t.interaction_id}','dismissed')">Dismiss</button>` : ''}
      ${t.status !== 'open' ? `<button onclick="setStatus('${t.interaction_id}','open')">Reopen</button>` : ''}
    </div>
  `;
  return el;
}

async function setStatus(iid, status) {
  try {
    await fetch(`/tickets/${iid}/status?status=${status}`, { method: 'PATCH' });
    await Promise.all([refreshSummary(), refreshTickets()]);
  } catch (e) {
    alert('Could not update: ' + e.message);
  }
}

async function regenSuggestion(iid, btn) {
  btn.disabled = true;
  btn.textContent = '⏳ Generating with Gemini Pro…';
  try {
    const r = await fetch(`/tickets/${iid}/suggest`, { method: 'POST' });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const d = await r.json();
    const card = btn.closest('.ticket-card');
    const codeEl = card.querySelector('.ticket-suggestion code');
    codeEl.textContent = d.suggestion;
    btn.textContent = '✓ Updated · regenerate again';
    btn.disabled = false;
  } catch (e) {
    btn.textContent = '⚠ Failed · ' + e.message;
    setTimeout(() => { btn.textContent = '↻ Regenerate with Gemini'; btn.disabled = false; }, 3000);
  }
}

function bindFilters() {
  $$('.filter-btn').forEach((b) => {
    b.onclick = () => {
      $$('.filter-btn').forEach((x) => x.classList.remove('active'));
      b.classList.add('active');
      currentStatus = b.dataset.status || '';
      refreshTickets();
    };
  });
}

function animateNumber(selector, target) {
  const el = $(selector);
  if (!el) return;
  const start = parseFloat((el.textContent || '0').replace(/[^\d.-]/g, '')) || 0;
  const duration = 600;
  const t0 = performance.now();
  function tick(ts) {
    const t = Math.min(1, (ts - t0) / duration);
    const e = 1 - Math.pow(1 - t, 3);
    el.textContent = Math.round(start + (target - start) * e);
    if (t < 1) requestAnimationFrame(tick);
    else el.textContent = target;
  }
  requestAnimationFrame(tick);
}

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Expose for inline onclicks
window.setStatus = setStatus;
window.regenSuggestion = regenSuggestion;
