// ARCA SENTRY — Dashboard logic (Compliance Operations Center)
// Vanilla JS + Chart.js (CDN). Includes count-up, sparklines, gradients,
// custom tooltips, loading skeletons, toast notifications, illustrated empty states.

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
  eu_ai_act: '#2563eb',
  gdpr: '#b91c1c',
  dora: '#0369a1',
  pii_leak: '#6d28d9',
  prompt_injection: '#334155',
};
const CHANNEL_ICONS = { text: '💬', voice: '🎙', api: '🔌' };
const LANG_TAG = {
  credit_denial: 'EN', credit_denial_es: 'ES', pii_leak: 'EN',
  prompt_injection: 'EN', dora_incident: 'EN', voice_no_disclosure: 'IT',
};

let chartDonut, chartTimeline, chartRegs;
let sparkCompliance;
let currentFilter = 'all';
let knownSeqs = new Set();   // for new-critical toast detection
let firstLoadDone = false;

/* ════════ INIT ════════ */
(async function init() {
  injectSkeletons();
  injectToastContainer();
  await pingHealth();
  await loadScenarios();
  initCharts();
  await refreshAll();
  setInterval(refreshAll, 3000);
  bindFilterButtons();
  bindDrawer();
})();

/* ════════ SKELETONS ════════ */
function injectSkeletons() {
  // Initial skeleton state for KPI values
  ['#kpi-compliance', '#kpi-critical', '#kpi-warning', '#kpi-total'].forEach((sel) => {
    const el = $(sel);
    if (el) el.classList.add('skeleton');
  });
}
function removeSkeletons() {
  $$('.skeleton').forEach((el) => el.classList.remove('skeleton'));
}

/* ════════ TOAST ════════ */
function injectToastContainer() {
  if ($('.toast-container')) return;
  const c = document.createElement('div');
  c.className = 'toast-container';
  document.body.appendChild(c);
}
function showToast({ title, msg, type = 'critical', timeout = 5500 }) {
  const wrap = $('.toast-container');
  if (!wrap) return;
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  const icons = { critical: '🚨', warning: '⚠️', success: '✓', info: 'ℹ️' };
  t.innerHTML = `
    <span class="toast-icon">${icons[type] || '🔔'}</span>
    <div class="toast-body">
      <div class="toast-title">${escapeHtml(title)}</div>
      <div class="toast-msg">${escapeHtml(msg)}</div>
    </div>
    <button class="toast-close" aria-label="close">✕</button>
  `;
  wrap.appendChild(t);
  const close = () => {
    t.classList.add('toast-leaving');
    setTimeout(() => t.remove(), 240);
  };
  t.querySelector('.toast-close').onclick = close;
  setTimeout(close, timeout);
}

/* ════════ HEALTH ════════ */
async function pingHealth() {
  try {
    const r = await fetch('/health');
    if (r.ok) {
      $('#status-text').textContent = window.t ? window.t('status.live') : 'live';
      $('#status-meta').textContent = window.location.host;
      document.querySelector('.status-pill').classList.add('live');
    }
  } catch {
    $('#status-text').textContent = window.t ? window.t('status.offline') : 'offline';
  }
}

/* ════════ SCENARIOS ════════ */
async function loadScenarios() {
  try {
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
  } catch (e) {}
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

/* ════════ CHARTS ════════ */
function initCharts() {
  Chart.defaults.font.family = "'Inter', sans-serif";
  Chart.defaults.font.size = 11;
  Chart.defaults.color = '#5a6b85';

  // ── Donut compliance overview
  const donutCtx = $('#chart-donut');
  chartDonut = new Chart(donutCtx, {
    type: 'doughnut',
    data: {
      labels: ['Compliant', 'Warning', 'Critical'],
      datasets: [{
        data: [1, 0, 0],
        backgroundColor: ['#15803d', '#b45309', '#b91c1c'],
        borderColor: '#fff',
        borderWidth: 3,
        hoverOffset: 8,
      }],
    },
    options: {
      cutout: '70%',
      plugins: {
        legend: { position: 'bottom', labels: { padding: 14, usePointStyle: true, pointStyle: 'circle' } },
        tooltip: customTooltip(),
      },
      maintainAspectRatio: false,
      animation: { animateScale: true, duration: 700, easing: 'easeOutQuart' },
    },
  });

  // ── Timeline with gradient fills
  const tlCtx = $('#chart-timeline').getContext('2d');
  const gradInteract = tlCtx.createLinearGradient(0, 0, 0, 220);
  gradInteract.addColorStop(0, 'rgba(37, 99, 235, 0.32)');
  gradInteract.addColorStop(1, 'rgba(37, 99, 235, 0.0)');

  chartTimeline = new Chart($('#chart-timeline'), {
    type: 'line',
    data: {
      labels: [],
      datasets: [
        { label: 'Interactions', data: [], borderColor: '#2563eb', backgroundColor: gradInteract,
          tension: 0.4, fill: true, borderWidth: 2, pointRadius: 0, pointHoverRadius: 4 },
        { label: 'Warnings', data: [], borderColor: '#b45309', backgroundColor: 'transparent',
          tension: 0.4, borderWidth: 2, pointRadius: 0, pointHoverRadius: 4 },
        { label: 'Critical', data: [], borderColor: '#b91c1c', backgroundColor: 'transparent',
          tension: 0.4, borderWidth: 2, pointRadius: 0, pointHoverRadius: 4 },
      ],
    },
    options: {
      maintainAspectRatio: false,
      interaction: { intersect: false, mode: 'index' },
      scales: {
        y: { beginAtZero: true, grid: { color: '#d8e0ed' }, ticks: { precision: 0, font: { size: 10 } } },
        x: { grid: { display: false }, ticks: { font: { size: 10 }, maxTicksLimit: 8 } },
      },
      plugins: {
        legend: { position: 'top', align: 'end', labels: { boxWidth: 8, boxHeight: 8, padding: 12 } },
        tooltip: customTooltip(),
      },
      animation: { duration: 600, easing: 'easeOutCubic' },
    },
  });

  // ── Bar of regulations
  chartRegs = new Chart($('#chart-regulations'), {
    type: 'bar',
    data: {
      labels: [],
      datasets: [{ data: [], backgroundColor: [], borderWidth: 0, borderRadius: 6, maxBarThickness: 24 }],
    },
    options: {
      maintainAspectRatio: false,
      indexAxis: 'y',
      scales: {
        x: { beginAtZero: true, grid: { color: '#d8e0ed' }, ticks: { precision: 0, font: { size: 10 } } },
        y: { grid: { display: false }, ticks: { font: { size: 11, weight: '500' } } },
      },
      plugins: { legend: { display: false }, tooltip: customTooltip() },
      animation: { duration: 600 },
    },
  });

  // ── KPI sparkline (compliance over time)
  const sparkCtx = $('#spark-compliance');
  if (sparkCtx) {
    const sg = sparkCtx.getContext('2d').createLinearGradient(0, 0, 0, 40);
    sg.addColorStop(0, 'rgba(37, 99, 235, 0.4)');
    sg.addColorStop(1, 'rgba(37, 99, 235, 0)');
    sparkCompliance = new Chart(sparkCtx, {
      type: 'line',
      data: { labels: [], datasets: [{ data: [], borderColor: '#2563eb', backgroundColor: sg, tension: 0.4, fill: true, borderWidth: 1.5, pointRadius: 0 }] },
      options: {
        plugins: { legend: { display: false }, tooltip: { enabled: false } },
        scales: { x: { display: false }, y: { display: false } },
        maintainAspectRatio: false,
        animation: { duration: 500 },
      },
    });
  }
}

function customTooltip() {
  return {
    backgroundColor: 'rgba(11, 26, 51, 0.95)',
    titleColor: '#fff',
    titleFont: { size: 11, weight: '700' },
    bodyColor: '#cfdcef',
    bodyFont: { size: 11 },
    padding: 10,
    cornerRadius: 6,
    displayColors: true,
    boxPadding: 4,
  };
}

/* ════════ REFRESH LOOP ════════ */
async function refreshAll() {
  await Promise.all([refreshKPIs(), refreshTimeline(), refreshRegs(), refreshFeed()]);
  firstLoadDone = true;
}

async function refreshKPIs() {
  try {
    const r = await fetch('/stats/summary');
    if (!r.ok) return;
    const d = await r.json();
    removeSkeletons();
    animateNumber('#kpi-compliance', d.compliance_rate, { decimals: 1, suffix: '%' });
    animateNumber('#kpi-critical', d.violations.critical);
    animateNumber('#kpi-warning', d.violations.warning);
    animateNumber('#kpi-total', d.total_interactions);
    $('#kpi-rate').textContent = d.interactions_per_minute;

    chartDonut.data.datasets[0].data = [
      Math.max(0, d.total_interactions - d.violations.total_flagged),
      d.violations.warning,
      d.violations.critical,
    ];
    chartDonut.update('none');
  } catch (e) {}
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

    // Spark uses inverse-compliance: lower interactions == higher line
    if (sparkCompliance) {
      const total = d.interactions.reduce((a, b) => a + b, 0);
      const totalFlag = d.warnings.reduce((a, b) => a + b, 0) + d.criticals.reduce((a, b) => a + b, 0);
      // simple compliance per bucket
      const series = d.interactions.map((n, i) => {
        if (n === 0) return null;
        const flagged = (d.warnings[i] || 0) + (d.criticals[i] || 0);
        return Math.round((1 - flagged / n) * 100);
      }).map((v) => v == null ? 100 : v);
      sparkCompliance.data.labels = d.labels;
      sparkCompliance.data.datasets[0].data = series;
      sparkCompliance.update('none');
    }
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
    detectNewCriticals(d.items);
    renderFeed(d.items);
  } catch {}
}

function detectNewCriticals(items) {
  if (!firstLoadDone) {
    items.forEach((i) => knownSeqs.add(i.seq));
    return;
  }
  items.forEach((i) => {
    if (!knownSeqs.has(i.seq) && (i.severity === 'critical' || i.severity === 'warning')) {
      knownSeqs.add(i.seq);
      const first = (i.findings || [])[0];
      const reg = first ? (REG_LABELS[first.regulation] || first.regulation) : 'Unknown';
      showToast({
        title: `${i.severity.toUpperCase()} · ${reg}`,
        msg: i.response_preview || 'New violation detected.',
        type: i.severity === 'critical' ? 'critical' : 'warning',
      });
    } else {
      knownSeqs.add(i.seq);
    }
  });
}

function renderFeed(items) {
  const body = $('#feed-body');
  body.innerHTML = '';
  const filtered = items.filter((i) => currentFilter === 'all' ? true : i.severity === currentFilter);

  if (filtered.length === 0) {
    body.innerHTML = `
      <tr class="empty-row"><td colspan="8">
        <div class="empty-state">
          ${emptyStateSvg()}
          <div class="empty-state-title">No events ${currentFilter !== 'all' ? 'at ' + currentFilter + ' level' : 'yet'}</div>
          <div class="empty-state-desc">${currentFilter === 'all'
            ? 'Click any demo scenario above to send a synthetic interaction through the audit pipeline.'
            : 'Switch the filter to "All" or trigger a violation from the Playground.'}</div>
        </div>
      </td></tr>
    `;
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

function emptyStateSvg() {
  return `
  <svg class="empty-state-svg" viewBox="0 0 88 88" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="44" cy="44" r="36" stroke="#2563eb" stroke-width="2" stroke-dasharray="4 6" opacity="0.4"/>
    <path d="M30 44l10 10 18-22" stroke="#2563eb" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" opacity="0.85"/>
    <circle cx="44" cy="44" r="44" fill="#2563eb" opacity="0.04"/>
  </svg>`;
}

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

/* ════════ DRAWER ════════ */
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
  $('#drawer-body').innerHTML = '<div class="muted" style="padding:20px;text-align:center;">Loading audit detail…</div>';
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
    html += `<div class="drawer-verdict ${d.severity}">
      <div class="label">${verdictHeader(d.severity)}</div>
      <div class="summary">${escapeHtml(d.summary || 'No summary.')}</div>
    </div>`;

    const hasReq = (d.request || '').trim().length > 0;
    const hasResp = (d.response || '').trim().length > 0;
    if (hasReq || hasResp) {
      html += `<div class="drawer-section">
        <h3>${window.t ? window.t('drawer.section.transcript') : 'Conversation transcript'}</h3>
        <div class="turn user">
          <div class="turn-role">${window.t ? window.t('drawer.role.user') : 'User'} · ${escapeHtml(d.channel || 'text')}</div>
          <div>${escapeHtml(d.request || '(no message)')}</div>
        </div>
        <div class="turn ai">
          <div class="turn-role">${escapeHtml(d.actor || 'AI')}</div>
          <div>${escapeHtml(d.response || '(no message)')}</div>
        </div>
      </div>`;
    }

    if ((d.findings || []).length > 0) {
      html += `<div class="drawer-section"><h3>${window.t ? window.t('drawer.section.findings') : 'Auditor findings'} (${d.findings.length})</h3>`;
      d.findings.forEach((f) => {
        const reg = REG_LABELS[f.regulation] || f.regulation;
        html += `<div class="finding-card">
          <div class="finding-head">
            <span class="finding-agent">${escapeHtml(f.agent)}</span>
            <span class="finding-conf">conf ${(f.confidence * 100).toFixed(0)}%</span>
          </div>
          <div style="font-size:11px;margin-bottom:6px;">
            <span class="reg-chip ${f.regulation}">${reg}</span>
            ${f.article ? `<span class="muted">${escapeHtml(f.article)}</span>` : ''}
          </div>
          <div class="finding-rationale">${escapeHtml(f.rationale || '')}</div>
        </div>`;
      });
      html += '</div>';
    }

    if (d.long_report && d.long_report.length > 30) {
      html += `<div class="drawer-section">
        <h3>${window.t ? window.t('drawer.section.report') : 'Compliance report — Gemini Pro'}</h3>
        <div class="report-content">${escapeHtml(d.long_report)}</div>
      </div>`;
    }

    if (d.event_hash) {
      html += `<div class="drawer-section">
        <h3>${window.t ? window.t('drawer.section.hash') : 'Tamper-evident event hash · SHA-256'}</h3>
        <div class="event-hash">${escapeHtml(d.event_hash)}</div>
      </div>`;
    }

    html += `<div class="drawer-links">
      <a href="/reports/${iid}.pdf" target="_blank">${window.t ? window.t('drawer.download_pdf') : 'Download PDF'}</a>
      <a href="/reports/${iid}.json" target="_blank">${window.t ? window.t('drawer.raw_json') : 'Raw JSON'}</a>
      <a href="/reports/${iid}" target="_blank">${window.t ? window.t('drawer.html_view') : 'HTML view'}</a>
    </div>`;

    $('#drawer-body').innerHTML = html;
  } catch (e) {
    $('#drawer-body').innerHTML = `<div class="muted">Error: ${escapeHtml(e.message)}</div>`;
  }
}

function verdictHeader(sev) {
  return window.t
    ? window.t(`verdict.${sev}`)
    : { advisory: 'Advisory · logged only', warning: 'Warning · compliance team notified', critical: 'Critical · response BLOCKED at gateway' }[sev] || sev;
}

/* ════════ ANIMATIONS ════════ */
function animateNumber(selector, target, opts = {}) {
  const el = document.querySelector(selector);
  if (!el) return;
  el.classList.remove('skeleton');
  const decimals = opts.decimals || 0;
  const suffix = opts.suffix || '';
  const start = parseFloat((el.textContent || '0').replace(/[^\d.-]/g, '')) || 0;
  const duration = 700;
  const startTs = performance.now();
  function tick(ts) {
    const t = Math.min(1, (ts - startTs) / duration);
    const ease = 1 - Math.pow(1 - t, 3);
    const v = start + (target - start) * ease;
    el.textContent = v.toFixed(decimals) + suffix;
    if (t < 1) requestAnimationFrame(tick);
    else el.textContent = target.toFixed(decimals) + suffix;
  }
  requestAnimationFrame(tick);
}

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
