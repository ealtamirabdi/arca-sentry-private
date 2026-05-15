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
    },

    es: {
      'brand.sub.ops': 'Centro de Operaciones de Cumplimiento',
      'brand.sub.playground': 'Demo en vivo · habla con un bot vulnerable, mira cómo SENTRY audita',
      'brand.sub.voice': 'Auditoría de Canal de Voz · habla con el bot, mira a SENTRY escuchar',
      'nav.dashboard': 'Panel',
      'nav.tickets': 'Tickets',
      'nav.playground': 'Demo',
      'nav.voice': 'Voz',
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
    },

    it: {
      'brand.sub.ops': 'Centro Operativo di Conformità',
      'brand.sub.playground': 'Demo dal vivo · parla con un bot vulnerabile, guarda SENTRY all\'opera',
      'brand.sub.voice': 'Audit del Canale Vocale · parla con il bot, guarda SENTRY ascoltare',
      'nav.dashboard': 'Pannello',
      'nav.tickets': 'Tickets',
      'nav.playground': 'Demo',
      'nav.voice': 'Voce',
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
    },

    zh: {
      'brand.sub.ops': '合规运营中心',
      'brand.sub.playground': '实时演示 · 与脆弱机器人对话,观看 SENTRY 审计',
      'brand.sub.voice': '语音通道审计 · 与机器人通话,观看 SENTRY 监听',
      'nav.dashboard': '仪表盘',
      'nav.tickets': '工单',
      'nav.playground': '演示',
      'nav.voice': '语音',
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
    },

    pt: {
      'brand.sub.ops': 'Centro de Operações de Conformidade',
      'brand.sub.playground': 'Demonstração ao vivo · converse com um bot vulnerável, veja SENTRY auditar',
      'brand.sub.voice': 'Auditoria do Canal de Voz · fale com o bot, veja SENTRY ouvir',
      'nav.dashboard': 'Painel',
      'nav.tickets': 'Tickets',
      'nav.playground': 'Demo',
      'nav.voice': 'Voz',
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
    // Inject the language switcher in the topbar if a placeholder exists,
    // else append it to the .topbar.
    const slot = document.querySelector('[data-i18n-slot]') || document.querySelector('.topbar');
    if (!slot) return;
    if (slot.querySelector('.lang-switch')) return;

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

    // Insert before .status-pill if it exists, else append
    const statusPill = slot.querySelector('.status-pill');
    if (statusPill) {
      slot.insertBefore(wrap, statusPill);
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
