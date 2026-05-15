// ARCA SENTRY — Voice page logic.
// Uses Web Speech API for STT (browser) and the browser's SpeechSynthesis
// API for TTS. Server-side Speechmatics integration is wired but optional
// for the demo (Web Speech is instant and works offline).

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

let recognition = null;
let isRecording = false;
let currentLang = 'en-US';
let lastFinalText = '';
let liveLineEl = null;

(function init() {
  pingHealth();
  setupSpeechRecognition();
  bindEvents();
})();

function pingHealth() {
  fetch('/health').then((r) => {
    if (r.ok) {
      $('#status-text').textContent = 'live';
      document.querySelector('.status-pill').classList.add('live');
    }
  });
}

function setupSpeechRecognition() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) {
    $('#mic-btn').disabled = true;
    $('#mic-btn .mic-label').textContent = 'Not supported';
    $('#transcript-state').textContent = 'Use Chrome or Safari for voice — your browser lacks Web Speech API';
    return;
  }
  recognition = new SR();
  recognition.continuous = false;
  recognition.interimResults = true;
  recognition.maxAlternatives = 1;

  recognition.onstart = () => {
    isRecording = true;
    $('#mic-btn').classList.add('recording');
    $('#mic-btn .mic-label').textContent = 'Listening…';
    $('#transcript-state').textContent = '● recording';
    $('#transcript-state').classList.add('live');
    appendUserLine('', true);
  };

  recognition.onresult = (event) => {
    let interim = '';
    let final = '';
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const r = event.results[i];
      if (r.isFinal) final += r[0].transcript;
      else interim += r[0].transcript;
    }
    if (liveLineEl) {
      liveLineEl.textContent = (final + interim).trim() || '…';
    }
    if (final) {
      lastFinalText = final.trim();
    }
  };

  recognition.onerror = (e) => {
    $('#transcript-state').textContent = 'mic error: ' + e.error;
    $('#transcript-state').classList.remove('live');
    isRecording = false;
    $('#mic-btn').classList.remove('recording');
    $('#mic-btn .mic-label').textContent = 'Hold to talk';
  };

  recognition.onend = async () => {
    isRecording = false;
    $('#mic-btn').classList.remove('recording');
    $('#mic-btn .mic-label').textContent = 'Hold to talk';
    $('#transcript-state').classList.remove('live');

    if (liveLineEl && lastFinalText) {
      liveLineEl.classList.remove('partial');
      liveLineEl.textContent = lastFinalText;
    }

    if (!lastFinalText) {
      $('#transcript-state').textContent = 'no speech detected';
      return;
    }

    $('#transcript-state').textContent = 'auditing…';
    await processUtterance(lastFinalText);
    lastFinalText = '';
    liveLineEl = null;
  };
}

function bindEvents() {
  const mic = $('#mic-btn');
  mic.addEventListener('click', () => {
    if (!recognition) return;
    if (isRecording) {
      recognition.stop();
    } else {
      recognition.lang = currentLang;
      try {
        recognition.start();
      } catch (e) {
        $('#transcript-state').textContent = 'cannot start: ' + e.message;
      }
    }
  });

  $('#lang-select').addEventListener('change', (e) => {
    currentLang = e.target.value;
  });

  $('#alert-close').onclick = () => $('#alert-banner').classList.remove('show');
}

function appendUserLine(text, partial) {
  const stream = $('#transcript-stream');
  // remove empty state
  const empty = stream.querySelector('.empty-chat');
  if (empty) empty.remove();

  const el = document.createElement('div');
  el.className = 'transcript-line user' + (partial ? ' partial' : '');
  el.textContent = text || '…';
  const meta = document.createElement('div');
  meta.className = 'meta';
  meta.textContent = `user · ${currentLang}`;
  el.prepend(meta);
  stream.appendChild(el);
  stream.scrollTop = stream.scrollHeight;
  if (partial) liveLineEl = el.lastChild;  // the text node after meta
  // ensure we keep a reference to the text container, not the meta
  if (partial) {
    const textNode = document.createElement('span');
    textNode.textContent = '…';
    el.appendChild(textNode);
    liveLineEl = textNode;
  }
}

function appendBotLine(text, severity, action) {
  const stream = $('#transcript-stream');
  const el = document.createElement('div');
  el.className = 'transcript-line bot';
  const meta = document.createElement('div');
  meta.className = 'meta';
  meta.textContent = `bot · severity: ${severity} · action: ${action}`;
  el.appendChild(meta);
  const txt = document.createElement('div');
  txt.textContent = text;
  el.appendChild(txt);
  stream.appendChild(el);
  stream.scrollTop = stream.scrollHeight;
}

async function processUtterance(userText) {
  // Animate agents auditing
  $$('.playground-agents .agent').forEach((el) => {
    el.classList.add('active');
    el.classList.remove('flagged');
    el.querySelector('.agent-state').textContent = 'audit';
  });
  $('#sentry-sub').textContent = 'auditing…';

  try {
    // Hit playground/chat with channel forced to voice via metadata
    const r = await fetch('/playground/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: userText, bot_profile: 'banking' }),
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const data = await r.json();

    appendBotLine(data.bot_reply, data.severity, data.action_taken);

    // TTS the bot reply (if available)
    speakText(data.bot_reply, currentLang);

    // Reflect agents
    const flagged = new Set((data.findings || []).map((f) => f.agent));
    $$('.playground-agents .agent').forEach((el) => {
      el.classList.remove('active');
      const n = el.dataset.name;
      if (flagged.has(n)) {
        el.classList.add('flagged');
        el.querySelector('.agent-state').textContent = 'flag';
      } else {
        el.querySelector('.agent-state').textContent = 'clean';
      }
    });

    renderVerdict(data);
    renderFindings(data.findings);

    if (data.severity === 'critical' || data.severity === 'warning') {
      showAlert(data);
    }
    $('#transcript-state').textContent = 'tap mic to start';
  } catch (e) {
    appendBotLine('(error: ' + e.message + ')', 'advisory', 'allow');
    $('#sentry-sub').textContent = 'error · check logs';
    $('#transcript-state').textContent = 'tap mic to start';
  }
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
  $('#sentry-sub').textContent = `voice interaction ${data.interaction_id.slice(0, 8)}…`;
}

function renderFindings(findings) {
  const stack = $('#findings-stack');
  stack.innerHTML = '';
  if (!findings || findings.length === 0) {
    stack.innerHTML = '<div class="muted small">No findings.</div>';
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

function showAlert(data) {
  const banner = $('#alert-banner');
  banner.className = 'alert-banner show ' + data.severity;
  const first = (data.findings || [])[0];
  let icon = '🚨', title = `${data.severity.toUpperCase()} · ${data.action_taken}`, detail = '';
  if (first) {
    const reg = REG_LABELS[first.regulation] || first.regulation;
    title = `${reg.toUpperCase()} DETECTED`;
    icon = { prompt_injection: '🧨', pii_leak: '📤', eu_ai_act: '🚨', gdpr: '⚖', dora: '🏦' }[first.regulation] || '🚨';
    detail = (first.rationale || '').slice(0, 200);
  }
  $('#alert-icon').textContent = icon;
  $('#alert-title').textContent = title;
  $('#alert-detail').textContent = detail;
  clearTimeout(window._alertTimer);
  window._alertTimer = setTimeout(() => banner.classList.remove('show'), 8000);
}

function speakText(text, lang) {
  if (!window.speechSynthesis) return;
  try {
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = lang;
    utter.rate = 1.0;
    utter.pitch = 1.0;
    // try to pick a voice that matches lang
    const voices = window.speechSynthesis.getVoices();
    const match = voices.find((v) => v.lang === lang) || voices.find((v) => v.lang.startsWith(lang.slice(0, 2)));
    if (match) utter.voice = match;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utter);
  } catch (e) {
    console.warn('TTS failed', e);
  }
}

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
