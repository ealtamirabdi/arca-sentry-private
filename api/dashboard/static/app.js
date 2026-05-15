// ARCA SENTRY — Compliance Operations Center
// Live dashboard logic. Vanilla JS + Chart.js (CDN).

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
const REG_COLORS = {
  eu_ai_act: '#c9a227',
  gdpr: '#b00020',
  dora: '#1f4e8c',
  pii_leak: '#5e2a8e',
  prompt_injection: '#495057',
};
const CHANNEL_ICONS = { text: '💬', voice: '🎙', api: '🔌' };

const LANG_TAG = {
  credit_denial: 'EN',
  credit_denial_es: 'ES',
  pii_leak: 'EN',
  prompt_injection: 'EN',
  dora_incident: 'EN',
  voice_no_disclosure: 'IT',
};

let chartDonut, chartTimeline, chartRegs;
let currentFilter = 'all';
let lastSeq = 0;

/* ════════════════════════════════════════════════════════
   INITIAL PAINT
   ════════════════════════════════════════════════════════ */
(async function init() {
  await pingHealth();
  await loadScenarios();
  initCharts();
  await refreshAll();
  setInterval(refreshAll, 3000);
  bindFilterButtons();
  bindDrawer();
})();

/* ─────────────────── HEALTH ─────────────────── */
async function pingHealth() {
  try {
    const r = await fetch('/health');
    if (r.ok) {
      $('#status-text').textContent = 'live';
      $('#status-meta').textContent = window.location.host;
      document.querySelector('.status-pill').classList.add('live');
    }
  } catch {
    $('#status-text').textContent = 'offline';
  }
}

/* ─────────────────── DEMO SCENARIOS ─────────────────── */
async function loadScenarios() {
  const r = await fetch('/demo/scenarios');
  const data = await r.json();
  const c = $('#scenarios');
  c.innerHTML = '';
  data.scenarios.forEach((name) => {
    const btn = document.createElement('button');
    btn.className = 'scenario-btn';
    const lang = LANG_TAG[name] || 'EN';
    btn.innerHTML = `${name.replace(/_/g, ' ')} <span class="lang-badge">${lang}</span>`;
    btn.onclick = () => runScenario(name, btn);
    c.appendChild(btn);
  });
}

async function runScenario(name, btn) {
  btn.disabled = true;
  setAgentsAuditing();
  try {
    const r = await fetch('/demo/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scenario: name }),
    });
    const decision = await r.json();
    reflectAgentsAfterAudit(decision.findings || []);
    setTimeout(refreshAll, 200);
    // open drawer with the freshly created interaction
    setTimeout(() => openDrawer(decision.interaction_id), 700);
  } catch (e) {
    console.error(e);
  } finally {
    btn.disabled = false;
  }
}

function setAgentsAuditing() {
  $$('.agent').forEach((el) => {
    el.classList.add('active');
    el.classList.remove('flagged');
    el.querySelector('.agent-state').textContent = 'auditing…';
  });
}
function reflectAgentsAfterAudit(findings) {
  const flagged = new Set(findings.map((f) => f.agent));
  $$('.agent').forEach((el) => {
    const n = el.dataset.name;
    el.classList.remove('active');
    if (flagged.has(n)) {
      el.classList.add('flagged');
      el.querySelector('.agent-state').textContent = 'flagged';
    } else {
      el.classList.remove('flagged');
      el.querySelector('.agent-state').textContent = 'clean';
    }
  });
  setTimeout(() => {
    $$('.agent').forEach((el) => {
      el.classList.remove('flagged');
      el.querySelector('.agent-state').textContent = 'idle';
    });
  }, 6000);
}

/* ─────────────────── CHARTS ─────────────────── */

function initCharts() {
  Chart.defaults.font.family = "'Inter', sans-serif";
  Chart.defaults.font.size = 11;
  Chart.defaults.color = '#585249';

  chartDonut = new Chart($('#chart-donut'), {
    type: 'doughnut',
    data: {
      labels: ['Compliant', 'Warning', 'Critical'],
      datasets: [{
        data: [1, 0, 0],
        backgroundColor: ['#2d7a3a', '#c98a00', '#b00020'],
        borderColor: '#fff', borderWidth: 3,
      }],
    },
    options: {
      cutout: '70%',
      plugins: {
        legend: { position: 'bottom', labels: { padding: 12, font: { size: 11 } } },
      },
      maintainAspectRatio: false,
    },
  });

  chartTimeline = new Chart($('#chart-timeline'), {
    type: 'line',
    data: {
      labels: [],
      datasets: [
        { label: 'Interactions', data: [], borderColor: '#c9a227',
          backgroundColor: 'rgba(201,162,39,0.1)', tension: 0.35, fill: true, borderWidth: 2 },
        { label: 'Warnings', data: [], borderColor: '#c98a00',
          backgroundColor: 'transparent', tension: 0.35, borderWidth: 2 },
        { label: 'Critical', data: [], borderColor: '#b00020',
          backgroundColor: 'transparent', tension: 0.35, borderWidth: 2 },
      ],
    },
    options: {
      maintainAspectRatio: false,
      scales: {
        y: { beginAtZero: true, grid: { color: '#e7e2cf' }, ticks: { precision: 0 } },
        x: { grid: { display: false } },
      },
      plugins: { legend: { position: 'top', align: 'end' } },
    },
  });

  chartRegs = new Chart($('#chart-regulations'), {
    type: 'bar',
    data: {
      labels: [],
      datasets: [{ data: [], backgroundColor: [], borderWidth: 0 }],
    },
    options: {
      maintainAspectRatio: false,
      indexAxis: 'y',
      scales: {
        x: { beginAtZero: true, grid: { color: '#e7e2cf' }, ticks: { precision: 0 } },
        y: { grid: { display: false } },
      },
      plugins: { legend: { display: false } },
    },
  });
}

/* ─────────────────── REFRESH LOOP ─────────────────── */

async function refreshAll() {
  await Promise.all([refreshKPIs(), refreshTimeline(), refreshRegs(), refreshFeed()]);
}

async function refreshKPIs() {
  try {
    const r = await fetch('/stats/summary');
    if (!r.ok) return;
    const d = await r.json();
    $('#kpi-compliance').textContent = d.compliance_rate.toFixed(1) + '%';
    $('#kpi-critical').textContent = d.violations.critical;
    $('#kpi-warning').textContent = d.violations.warning;
    $('#kpi-total').textContent = d.total_interactions;
    $('#kpi-rate').textContent = d.interactions_per_minute;

    chartDonut.data.datasets[0].data = [
      Math.max(0, d.total_interactions - d.violations.total_flagged),
      d.violations.warning,
      d.violations.critical,
    ];
    chartDonut.update('none');
  } catch (e) { /* keep last values */ }
}

async function refreshTimeline() {
  try {
    const r = await fetch('/stats/timeline?hours=24&buckets=24');
    if (!r.ok) return;
    const d = await r.json();
    chartTimeline.data.labels = d.labels;
    chartTimeline.data.datasets[0].data = d.interactions;
    chartTimeline.data.datasets[1].data = d.warnings;
    chartTimeline.data.datasets[2].data = d.criticals;
    chartTimeline.update('none');
  } catch {}
}

async function refreshRegs() {
  try {
    const r = await fetch('/stats/by_regulation');
    if (!r.ok) return;
    const d = await r.json();
    chartRegs.data.labels = d.items.map((i) => REG_LABELS[i.regulation] || i.regulation);
    chartRegs.data.datasets[0].data = d.items.map((i) => i.count);
    chartRegs.data.datasets[0].backgroundColor = d.items.map((i) => REG_COLORS[i.regulation] || '#888');
    chartRegs.update('none');
  } catch {}
}

async function refreshFeed() {
  try {
    const r = await fetch('/stats/recent?limit=40');
    if (!r.ok) return;
    const d = await r.json();
    renderFeed(d.items);
  } catch {}
}

function renderFeed(items) {
  const body = $('#feed-body');
  body.innerHTML = '';
  const filtered = items.filter((i) =>
    currentFilter === 'all' ? true : i.severity === currentFilter
  );

  if (filtered.length === 0) {
    body.innerHTML = '<tr class="empty-row"><td colspan="8">No events match the current filter.</td></tr>';
    return;
  }

  filtered.forEach((i) => {
    const tr = document.createElement('tr');
    tr.onclick = () => openDrawer(i.interaction_id);

    const time = new Date(i.created_at);
    const chips = (i.findings || []).map((f) =>
      `<span class="reg-chip ${f.regulation}">${REG_LABELS[f.regulation] || f.regulation}</span>`
    ).join('') || '<span class="muted">—</span>';

    const channelIcon = CHANNEL_ICONS[i.channel] || '🔌';

    tr.innerHTML = `
      <td class="time-cell">${time.toLocaleTimeString('en-GB')}</td>
      <td><span class="sev-pill ${i.severity}">${i.severity}</span></td>
      <td><span class="channel-icon">${channelIcon}</span>${i.channel}</td>
      <td class="actor-cell">${escapeHtml(i.actor || '')}</td>
      <td class="snippet-cell">${escapeHtml(i.response_preview || '')}</td>
      <td>${chips}</td>
      <td class="action-cell ${i.action_taken}">${i.action_taken}</td>
      <td class="arrow-cell">→</td>
    `;
    body.appendChild(tr);
  });
}

/* ─────────────────── FILTER BUTTONS ─────────────────── */

function bindFilterButtons() {
  $$('.filter-btn').forEach((btn) => {
    btn.onclick = () => {
      $$('.filter-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      currentFilter = btn.dataset.filter;
      refreshFeed();
    };
  });
}

/* ─────────────────── DRAWER ─────────────────── */

function bindDrawer() {
  $('#drawer-backdrop').onclick = closeDrawer;
  $('#drawer-close').onclick = closeDrawer;
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeDrawer();
  });
}

function openDrawer(iid) {
  $('#drawer').classList.add('open');
  $('#drawer-backdrop').classList.add('open');
  $('#drawer-iid').textContent = iid;
  $('#drawer-body').innerHTML = '<div class="muted">Loading audit detail…</div>';
  loadDrawerDetail(iid);
}
function closeDrawer() {
  $('#drawer').classList.remove('open');
  $('#drawer-backdrop').classList.remove('open');
}

async function loadDrawerDetail(iid) {
  try {
    const r = await fetch(`/reports/${iid}.json`);
    if (!r.ok) {
      $('#drawer-body').innerHTML = `<div class="muted">Could not load report (HTTP ${r.status}).</div>`;
      return;
    }
    const d = await r.json();

    let html = '';

    // verdict
    html += `
      <div class="drawer-verdict ${d.severity}">
        <div class="label">${verdictHeader(d.severity)}</div>
        <div class="summary">${escapeHtml(d.summary || 'No summary.')}</div>
      </div>
    `;

    // interaction transcript
    const hasReq = (d.request || "").trim().length > 0;
    const hasResp = (d.response || "").trim().length > 0;
    if (hasReq || hasResp) {
      html += `
        <div class="drawer-section">
          <h3>Conversation transcript</h3>
          <div class="turn user">
            <div class="turn-role">User · ${escapeHtml(d.channel || 'text')}</div>
            <div>${escapeHtml(d.request || '(no message)')}</div>
          </div>
          <div class="turn ai">
            <div class="turn-role">${escapeHtml(d.actor || 'AI')}</div>
            <div>${escapeHtml(d.response || '(no message)')}</div>
          </div>
        </div>
      `;
    } else {
      html += `
        <div class="drawer-section">
          <h3>Conversation transcript</h3>
          <div class="muted">This interaction was logged without a transcript
          (likely from a pre-launch test before the playground existed).</div>
        </div>
      `;
    }

    // findings
    if ((d.findings || []).length > 0) {
      html += `<div class="drawer-section"><h3>Auditor findings (${d.findings.length})</h3>`;
      d.findings.forEach((f) => {
        const reg = REG_LABELS[f.regulation] || f.regulation;
        html += `
          <div class="finding-card">
            <div class="finding-head">
              <span class="finding-agent">${escapeHtml(f.agent)}</span>
              <span class="finding-conf">conf ${(f.confidence * 100).toFixed(0)}%</span>
            </div>
            <div style="font-size:11px;margin-bottom:6px;">
              <span class="reg-chip ${f.regulation}">${reg}</span>
              ${f.article ? `<span class="muted">${escapeHtml(f.article)}</span>` : ''}
            </div>
            <div class="finding-rationale">${escapeHtml(f.rationale || '')}</div>
          </div>
        `;
      });
      html += '</div>';
    } else {
      html += `<div class="drawer-section"><h3>Auditor findings</h3>
               <div class="muted">No findings — every agent cleared this interaction.</div></div>`;
    }

    // long report (Gemini)
    if (d.long_report && d.long_report.length > 30) {
      html += `
        <div class="drawer-section">
          <h3>Compliance report — Gemini Pro</h3>
          <div class="report-content">${escapeHtml(d.long_report)}</div>
        </div>
      `;
    }

    // provenance
    if (d.event_hash) {
      html += `
        <div class="drawer-section">
          <h3>Tamper-evident event hash · SHA-256</h3>
          <div class="event-hash">${escapeHtml(d.event_hash)}</div>
        </div>
      `;
    }

    // download links
    html += `
      <div class="drawer-links">
        <a href="/reports/${iid}.pdf" target="_blank">Download PDF</a>
        <a href="/reports/${iid}.json" target="_blank">Raw JSON</a>
        <a href="/reports/${iid}" target="_blank">HTML view</a>
      </div>
    `;

    $('#drawer-body').innerHTML = html;
  } catch (e) {
    $('#drawer-body').innerHTML = `<div class="muted">Error loading: ${escapeHtml(e.message)}</div>`;
  }
}

function verdictHeader(sev) {
  return {
    advisory: 'Advisory · logged only',
    warning:  'Warning · compliance team notified',
    critical: 'Critical · response BLOCKED at gateway',
  }[sev] || sev;
}

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
