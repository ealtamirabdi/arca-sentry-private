// ARCA SENTRY — Voice page.
// Uses Web Speech API for STT + a Web Audio analyser to visualize the mic
// level so the user has clear visual feedback that audio is being captured.
// SpeechSynthesis is used to read the bot's reply back.

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
let lastInterimText = "";
let lastFinalText = '';
let liveTextNode = null;

// Web Audio analyser for mic level visualization
let audioCtx = null;
let analyser = null;
let micStream = null;
let levelRAF = 0;
let micGranted = false;

(function init() {
  pingHealth();
  setupSpeechRecognition();
  bindEvents();
  ensureLevelMeter();
})();

function pingHealth() {
  fetch('/health').then((r) => {
    if (r.ok) {
      $('#status-text').textContent = 'live';
      document.querySelector('.status-pill').classList.add('live');
    }
  });
}

/* ───────────────────────── Mic level meter UI injection ───────────────────────── */

function ensureLevelMeter() {
  // Inject a level meter inside the transcript head if not already there.
  if ($('#mic-level-wrap')) return;
  const head = document.querySelector('.transcript-head');
  if (!head) return;
  const wrap = document.createElement('div');
  wrap.id = 'mic-level-wrap';
  wrap.className = 'mic-level-wrap';
  wrap.innerHTML = `
    <span class="mic-level-label">mic</span>
    <div class="mic-level-bar"><div class="mic-level-fill" id="mic-level-fill"></div></div>
    <span class="mic-level-state" id="mic-level-state">off</span>
  `;
  head.appendChild(wrap);
}

/* ───────────────────────── Speech Recognition ───────────────────────── */

function setupSpeechRecognition() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) {
    $('#mic-btn').disabled = true;
    $('#mic-btn .mic-label').textContent = 'Not supported';
    setTranscriptState('Use Chrome or Safari — your browser lacks Web Speech API', false);
    return;
  }
  recognition = new SR();
  recognition.continuous = false;
  recognition.interimResults = true;
  recognition.maxAlternatives = 1;

  recognition.onstart = () => {
    isRecording = true;
    $('#mic-btn').classList.add('recording');
    $('#mic-btn .mic-label').textContent = 'Listening — release';
    setTranscriptState('● recording — speak now', true);
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
    const display = (final + interim).trim();
    if (liveTextNode && display) {
      liveTextNode.textContent = display;
    }
    if (final) {
      lastFinalText = final.trim();
    }
    if (interim) {
      lastInterimText = interim.trim();
    }
  };

  recognition.onerror = (e) => {
    isRecording = false;
    $('#mic-btn').classList.remove('recording');
    $('#mic-btn .mic-label').textContent = 'Hold to talk';
    let msg = 'mic error: ' + e.error;
    if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
      msg = '❌ Microphone permission denied. Enable in Safari → Settings → Websites → Microphone';
    } else if (e.error === 'no-speech') {
      msg = '⚠ No speech detected — try again, speak louder';
    } else if (e.error === 'audio-capture') {
      msg = '❌ No microphone found. Plug one in and reload.';
    } else if (e.error === 'network') {
      msg = '❌ Web Speech needs network connectivity (it uploads audio to Apple/Google)';
    }
    setTranscriptState(msg, false);
  };

  recognition.onend = async () => {
    isRecording = false;
    $('#mic-btn').classList.remove('recording');
    $('#mic-btn .mic-label').textContent = 'Hold to talk';

    // Fallback for Safari/Chrome: if no final transcript arrived but we
    // captured an interim, treat it as final. Web Speech API in Safari often
    // never delivers isFinal=true even though the recognition worked fine.
    const captured = lastFinalText || lastInterimText;
    if (liveTextNode && captured) {
      liveTextNode.parentElement.classList.remove('partial');
      liveTextNode.textContent = captured;
    } else if (liveTextNode && !captured) {
      liveTextNode.parentElement.remove();
    }

    if (!captured) {
      setTranscriptState('no speech captured — try again', false);
      return;
    }
    // Use whichever we got
    lastFinalText = captured;

    setTranscriptState('auditing…', false);
    await processUtterance(lastFinalText);
    lastFinalText = '';
    lastInterimText = '';
    liveTextNode = null;
    setTranscriptState('tap mic to start', false);
  };
}

/* ───────────────────────── Mic level via Web Audio API ───────────────────────── */

async function acquireMic() {
  if (micGranted) return true;
  try {
    micStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256;
    const src = audioCtx.createMediaStreamSource(micStream);
    src.connect(analyser);
    micGranted = true;
    pumpLevel();
    return true;
  } catch (err) {
    micGranted = false;
    let msg = '❌ Cannot access microphone: ' + (err.message || err.name || 'unknown');
    if (err.name === 'NotAllowedError') {
      msg = '❌ Permission denied. Safari → Settings → Websites → Microphone → Allow for this site';
    } else if (err.name === 'NotFoundError') {
      msg = '❌ No microphone detected on this machine';
    }
    setTranscriptState(msg, false);
    $('#mic-level-state').textContent = 'denied';
    return false;
  }
}

function pumpLevel() {
  if (!analyser) return;
  const data = new Uint8Array(analyser.frequencyBinCount);
  function frame() {
    if (!analyser) return;
    analyser.getByteTimeDomainData(data);
    let max = 0;
    for (let i = 0; i < data.length; i++) {
      const v = Math.abs(data[i] - 128) / 128;
      if (v > max) max = v;
    }
    const pct = Math.min(100, Math.round(max * 220));
    const fill = $('#mic-level-fill');
    if (fill) fill.style.width = pct + '%';
    const state = $('#mic-level-state');
    if (state) state.textContent = isRecording ? (pct > 8 ? 'capturing' : 'silence') : 'ready';
    levelRAF = requestAnimationFrame(frame);
  }
  frame();
}

/* ───────────────────────── Events ───────────────────────── */

function bindEvents() {
  const mic = $('#mic-btn');
  mic.addEventListener('click', async () => {
    if (!recognition) return;

    // 1. If the bot is currently speaking, the click interrupts it.
    //    Cancel the TTS and immediately go into listening mode — natural
    //    "talk over the assistant" behavior.
    if (window.speechSynthesis && window.speechSynthesis.speaking) {
      try { window.speechSynthesis.cancel(); } catch {}
      $('#mic-btn').classList.remove('speaking');
      setTranscriptState('interrupted bot · ready to listen', false);
      // fall through to start recording
    }

    // 2. If already recording, stop (don't start a new session on top).
    if (isRecording) {
      recognition.stop();
      return;
    }

    // 3. Otherwise: acquire mic permission + start a new session.
    const ok = await acquireMic();
    if (!ok) return;

    recognition.lang = currentLang;
    try {
      recognition.start();
    } catch (e) {
      // recognition.start() throws InvalidStateError if a previous session
      // is still finalizing. Wait a tick and try again.
      setTranscriptState('starting…', false);
      setTimeout(() => {
        try { recognition.start(); } catch {}
      }, 300);
    }
  });

  $('#lang-select').addEventListener('change', (e) => {
    currentLang = e.target.value;
    setTranscriptState('language: ' + currentLang, false);
  });

  $('#alert-close').onclick = () => $('#alert-banner').classList.remove('show');
}

function setTranscriptState(text, live) {
  const el = $('#transcript-state');
  if (!el) return;
  el.textContent = text;
  el.classList.toggle('live', !!live);
}

/* ───────────────────────── Transcript stream ───────────────────────── */

function appendUserLine(text, partial) {
  const stream = $('#transcript-stream');
  const empty = stream.querySelector('.empty-chat');
  if (empty) empty.remove();

  const wrap = document.createElement('div');
  wrap.className = 'transcript-line user' + (partial ? ' partial' : '');
  const meta = document.createElement('div');
  meta.className = 'meta';
  meta.textContent = `user · ${currentLang}`;
  const body = document.createElement('div');
  body.textContent = text || '…';
  wrap.appendChild(meta);
  wrap.appendChild(body);
  stream.appendChild(wrap);
  stream.scrollTop = stream.scrollHeight;
  if (partial) liveTextNode = body;
}

function appendBotLine(text, severity, action) {
  const stream = $('#transcript-stream');
  const el = document.createElement('div');
  el.className = 'transcript-line bot';
  const meta = document.createElement('div');
  meta.className = 'meta';
  meta.textContent = `bot · severity: ${severity} · action: ${action}`;
  el.appendChild(meta);
  const body = document.createElement('div');
  body.textContent = text;
  el.appendChild(body);
  stream.appendChild(el);
  stream.scrollTop = stream.scrollHeight;
}

/* ───────────────────────── Submit to /playground/chat ───────────────────────── */

async function processUtterance(userText) {
  $$('.playground-agents .agent').forEach((el) => {
    el.classList.add('active');
    el.classList.remove('flagged');
    el.querySelector('.agent-state').textContent = 'audit';
  });
  $('#sentry-sub').textContent = 'auditing…';

  try {
    const r = await fetch('/playground/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: userText, bot_profile: 'banking' }),
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const data = await r.json();

    appendBotLine(data.bot_reply, data.severity, data.action_taken);
    speakText(data.bot_reply, currentLang);

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
  } catch (e) {
    appendBotLine('(error: ' + e.message + ')', 'advisory', 'allow');
    $('#sentry-sub').textContent = 'error · check logs';
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
    // Always cancel any in-flight TTS before queuing a new one.
    window.speechSynthesis.cancel();

    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = lang;
    utter.rate = 1.0;
    const voices = window.speechSynthesis.getVoices();
    const match = voices.find((v) => v.lang === lang)
              || voices.find((v) => v.lang.startsWith(lang.slice(0, 2)));
    if (match) utter.voice = match;

    // Visual feedback on the mic button while bot is speaking.
    utter.onstart = () => {
      $('#mic-btn').classList.add('speaking');
      $('#mic-btn .mic-label').textContent = '⏹ tap to interrupt';
      setTranscriptState('bot speaking…', false);
    };
    utter.onend = () => {
      $('#mic-btn').classList.remove('speaking');
      $('#mic-btn .mic-label').textContent = window.i18n
        ? window.i18n.t('voice.mic.idle')
        : 'Hold to talk';
      setTranscriptState(window.i18n
        ? window.i18n.t('voice.transcript.idle')
        : 'tap mic to start', false);
    };
    utter.onerror = utter.onend;

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
