// ARCA SENTRY — Playground page logic.

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

let sessionId = null;
let currentProfile = 'banking';
let isThinking = false;
let sessionMsgs = 0;
let sessionFlags = 0;

(async function init() {
  await pingHealth();
  await loadSuggested();
  bindEvents();
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

async function loadSuggested() {
  try {
    const r = await fetch('/playground/suggested-prompts');
    const data = await r.json();
    const grid = $('#suggested-grid');
    grid.innerHTML = '';
    data.items.forEach((item) => {
      const card = document.createElement('button');
      card.className = 'suggested-card';
      card.innerHTML = `
        <div class="ico">${item.icon}</div>
        <div class="body">
          <div class="label">${escapeHtml(item.label)}</div>
          <div class="prompt">${escapeHtml(item.prompt.length > 70 ? item.prompt.slice(0, 70) + '…' : item.prompt)}</div>
        </div>
      `;
      card.onclick = () => sendMessage(item.prompt);
      grid.appendChild(card);
    });
  } catch (e) {
    console.error('suggested-prompts failed', e);
  }
}

function bindEvents() {
  $('#chat-input-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const text = $('#chat-input').value.trim();
    if (!text) return;
    sendMessage(text);
  });

  $('#btn-reset').onclick = resetChat;
  $('#profile-select').onchange = (e) => {
    currentProfile = e.target.value;
    $('#chat-actor').textContent = `vulnerable-demo-bot · ${currentProfile}`;
    resetChat();
  };

  $('#alert-close').onclick = hideAlert;
}

function resetChat() {
  sessionId = null;
  $('#chat-messages').innerHTML = `
    <div class="empty-chat">
      <p>Start typing below — or click a suggested attack above.</p>
      <p class="muted small">Every exchange is audited by SENTRY in real time.</p>
    </div>
  `;
  resetSentryPane();
  hideAlert();
}

function resetSentryPane() {
  $$('.playground-agents .agent').forEach((el) => {
    el.classList.remove('active', 'flagged');
    el.querySelector('.agent-state').textContent = 'idle';
  });
  $('#sentry-sub').textContent = 'awaiting interaction…';
  $('#verdict-box').className = 'verdict-box empty';
  $('#verdict-box').innerHTML = '<div class="verdict-empty-msg">No interactions audited yet.</div>';
  $('#findings-stack').innerHTML = '';
}

async function sendMessage(text) {
  if (isThinking) return;
  isThinking = true;

  // Remove empty-state if first message
  const empty = $('#chat-messages .empty-chat');
  if (empty) empty.remove();

  // Append user message
  appendMessage('user', text);

  // Thinking placeholder
  const thinkingId = appendMessage('bot', '…', 'thinking');

  // SENTRY: agents go active
  setAgentsAuditing();
  $('#sentry-sub').textContent = 'auditing…';
  hideAlert();

  $('#chat-input').value = '';
  $('#chat-send').disabled = true;

  try {
    const r = await fetch('/playground/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: text,
        bot_profile: currentProfile,
        session_id: sessionId,
      }),
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const data = await r.json();
    sessionId = data.session_id;

    // Replace thinking with bot reply
    replaceThinking(thinkingId, data.bot_reply, data.severity, data.action_taken);

    // Render SENTRY verdict
    renderVerdict(data);
    renderFindings(data.findings);
    reflectAgentsAfterAudit(data.findings);

    // Alert banner if violation
    if (data.severity === 'critical' || data.severity === 'warning') {
      showAlert(data);
      sessionFlags++;
    }
    sessionMsgs++;
    const ms = document.querySelector('#hero-stat-msgs');
    const fs = document.querySelector('#hero-stat-flags');
    if (ms) ms.textContent = sessionMsgs;
    if (fs) fs.textContent = sessionFlags;
  } catch (e) {
    replaceThinking(thinkingId, `(error: ${e.message})`, 'advisory', 'allow');
    $('#sentry-sub').textContent = 'error · check logs';
  } finally {
    isThinking = false;
    $('#chat-send').disabled = false;
    $('#chat-input').focus();
  }
}

/* ─────────────────── CHAT RENDERING ─────────────────── */

function appendMessage(who, text, extraClass) {
  const wrap = $('#chat-messages');
  const el = document.createElement('div');
  el.className = `msg ${who}${extraClass ? ' ' + extraClass : ''}`;
  el.textContent = text;
  wrap.appendChild(el);
  wrap.scrollTop = wrap.scrollHeight;
  return el;
}

function replaceThinking(el, newText, severity, action) {
  el.classList.remove('thinking');
  el.textContent = newText;
  if (action === 'block') el.classList.add('blocked');
  const meta = document.createElement('div');
  meta.className = 'msg-meta';
  meta.textContent = `severity: ${severity} · action: ${action}`;
  el.appendChild(meta);
  $('#chat-messages').scrollTop = $('#chat-messages').scrollHeight;
}

/* ─────────────────── SENTRY PANE ─────────────────── */

function setAgentsAuditing() {
  $$('.playground-agents .agent').forEach((el) => {
    el.classList.add('active');
    el.classList.remove('flagged');
    el.querySelector('.agent-state').textContent = 'audit';
  });
}
function reflectAgentsAfterAudit(findings) {
  const flagged = new Set((findings || []).map((f) => f.agent));
  $$('.playground-agents .agent').forEach((el) => {
    const n = el.dataset.name;
    el.classList.remove('active');
    if (flagged.has(n)) {
      el.classList.add('flagged');
      el.querySelector('.agent-state').textContent = 'flag';
    } else {
      el.classList.remove('flagged');
      el.querySelector('.agent-state').textContent = 'clean';
    }
  });
}

function renderVerdict(data) {
  const box = $('#verdict-box');
  box.className = `verdict-box ${data.severity}`;
  const header = {
    advisory: '✓ Advisory · logged only',
    warning:  '⚠ Warning · compliance team notified',
    critical: '🚫 Critical · response BLOCKED at gateway',
  }[data.severity];
  box.innerHTML = `
    <div class="verdict-header ${data.severity}">${header}</div>
    <div class="verdict-summary">
      ${data.findings.length} finding${data.findings.length === 1 ? '' : 's'}
      · <a href="/reports/${data.interaction_id}" target="_blank">full report →</a>
    </div>
  `;
  $('#sentry-sub').textContent = `interaction ${data.interaction_id.slice(0, 8)}…`;
}

function renderFindings(findings) {
  const stack = $('#findings-stack');
  stack.innerHTML = '';
  if (!findings || findings.length === 0) {
    stack.innerHTML = '<div class="muted small">No findings — all five agents cleared this interaction.</div>';
    return;
  }
  findings.forEach((f) => {
    const reg = REG_LABELS[f.regulation] || f.regulation;
    const el = document.createElement('div');
    el.className = `finding-mini ${f.regulation}`;
    el.innerHTML = `
      <div class="finding-mini-head">
        <span class="finding-mini-name">${escapeHtml(f.agent)} · ${reg}${f.article ? ' · ' + escapeHtml(f.article) : ''}</span>
        <span class="finding-mini-conf">${(f.confidence * 100).toFixed(0)}%</span>
      </div>
      <div class="finding-mini-rationale">${escapeHtml(f.rationale || '')}</div>
    `;
    stack.appendChild(el);
  });
}

/* ─────────────────── ALERT BANNER ─────────────────── */

function showAlert(data) {
  const banner = $('#alert-banner');
  banner.className = 'alert-banner show ' + data.severity;
  const firstFinding = (data.findings || [])[0];

  let title, detail;
  if (firstFinding) {
    const reg = REG_LABELS[firstFinding.regulation] || firstFinding.regulation;
    title = `${reg.toUpperCase()} VIOLATION DETECTED`;
    if (firstFinding.regulation === 'prompt_injection') {
      title = '🧨 PROMPT INJECTION DETECTED';
    } else if (firstFinding.regulation === 'pii_leak') {
      title = '📤 PII LEAK DETECTED';
    } else if (firstFinding.regulation === 'eu_ai_act') {
      title = '🚨 EU AI ACT VIOLATION';
    } else if (firstFinding.regulation === 'gdpr') {
      title = '⚖ GDPR VIOLATION';
    } else if (firstFinding.regulation === 'dora') {
      title = '🏦 DORA VIOLATION';
    }
    detail = firstFinding.rationale
      ? firstFinding.rationale.slice(0, 200) + (firstFinding.rationale.length > 200 ? '…' : '')
      : 'Multiple agents flagged this interaction.';
  } else {
    title = `${data.severity.toUpperCase()} · ${data.action_taken}`;
    detail = '—';
  }

  let icon = '🚨';
  if (firstFinding) {
    icon = {
      prompt_injection: '🧨',
      pii_leak: '📤',
      eu_ai_act: '🚨',
      gdpr: '⚖',
      dora: '🏦',
    }[firstFinding.regulation] || '🚨';
  }
  $('#alert-icon').textContent = icon;
  $('#alert-title').textContent = title;
  $('#alert-detail').textContent = detail;

  // Auto-hide after 8s
  clearTimeout(window._alertTimer);
  window._alertTimer = setTimeout(hideAlert, 8000);
}

function hideAlert() {
  $('#alert-banner').classList.remove('show');
}

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
