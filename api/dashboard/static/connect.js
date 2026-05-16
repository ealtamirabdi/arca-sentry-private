// Connect/Register page — agent onboarding flow
'use strict';

const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

let selectedChannel = 'proxy';

(function init() {
  $$('.cn-channel').forEach((card) => {
    card.onclick = () => selectChannel(card.dataset.channel);
  });
  $('#cn-submit').onclick = submit;
})();

function selectChannel(ch) {
  selectedChannel = ch;
  $$('.cn-channel').forEach((c) => c.classList.toggle('selected', c.dataset.channel === ch));
  $$('.cn-channel-config').forEach((c) => c.style.display = 'none');
  const cfg = $('#cn-config-' + ch);
  if (cfg) cfg.style.display = 'block';
}

async function submit() {
  const name = $('#cn-name').value.trim();
  const vertical = $('#cn-vertical').value;
  const icon = $('#cn-icon').value;
  const desc = $('#cn-desc').value.trim();
  const endpoint = ($('#cn-endpoint') && $('#cn-endpoint').value.trim()) || null;
  const website = ($('#cn-website') && $('#cn-website').value.trim()) || null;
  const upstream = ($('#cn-upstream') && $('#cn-upstream').value) || null;

  if (!name) { alert('Please give the agent a name.'); return; }

  $('#cn-submit').disabled = true;
  $('#cn-status').textContent = 'Registering…';

  try {
    const r = await fetch('/agents/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name, vertical, icon, description: desc,
        connection: selectedChannel,
        endpoint_url: endpoint || website,
        upstream_provider: upstream,
      }),
    });
    if (!r.ok) {
      const t = await r.text();
      throw new Error(t.slice(0, 200));
    }
    const d = await r.json();
    renderResult(d);
  } catch (e) {
    $('#cn-result').className = 'cn-result error';
    $('#cn-result').style.display = 'block';
    $('#cn-result').innerHTML = `<h3>❌ Registration failed</h3><p>${escapeHtml(e.message)}</p>`;
  } finally {
    $('#cn-submit').disabled = false;
    $('#cn-status').textContent = 'Ready.';
  }
}

function renderResult(d) {
  const box = $('#cn-result');
  box.className = 'cn-result' + (d.pending ? ' error' : '');
  box.style.display = 'block';
  const id = d.agent_id;
  const pendingMsg = d.pending
    ? `<p>The channel "<strong>${selectedChannel}</strong>" is in beta. The agent has been registered as <code>${id}</code> and will be activated when that channel ships.</p>`
    : `<p>Agent registered as <code>${id}</code>. ${escapeHtml(d.next_step || '')}</p>`;

  let proxySnippet = '';
  if (d.proxy_endpoint || selectedChannel === 'proxy') {
    const url = (window.location.origin || '') + '/v1/chat/completions';
    proxySnippet = `<p><strong>Your proxy endpoint:</strong></p>
      <code>${url}</code>
      <p class="muted small">Point your OpenAI client's <code>base_url</code> there. SENTRY audits every call inline.</p>`;
  }

  box.innerHTML = `
    <h3>${d.pending ? '🟡 Saved · channel in beta' : '✅ Agent registered'}</h3>
    ${pendingMsg}
    ${proxySnippet}
    <div class="cn-result-actions">
      <a href="/dashboard/agent.html?id=${id}">📊 View agent profile</a>
      ${!d.pending ? `<a href="/dashboard/redteam.html?prefill=${id}">⚡ Run Red Team now</a>` : ''}
      <a href="/dashboard/connect.html">➕ Register another</a>
    </div>
  `;
  box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function escapeHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
