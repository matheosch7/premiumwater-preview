// site-v3 — scroll-scrubbed pour video, EN/ES i18n, brand modes, lead form
(function () {
  // ---------- CONFIG ----------
  // Drop-in values the client/operator owns. Leave empty to keep demo fallbacks.
  const CONFIG = {
    // WhatsApp number in international format, digits only (e.g. '573001234567').
    // TODO: replace with the real client number once provided.
    WHATSAPP_NUMBER: '573000000000',
    // POST endpoint for lead submissions (Formspree / Resend / n8n / Zapier / direct CRM).
    // Leave empty string to fall back to console-only demo behavior.
    WEBHOOK_URL: '',
    // GA4 measurement ID, e.g. 'G-XXXXXXXX'. Empty = analytics disabled.
    GA4_ID: 'G-3TPNPFHF07'
  };

  const root = document.documentElement;
  root.setAttribute('data-theme', 'deep');
  root.setAttribute('data-motion', 'full');
  root.setAttribute('data-cine', 'sage');

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const smoothstep = (e0, e1, x) => {
    const t = clamp((x - e0) / (e1 - e0), 0, 1);
    return t * t * (3 - 2 * t);
  };

  // ---------- WhatsApp wiring ----------
  // Formats a digits-only international number into a human-readable string.
  // Colombia (+57) mobile: "573001234567" → "+57 300 123 4567"
  // Falls back to "+<digits>" for other lengths so it stays sensible.
  function formatWhatsAppDisplay(digits) {
    if (digits.length === 12 && digits.startsWith('57')) {
      return '+' + digits.slice(0, 2) + ' ' + digits.slice(2, 5) + ' ' + digits.slice(5, 8) + ' ' + digits.slice(8);
    }
    return '+' + digits;
  }
  function applyWhatsApp() {
    const digits = (CONFIG.WHATSAPP_NUMBER || '').replace(/\D/g, '');
    if (!digits) return;
    const url = 'https://wa.me/' + digits;
    const display = formatWhatsAppDisplay(digits);
    document.querySelectorAll('[data-wa]').forEach(el => { el.href = url; });
    document.querySelectorAll('[data-wa-display]').forEach(el => { el.textContent = display; });
  }

  // ---------- consent (Habeas Data / Ley 1581) ----------
  // Tri-state stored in localStorage:
  //   null         → no choice yet (banner shows)
  //   'analytics'  → user accepted analytics + essential
  //   'essential'  → user declined analytics
  function getConsent() { return localStorage.getItem('pw:consent'); }
  function setConsent(value) {
    localStorage.setItem('pw:consent', value);
    if (value === 'analytics' && CONFIG.GA4_ID && !window.gtag) initAnalytics();
  }

  // ---------- analytics (GA4) ----------
  // Loads gtag only when CONFIG.GA4_ID is set AND the visitor has accepted
  // analytics cookies. This keeps dev/preview clean and stays compliant with
  // Colombian Habeas Data + GDPR-style opt-in expectations.
  function initAnalytics() {
    if (!CONFIG.GA4_ID) return;
    if (getConsent() !== 'analytics') return;
    if (window.gtag) return; // already initialized
    const s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(CONFIG.GA4_ID);
    document.head.appendChild(s);
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag('js', new Date());
    window.gtag('config', CONFIG.GA4_ID);
  }
  function track(event, params) {
    if (typeof window.gtag === 'function') {
      window.gtag('event', event, params || {});
    }
  }

  // ---------- privacy notice ----------
  // Element ids/classes are namespaced (`pwNotice`, `.pw-notice`) so that
  // ad/tracker blocklists (Brave Shields, uBlock, EasyList Cookie) which
  // hide common selectors like `.cookie-banner` / `#cookieBanner` don't
  // strip our consent prompt — without it we can't lawfully load GA4.
  function setupConsentBanner() {
    const banner = document.getElementById('pwNotice');
    const acceptBtn = document.getElementById('pwNoticeAccept');
    const rejectBtn = document.getElementById('pwNoticeReject');
    const reopenBtn = document.getElementById('pwNoticeReopen');
    console.log('[pw] consent banner init', { banner: !!banner, consent: getConsent() });
    if (!banner) return;
    const show = () => {
      banner.removeAttribute('hidden');
      banner.hidden = false;
      void banner.offsetWidth;
      banner.classList.add('show');
    };
    const hide = () => { banner.classList.remove('show'); setTimeout(() => { banner.hidden = true; }, 320); };
    if (!getConsent()) setTimeout(show, 1200);
    if (acceptBtn) acceptBtn.addEventListener('click', () => { setConsent('analytics'); hide(); });
    if (rejectBtn) rejectBtn.addEventListener('click', () => { setConsent('essential'); hide(); });
    if (reopenBtn) reopenBtn.addEventListener('click', (e) => { e.preventDefault(); show(); });
  }

  // ---------- brand mode (calm | bold) ----------
  // Calm = sandpaper/gold páramo identity (default).
  // Bold = Liquid-Death-leaning party identity (3D bottle hero, crimson palette).
  // Both modes share copy bundles below — bold-only overrides live in COPY[lang].bold.
  let currentBrand = localStorage.getItem('pw:brand') || 'calm';
  let modelViewerLoaded = false;

  // Lazy-load Google's <model-viewer> module the first time bold mode activates,
  // so calm-only visitors never download the runtime or the 5 MB GLB.
  function ensureModelViewer() {
    if (modelViewerLoaded) return;
    modelViewerLoaded = true;
    const s = document.createElement('script');
    s.type = 'module';
    s.src = 'https://ajax.googleapis.com/ajax/libs/model-viewer/3.5.0/model-viewer.min.js';
    document.head.appendChild(s);
    mountBoldModel();
  }

  let boldModelEl = null;
  function mountBoldModel() {
    const mount = document.getElementById('boldModelMount');
    if (!mount || mount.dataset.mounted) return;
    mount.dataset.mounted = '1';
    const mv = document.createElement('model-viewer');
    mv.setAttribute('src', 'assets/bottle-bold.glb');
    mv.setAttribute('poster', 'assets/bottle-bold-poster.png');
    mv.setAttribute('alt', 'premiumwater bold edition');
    // No auto-rotate, no camera-controls: scroll position is the controller.
    mv.setAttribute('interaction-prompt', 'none');
    mv.setAttribute('disable-pan', '');
    mv.setAttribute('disable-tap', '');
    mv.setAttribute('disable-zoom', '');
    mv.setAttribute('shadow-intensity', '1.4');
    mv.setAttribute('shadow-softness', '0.7');
    mv.setAttribute('exposure', '1.05');
    mv.setAttribute('environment-image', 'neutral');
    // Initial pose — wide, slightly off-axis. updateBold() takes over on first scroll event.
    mv.setAttribute('camera-orbit', '0deg 80deg 8m');
    mv.setAttribute('field-of-view', '24deg');
    mount.appendChild(mv);
    boldModelEl = mv;
    mv.addEventListener('load', () => updateBold(), { once: true });
    // Mount the lime-green Cheers companion bottle in parallel.
    mountCheersModel();
  }

  let cheersModelEl = null;
  function mountCheersModel() {
    const mount = document.getElementById('boldBottleCheers');
    if (!mount || mount.dataset.mounted) return;
    mount.dataset.mounted = '1';
    const mv = document.createElement('model-viewer');
    mv.setAttribute('src', 'assets/bottle-green.glb');
    mv.setAttribute('poster', 'assets/bottle-green-poster.png');
    mv.setAttribute('alt', 'cheers companion bottle');
    mv.setAttribute('interaction-prompt', 'none');
    mv.setAttribute('disable-pan', '');
    mv.setAttribute('disable-tap', '');
    mv.setAttribute('disable-zoom', '');
    mv.setAttribute('shadow-intensity', '1.0');
    mv.setAttribute('shadow-softness', '0.7');
    mv.setAttribute('exposure', '1.05');
    mv.setAttribute('environment-image', 'neutral');
    mv.setAttribute('camera-orbit', '20deg 78deg 6m');
    mv.setAttribute('field-of-view', '28deg');
    mount.appendChild(mv);
    cheersModelEl = mv;
  }

  function applyBrand(mode) {
    if (mode !== 'calm' && mode !== 'bold') mode = 'calm';
    currentBrand = mode;
    root.setAttribute('data-brand', mode);
    localStorage.setItem('pw:brand', mode);
    document.querySelectorAll('.brand-pill button').forEach(b => {
      b.setAttribute('aria-pressed', b.dataset.brand === mode ? 'true' : 'false');
    });
    if (mode === 'bold') {
      ensureModelViewer();
      // Kick the choreography immediately so first paint matches scroll position.
      if (typeof updateBold === 'function') updateBold();
    } else if (typeof updateBold === 'function') {
      // Reset the mount transform so a later toggle back doesn't inherit a stale offset.
      const mount = document.getElementById('boldModelMount');
      if (mount) mount.style.transform = '';
    }
    // re-render i18n so bold-mode copy overrides take effect
    if (typeof applyLang === 'function') applyLang(currentLang);
  }
  document.querySelectorAll('.brand-pill button').forEach(b => {
    b.addEventListener('click', () => {
      applyBrand(b.dataset.brand);
      track('brand_toggle', { brand_mode: b.dataset.brand });
    });
  });

  // ---------- mobile drawer ----------
  const burger = document.getElementById('navBurger');
  const drawer = document.getElementById('navDrawer');
  function setDrawer(open) {
    if (!burger || !drawer) return;
    drawer.classList.toggle('open', open);
    burger.classList.toggle('is-open', open);
    burger.setAttribute('aria-expanded', open ? 'true' : 'false');
    drawer.setAttribute('aria-hidden', open ? 'false' : 'true');
    document.body.style.overflow = open ? 'hidden' : '';
  }
  if (burger && drawer) {
    burger.addEventListener('click', () => setDrawer(!drawer.classList.contains('open')));
    drawer.querySelectorAll('a').forEach(a => a.addEventListener('click', () => setDrawer(false)));
    window.addEventListener('keydown', (e) => { if (e.key === 'Escape') setDrawer(false); });
  }

  // ---------- i18n dictionary ----------
  // Placeholder English translated into believable Spanish. Real client copy
  // replaces both sides after signature.
  const COPY = {
    en: {
      'nav.product': 'Product', 'nav.story': 'Story', 'nav.trade': 'Trade', 'nav.impact': 'Impact',
      'nav.talk': 'Talk to us', 'nav.become': 'Become a distributor',
      'brand.calm': 'Calm', 'brand.bold': 'Bold',
      'badge.bottom': 'Est 2024 · Andes',
      'river.label': 'FLOW',
      'scroll.label': 'Scroll down', 'scroll.sub': '& pour in',
      'hero.eyebrow': 'Luxury water for the people',
      'hero.line1': 'Still water,', 'hero.line2': 'poured with', 'hero.line3': '<em>intention.</em>',
      'hero.lede': 'A Colombian table water bottled for restaurants, hotels and brands that treat hospitality as craft — poured with the same care as the meal it accompanies.',
      'hero.cta': 'Get started →',
      'act1.kicker': '01 — The source',  'act1.hed': 'From the <em>páramo</em>.',
      'act2.kicker': '02 — Opened',      'act2.hed': 'Unhurried.',
      'act3.kicker': '03 — Poured',      'act3.hed': 'With <em>intention</em>.',
      'act4.kicker': '04 — Served',      'act4.hed': 'premium<em>water</em>',
      'story.eyebrow': '01 · The source',
      'story.hed': 'From the <em>páramo</em>,<br/>unhurried.',
      'story.lede': 'Our water rises through volcanic rock in the Colombian high Andes and is bottled within forty kilometers of source. No long hauls, no stripping, no re-mineralization — only what the mountain gives.',
      'story.s1.k': 'Altitude', 'story.s1.v': '3,600 m páramo catchment',
      'story.s2.k': 'Mineral',  'story.s2.v': 'Low-to-medium, naturally alkaline',
      'story.s3.k': 'Distance', 'story.s3.v': '< 40 km from source to bottle',
      'story.s4.k': 'Packaging','story.s4.v': 'Glass first, PET where service demands',
      'product.eyebrow': '02 · The range',
      'product.hed': 'A small,<br/><em>considered</em> range.',
      'product.lede': 'Three formats, chosen so a front-of-house team never has to apologize. Specify by occasion; we handle the rest.',
      'product.p1.name': 'Carafe',  'product.p1.spec': '750 ml · Glass', 'product.p1.desc': 'A refillable service bottle for plated dining. Natural still.',
      'product.p2.name': 'Table',   'product.p2.spec': '500 ml · Glass', 'product.p2.desc': 'The everyday hospitality size. Fits any room, any cover.',
      'product.p3.name': 'Service', 'product.p3.spec': '330 ml · Glass', 'product.p3.desc': 'Individual service for bar, spa and hotel minibar.',
      'trade.eyebrow': '03 · Trade',
      'trade.hed': 'Built for the people<br/>who <em>pour it</em>.',
      'trade.lede': 'We partner with gyms, hotels, restaurants and distributors who want a premium still water that earns its place on the table without inflating the check.',
      'trade.c1.h': 'Wholesale pricing',   'trade.c1.p': 'Tiered by monthly volume with no listing fees.',
      'trade.c2.h': 'Cold-chain delivery', 'trade.c2.p': 'Temperature-controlled routes across five Colombian cities.',
      'trade.c3.h': 'Co-branded service',  'trade.c3.p': 'Custom menu cards and branded carafe service for qualifying partners.',
      'trade.c4.h': 'Net-30 terms',        'trade.c4.p': '30-day invoicing available after the first order cycle.',
      'trade.ctaDist': 'Become a distributor →', 'trade.ctaWA': 'WhatsApp us',
      'impact.eyebrow': '04 · Impact',
      'impact.hed': 'One liter in,<br/>one liter <em>forward</em>.',
      'impact.lede': 'For every case sold we fund one day of clean water access for a family in rural Colombia. It\'s the reason we exist.',
      'impact.s1': 'Liters funded', 'impact.s2': 'Communities served', 'impact.s3': 'Liter match / case', 'impact.s4': 'Audited yearly',
      'impact.p1.t': 'Chocó · Bahía Solano', 'impact.p1.d': 'Rainwater catchment and filtration for three Pacific coast communities.',
      'impact.p2.t': 'La Guajira · Wayúu',   'impact.p2.d': 'Well rehabilitation and solar pumping with the Wayúu council.',
      'impact.p3.t': 'Cauca · Tierradentro', 'impact.p3.d': 'Household ceramic filters and training, co-managed with local schools.',
      'contact.eyebrow': '05 · Become a distributor',
      'contact.hed': 'Tell us where<br/>you <em>pour</em>.',
      'contact.lede': 'Fill in the form and our trade team will come back within one business day. If you\'d rather speak now, WhatsApp is the fastest channel.',
      'contact.d1.k': 'Trade', 'contact.d2.k': 'WhatsApp', 'contact.d3.k': 'Office', 'contact.d3.v': 'Carrera 11 · Bogotá, CO',
      'form.head': 'Inquiry form',
      'form.business': 'Business name', 'form.name': 'Contact name', 'form.city': 'City',
      'form.email': 'Work email', 'form.whatsapp': 'WhatsApp',
      'form.type': 'Business type', 'form.volume': 'Monthly volume',
      'form.notes': 'Anything we should know',
      'form.reply': 'We reply within 1 business day.', 'form.submit': 'Submit →',
      'form.privacy': 'We use your details only to reply to this inquiry. Never shared.',
      'form.successHead': 'Thank you — we\'ll be in touch within one business day.',
      'form.successWA': 'Prefer to chat now? WhatsApp us →',
      'foot.tag': 'Luxury water for the people. Bottled in Colombia since 2024.',
      'foot.meta': '© 2026 · Bogotá, CO',
      'foot.privacy': 'Privacy', 'foot.terms': 'Terms', 'foot.cookies': 'Cookies', 'foot.cookieReopen': 'Cookie preferences',
      'cookie.title': 'Cookies & analytics',
      'cookie.body': 'We use a small amount of data to understand how this site is used and improve it. You can accept analytics cookies, or keep things essential-only. Your choice is remembered.',
      'cookie.accept': 'Accept analytics', 'cookie.reject': 'Essential only',
      'select.type': ['Restaurant','Hotel','Gym / Wellness','Retail','Distributor','Event / Catering','Other'],
      'select.volume': ['< 10 cases','10–49 cases','50–249 cases','250+ cases','Not sure yet'],
      'marquee': ['Colombian owned','Bottled at source','Glass first','Wholesale ready','Cold-chain delivery','Bogotá · Medellín · Cartagena']
    },
    es: {
      'nav.product': 'Producto', 'nav.story': 'Historia', 'nav.trade': 'Mayoreo', 'nav.impact': 'Impacto',
      'nav.talk': 'Hablemos', 'nav.become': 'Ser distribuidor',
      'brand.calm': 'Calmo', 'brand.bold': 'Audaz',
      'badge.bottom': 'Fund. 2024 · Andes',
      'river.label': 'CAUDAL',
      'scroll.label': 'Desliza', 'scroll.sub': 'y sírvete',
      'hero.eyebrow': 'Agua de lujo, para la gente',
      'hero.line1': 'Agua sin gas,', 'hero.line2': 'servida con', 'hero.line3': '<em>intención.</em>',
      'hero.lede': 'Un agua de mesa colombiana embotellada para restaurantes, hoteles y marcas que viven la hospitalidad como oficio — servida con el mismo cuidado que el plato que acompaña.',
      'hero.cta': 'Empezar →',
      'act1.kicker': '01 — El origen',   'act1.hed': 'Desde el <em>páramo</em>.',
      'act2.kicker': '02 — Abierta',      'act2.hed': 'Sin prisa.',
      'act3.kicker': '03 — Servida',      'act3.hed': 'Con <em>intención</em>.',
      'act4.kicker': '04 — Presentada',   'act4.hed': 'premium<em>water</em>',
      'story.eyebrow': '01 · El origen',
      'story.hed': 'Desde el <em>páramo</em>,<br/>sin prisa.',
      'story.lede': 'Nuestra agua nace entre roca volcánica en los Andes colombianos y se embotella a menos de cuarenta kilómetros de la fuente. Sin trayectos largos, sin remineralización — solo lo que da la montaña.',
      'story.s1.k': 'Altitud',    'story.s1.v': 'Páramo a 3.600 m',
      'story.s2.k': 'Minerales',  'story.s2.v': 'Bajos a medios, alcalinidad natural',
      'story.s3.k': 'Distancia',  'story.s3.v': '< 40 km de fuente a botella',
      'story.s4.k': 'Empaque',    'story.s4.v': 'Vidrio primero, PET donde lo pida el servicio',
      'product.eyebrow': '02 · La gama',
      'product.hed': 'Una gama pequeña,<br/><em>pensada</em>.',
      'product.lede': 'Tres formatos, elegidos para que un equipo de sala nunca tenga que disculparse. Dinos la ocasión; del resto nos encargamos nosotros.',
      'product.p1.name': 'Jarra',    'product.p1.spec': '750 ml · Vidrio', 'product.p1.desc': 'Botella de servicio recargable para mesa. Sin gas, natural.',
      'product.p2.name': 'Mesa',     'product.p2.spec': '500 ml · Vidrio', 'product.p2.desc': 'La medida cotidiana de la hospitalidad. Encaja en cualquier sala.',
      'product.p3.name': 'Servicio', 'product.p3.spec': '330 ml · Vidrio', 'product.p3.desc': 'Formato individual para barra, spa y minibar de hotel.',
      'trade.eyebrow': '03 · Mayoreo',
      'trade.hed': 'Hecha para quienes<br/>la <em>sirven</em>.',
      'trade.lede': 'Trabajamos con gimnasios, hoteles, restaurantes y distribuidores que buscan un agua premium que se gana su lugar en la mesa sin inflar la cuenta.',
      'trade.c1.h': 'Precios mayoristas',  'trade.c1.p': 'Escalonados por volumen mensual, sin tarifas de listado.',
      'trade.c2.h': 'Reparto en frío',     'trade.c2.p': 'Rutas de temperatura controlada en cinco ciudades colombianas.',
      'trade.c3.h': 'Servicio co-branded', 'trade.c3.p': 'Cartas a medida y jarras marcadas para socios calificados.',
      'trade.c4.h': 'Crédito a 30 días',   'trade.c4.p': 'Factura a 30 días disponible tras el primer ciclo de pedido.',
      'trade.ctaDist': 'Ser distribuidor →', 'trade.ctaWA': 'Escríbenos por WhatsApp',
      'impact.eyebrow': '04 · Impacto',
      'impact.hed': 'Un litro dentro,<br/>un litro <em>adelante</em>.',
      'impact.lede': 'Por cada caja vendida financiamos un día de agua potable para una familia en la Colombia rural. Esa es la razón por la que existimos.',
      'impact.s1': 'Litros financiados', 'impact.s2': 'Comunidades atendidas', 'impact.s3': 'Litro x litro / caja', 'impact.s4': 'Auditado anualmente',
      'impact.p1.t': 'Chocó · Bahía Solano', 'impact.p1.d': 'Captación de agua lluvia y filtración en tres comunidades del Pacífico.',
      'impact.p2.t': 'La Guajira · Wayúu',   'impact.p2.d': 'Rehabilitación de pozos y bombeo solar junto al consejo Wayúu.',
      'impact.p3.t': 'Cauca · Tierradentro', 'impact.p3.d': 'Filtros cerámicos y formación en los hogares, con las escuelas locales.',
      'contact.eyebrow': '05 · Ser distribuidor',
      'contact.hed': 'Dinos dónde<br/>la <em>sirves</em>.',
      'contact.lede': 'Llena el formulario y nuestro equipo comercial responde en un día hábil. Si prefieres hablar ahora, WhatsApp es el canal más rápido.',
      'contact.d1.k': 'Comercial', 'contact.d2.k': 'WhatsApp', 'contact.d3.k': 'Oficina', 'contact.d3.v': 'Carrera 11 · Bogotá, CO',
      'form.head': 'Formulario',
      'form.business': 'Nombre del negocio', 'form.name': 'Nombre de contacto', 'form.city': 'Ciudad',
      'form.email': 'Email corporativo', 'form.whatsapp': 'WhatsApp',
      'form.type': 'Tipo de negocio', 'form.volume': 'Volumen mensual',
      'form.notes': 'Algo que debamos saber',
      'form.reply': 'Respondemos en 1 día hábil.', 'form.submit': 'Enviar →',
      'form.privacy': 'Usamos tus datos solo para responder esta solicitud. Nunca se comparten.',
      'form.successHead': 'Gracias — te contactamos en un día hábil.',
      'form.successWA': '¿Prefieres hablar ahora? Escríbenos por WhatsApp →',
      'foot.tag': 'Agua de lujo, para la gente. Embotellada en Colombia desde 2024.',
      'foot.meta': '© 2026 · Bogotá, CO',
      'foot.privacy': 'Privacidad', 'foot.terms': 'Términos', 'foot.cookies': 'Cookies', 'foot.cookieReopen': 'Preferencias de cookies',
      'cookie.title': 'Cookies y analítica',
      'cookie.body': 'Usamos algunos datos para entender cómo se usa el sitio y mejorarlo. Puedes aceptar las cookies de analítica, o mantener solo las esenciales. Recordamos tu elección.',
      'cookie.accept': 'Aceptar analítica', 'cookie.reject': 'Solo esenciales',
      'select.type': ['Restaurante','Hotel','Gimnasio / Bienestar','Retail','Distribuidor','Evento / Catering','Otro'],
      'select.volume': ['< 10 cajas','10–49 cajas','50–249 cajas','250+ cajas','Aún no lo sé'],
      'marquee': ['Propiedad colombiana','Embotellada en la fuente','Vidrio primero','Lista para mayoreo','Entrega en frío','Bogotá · Medellín · Cartagena']
    }
  };

  // Bold-mode copy overrides — only the keys that *change* tone in party identity.
  // Anything not listed here falls through to the calm dictionary above.
  const BOLD_COPY = {
    en: {
      'hero.eyebrow': 'Hydration · Loud edition',
      'hero.line1': 'Drink water',
      'hero.line2': 'like you',
      'hero.line3': '<em>mean it.</em>',
      'hero.lede': "Same Andean source, louder personality. A premium still water for gyms, nightclubs and venues that don't apologize for their volume.",
      'hero.cta': 'Stock the bar →',
      'story.eyebrow': '01 · The source',
      'story.hed': 'Mountain water,<br/><em>no apologies.</em>',
      'story.lede': 'Same volcanic páramo, same forty-kilometer haul, same zero re-mineralization — but bottled for venues that move at 130 BPM. The mountain doesn\'t care about your dress code.',
      'product.eyebrow': '02 · The lineup',
      'product.hed': 'Three sizes,<br/><em>one volume.</em>',
      'product.lede': 'Sized for the bar rail, the gym floor and the green room. Specify by setting; we keep your fridge stocked.',
      'trade.eyebrow': '03 · For venues',
      'trade.hed': 'Built for the floor,<br/><em>not the lobby.</em>',
      'trade.lede': 'Gyms, nightclubs, festivals, fight nights. We serve venues where water has to keep up with the room.',
      'impact.eyebrow': '04 · One for one',
      'impact.hed': 'Loud here,<br/><em>useful there.</em>',
      'impact.lede': 'Every case poured at your bar funds one day of clean water for a Colombian family. The mountain pays it forward.',
      'contact.eyebrow': '05 · Get on the list',
      'contact.hed': 'Tell us where<br/>you <em>pour it loud.</em>',
      'contact.lede': "Drop your venue and we'll be in touch within a business day. WhatsApp is faster.",
      'foot.tag': 'Loud water for loud rooms. Bottled in Colombia since 2024.',
      'marquee': ['Drink loud','Bottled at source','Colombian owned','Built for venues','Cold-chain delivery','Same liquid · zero apologies']
    },
    es: {
      'hero.eyebrow': 'Hidratación · Edición fuerte',
      'hero.line1': 'Toma agua',
      'hero.line2': 'como si',
      'hero.line3': '<em>te importara.</em>',
      'hero.lede': 'Misma fuente andina, mayor volumen. Agua sin gas premium para gimnasios, discotecas y locales que no piden disculpas por su intensidad.',
      'hero.cta': 'Surte la barra →',
      'story.eyebrow': '01 · El origen',
      'story.hed': 'Agua de la montaña,<br/><em>sin disculpas.</em>',
      'story.lede': 'Mismo páramo volcánico, mismos cuarenta kilómetros, cero remineralización — embotellada para locales que viven a 130 BPM. A la montaña le da igual el código de vestimenta.',
      'product.eyebrow': '02 · La línea',
      'product.hed': 'Tres tamaños,<br/><em>un volumen.</em>',
      'product.lede': 'Pensados para la barra, el piso del gym y el camerino. Especifica el escenario; nosotros mantenemos la nevera llena.',
      'trade.eyebrow': '03 · Para locales',
      'trade.hed': 'Hecha para la pista,<br/><em>no el lobby.</em>',
      'trade.lede': 'Gimnasios, discotecas, festivales, peleas. Servimos a los locales donde el agua tiene que seguirle el ritmo al cuarto.',
      'impact.eyebrow': '04 · Uno a uno',
      'impact.hed': 'Fuerte aquí,<br/><em>útil allá.</em>',
      'impact.lede': 'Cada caja servida en tu barra financia un día de agua potable para una familia colombiana. La montaña paga el favor.',
      'contact.eyebrow': '05 · Únete',
      'contact.hed': 'Cuéntanos dónde<br/>la <em>sirves fuerte.</em>',
      'contact.lede': 'Déjanos tu local y te respondemos en un día hábil. WhatsApp es más rápido.',
      'foot.tag': 'Agua fuerte para cuartos ruidosos. Embotellada en Colombia desde 2024.',
      'marquee': ['Sírvela fuerte','Embotellada en la fuente','Propiedad colombiana','Hecha para locales','Entrega en frío','Mismo líquido · cero disculpas']
    }
  };

  let currentLang = localStorage.getItem('pw:lang') || 'en';

  function applyLang(lang) {
    if (!COPY[lang]) lang = 'en';
    currentLang = lang;
    // Merge bold overrides on top of calm dict when in bold mode.
    const base = COPY[lang];
    const dict = currentBrand === 'bold' && BOLD_COPY[lang]
      ? Object.assign({}, base, BOLD_COPY[lang])
      : base;
    root.setAttribute('lang', lang);
    localStorage.setItem('pw:lang', lang);

    document.querySelectorAll('[data-i18n]').forEach(el => {
      const k = el.getAttribute('data-i18n');
      if (dict[k] != null) el.textContent = dict[k];
    });
    document.querySelectorAll('[data-i18n-html]').forEach(el => {
      const k = el.getAttribute('data-i18n-html');
      if (dict[k] != null) el.innerHTML = dict[k];
    });

    // selects
    const setOptions = (id, key) => {
      const sel = document.getElementById(id);
      if (!sel) return;
      const prev = sel.value;
      sel.innerHTML = '';
      (dict[key] || []).forEach(v => {
        const o = document.createElement('option');
        o.value = v; o.textContent = v;
        sel.appendChild(o);
      });
      if (prev) sel.value = prev;
    };
    setOptions('selType', 'select.type');
    setOptions('selVolume', 'select.volume');

    // marquee — duplicate for seamless loop
    const track = document.getElementById('marqueeTrack');
    if (track) {
      track.innerHTML = '';
      const items = dict['marquee'] || [];
      for (let pass = 0; pass < 2; pass++) {
        items.forEach(label => {
          const s = document.createElement('span'); s.textContent = label;
          const e = document.createElement('em'); e.textContent = '✦';
          track.appendChild(s); track.appendChild(e);
        });
      }
    }

    // lang-pill pressed state
    document.querySelectorAll('.lang-pill button').forEach(b => {
      b.setAttribute('aria-pressed', b.dataset.lang === lang ? 'true' : 'false');
    });
  }

  document.querySelectorAll('.lang-pill button').forEach(b => {
    b.addEventListener('click', () => applyLang(b.dataset.lang));
  });

  // ---------- reveal on scroll ----------
  let io;
  function setupReveal() {
    if (io) io.disconnect();
    root.setAttribute('data-reveal-ready', '');
    const els = Array.from(document.querySelectorAll('.reveal'));
    const vh = window.innerHeight || 800;
    els.forEach(el => {
      const r = el.getBoundingClientRect();
      if (r.top < vh * 0.9) el.classList.add('in');
    });
    io = new IntersectionObserver((entries) => {
      entries.forEach(en => {
        if (en.isIntersecting) {
          en.target.classList.add('in');
          io.unobserve(en.target);
        }
      });
    }, { rootMargin: '0px 0px -80px 0px' });
    els.forEach(el => { if (!el.classList.contains('in')) io.observe(el); });
  }

  // ---------- cinematic stage: scroll-scrubbed video ----------
  const cineStage    = document.getElementById('cineStage');
  const cineVideo    = document.getElementById('cineVideo');
  const cineProgress = document.getElementById('cineProgressFill');
  const captionEls   = Array.from(document.querySelectorAll('.cine-caption'));
  const scrollCard   = document.getElementById('scrollCard');
  const productEl    = document.getElementById('product');

  // respect reduced-motion: hide video, keep poster backdrop
  const reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reducedMotion && cineVideo) {
    cineVideo.style.display = 'none';
    root.setAttribute('data-motion', 'off');
  }

  function zoneEnd() {
    if (productEl) return productEl.getBoundingClientRect().top + window.scrollY - window.innerHeight * 0.3;
    return window.innerHeight * 3;
  }

  function videoScrubbable() {
    return cineVideo && isFinite(cineVideo.duration) && cineVideo.duration > 0;
  }

  function updateCine() {
    if (!cineStage) return;
    const p = clamp(window.scrollY / Math.max(zoneEnd(), 1), 0, 1);
    cineStage.style.opacity = 1 - smoothstep(0.9, 1.0, p);

    if (videoScrubbable()) {
      try { cineVideo.currentTime = p * cineVideo.duration; } catch (e) {}
    }

    let activeAct = 0;
    if (p >= 0.08 && p < 0.30)      activeAct = 1;
    else if (p >= 0.30 && p < 0.55) activeAct = 2;
    else if (p >= 0.55 && p < 0.82) activeAct = 3;
    else if (p >= 0.82)             activeAct = 4;
    captionEls.forEach(el => {
      el.classList.toggle('is-active', parseInt(el.dataset.act, 10) === activeAct);
    });

    if (cineProgress) cineProgress.style.height = (p * 100) + '%';
    if (scrollCard) scrollCard.classList.toggle('hide', window.scrollY > 120);
  }

  // On small / likely-mobile viewports, defer the 6.8MB pour video until the
  // user actually starts scrolling. Until then, the poster (cine-static) handles
  // first paint with zero network cost. As soon as scroll begins, we upgrade
  // preload to 'metadata' so scrubbing engages without a long wait.
  if (cineVideo && window.innerWidth <= 900) {
    cineVideo.preload = 'none';
    let upgraded = false;
    const upgradePreload = () => {
      if (upgraded || window.scrollY < 80) return;
      upgraded = true;
      cineVideo.preload = 'metadata';
      try { cineVideo.load(); } catch (e) {}
      window.removeEventListener('scroll', upgradePreload);
    };
    window.addEventListener('scroll', upgradePreload, { passive: true });
  }

  if (cineVideo && !reducedMotion) {
    cineVideo.autoplay = false;
    cineVideo.loop = false;
    cineVideo.pause();
    const primeVideo = () => {
      try { cineVideo.currentTime = 0; } catch (e) {}
      updateCine();
    };
    if (cineVideo.readyState >= 1) primeVideo();
    else cineVideo.addEventListener('loadedmetadata', primeVideo, { once: true });
    cineVideo.addEventListener('play', () => {
      if (window.scrollY < 4) cineVideo.pause();
    });
  }

  window.addEventListener('scroll', updateCine, { passive: true });
  window.addEventListener('resize', updateCine);

  // ---------- bold-mode scroll choreography (full page) ----------
  // The whole page is one continuous cinematic stage in bold mode. The fixed
  // bold-stage stays visible behind every section (subsequent sections are
  // transparent in bold). Camera, sway and flood are driven by scrollY across
  // the *entire* document, so the bottle keeps moving as the user reaches
  // story → product → trade → impact → contact.
  const boldStage      = document.getElementById('boldStage');
  const boldFlood      = document.getElementById('boldFlood');
  const boldModelMount = document.getElementById('boldModelMount');
  const boldCaptionEls = Array.from(document.querySelectorAll('.bold-caption'));
  const boldLockupEls  = Array.from(document.querySelectorAll('[data-bold-lockup]'));
  const boldTrail      = document.querySelector('.bold-trail');
  const boldPour       = document.querySelector('.bold-pour');
  const boldHand       = document.querySelector('.bold-hand');
  const boldCheers     = document.querySelector('.bold-bottle-cheers');
  const boldClink      = document.querySelector('.bold-clink');
  const boldReticle    = document.querySelector('.bold-reticle');
  const boldData       = document.getElementById('boldData');
  const boldBpm        = document.getElementById('boldBpm');
  const boldLabelCallout = document.getElementById('boldLabelCallout');
  const boldCheersSwoosh = document.querySelector('.bold-cheers-swoosh');

  function easeInOutCubic(t) { return t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t + 2, 3) / 2; }
  function fullScrollEnd() {
    return Math.max(document.documentElement.scrollHeight - window.innerHeight, 1);
  }

  function updateBold() {
    if (!boldStage || currentBrand !== 'bold') return;
    const p = clamp(window.scrollY / fullScrollEnd(), 0, 1);

    // STORYBOARD v3 ACTS (per user reMarkable sketches + plan):
    //   1 ENTRY       0.00–0.13  bottle slides in from off-screen LEFT, tilted, pouring
    //   2 INSPECTION  0.13–0.27  bottle holds centre, parallax does the work
    //   3 HAND GRAB   0.27–0.45  hand sweeps in from RIGHT, contacts bottle (jolt)
    //   4 CHEERS      0.45–0.65  green bottle sweeps in from LEFT, clinks, both held
    //   5 APPROACH    0.65–0.85  green exits LEFT, camera dollies in toward black
    //   6 LABEL ZOOM  0.85–1.00  label fills frame, callout panel reveals

    // ----- background parallax (counter-phase to subject sway) -----
    const bgParallaxX = Math.sin(p * Math.PI * 2) * 18;
    boldStage.style.setProperty('--bg-parallax-x', bgParallaxX.toFixed(1) + 'vw');

    // ----- camera (always running) -----
    let theta, phi, radius, fov;
    if (p < 0.85) {
      const ep = easeInOutCubic(p / 0.85);
      theta  = ep * 1080;
      phi    = 80 - Math.sin(p * Math.PI * 2) * 8 - ep * 6;
      radius = 8 - ep * 5;
      fov    = 24 + ep * 10;
    } else {
      const lp = easeInOutCubic((p - 0.85) / 0.15);
      theta  = 1080;
      phi    = 90 - lp * 8;
      radius = 3 - lp * 1.8;
      fov    = 34 - lp * 6;
    }
    if (boldModelEl) {
      boldModelEl.setAttribute('camera-orbit',  `${theta.toFixed(2)}deg ${phi.toFixed(2)}deg ${radius.toFixed(3)}m`);
      boldModelEl.setAttribute('field-of-view', `${fov.toFixed(2)}deg`);
      const targetY = -0.05 - clamp((p - 0.85) / 0.15, 0, 1) * 0.35;
      boldModelEl.setAttribute('camera-target', `0m ${targetY.toFixed(2)}m 0m`);
    }

    // ===== MAIN BOTTLE: per-act sway + tilt =====
    let swayX, tilt = 0, joltTilt = 0;
    if (p < 0.02) {
      swayX = -55; tilt = -75;
    } else if (p < 0.13) {
      // ACT 1 ENTRY: slide from off-screen-LEFT (-55vw) to centre, righten -75°→0
      const ep = easeInOutCubic((p - 0.02) / 0.11);
      swayX = -55 + ep * 55;
      tilt  = -75 + ep * 75;
    } else if (p < 0.27) {
      // ACT 2 INSPECTION: hold centre with subtle wobble (parallax does the work)
      swayX = Math.sin((p - 0.13) * Math.PI / 0.14) * 3;
      tilt  = Math.sin((p - 0.13) * Math.PI * 3) * 1.2;
    } else if (p < 0.45) {
      // ACT 3 HAND GRAB: bottle held, jolts on contact (p≈0.36)
      swayX = -1;
      tilt  = 0;
      const contactDist = Math.abs(p - 0.36);
      if (contactDist < 0.04) {
        joltTilt = (1 - contactDist / 0.04) * 6;  // up to +6° at contact
      }
    } else if (p < 0.65) {
      // ACT 4 CHEERS: black bottle drifts slightly RIGHT to make space for green
      const lp = (p - 0.45) / 0.20;
      swayX = 4 + Math.sin(lp * Math.PI) * 4;  // 4 → 8 → 4 vw
      tilt  = -2 + Math.sin(lp * Math.PI * 2) * 1;
    } else if (p < 0.85) {
      // ACT 5 APPROACH: returns to centre as camera dollies in
      const lp = easeInOutCubic((p - 0.65) / 0.20);
      swayX = 4 - lp * 4;
      tilt  = 0;
    } else {
      // ACT 6 LABEL ZOOM: dead-centre, no sway
      swayX = 0; tilt = 0;
    }
    const driftY = Math.sin(p * Math.PI * 2) * 3;
    if (boldModelMount) {
      boldModelMount.style.setProperty('--mount-x',    swayX.toFixed(2) + 'vw');
      boldModelMount.style.setProperty('--mount-y',    driftY.toFixed(2) + 'vh');
      boldModelMount.style.setProperty('--mount-tilt', (tilt + joltTilt).toFixed(2) + 'deg');
    }

    // ----- ACT 1 water pour: peaks while bottle is tilted -----
    if (boldPour) {
      const pourIn  = clamp((p - 0.01) / 0.04, 0, 1);
      const pourOut = clamp((p - 0.10) / 0.03, 0, 1);
      const pourO   = pourIn * (1 - pourOut);
      boldPour.style.opacity = pourO.toFixed(3);
    }

    // ----- ACT 3 reaching hand: 0.27→0.45, contact at 0.36, exit RIGHT by 0.45 -----
    if (boldHand) {
      const handIn  = clamp((p - 0.27) / 0.07, 0, 1);   // 0.27..0.34 enter
      const handOut = clamp((p - 0.40) / 0.05, 0, 1);   // 0.40..0.45 exit
      const handAt  = handIn * (1 - handOut);
      // X path: 130% off-right → -5% (across the bottle) → 130% off-right
      let handX;
      if (p < 0.34)      handX = 130 - handIn * 135;     // entering (130 → -5)
      else if (p < 0.40) handX = -5;                      // holding at -5%
      else               handX = -5 + handOut * 135;      // exiting (-5 → 130)
      boldHand.style.setProperty('--hand-x', handX.toFixed(1) + '%');
      boldHand.style.setProperty('--hand-o', handAt.toFixed(2));
    }

    // ----- ACT 4 CHEERS green bottle: 0.45→0.65 in from LEFT, hold, exit-LEFT 0.65→0.78 -----
    if (boldCheers) {
      let cx, cr, cAt;
      if (p < 0.45) { cx = -140; cr = -55; cAt = 0; }
      else if (p < 0.55) {
        // entering from off-screen-LEFT (-140%) to next-to-main (-8%), tilts upright
        const lp = easeInOutCubic((p - 0.45) / 0.10);
        cx  = -140 + lp * 132;
        cr  = -55 + lp * 47;
        cAt = lp;
      } else if (p < 0.65) {
        // hold with tiny clink wobble
        const w = Math.sin((p - 0.55) * Math.PI * 6);
        cx  = -8 + w * 1;
        cr  = -8 + w * 1.5;
        cAt = 1;
      } else if (p < 0.78) {
        // exits LEFT (-8 → -140%) so by Act 6 only black bottle remains
        const lp = easeInOutCubic((p - 0.65) / 0.13);
        cx  = -8 - lp * 132;
        cr  = -8 - lp * 30;
        cAt = 1 - lp;
      } else { cx = -140; cr = -38; cAt = 0; }
      boldCheers.style.setProperty('--cheers-x', cx.toFixed(1) + '%');
      boldCheers.style.setProperty('--cheers-r', cr.toFixed(1) + 'deg');
      boldCheers.style.setProperty('--cheers-o', cAt.toFixed(2));
      // spark burst at meeting moment (p≈0.55)
      const clinkAt = Math.max(0, 1 - Math.abs(p - 0.55) / 0.03);
      if (boldClink) boldClink.style.setProperty('--clink-o', clinkAt.toFixed(2));
    }

    // ----- ACT 4 cheers SWOOSH trail: fades in during entry, out after landing -----
    if (boldCheersSwoosh) {
      const sIn  = clamp((p - 0.45) / 0.06, 0, 1);
      const sOut = clamp((p - 0.55) / 0.04, 0, 1);
      const sAt  = sIn * (1 - sOut);
      boldCheersSwoosh.style.opacity = sAt.toFixed(2);
    }

    // ----- reticle: bright in entry/inspect, dim during hand+cheers, brightens for label -----
    if (boldReticle) {
      const focus = (p < 0.13) ? Math.min(1, p / 0.05) :
                    (p < 0.27) ? 1 :
                    (p < 0.45) ? 1 - (p - 0.27) / 0.18 * 0.7 :
                    (p < 0.65) ? 0.3 :
                    (p < 0.85) ? 0.3 + (p - 0.65) / 0.20 * 0.5 :
                                 Math.min(0.95, 0.8 + (p - 0.85) / 0.15 * 0.15);
      boldReticle.style.setProperty('--reticle-o', focus.toFixed(2));
      boldReticle.style.setProperty('--reticle-x', swayX.toFixed(1) + 'vw');
    }

    // ----- data strip: visible when bottle is the focus -----
    if (boldData) {
      const dataAt = (p < 0.27) ? Math.min(1, p / 0.05) :
                     (p < 0.45) ? 1 - (p - 0.27) / 0.18 * 0.6 :
                     (p < 0.65) ? 0.4 :
                                  0.4 + clamp((p - 0.78) / 0.10, 0, 1) * 0.5;
      boldData.style.setProperty('--data-o', dataAt.toFixed(2));
    }
    if (boldBpm) {
      const bpm = Math.round(110 + Math.sin(p * Math.PI * 8) * 25);
      boldBpm.textContent = bpm;
    }

    // ----- ACT 6 LABEL ZOOM callout: slides in once label-zoom begins -----
    if (boldLabelCallout) {
      const labelOn = p >= 0.85 ? 1 : 0;
      const calloutIn = clamp((p - 0.85) / 0.06, 0, 1);
      boldLabelCallout.style.opacity = calloutIn.toFixed(2);
      boldLabelCallout.style.setProperty('--callout-y', ((1 - calloutIn) * -40).toFixed(0) + 'px');
      const wantOn = labelOn ? '1' : '0';
      if (boldLabelCallout.dataset.on !== wantOn) boldLabelCallout.dataset.on = wantOn;
    }

    // TWO flood peaks: one in the hero (p≈0.18) capped at 35% so it doesn't
    // drown the story section, one bigger one in #impact at 65%.
    const flood1raw = clamp((p - 0.05) / (0.18 - 0.05), 0, 1) - clamp((p - 0.20) / (0.32 - 0.20), 0, 1);
    const flood2raw = clamp((p - 0.68) / (0.84 - 0.68), 0, 1) - clamp((p - 0.92) / (0.99 - 0.92), 0, 1);
    const flood1 = flood1raw * 35; // peaks at 35% viewport height
    const flood2 = flood2raw * 65; // peaks at 65% viewport height
    const floodPct = Math.max(flood1, flood2);
    if (boldFlood) boldFlood.style.setProperty('--flood', floodPct.toFixed(1) + '%');

    // Per-section parallax lockup: each section's giant stroked text slides
    // horizontally as the section enters/exits the viewport. Direction
    // alternates so adjacent sections don't move in lockstep.
    const vh = window.innerHeight;
    boldLockupEls.forEach((el, i) => {
      const r = el.getBoundingClientRect();
      // section progress: 0 when section just enters viewport bottom,
      // 1 when section has fully passed the viewport top.
      const sp = clamp(1 - (r.top + r.height) / (vh + r.height), 0, 1);
      const dir = i % 2 === 0 ? -1 : 1;
      const x = (sp - 0.5) * 120 * dir; // bumped: -60vw to +60vw for stronger parallax
      el.style.setProperty('--lockup-x', x.toFixed(2) + 'vw');
      // also drift the ambient blob (::after) per-section
      el.style.setProperty('--blob-x', (50 + Math.sin(sp * Math.PI * 2) * 25 * dir).toFixed(0) + '%');
      el.style.setProperty('--blob-y', (50 + Math.cos(sp * Math.PI) * 20).toFixed(0) + '%');
    });

    // Caption acts only fire over the hero zone (first ~14% of total scroll).
    const heroP = clamp(p / 0.14, 0, 1);
    let activeAct = 0;
    if (heroP >= 0.05 && heroP < 0.30)      activeAct = 1;
    else if (heroP >= 0.30 && heroP < 0.55) activeAct = 2;
    else if (heroP >= 0.55 && heroP < 0.82) activeAct = 3;
    else if (heroP >= 0.82 && heroP < 1.0)  activeAct = 4;
    boldCaptionEls.forEach(el => {
      el.classList.toggle('is-active', parseInt(el.dataset.act, 10) === activeAct);
    });

    // Bottle dims slightly through the middle sections so section content
    // gets focus, then re-brightens for the impact climax.
    const bottleOpacity = 0.55 + 0.45 * (Math.cos(p * Math.PI * 2) * 0.5 + 0.5);
    if (boldModelEl) boldModelEl.style.opacity = bottleOpacity.toFixed(2);

    // Stage stays fully opaque to the very bottom now.
    boldStage.style.opacity = 1;
  }

  window.addEventListener('scroll', updateBold, { passive: true });
  window.addEventListener('resize', updateBold);

  // ---------- lead form ----------
  // Posts an enriched payload (form fields + brand_mode + language + UTM source)
  // to CONFIG.WEBHOOK_URL. With no webhook configured, falls back to console
  // logging so the UX still flows during demo / development.
  function buildLeadPayload(form) {
    const data = Object.fromEntries(new FormData(form));
    const params = new URLSearchParams(window.location.search);
    return {
      ...data,
      brand_mode: currentBrand,
      language: currentLang,
      source: document.referrer || 'direct',
      utm_source: params.get('utm_source') || '',
      utm_medium: params.get('utm_medium') || '',
      utm_campaign: params.get('utm_campaign') || '',
      page_url: window.location.href,
      submitted_at: new Date().toISOString()
    };
  }
  async function submitLead(payload) {
    if (!CONFIG.WEBHOOK_URL) {
      console.log('[lead] no webhook configured — demo payload:', payload);
      return { ok: true, demo: true };
    }
    try {
      const res = await fetch(CONFIG.WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      return { ok: res.ok };
    } catch (err) {
      console.error('[lead] submit error:', err);
      return { ok: false, error: err.message };
    }
  }
  const form = document.getElementById('leadForm');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      // Honeypot: real users never see/fill `company_website`. Bots do — drop silently.
      const honeypot = form.querySelector('[name="company_website"]');
      if (honeypot && honeypot.value) {
        const s = document.getElementById('formSuccess');
        if (s) s.hidden = false;
        return;
      }
      const payload = buildLeadPayload(form);
      delete payload.company_website;
      const fields = form.querySelectorAll('input, select, textarea, button');
      fields.forEach(el => el.disabled = true);
      const result = await submitLead(payload);
      const s = document.getElementById('formSuccess');
      if (result.ok) {
        if (s) s.hidden = false;
        track('form_submit', {
          brand_mode: payload.brand_mode,
          language: payload.language,
          business_type: payload.type || '',
          monthly_volume: payload.volume || ''
        });
      } else {
        fields.forEach(el => el.disabled = false);
        alert('Sorry — we could not submit just now. Please try WhatsApp.');
      }
    });
  }

  // ---------- smooth anchor scroll ----------
  document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener('click', (e) => {
      const href = a.getAttribute('href');
      if (href === '#' || !href) return;
      const target = document.querySelector(href);
      if (target) {
        e.preventDefault();
        window.scrollTo({ top: target.getBoundingClientRect().top + window.scrollY - 20, behavior: 'smooth' });
      }
    });
  });

  // ---------- mobile sticky CTA bar ----------
  // Hides itself when the contact form is on screen so it doesn't double up.
  const stickyBar = document.querySelector('.mobile-sticky-cta');
  const contactSection = document.getElementById('contact');
  if (stickyBar && contactSection && 'IntersectionObserver' in window) {
    const obs = new IntersectionObserver((entries) => {
      entries.forEach(en => stickyBar.classList.toggle('hidden', en.isIntersecting));
    }, { threshold: 0.15 });
    obs.observe(contactSection);
  }

  // ---------- init ----------
  applyLang(currentLang);
  applyBrand(currentBrand);
  applyWhatsApp();
  setupConsentBanner();
  initAnalytics();
  setupReveal();
  updateCine();
})();
