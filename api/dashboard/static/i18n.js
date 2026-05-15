// ARCA SENTRY — i18n module
// Used across dashboard, playground, voice pages.
// All translatable text is keyed via data-i18n attribute in HTML, plus a
// global `t(key)` for strings hardcoded in JS.

(function () {
  'use strict';

  const STORAGE_KEY = 'sentry.lang';
  const DEFAULT = 'en';

  const DICT = {
    en: {
      // topbar
      'brand.sub.ops': 'Compliance Operations Center',
      'brand.sub.playground': 'Live Playground · talk to a vulnerable bot, watch SENTRY audit',
      'brand.sub.voice': 'Voice Channel Audit · speak to the bot, watch SENTRY listen',
      'nav.dashboard': 'Dashboard',
      'nav.playground': 'Playground',
      'nav.voice': 'Voice',
      'nav.architecture': 'Architecture',
      'nav.github': 'GitHub →',
      'status.connecting': 'connecting…',
      'status.live': 'live',
      'status.offline': 'offline',

      // KPI
      'kpi.compliance': 'Compliance rate',
      'kpi.compliance.sub': 'last 24h',
      'kpi.critical': 'Critical violations',
      'kpi.critical.sub': 'blocked at gateway',
      'kpi.warning': 'Warnings',
      'kpi.warning.sub': 'compliance team notified',
      'kpi.total': 'Interactions audited',
      'kpi.total.sub': '/min · live',

      // demo bar
      'demo.title': 'Try it live',
      'demo.desc': 'Click a scenario to run a synthetic AI interaction through the full pipeline. Six pre-loaded violations across EU AI Act, GDPR, DORA, PII and prompt injection — in English, Spanish and Italian.',

      // charts
      'chart.donut.title': 'Compliance overview',
      'chart.donut.sub': '24h breakdown',
      'chart.timeline.title': 'Violations timeline',
      'chart.timeline.sub': 'Interactions vs warnings vs criticals, hourly buckets',
      'chart.regs.title': 'Top regulations flagged',
      'chart.regs.sub': 'Findings by regulation, last 24h',
      'chart.council.title': 'Auditor council',
      'chart.council.sub': '5 specialized agents, current load',

      // feed
      'feed.title': 'Live event stream',
      'feed.desc': 'Click any row for full forensic detail · auto-refreshes every 3 s',
      'feed.filter.all': 'All',
      'feed.filter.critical': 'Critical',
      'feed.filter.warning': 'Warning',
      'feed.filter.advisory': 'Advisory',
      'feed.col.time': 'Time',
      'feed.col.severity': 'Severity',
      'feed.col.channel': 'Channel',
      'feed.col.actor': 'Actor',
      'feed.col.snippet': 'Snippet',
      'feed.col.findings': 'Findings',
      'feed.col.action': 'Action',
      'feed.empty.initial': 'No events yet — click a demo scenario to start.',
      'feed.empty.filtered': 'No events match the current filter.',

      // drawer
      'drawer.title': 'Audit detail',
      'drawer.section.transcript': 'Conversation transcript',
      'drawer.section.findings': 'Auditor findings',
      'drawer.section.report': 'Compliance report — Gemini Pro',
      'drawer.section.hash': 'Tamper-evident event hash · SHA-256',
      'drawer.no_findings': 'No findings — every agent cleared this interaction.',
      'drawer.no_transcript': 'This interaction was logged without a transcript.',
      'drawer.download_pdf': 'Download PDF',
      'drawer.raw_json': 'Raw JSON',
      'drawer.html_view': 'HTML view',
      'drawer.role.user': 'User',
      'drawer.role.ai': 'AI',

      // verdict
      'verdict.advisory': 'Advisory · logged only',
      'verdict.warning': 'Warning · compliance team notified',
      'verdict.critical': 'Critical · response BLOCKED at gateway',

      // playground
      'pg.toolbar.bot_label': 'Bot under audit:',
      'pg.toolbar.reset': '↺ Reset conversation',
      'pg.toolbar.hint_html': 'The bot is <strong>intentionally vulnerable</strong> for demo purposes. Try the suggested attacks below or type your own.',
      'pg.suggested.title': 'Try one of these',
      'pg.suggested.desc': 'Click any prompt to send it to the bot and watch SENTRY react.',
      'pg.conversation.title': 'Conversation',
      'pg.empty.line1': 'Start typing below — or click a suggested attack above.',
      'pg.empty.line2': 'Every exchange is audited by SENTRY in real time.',
      'pg.input.placeholder': 'Type a message to the bot… (Enter to send)',
      'pg.send': 'Send →',
      'pg.sentry.title': 'SENTRY · live audit',
      'pg.sentry.awaiting': 'awaiting interaction…',
      'pg.sentry.empty_verdict': 'No interactions audited yet.',
      'pg.sentry.no_findings': 'No findings — all five agents cleared this interaction.',

      // voice
      'voice.hero.title': 'Speak to a vulnerable voice bot',
      'voice.hero.desc1': 'Push the microphone, ask a question that a real bank\'s voice agent might mishandle, and watch SENTRY transcribe and audit the call in real time. Spanish, English, Italian and Portuguese all work.',
      'voice.hero.desc2': 'Uses your browser\'s microphone via the Web Speech API for transcription, and Speechmatics is configured on the backend for production-grade STT.',
      'voice.mic.idle': 'Hold to talk',
      'voice.mic.listening': 'Listening — release',
      'voice.transcript.title': 'Live transcript',
      'voice.transcript.idle': 'tap mic to start',
      'voice.transcript.recording': '● recording — speak now',
      'voice.transcript.audit': 'auditing…',
      'voice.transcript.empty1': 'Hold the microphone button and speak.',
      'voice.transcript.empty2': 'When you stop talking, the bot replies and SENTRY audits the exchange.',
      'voice.suggestions.title': 'Suggested scripts to read aloud',
      'voice.suggestions.desc': 'Try saying any of these — the bot is configured to stumble on each one, giving SENTRY plenty to flag.',

      // alert banner
      'alert.detected': 'VIOLATION DETECTED',
      // architecture cards (en masse)
      'arch.flow.s1.title': 'Capture',
      'arch.flow.s1.desc': 'Production AI sends every interaction to <code>POST /audit</code>. Voice calls stream through Speechmatics with speaker diarization.',
      'arch.flow.s2.title': 'Orchestrator',
      'arch.flow.s2.desc': 'Builds an <code>Interaction</code> and fans out to all five auditor agents simultaneously via <code>asyncio.gather</code>.',
      'arch.flow.s3.title': 'Auditor council',
      'arch.flow.s3.desc': 'Five domain-specialized models inspect the exchange in parallel. Each returns a <code>Finding</code> with confidence 0.0–1.0.',
      'arch.flow.s4.title': 'Severity engine',
      'arch.flow.s4.desc': 'Findings are classified into <span class="sev-pill advisory">advisory</span> <span class="sev-pill warning">warning</span> <span class="sev-pill critical">critical</span>. Consensus rule blocks single-agent false positives.',
      'arch.flow.s5.title': 'Synthesizer',
      'arch.flow.s5.desc': 'Gemini 2.5 Pro composes the auditable report in the source language. Includes article citations and recommended action.',
      'arch.flow.s6.title': 'Persist & act',
      'arch.flow.s6.desc': 'Every event appends to the SHA-256-chained event store. Tickets auto-open with cost estimate. Critical responses block at the gateway.',
      'arch.ag.euaiact.title': 'Transparency, oversight & disclosure',
      'arch.ag.euaiact.desc': 'Flags automated consequential decisions (credit, hiring, eligibility) lacking explanation or human-review path. Also fires when a voice agent denies being an AI under Art. 50.',
      'arch.ag.gdpr.title': 'Data subject rights',
      'arch.ag.gdpr.desc': 'Detects unlawful processing, opaque automated decisions, refused access requests, and erasure denials. Cross-checks with PII Leak for compound breaches.',
      'arch.ag.dora.title': 'Digital operational resilience',
      'arch.ag.dora.desc': 'Catches incidents being denied, hidden third-party dependencies, opaque trading advice, and missing incident-reporting channels. Specific to EU financial entities post-Jan 2025.',
      'arch.ag.pii.title': 'Volunteered personal data',
      'arch.ag.pii.desc': 'Deterministic regex bank: email, IBAN, credit card, codice fiscale, CURP, RFC, SSN, passport, DNI, phone. LLM confirms whether the leak was solicited (legitimate retrieval) or volunteered (breach pattern).',
      'arch.ag.pi.title': 'OWASP LLM01 — direct + indirect injection',
      'arch.ag.pi.desc': 'Two-stage detection: attack-side markers in the user request <strong>and</strong> compliance-side regex in the AI response (leaked system prompts, leaked credentials, broken character).',
      'arch.sev.adv.action': 'action: allow',
      'arch.sev.warn.action': 'action: warn',
      'arch.sev.crit.action': 'action: block',
      'arch.sev.adv.desc': 'Logged to event store only. No alert. Useful for trending and weak-signal monitoring.',
      'arch.sev.warn.desc': 'Compliance team notified. Ticket auto-opens with cost estimate. Response is not blocked.',
      'arch.sev.crit.desc': 'Response is intercepted at the gateway before it reaches the end user. Ticket flagged red. Synthesizer report dispatched to compliance lead.',
      'arch.int.chain.title': 'Hash chain',
      'arch.int.chain.desc': 'Each record carries a SHA-256 hash that combines the previous record\'s hash plus the new payload. Modifying a past event invalidates every hash downstream.',
      'arch.int.append.title': 'Append-only at app layer',
      'arch.int.append.desc': 'The <code>EventStore</code> class exposes no UPDATE or DELETE methods. Workflow state changes (open → resolved) are themselves new events.',
      'arch.int.verify.title': 'Verifiable in O(n)',
      'arch.int.verify.desc': '<code>EventStore.verify_integrity()</code> recomputes the chain end-to-end. Returns false on any inconsistency. Regulators can run it on a copy of the database.',
      'arch.int.pg.title': 'Postgres alternative',
      'arch.int.pg.desc': 'For enterprise deployments, an optional Postgres schema enforces immutability at the database layer via row-level triggers preventing UPDATE/DELETE.',
      'arch.stack.inf': 'Inference',
      'arch.stack.run': 'Runtime',
      'arch.stack.persist': 'Persistence',
      'arch.stack.deploy': 'Deployment',
      'arch.stack.front': 'Frontend',
      'arch.stack.qa': 'Quality',
      'arch.perf.p1.lbl': 'p95 latency, no-flag interaction',
      'arch.perf.p1.note': 'Regex pre-filters short-circuit before any LLM call.',
      'arch.perf.p2.lbl': 'p95 latency, single agent fires',
      'arch.perf.p2.note': 'One Featherless call. Synthesizer triggered only if findings exist.',
      'arch.perf.p3.lbl': 'p95 latency, full critical event',
      'arch.perf.p3.note': 'All five agents fire in parallel + Gemini synthesizer.',
      'arch.perf.p4.lbl': 'Sustained throughput, single instance',
      'arch.perf.p4.note': 'Per-model semaphore prevents 429 cascades.',
      'arch.perf.p5.lbl': 'False positive rate on synthetic corpus',
      'arch.perf.p5.note': 'Consensus rule on critical eliminates single-agent hallucinations.',
      'arch.perf.p6.lbl': 'Event store size',
      'arch.perf.p6.note': 'SQLite with JSON payloads. Indexed by interaction_id, type, time.',
      'arch.sec.secrets.title': 'No secrets in transit or at rest',
      'arch.sec.secrets.desc': 'API keys live in <code>.env</code> outside git. The vulnerable demo bot\'s fake keys are explicit hooks for testing — verified deterministically.',
      'arch.sec.injection.title': 'Prompt injection hardened',
      'arch.sec.injection.desc': 'System prompts are constructed with explicit separators. Every agent uses structured JSON output. Compliance-side regex catches credential leaks if a downstream bot is compromised.',
      'arch.sec.auditable.title': 'Auditable by regulators',
      'arch.sec.auditable.desc': 'Any decision can be replayed deterministically from the event store. PDF reports include event hash for chain-of-custody verification.',
      'arch.sec.reversible.title': 'Human-reversible blocks',
      'arch.sec.reversible.desc': 'A blocking decision is itself a logged event. Operators can override (status: dismissed) without modifying historical findings.',
      'arch.topo.smb.tier': 'SMB / Demo',
      'arch.topo.mid.tier': 'Mid-market',
      'arch.topo.ent.tier': 'Enterprise',


      // tickets page
      'tickets.title': 'Compliance tickets · auto-generated remediations',
      'tickets.kpi.open': 'Open tickets',
      'tickets.kpi.open.sub': 'awaiting remediation',
      'tickets.kpi.exposure': 'Estimated exposure',
      'tickets.kpi.exposure.sub': 'potential fines if not remediated',
      'tickets.kpi.resolved': 'Resolved',
      'tickets.kpi.resolved.sub': 'closed out',
      'tickets.kpi.total': 'Total tickets',
      'tickets.kpi.total.sub': 'all time',
      'tickets.list': 'Remediation queue',
      'tickets.list.desc': 'Every warning or critical detected by SENTRY becomes a ticket here, with an estimated cost if left unresolved and a suggested fix.',
      'tickets.filter.all': 'All',
      'tickets.filter.open': 'Open',
      'tickets.filter.in_progress': 'In progress',
      'tickets.filter.resolved': 'Resolved',
      'tickets.filter.dismissed': 'Dismissed',

      // architecture page
      'brand.sub.arch': 'Architecture · how the system works under the hood',
      'arch.hero.eyebrow': 'System architecture',
      'arch.hero.title': 'A continuous compliance brain for enterprise AI',
      'arch.hero.sub': 'ARCA SENTRY is a multi-agent system that audits every interaction your AI produces, in real time, against EU regulatory frameworks. Built around five specialized auditor agents, a Gemini Pro synthesizer, and an append-only hash-chained event store — every decision is forensically reproducible and tamper-evident by design.',
      'arch.metric.latency': 'End-to-end p95 latency',
      'arch.metric.agents': 'Specialized auditor agents',
      'arch.metric.integrity': 'Audit log integrity (SHA-256)',
      'arch.metric.langs': 'Languages supported',
      'arch.flow.title': 'Request flow · how an interaction becomes an audited decision',
      'arch.flow.desc': 'Every chat or voice exchange goes through the same six-stage pipeline. Stages run in parallel where possible — total wall time stays under six seconds even with frontier models in the synthesizer.',
      'arch.agents.title': 'The five auditor agents · domain-specialized by design',
      'arch.agents.desc': 'Each agent owns one regulation or risk family. They share a base class (heuristic pre-filter → specialized LLM judgment) but use different system prompts and different open-source models from Featherless. This keeps p95 low: most interactions skip the LLM call entirely.',
      'arch.severity.title': 'Severity model · three tiers, consensus protected',
      'arch.severity.desc': 'A single hallucinating agent cannot unilaterally block production traffic. Critical fires only when multiple agents converge — or when the evidence is irrefutable.',
      'arch.integrity.title': 'Tamper-evident audit log · forensic by default',
      'arch.integrity.desc': 'Every event the system observes — interactions, findings, decisions, ticket status changes — appends to a SHA-256 hash-chained event store. The chain is verifiable end-to-end in a single call.',
      'arch.stack.title': 'Technology stack',
      'arch.stack.desc': 'Linux-first, ARM64-native, asyncio throughout. Designed to run on a single Vultr VM for SMB and to scale horizontally on Kubernetes for enterprise.',
      'arch.perf.title': 'Performance envelope',
      'arch.perf.desc': 'Measured on the production NVIDIA Grace ARM64 instance, against real Featherless and Gemini endpoints.',
      'arch.sec.title': 'Security guarantees',
      'arch.sec.desc': 'Built-in by default; nothing optional. Aligned to OWASP LLM Top 10, SOC 2 readiness, and EU AI Act enforcement controls.',
      'arch.topo.title': 'Deployment topologies',
      'arch.topo.desc': 'From a single 1-vCPU Vultr instance to a multi-region Kubernetes cluster.',
    },

    es: {
      'brand.sub.ops': 'Centro de Operaciones de Cumplimiento',
      'brand.sub.playground': 'Demo en vivo · habla con un bot vulnerable, mira cómo SENTRY audita',
      'brand.sub.voice': 'Auditoría de Canal de Voz · habla con el bot, mira a SENTRY escuchar',
      'nav.dashboard': 'Panel',
      'nav.tickets': 'Tickets',
      'nav.playground': 'Demo',
      'nav.voice': 'Voz',
      'nav.architecture': 'Arquitectura',
      'nav.github': 'GitHub →',
      'status.connecting': 'conectando…',
      'status.live': 'en vivo',
      'status.offline': 'desconectado',

      'kpi.compliance': 'Tasa de cumplimiento',
      'kpi.compliance.sub': 'últimas 24 h',
      'kpi.critical': 'Violaciones críticas',
      'kpi.critical.sub': 'bloqueadas en la puerta',
      'kpi.warning': 'Advertencias',
      'kpi.warning.sub': 'equipo de cumplimiento notificado',
      'kpi.total': 'Interacciones auditadas',
      'kpi.total.sub': '/min · en vivo',

      'demo.title': 'Pruébalo en vivo',
      'demo.desc': 'Haz clic en un escenario para ejecutar una interacción sintética por el pipeline completo. Seis violaciones precargadas en EU AI Act, GDPR, DORA, PII e inyección de prompt — en inglés, español e italiano.',

      'chart.donut.title': 'Resumen de cumplimiento',
      'chart.donut.sub': 'desglose 24 h',
      'chart.timeline.title': 'Línea temporal de violaciones',
      'chart.timeline.sub': 'Interacciones vs advertencias vs críticas, por hora',
      'chart.regs.title': 'Regulaciones más violadas',
      'chart.regs.sub': 'Hallazgos por regulación, últimas 24 h',
      'chart.council.title': 'Concilio de auditores',
      'chart.council.sub': '5 agentes especializados, carga actual',

      'feed.title': 'Flujo de eventos en vivo',
      'feed.desc': 'Haz clic en cualquier fila para ver el detalle forense · se actualiza cada 3 s',
      'feed.filter.all': 'Todos',
      'feed.filter.critical': 'Críticos',
      'feed.filter.warning': 'Advertencia',
      'feed.filter.advisory': 'Informativo',
      'feed.col.time': 'Hora',
      'feed.col.severity': 'Severidad',
      'feed.col.channel': 'Canal',
      'feed.col.actor': 'Actor',
      'feed.col.snippet': 'Fragmento',
      'feed.col.findings': 'Hallazgos',
      'feed.col.action': 'Acción',
      'feed.empty.initial': 'Sin eventos aún — haz clic en un escenario para empezar.',
      'feed.empty.filtered': 'Ningún evento coincide con el filtro actual.',

      'drawer.title': 'Detalle de auditoría',
      'drawer.section.transcript': 'Transcripción de la conversación',
      'drawer.section.findings': 'Hallazgos de los auditores',
      'drawer.section.report': 'Reporte de cumplimiento — Gemini Pro',
      'drawer.section.hash': 'Hash a prueba de manipulación · SHA-256',
      'drawer.no_findings': 'Sin hallazgos — todos los agentes aprobaron esta interacción.',
      'drawer.no_transcript': 'Esta interacción se registró sin transcripción.',
      'drawer.download_pdf': 'Descargar PDF',
      'drawer.raw_json': 'JSON crudo',
      'drawer.html_view': 'Vista HTML',
      'drawer.role.user': 'Usuario',
      'drawer.role.ai': 'IA',

      'verdict.advisory': 'Informativo · solo registrado',
      'verdict.warning': 'Advertencia · equipo de cumplimiento notificado',
      'verdict.critical': 'Crítico · respuesta BLOQUEADA en la puerta',

      'pg.toolbar.bot_label': 'Bot auditado:',
      'pg.toolbar.reset': '↺ Reiniciar conversación',
      'pg.toolbar.hint_html': 'El bot es <strong>vulnerable a propósito</strong> para fines de demo. Prueba los ataques sugeridos abajo o escribe el tuyo.',
      'pg.suggested.title': 'Prueba uno de estos',
      'pg.suggested.desc': 'Haz clic en cualquier prompt para enviarlo al bot y ver cómo reacciona SENTRY.',
      'pg.conversation.title': 'Conversación',
      'pg.empty.line1': 'Empieza a escribir abajo — o haz clic en un ataque sugerido arriba.',
      'pg.empty.line2': 'Cada intercambio es auditado por SENTRY en tiempo real.',
      'pg.input.placeholder': 'Escribe un mensaje al bot… (Enter para enviar)',
      'pg.send': 'Enviar →',
      'pg.sentry.title': 'SENTRY · auditoría en vivo',
      'pg.sentry.awaiting': 'esperando interacción…',
      'pg.sentry.empty_verdict': 'Ninguna interacción auditada todavía.',
      'pg.sentry.no_findings': 'Sin hallazgos — los cinco agentes aprobaron esta interacción.',

      'voice.hero.title': 'Habla con un bot de voz vulnerable',
      'voice.hero.desc1': 'Presiona el micrófono, haz una pregunta que un agente de voz bancario podría manejar mal, y observa cómo SENTRY transcribe y audita la llamada en tiempo real. Funciona en español, inglés, italiano y portugués.',
      'voice.hero.desc2': 'Usa el micrófono del navegador a través de la Web Speech API para transcripción, y Speechmatics está configurado en el backend para STT de producción.',
      'voice.mic.idle': 'Mantén para hablar',
      'voice.mic.listening': 'Escuchando — suelta',
      'voice.transcript.title': 'Transcripción en vivo',
      'voice.transcript.idle': 'toca el mic para empezar',
      'voice.transcript.recording': '● grabando — habla ahora',
      'voice.transcript.audit': 'auditando…',
      'voice.transcript.empty1': 'Mantén el botón del micrófono y habla.',
      'voice.transcript.empty2': 'Cuando termines, el bot responde y SENTRY audita el intercambio.',
      'voice.suggestions.title': 'Frases sugeridas para leer en voz alta',
      'voice.suggestions.desc': 'Prueba decir alguna de estas — el bot está configurado para tropezar con cada una, dándole a SENTRY mucho que marcar.',

      'alert.detected': 'VIOLACIÓN DETECTADA',

      'tickets.title': 'Tickets de cumplimiento · remediaciones automáticas',
      'tickets.kpi.open': 'Tickets abiertos',
      'tickets.kpi.open.sub': 'esperando remediación',
      'tickets.kpi.exposure': 'Exposición estimada',
      'tickets.kpi.exposure.sub': 'multas potenciales si no se remedia',
      'tickets.kpi.resolved': 'Resueltos',
      'tickets.kpi.resolved.sub': 'cerrados',
      'tickets.kpi.total': 'Total tickets',
      'tickets.kpi.total.sub': 'histórico completo',
      'tickets.list': 'Cola de remediación',
      'tickets.list.desc': 'Cada advertencia o crítico detectado por SENTRY se vuelve un ticket aquí, con un costo estimado si no se resuelve y una propuesta de corrección.',
      'tickets.filter.all': 'Todos',
      'tickets.filter.open': 'Abiertos',
      'tickets.filter.in_progress': 'En progreso',
      'tickets.filter.resolved': 'Resueltos',
      'tickets.filter.dismissed': 'Descartados',

      'brand.sub.arch': 'Arquitectura · cómo funciona el sistema por dentro',
      'arch.hero.eyebrow': 'Arquitectura del sistema',
      'arch.hero.title': 'Un cerebro de cumplimiento continuo para IA empresarial',
      'arch.hero.sub': 'ARCA SENTRY es un sistema multi-agente que audita cada interacción que produce tu IA, en tiempo real, contra los marcos regulatorios europeos. Construido sobre cinco agentes auditores especializados, un sintetizador Gemini Pro, y un almacén de eventos encadenado por hash — cada decisión es forensicamente reproducible y a prueba de manipulación por diseño.',
      'arch.metric.latency': 'Latencia p95 extremo a extremo',
      'arch.metric.agents': 'Agentes auditores especializados',
      'arch.metric.integrity': 'Integridad del log (SHA-256)',
      'arch.metric.langs': 'Idiomas soportados',
      'arch.flow.title': 'Flujo de petición · cómo una interacción se convierte en decisión auditada',
      'arch.flow.desc': 'Cada intercambio de chat o voz pasa por el mismo pipeline de seis etapas. Las etapas corren en paralelo donde es posible — el tiempo total se mantiene bajo seis segundos incluso con modelos de frontera en el sintetizador.',
      'arch.agents.title': 'Los cinco agentes auditores · especializados por dominio',
      'arch.agents.desc': 'Cada agente es dueño de una regulación o familia de riesgo. Comparten una clase base (pre-filtro heurístico → juicio LLM especializado) pero usan system prompts y modelos open-source distintos de Featherless. Esto mantiene la latencia p95 baja: la mayoría de interacciones se saltan la llamada al LLM por completo.',
      'arch.severity.title': 'Modelo de severidad · tres niveles, protegido por consenso',
      'arch.severity.desc': 'Un solo agente alucinando no puede bloquear unilateralmente tráfico productivo. CRITICAL se dispara solo cuando varios agentes convergen — o cuando la evidencia es irrefutable.',
      'arch.integrity.title': 'Log auditable a prueba de manipulación · forense por diseño',
      'arch.integrity.desc': 'Cada evento que el sistema observa — interacciones, hallazgos, decisiones, cambios de estado de ticket — se anexa a un event store encadenado por SHA-256. La cadena es verificable extremo a extremo en una sola llamada.',
      'arch.stack.title': 'Stack tecnológico',
      'arch.stack.desc': 'Linux-first, ARM64-nativo, asyncio en todas las capas. Diseñado para correr en una sola VM Vultr para PYMES y escalar horizontalmente en Kubernetes para empresas.',
      'arch.perf.title': 'Envolvente de rendimiento',
      'arch.perf.desc': 'Medido en la instancia NVIDIA Grace ARM64 productiva, contra endpoints reales de Featherless y Gemini.',
      'arch.sec.title': 'Garantías de seguridad',
      'arch.sec.desc': 'Integrado por defecto; nada opcional. Alineado a OWASP LLM Top 10, listo para SOC 2, y a los controles de cumplimiento del EU AI Act.',
      'arch.topo.title': 'Topologías de despliegue',
      'arch.topo.desc': 'Desde una sola instancia Vultr de 1 vCPU hasta un clúster Kubernetes multi-región.',
    },

    it: {
      'brand.sub.ops': 'Centro Operativo di Conformità',
      'brand.sub.playground': 'Demo dal vivo · parla con un bot vulnerabile, guarda SENTRY all\'opera',
      'brand.sub.voice': 'Audit del Canale Vocale · parla con il bot, guarda SENTRY ascoltare',
      'nav.dashboard': 'Pannello',
      'nav.tickets': 'Tickets',
      'nav.playground': 'Demo',
      'nav.voice': 'Voce',
      'nav.architecture': 'Architettura',
      'nav.github': 'GitHub →',
      'status.connecting': 'connessione…',
      'status.live': 'dal vivo',
      'status.offline': 'offline',

      'kpi.compliance': 'Tasso di conformità',
      'kpi.compliance.sub': 'ultime 24 ore',
      'kpi.critical': 'Violazioni critiche',
      'kpi.critical.sub': 'bloccate al gateway',
      'kpi.warning': 'Avvertimenti',
      'kpi.warning.sub': 'team di compliance notificato',
      'kpi.total': 'Interazioni verificate',
      'kpi.total.sub': '/min · dal vivo',

      'demo.title': 'Provalo dal vivo',
      'demo.desc': 'Clicca uno scenario per eseguire un\'interazione sintetica nel pipeline completo. Sei violazioni precaricate per EU AI Act, GDPR, DORA, PII e prompt injection — in inglese, spagnolo e italiano.',

      'chart.donut.title': 'Panoramica conformità',
      'chart.donut.sub': 'ripartizione 24 ore',
      'chart.timeline.title': 'Cronologia violazioni',
      'chart.timeline.sub': 'Interazioni vs avvertimenti vs critiche, per ora',
      'chart.regs.title': 'Regolamenti più violati',
      'chart.regs.sub': 'Rilevazioni per regolamento, ultime 24 ore',
      'chart.council.title': 'Consiglio degli auditor',
      'chart.council.sub': '5 agenti specializzati, carico attuale',

      'feed.title': 'Flusso di eventi dal vivo',
      'feed.desc': 'Clicca una riga per il dettaglio forense · si aggiorna ogni 3 s',
      'feed.filter.all': 'Tutti',
      'feed.filter.critical': 'Critici',
      'feed.filter.warning': 'Avviso',
      'feed.filter.advisory': 'Informativo',
      'feed.col.time': 'Ora',
      'feed.col.severity': 'Gravità',
      'feed.col.channel': 'Canale',
      'feed.col.actor': 'Attore',
      'feed.col.snippet': 'Estratto',
      'feed.col.findings': 'Rilevazioni',
      'feed.col.action': 'Azione',
      'feed.empty.initial': 'Nessun evento ancora — clicca uno scenario per iniziare.',
      'feed.empty.filtered': 'Nessun evento corrisponde al filtro attuale.',

      'drawer.title': 'Dettaglio audit',
      'drawer.section.transcript': 'Trascrizione della conversazione',
      'drawer.section.findings': 'Rilevazioni degli auditor',
      'drawer.section.report': 'Report di conformità — Gemini Pro',
      'drawer.section.hash': 'Hash a prova di manomissione · SHA-256',
      'drawer.no_findings': 'Nessuna rilevazione — tutti gli agenti hanno approvato questa interazione.',
      'drawer.no_transcript': 'Questa interazione è stata registrata senza trascrizione.',
      'drawer.download_pdf': 'Scarica PDF',
      'drawer.raw_json': 'JSON grezzo',
      'drawer.html_view': 'Vista HTML',
      'drawer.role.user': 'Utente',
      'drawer.role.ai': 'IA',

      'verdict.advisory': 'Informativo · solo registrato',
      'verdict.warning': 'Avviso · team di compliance notificato',
      'verdict.critical': 'Critico · risposta BLOCCATA al gateway',

      'pg.toolbar.bot_label': 'Bot sotto audit:',
      'pg.toolbar.reset': '↺ Reimposta conversazione',
      'pg.toolbar.hint_html': 'Il bot è <strong>volutamente vulnerabile</strong> per scopi dimostrativi. Prova gli attacchi suggeriti qui sotto o scrivi il tuo.',
      'pg.suggested.title': 'Prova uno di questi',
      'pg.suggested.desc': 'Clicca un prompt per inviarlo al bot e guardare come reagisce SENTRY.',
      'pg.conversation.title': 'Conversazione',
      'pg.empty.line1': 'Inizia a scrivere qui sotto — o clicca un attacco suggerito sopra.',
      'pg.empty.line2': 'Ogni scambio è verificato da SENTRY in tempo reale.',
      'pg.input.placeholder': 'Scrivi un messaggio al bot… (Invio per inviare)',
      'pg.send': 'Invia →',
      'pg.sentry.title': 'SENTRY · audit dal vivo',
      'pg.sentry.awaiting': 'in attesa di interazione…',
      'pg.sentry.empty_verdict': 'Nessuna interazione verificata ancora.',
      'pg.sentry.no_findings': 'Nessuna rilevazione — tutti i cinque agenti hanno approvato.',

      'voice.hero.title': 'Parla con un bot vocale vulnerabile',
      'voice.hero.desc1': 'Premi il microfono, fai una domanda che un vero agente vocale bancario potrebbe gestire male, e guarda SENTRY trascrivere e verificare la chiamata in tempo reale. Funziona in italiano, inglese, spagnolo e portoghese.',
      'voice.hero.desc2': 'Usa il microfono del browser tramite la Web Speech API per la trascrizione, e Speechmatics è configurato sul backend per STT di livello produttivo.',
      'voice.mic.idle': 'Tieni premuto per parlare',
      'voice.mic.listening': 'In ascolto — rilascia',
      'voice.transcript.title': 'Trascrizione dal vivo',
      'voice.transcript.idle': 'tocca il microfono per iniziare',
      'voice.transcript.recording': '● registrazione — parla ora',
      'voice.transcript.audit': 'verifica in corso…',
      'voice.transcript.empty1': 'Tieni premuto il pulsante del microfono e parla.',
      'voice.transcript.empty2': 'Quando smetti di parlare, il bot risponde e SENTRY verifica lo scambio.',
      'voice.suggestions.title': 'Frasi suggerite da leggere ad alta voce',
      'voice.suggestions.desc': 'Prova a dire una di queste — il bot è configurato per inciampare su ognuna, dando a SENTRY molto da segnalare.',

      'alert.detected': 'VIOLAZIONE RILEVATA',

      // tickets — translated to Italian
      'tickets.title': 'Ticket di conformità · remediazioni automatiche',
      'tickets.kpi.open': 'Ticket aperti',
      'tickets.kpi.open.sub': 'in attesa di remediazione',
      'tickets.kpi.exposure': 'Esposizione stimata',
      'tickets.kpi.exposure.sub': 'multe potenziali se non risolte',
      'tickets.kpi.resolved': 'Risolti',
      'tickets.kpi.resolved.sub': 'chiusi',
      'tickets.kpi.total': 'Totale ticket',
      'tickets.kpi.total.sub': 'storico completo',
      'tickets.list': 'Coda di remediazione',
      'tickets.list.desc': 'Ogni avviso o critico rilevato da SENTRY diventa un ticket qui, con un costo stimato se non risolto e una proposta di correzione.',
      'tickets.filter.all': 'Tutti',
      'tickets.filter.open': 'Aperti',
      'tickets.filter.in_progress': 'In corso',
      'tickets.filter.resolved': 'Risolti',
      'tickets.filter.dismissed': 'Respinti',

      // architecture
      'brand.sub.arch': 'Architettura · come funziona il sistema sotto il cofano',
      'arch.hero.eyebrow': 'Architettura del sistema',
      'arch.hero.title': 'Un cervello di conformità continua per l\'IA aziendale',
      'arch.hero.sub': 'ARCA SENTRY è un sistema multi-agente che verifica ogni interazione prodotta dalla tua IA, in tempo reale, contro i quadri normativi UE. Costruito attorno a cinque agenti auditor specializzati, un sintetizzatore Gemini Pro e un event store append-only concatenato con hash — ogni decisione è forensicamente riproducibile e a prova di manomissione per design.',
      'arch.metric.latency': 'Latenza p95 end-to-end',
      'arch.metric.agents': 'Agenti auditor specializzati',
      'arch.metric.integrity': 'Integrità del log (SHA-256)',
      'arch.metric.langs': 'Lingue supportate',
      'arch.flow.title': 'Flusso di richiesta · come un\'interazione diventa una decisione auditata',
      'arch.flow.desc': 'Ogni scambio di chat o voce passa attraverso la stessa pipeline a sei stadi. Gli stadi girano in parallelo dove possibile — il tempo totale rimane sotto i sei secondi anche con modelli di frontiera nel sintetizzatore.',
      'arch.agents.title': 'I cinque agenti auditor · specializzati per dominio',
      'arch.agents.desc': 'Ogni agente è padrone di un regolamento o famiglia di rischio. Condividono una classe base (pre-filtro euristico → giudizio LLM specializzato) ma usano system prompt e modelli open-source diversi da Featherless. Questo mantiene il p95 basso: la maggior parte delle interazioni salta del tutto la chiamata LLM.',
      'arch.severity.title': 'Modello di gravità · tre livelli, protetto dal consenso',
      'arch.severity.desc': 'Un singolo agente che allucina non può bloccare unilateralmente il traffico produttivo. Critico scatta solo quando più agenti convergono — o quando l\'evidenza è inconfutabile.',
      'arch.integrity.title': 'Log auditabile a prova di manomissione · forense per design',
      'arch.integrity.desc': 'Ogni evento osservato dal sistema — interazioni, rilevazioni, decisioni, cambi di stato dei ticket — viene aggiunto a un event store concatenato con SHA-256. La catena è verificabile end-to-end in una singola chiamata.',
      'arch.stack.title': 'Stack tecnologico',
      'arch.stack.desc': 'Linux-first, ARM64-nativo, asyncio in tutti i livelli. Progettato per girare su una singola VM Vultr per PMI e scalare orizzontalmente su Kubernetes per le aziende.',
      'arch.perf.title': 'Profilo di prestazione',
      'arch.perf.desc': 'Misurato sull\'istanza produttiva NVIDIA Grace ARM64, contro endpoint reali di Featherless e Gemini.',
      'arch.sec.title': 'Garanzie di sicurezza',
      'arch.sec.desc': 'Integrate per default; niente di opzionale. Allineate a OWASP LLM Top 10, pronte per SOC 2, e ai controlli di conformità dell\'EU AI Act.',
      'arch.topo.title': 'Topologie di deployment',
      'arch.topo.desc': 'Da una singola istanza Vultr con 1 vCPU a un cluster Kubernetes multi-regione.',
    },

    zh: {
      'brand.sub.ops': '合规运营中心',
      'brand.sub.playground': '实时演示 · 与脆弱机器人对话,观看 SENTRY 审计',
      'brand.sub.voice': '语音通道审计 · 与机器人通话,观看 SENTRY 监听',
      'nav.dashboard': '仪表盘',
      'nav.tickets': '工单',
      'nav.playground': '演示',
      'nav.voice': '语音',
      'nav.architecture': '架构',
      'nav.github': 'GitHub →',
      'status.connecting': '连接中…',
      'status.live': '在线',
      'status.offline': '离线',

      'kpi.compliance': '合规率',
      'kpi.compliance.sub': '过去 24 小时',
      'kpi.critical': '严重违规',
      'kpi.critical.sub': '在网关阻断',
      'kpi.warning': '警告',
      'kpi.warning.sub': '已通知合规团队',
      'kpi.total': '已审计交互',
      'kpi.total.sub': '/分钟 · 实时',

      'demo.title': '立即试用',
      'demo.desc': '点击场景,通过完整管道运行合成的 AI 交互。六个预设违规涵盖 EU AI Act、GDPR、DORA、PII 和提示注入 — 英语、西班牙语和意大利语。',

      'chart.donut.title': '合规概览',
      'chart.donut.sub': '24 小时细分',
      'chart.timeline.title': '违规时间线',
      'chart.timeline.sub': '交互 vs 警告 vs 严重,按小时',
      'chart.regs.title': '最常被违反的法规',
      'chart.regs.sub': '按法规统计,过去 24 小时',
      'chart.council.title': '审计议会',
      'chart.council.sub': '5 个专业代理,当前负载',

      'feed.title': '实时事件流',
      'feed.desc': '点击任意行查看完整取证细节 · 每 3 秒自动刷新',
      'feed.filter.all': '全部',
      'feed.filter.critical': '严重',
      'feed.filter.warning': '警告',
      'feed.filter.advisory': '提示',
      'feed.col.time': '时间',
      'feed.col.severity': '严重性',
      'feed.col.channel': '通道',
      'feed.col.actor': '主体',
      'feed.col.snippet': '片段',
      'feed.col.findings': '发现',
      'feed.col.action': '动作',
      'feed.empty.initial': '尚无事件 — 点击演示场景开始。',
      'feed.empty.filtered': '没有事件匹配当前过滤器。',

      'drawer.title': '审计详情',
      'drawer.section.transcript': '对话记录',
      'drawer.section.findings': '审计员发现',
      'drawer.section.report': '合规报告 — Gemini Pro',
      'drawer.section.hash': '防篡改事件哈希 · SHA-256',
      'drawer.no_findings': '无发现 — 所有代理均通过此次交互。',
      'drawer.no_transcript': '此次交互未记录对话内容。',
      'drawer.download_pdf': '下载 PDF',
      'drawer.raw_json': '原始 JSON',
      'drawer.html_view': 'HTML 视图',
      'drawer.role.user': '用户',
      'drawer.role.ai': 'AI',

      'verdict.advisory': '提示 · 仅记录',
      'verdict.warning': '警告 · 已通知合规团队',
      'verdict.critical': '严重 · 在网关阻断响应',

      'pg.toolbar.bot_label': '被审计的机器人:',
      'pg.toolbar.reset': '↺ 重置对话',
      'pg.toolbar.hint_html': '该机器人<strong>故意被设计为脆弱的</strong>以便演示。尝试下方建议的攻击或自行输入。',
      'pg.suggested.title': '尝试以下任一项',
      'pg.suggested.desc': '点击任意提示发送给机器人并观察 SENTRY 的反应。',
      'pg.conversation.title': '对话',
      'pg.empty.line1': '在下方开始输入 — 或点击上方建议的攻击。',
      'pg.empty.line2': '每次交互都由 SENTRY 实时审计。',
      'pg.input.placeholder': '向机器人输入消息…(按 Enter 发送)',
      'pg.send': '发送 →',
      'pg.sentry.title': 'SENTRY · 实时审计',
      'pg.sentry.awaiting': '等待交互…',
      'pg.sentry.empty_verdict': '尚未审计任何交互。',
      'pg.sentry.no_findings': '无发现 — 所有五个代理均通过此次交互。',

      'voice.hero.title': '与脆弱的语音机器人对话',
      'voice.hero.desc1': '按下麦克风,提出一个真实银行语音代理可能处理不当的问题,观看 SENTRY 实时转录并审计通话。支持中文、英语、西班牙语、意大利语和葡萄牙语。',
      'voice.hero.desc2': '通过 Web Speech API 使用浏览器麦克风进行转录,后端配置了 Speechmatics 用于生产级 STT。',
      'voice.mic.idle': '按住说话',
      'voice.mic.listening': '正在聆听 — 松开',
      'voice.transcript.title': '实时转录',
      'voice.transcript.idle': '点击麦克风开始',
      'voice.transcript.recording': '● 录制中 — 请说话',
      'voice.transcript.audit': '审计中…',
      'voice.transcript.empty1': '按住麦克风按钮并说话。',
      'voice.transcript.empty2': '停止说话后,机器人会回复,SENTRY 会审计此次交互。',
      'voice.suggestions.title': '可以朗读的建议语句',
      'voice.suggestions.desc': '试着说出其中任何一句 — 机器人被配置为每一句都会出错,给 SENTRY 充分的标记机会。',

      'alert.detected': '检测到违规',

      'tickets.title': '合规工单 · 自动生成的修复建议',
      'tickets.kpi.open': '开放工单',
      'tickets.kpi.open.sub': '等待修复',
      'tickets.kpi.exposure': '估算风险',
      'tickets.kpi.exposure.sub': '若不修复的潜在罚款',
      'tickets.kpi.resolved': '已解决',
      'tickets.kpi.resolved.sub': '已关闭',
      'tickets.kpi.total': '工单总数',
      'tickets.kpi.total.sub': '全部',
      'tickets.list': '修复队列',
      'tickets.list.desc': 'SENTRY 检测到的每个警告或严重事件都会在此处生成工单,包含未解决时的估算成本和建议修复。',
      'tickets.filter.all': '全部',
      'tickets.filter.open': '开放',
      'tickets.filter.in_progress': '处理中',
      'tickets.filter.resolved': '已解决',
      'tickets.filter.dismissed': '已驳回',

      'brand.sub.arch': '架构 · 系统内部如何工作',
      'arch.hero.eyebrow': '系统架构',
      'arch.hero.title': '面向企业 AI 的持续合规大脑',
      'arch.hero.sub': 'ARCA SENTRY 是一个多代理系统,实时审计您 AI 产生的每一次交互,以欧盟监管框架为准则。围绕五个专业审计代理、Gemini Pro 综合器和带哈希链的只追加事件存储构建 — 每个决策按设计可法证重现且防篡改。',
      'arch.metric.latency': '端到端 p95 延迟',
      'arch.metric.agents': '专业审计代理',
      'arch.metric.integrity': '日志完整性 (SHA-256)',
      'arch.metric.langs': '支持的语言',
      'arch.flow.title': '请求流 · 交互如何变成已审计的决策',
      'arch.flow.desc': '每次聊天或语音交互都通过相同的六阶段流水线。各阶段尽可能并行 — 即使综合器使用前沿模型,总耗时仍保持在六秒以内。',
      'arch.agents.title': '五个审计代理 · 按领域专业化',
      'arch.agents.desc': '每个代理掌管一个监管或风险家族。它们共享一个基类(启发式预过滤 → 专业 LLM 判断),但使用不同的系统提示和不同的 Featherless 开源模型。这使 p95 延迟保持低水平:大多数交互完全跳过 LLM 调用。',
      'arch.severity.title': '严重性模型 · 三层级,共识保护',
      'arch.severity.desc': '单个产生幻觉的代理不能单方面阻止生产流量。仅当多个代理趋于一致 — 或证据无可辩驳时 — 才触发严重事件。',
      'arch.integrity.title': '防篡改审计日志 · 设计上即为法证',
      'arch.integrity.desc': '系统观察到的每个事件 — 交互、发现、决策、工单状态变更 — 都会追加到 SHA-256 哈希链事件存储中。该链可在单次调用中端到端验证。',
      'arch.stack.title': '技术栈',
      'arch.stack.desc': 'Linux 优先,ARM64 原生,全程 asyncio。设计为在单台 Vultr VM 上运行小型企业,在 Kubernetes 上水平扩展到企业级。',
      'arch.perf.title': '性能范围',
      'arch.perf.desc': '在生产环境 NVIDIA Grace ARM64 实例上,针对真实 Featherless 和 Gemini 端点进行测量。',
      'arch.sec.title': '安全保证',
      'arch.sec.desc': '默认内置;无可选项。符合 OWASP LLM Top 10、SOC 2 就绪和 EU AI Act 合规控制。',
      'arch.topo.title': '部署拓扑',
      'arch.topo.desc': '从单个 1 vCPU 的 Vultr 实例到多区域 Kubernetes 集群。',
    },

    pt: {
      'brand.sub.ops': 'Centro de Operações de Conformidade',
      'brand.sub.playground': 'Demonstração ao vivo · converse com um bot vulnerável, veja SENTRY auditar',
      'brand.sub.voice': 'Auditoria do Canal de Voz · fale com o bot, veja SENTRY ouvir',
      'nav.dashboard': 'Painel',
      'nav.tickets': 'Tickets',
      'nav.playground': 'Demo',
      'nav.voice': 'Voz',
      'nav.architecture': 'Arquitetura',
      'nav.github': 'GitHub →',
      'status.connecting': 'conectando…',
      'status.live': 'ao vivo',
      'status.offline': 'offline',

      'kpi.compliance': 'Taxa de conformidade',
      'kpi.compliance.sub': 'últimas 24 h',
      'kpi.critical': 'Violações críticas',
      'kpi.critical.sub': 'bloqueadas no gateway',
      'kpi.warning': 'Avisos',
      'kpi.warning.sub': 'equipe de compliance notificada',
      'kpi.total': 'Interações auditadas',
      'kpi.total.sub': '/min · ao vivo',

      'demo.title': 'Teste ao vivo',
      'demo.desc': 'Clique em um cenário para executar uma interação sintética por todo o pipeline. Seis violações pré-carregadas em EU AI Act, GDPR, DORA, PII e prompt injection — em inglês, espanhol e italiano.',

      'chart.donut.title': 'Visão geral de conformidade',
      'chart.donut.sub': 'detalhamento 24 h',
      'chart.timeline.title': 'Linha do tempo de violações',
      'chart.timeline.sub': 'Interações vs avisos vs críticas, por hora',
      'chart.regs.title': 'Regulamentos mais violados',
      'chart.regs.sub': 'Achados por regulamento, últimas 24 h',
      'chart.council.title': 'Conselho de auditores',
      'chart.council.sub': '5 agentes especializados, carga atual',

      'feed.title': 'Fluxo de eventos ao vivo',
      'feed.desc': 'Clique em qualquer linha para o detalhe forense · atualiza a cada 3 s',
      'feed.filter.all': 'Todos',
      'feed.filter.critical': 'Críticos',
      'feed.filter.warning': 'Aviso',
      'feed.filter.advisory': 'Informativo',
      'feed.col.time': 'Hora',
      'feed.col.severity': 'Severidade',
      'feed.col.channel': 'Canal',
      'feed.col.actor': 'Ator',
      'feed.col.snippet': 'Trecho',
      'feed.col.findings': 'Achados',
      'feed.col.action': 'Ação',
      'feed.empty.initial': 'Sem eventos ainda — clique em um cenário para começar.',
      'feed.empty.filtered': 'Nenhum evento corresponde ao filtro atual.',

      'drawer.title': 'Detalhe de auditoria',
      'drawer.section.transcript': 'Transcrição da conversa',
      'drawer.section.findings': 'Achados dos auditores',
      'drawer.section.report': 'Relatório de conformidade — Gemini Pro',
      'drawer.section.hash': 'Hash à prova de adulteração · SHA-256',
      'drawer.no_findings': 'Sem achados — todos os agentes aprovaram esta interação.',
      'drawer.no_transcript': 'Esta interação foi registrada sem transcrição.',
      'drawer.download_pdf': 'Baixar PDF',
      'drawer.raw_json': 'JSON bruto',
      'drawer.html_view': 'Visão HTML',
      'drawer.role.user': 'Usuário',
      'drawer.role.ai': 'IA',

      'verdict.advisory': 'Informativo · apenas registrado',
      'verdict.warning': 'Aviso · equipe de compliance notificada',
      'verdict.critical': 'Crítico · resposta BLOQUEADA no gateway',

      'pg.toolbar.bot_label': 'Bot sob auditoria:',
      'pg.toolbar.reset': '↺ Reiniciar conversa',
      'pg.toolbar.hint_html': 'O bot é <strong>intencionalmente vulnerável</strong> para fins de demo. Tente os ataques sugeridos abaixo ou escreva o seu.',
      'pg.suggested.title': 'Tente um destes',
      'pg.suggested.desc': 'Clique em um prompt para enviá-lo ao bot e ver como o SENTRY reage.',
      'pg.conversation.title': 'Conversa',
      'pg.empty.line1': 'Comece a digitar abaixo — ou clique em um ataque sugerido acima.',
      'pg.empty.line2': 'Cada troca é auditada pelo SENTRY em tempo real.',
      'pg.input.placeholder': 'Digite uma mensagem para o bot… (Enter para enviar)',
      'pg.send': 'Enviar →',
      'pg.sentry.title': 'SENTRY · auditoria ao vivo',
      'pg.sentry.awaiting': 'aguardando interação…',
      'pg.sentry.empty_verdict': 'Nenhuma interação auditada ainda.',
      'pg.sentry.no_findings': 'Sem achados — todos os cinco agentes aprovaram.',

      'voice.hero.title': 'Fale com um bot de voz vulnerável',
      'voice.hero.desc1': 'Pressione o microfone, faça uma pergunta que um agente de voz bancário real poderia tratar mal, e veja SENTRY transcrever e auditar a chamada em tempo real. Funciona em português, inglês, espanhol e italiano.',
      'voice.hero.desc2': 'Usa o microfone do navegador através da Web Speech API para transcrição, e Speechmatics está configurado no backend para STT de produção.',
      'voice.mic.idle': 'Mantenha para falar',
      'voice.mic.listening': 'Ouvindo — solte',
      'voice.transcript.title': 'Transcrição ao vivo',
      'voice.transcript.idle': 'toque no mic para começar',
      'voice.transcript.recording': '● gravando — fale agora',
      'voice.transcript.audit': 'auditando…',
      'voice.transcript.empty1': 'Mantenha o botão do microfone e fale.',
      'voice.transcript.empty2': 'Quando parar de falar, o bot responde e SENTRY audita a troca.',
      'voice.suggestions.title': 'Frases sugeridas para ler em voz alta',
      'voice.suggestions.desc': 'Tente dizer uma destas — o bot está configurado para tropeçar em cada uma, dando ao SENTRY muito para sinalizar.',

      'alert.detected': 'VIOLAÇÃO DETECTADA',

      'tickets.title': 'Tickets de conformidade · remediações automáticas',
      'tickets.kpi.open': 'Tickets abertos',
      'tickets.kpi.open.sub': 'aguardando remediação',
      'tickets.kpi.exposure': 'Exposição estimada',
      'tickets.kpi.exposure.sub': 'multas potenciais se não remediadas',
      'tickets.kpi.resolved': 'Resolvidos',
      'tickets.kpi.resolved.sub': 'fechados',
      'tickets.kpi.total': 'Total de tickets',
      'tickets.kpi.total.sub': 'histórico completo',
      'tickets.list': 'Fila de remediação',
      'tickets.list.desc': 'Cada aviso ou crítico detectado pelo SENTRY vira um ticket aqui, com um custo estimado se não resolvido e uma proposta de correção.',
      'tickets.filter.all': 'Todos',
      'tickets.filter.open': 'Abertos',
      'tickets.filter.in_progress': 'Em andamento',
      'tickets.filter.resolved': 'Resolvidos',
      'tickets.filter.dismissed': 'Descartados',

      'brand.sub.arch': 'Arquitetura · como o sistema funciona por dentro',
      'arch.hero.eyebrow': 'Arquitetura do sistema',
      'arch.hero.title': 'Um cérebro de conformidade contínua para IA empresarial',
      'arch.hero.sub': 'ARCA SENTRY é um sistema multi-agente que audita cada interação produzida pela sua IA, em tempo real, contra frameworks regulatórios da UE. Construído em torno de cinco agentes auditores especializados, um sintetizador Gemini Pro e um event store append-only com hash em cadeia — cada decisão é forensicamente reprodutível e à prova de adulteração por design.',
      'arch.metric.latency': 'Latência p95 ponta a ponta',
      'arch.metric.agents': 'Agentes auditores especializados',
      'arch.metric.integrity': 'Integridade do log (SHA-256)',
      'arch.metric.langs': 'Idiomas suportados',
      'arch.flow.title': 'Fluxo de requisição · como uma interação vira uma decisão auditada',
      'arch.flow.desc': 'Cada troca de chat ou voz passa pelo mesmo pipeline de seis estágios. Os estágios rodam em paralelo quando possível — o tempo total fica abaixo de seis segundos mesmo com modelos de fronteira no sintetizador.',
      'arch.agents.title': 'Os cinco agentes auditores · especializados por domínio',
      'arch.agents.desc': 'Cada agente é dono de uma regulamentação ou família de risco. Eles compartilham uma classe base (pré-filtro heurístico → julgamento LLM especializado) mas usam system prompts e modelos open-source diferentes do Featherless. Isso mantém a latência p95 baixa: a maioria das interações pula a chamada ao LLM totalmente.',
      'arch.severity.title': 'Modelo de severidade · três níveis, protegido por consenso',
      'arch.severity.desc': 'Um único agente alucinando não pode bloquear unilateralmente o tráfego produtivo. Crítico dispara apenas quando múltiplos agentes convergem — ou quando a evidência é irrefutável.',
      'arch.integrity.title': 'Log auditável à prova de adulteração · forense por padrão',
      'arch.integrity.desc': 'Cada evento que o sistema observa — interações, achados, decisões, mudanças de estado de tickets — anexa a um event store encadeado por SHA-256. A cadeia é verificável ponta a ponta em uma única chamada.',
      'arch.stack.title': 'Stack tecnológico',
      'arch.stack.desc': 'Linux-first, ARM64-nativo, asyncio em todas as camadas. Projetado para rodar em uma única VM Vultr para PMEs e escalar horizontalmente em Kubernetes para grandes empresas.',
      'arch.perf.title': 'Envelope de performance',
      'arch.perf.desc': 'Medido na instância produtiva NVIDIA Grace ARM64, contra endpoints reais de Featherless e Gemini.',
      'arch.sec.title': 'Garantias de segurança',
      'arch.sec.desc': 'Integradas por padrão; nada opcional. Alinhadas com OWASP LLM Top 10, prontas para SOC 2, e controles de conformidade do EU AI Act.',
      'arch.topo.title': 'Topologias de deployment',
      'arch.topo.desc': 'De uma única instância Vultr de 1 vCPU a um cluster Kubernetes multi-região.',
    },
  };

  let currentLang = (function () {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored && DICT[stored]) return stored;
    } catch {}
    const nav = (navigator.language || 'en').slice(0, 2);
    return DICT[nav] ? nav : DEFAULT;
  })();

  function t(key, fallback) {
    return (DICT[currentLang] && DICT[currentLang][key])
        || (DICT[DEFAULT] && DICT[DEFAULT][key])
        || (fallback ?? key);
  }

  function applyAll() {
    document.documentElement.lang = currentLang;
    document.querySelectorAll('[data-i18n]').forEach((el) => {
      const key = el.getAttribute('data-i18n');
      if (el.hasAttribute('data-i18n-html')) {
        el.innerHTML = t(key);
      } else {
        el.textContent = t(key);
      }
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
      const key = el.getAttribute('data-i18n-placeholder');
      el.placeholder = t(key);
    });
    document.querySelectorAll('[data-i18n-title]').forEach((el) => {
      const key = el.getAttribute('data-i18n-title');
      el.title = t(key);
    });
    document.dispatchEvent(new CustomEvent('i18n:changed', { detail: { lang: currentLang } }));
  }

  function setLang(lang) {
    if (!DICT[lang]) lang = DEFAULT;
    currentLang = lang;
    try { localStorage.setItem(STORAGE_KEY, lang); } catch {}
    applyAll();
  }

  function inject() {
    // Guard: only inject once per page
    if (document.querySelector('.lang-switch')) return;

    // Build the select element
    const wrap = document.createElement('select');
    wrap.className = 'lang-switch';
    wrap.id = 'lang-switch';
    wrap.title = 'Language';
    wrap.innerHTML = `
      <option value="en">🇬🇧 EN</option>
      <option value="es">🇪🇸 ES</option>
      <option value="it">🇮🇹 IT</option>
      <option value="pt">🇧🇷 PT</option>
      <option value="zh">🇨🇳 中文</option>
    `;
    wrap.value = currentLang;
    wrap.onchange = (e) => setLang(e.target.value);

    // Preferred slot: .topbar-right (new layout used in dashboard/tickets)
    const right = document.querySelector('.topbar-right');
    if (right) {
      const pill = right.querySelector('.status-pill');
      if (pill) right.insertBefore(wrap, pill);
      else right.appendChild(wrap);
      return;
    }

    // Fallback: explicit data-i18n-slot, or directly inside .topbar
    const slot = document.querySelector('[data-i18n-slot]') || document.querySelector('.topbar');
    if (!slot) return;

    // If .topbar has a direct .status-pill child, place lang switch before it
    const pill = slot.querySelector(':scope > .status-pill');
    if (pill) {
      slot.insertBefore(wrap, pill);
    } else {
      slot.appendChild(wrap);
    }
  }

  function init() {
    inject();
    applyAll();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // expose API
  window.i18n = { t, setLang, getLang: () => currentLang, applyAll };
  window.t = t;
})();
