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
  // Frame-pose harness: ?frame=N URL param forces bold mode and locks the
  // visual to FRAMES[N-1] regardless of scroll. (Constants populated below.)
  const _frameURLOverride = new URLSearchParams(window.location.search).get('frame');
  let currentBrand = _frameURLOverride
    ? 'bold'
    : (localStorage.getItem('pw:brand') || 'calm');
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
    mv.addEventListener('load', () => {
      if (isFrameLocked()) applyFrame(FRAMES[FRAME_LOCK_INDEX]);
      else updateBold();
    }, { once: true });
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
      if (typeof setupBottleRoadmap === 'function') setupBottleRoadmap();
      if (isFrameLocked()) {
        applyFrame(FRAMES[FRAME_LOCK_INDEX]);
        ensureFrameBadge();
      } else if (typeof updateBold === 'function') {
        updateBold();
      }
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

    // Re-run hero split-text reveal after copy changes (i18n / brand toggle)
    document.querySelectorAll('.hero-title .line, .hero-eyebrow, .hero-lede').forEach(el => {
      el.dataset.split = '';
    });
    if (typeof applyHeroReveal === 'function') {
      document.body.classList.remove('mg-hero-ready');
      applyHeroReveal();
    }
  }

  document.querySelectorAll('.lang-pill button').forEach(b => {
    b.addEventListener('click', () => applyLang(b.dataset.lang));
  });

  // ===================================================================
  // MOTION GRAPHICS LAYER (Apple/Stripe-style premium polish)
  // - Split-text reveal on hero headlines (word-by-word slide up)
  // - Number count-up on stats when scrolled into view
  // - Card stagger entrance (sibling .reveal elements get cascade delay)
  // - Cursor follower dot in bold mode
  // Each helper is idempotent and re-runs cleanly when language/brand toggles.
  // ===================================================================

  // Split a line of text into <span class="word">…</span> wrappers so we can
  // animate each word independently. Skips elements already split.
  function splitWords(el) {
    if (!el || el.dataset.split === '1') return;
    const html = el.innerHTML;
    // Preserve <em>, <br/>, <i>, <b> etc — only split text nodes
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    const walk = (node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        const frag = document.createDocumentFragment();
        const parts = node.textContent.split(/(\s+)/);
        parts.forEach(part => {
          if (!part) return;
          if (/^\s+$/.test(part)) {
            frag.appendChild(document.createTextNode(part));
          } else {
            const w = document.createElement('span');
            w.className = 'mg-word';
            w.textContent = part;
            frag.appendChild(w);
          }
        });
        node.parentNode.replaceChild(frag, node);
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        Array.from(node.childNodes).forEach(walk);
      }
    };
    Array.from(tmp.childNodes).forEach(walk);
    el.innerHTML = tmp.innerHTML;
    el.dataset.split = '1';
  }

  function applyHeroReveal() {
    const targets = document.querySelectorAll('.hero-title .line, .hero-eyebrow, .hero-lede');
    targets.forEach(splitWords);
    // Stagger reveal — set --mg-i index on each word so CSS transition-delay
    // can drive the cascade.
    document.querySelectorAll('.hero-title .line').forEach(line => {
      line.querySelectorAll('.mg-word').forEach((w, i) => {
        w.style.setProperty('--mg-i', i);
      });
    });
    // After a tick, mark them as ready so CSS animation kicks in.
    requestAnimationFrame(() => {
      document.body.classList.add('mg-hero-ready');
    });
  }

  // Easing for counter — ease-out cubic
  function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }

  // Animate a number from 0 to target over duration ms. Preserves the original
  // formatting (commas, k suffix, %, etc) by interpreting the original text.
  function animateCounter(el, durationMs = 1400) {
    if (el.dataset.counted === '1') return;
    const original = el.textContent.trim();
    const m = original.match(/^([0-9,.]+)([a-zA-Z%]*)$/);
    if (!m) return;
    const numStr = m[1];
    const suffix = m[2] || '';
    const hasComma = numStr.includes(',');
    const hasDot = numStr.includes('.');
    const decimals = hasDot ? (numStr.split('.')[1] || '').length : 0;
    const target = parseFloat(numStr.replace(/,/g, ''));
    if (!isFinite(target)) return;
    el.dataset.counted = '1';
    const start = performance.now();
    const fmt = (n) => {
      let s;
      if (decimals > 0) s = n.toFixed(decimals);
      else s = String(Math.round(n));
      if (hasComma) {
        const [intPart, decPart] = s.split('.');
        s = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (decPart ? '.' + decPart : '');
      }
      return s + suffix;
    };
    function tick(now) {
      const t = Math.min(1, (now - start) / durationMs);
      el.textContent = fmt(target * easeOutCubic(t));
      if (t < 1) requestAnimationFrame(tick);
      else el.textContent = original; // snap back to original formatting at end
    }
    requestAnimationFrame(tick);
  }

  function applyCounters() {
    const counters = document.querySelectorAll('.stats em');
    if (!counters.length) return;
    const cIo = new IntersectionObserver((entries) => {
      entries.forEach(en => {
        if (en.isIntersecting) {
          animateCounter(en.target);
          cIo.unobserve(en.target);
        }
      });
    }, { rootMargin: '0px 0px -120px 0px' });
    counters.forEach(c => cIo.observe(c));
  }

  function applyCardStagger() {
    // Sibling .reveal cards inside the same row get a cascading --mg-stagger-i.
    document.querySelectorAll('.product-row, .trade-grid, .stats, .impact-grid').forEach(row => {
      // Combine class-based selectors with a :scope > div fallback for the
      // .stats container (which uses bare <div> children).
      const kids = new Set();
      row.querySelectorAll('.reveal, .product, .trade-card').forEach(el => kids.add(el));
      row.querySelectorAll(':scope > div').forEach(el => kids.add(el));
      Array.from(kids).forEach((k, i) => k.style.setProperty('--mg-stagger-i', i));
    });
  }

  // Section motion — when a .block enters viewport, add .section-in so the
  // section title clip-reveals and its content cascade-stagger in. Each
  // sub-element gets a --mg-section-i index so CSS transition-delay can
  // build the cascade.
  function applySectionMotion() {
    const sections = document.querySelectorAll('main section.block, main #contact');
    if (!sections.length) return;
    sections.forEach(sec => {
      // Index every motion-eligible child for cascade delay
      const targets = sec.querySelectorAll(
        '.eyebrow, .h-display, .lede, .spec-list, .spec-list li, .product, .trade-card, .stats > div, .impact-grid > .reveal, .form-card, .contact-detail'
      );
      targets.forEach((el, i) => el.style.setProperty('--mg-section-i', i));
    });
    if (!('IntersectionObserver' in window)) {
      sections.forEach(s => s.classList.add('section-in'));
      return;
    }
    const sIo = new IntersectionObserver((entries) => {
      entries.forEach(en => {
        if (en.isIntersecting) {
          en.target.classList.add('section-in');
          sIo.unobserve(en.target);
        }
      });
    }, { rootMargin: '200px 0px 200px 0px', threshold: 0.01 });
    sections.forEach(s => sIo.observe(s));
  }

  // Cursor follower — subtle accent dot trailing the cursor. Only on bold mode
  // and only on devices with a fine pointer (skips touch).
  let cursorEl = null, cursorRaf = 0, cursorTarget = { x: 0, y: 0 }, cursorPos = { x: 0, y: 0 };
  function applyCursorFollower() {
    if (cursorEl) return;
    if (!window.matchMedia || !window.matchMedia('(pointer: fine)').matches) return;
    cursorEl = document.createElement('div');
    cursorEl.className = 'mg-cursor';
    cursorEl.setAttribute('aria-hidden', 'true');
    document.body.appendChild(cursorEl);
    window.addEventListener('mousemove', (e) => {
      cursorTarget.x = e.clientX;
      cursorTarget.y = e.clientY;
      if (!cursorRaf) {
        cursorRaf = requestAnimationFrame(function loop() {
          cursorPos.x += (cursorTarget.x - cursorPos.x) * 0.18;
          cursorPos.y += (cursorTarget.y - cursorPos.y) * 0.18;
          cursorEl.style.transform = `translate3d(${cursorPos.x}px, ${cursorPos.y}px, 0) translate(-50%, -50%)`;
          if (Math.abs(cursorTarget.x - cursorPos.x) > 0.5 || Math.abs(cursorTarget.y - cursorPos.y) > 0.5) {
            cursorRaf = requestAnimationFrame(loop);
          } else {
            cursorRaf = 0;
          }
        });
      }
    }, { passive: true });
  }

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

  // ===== FRAME-POSE HARNESS ===========================================
  // Each entry is the explicit visual state for one of the 10 hero frames.
  // We iterate each frame in isolation by visiting `?frame=N` (1..10).
  // When the URL param is set, the scroll-driven choreography is bypassed
  // and the page is locked to FRAMES[N-1]. Once all 10 frames are dialled
  // in, the scroll handler can lerp between adjacent frames using `p`.
  //
  // State schema (every frame must define every field):
  //   bottle:  { x: vw, y: vh, tilt: deg }
  //   camera:  { theta: deg, phi: deg, radius: m, fov: deg, targetY: m, opacity: 0..1 }
  //   pour:    { o: 0..1 }
  //   hand:    { x: '%' string, o: 0..1 }
  //   cheers:  { x: '%' string, rot: deg, o: 0..1 }
  //   swoosh:  { o: 0..1 }
  //   clink:   { o: 0..1 }
  //   callout: { o: 0..1, y: px, on: '0'|'1' }
  //   flood:   pct (0..100)
  //   reticle: { o: 0..1, x: vw }
  //   data:    { o: 0..1 }
  //   bgParallaxX: vw
  const FRAMES = [
    // 1. Cold open — bottle off-screen LEFT, fully tilted, HUD low
    { name: 'cold-open',
      bottle:  { x: -55, y: 0,  tilt: -75 },
      camera:  { theta: 0,    phi: 80, radius: 8, fov: 24, targetY: -0.05, opacity: 1 },
      pour:    { o: 0 },
      hand:    { x: '130%',  o: 0 },
      cheers:  { x: '-140%', rot: -55, o: 0 },
      swoosh:  { o: 0 },
      clink:   { o: 0 },
      callout: { o: 0, y: -40, on: '0' },
      flood:   0,
      reticle: { o: 0.35, x: -55 },
      data:    { o: 0.4 },
      bgParallaxX: 0 },

    // 2. Pour peak — bottle 70% on-screen, tilted -50, water cascades
    { name: 'pour-peak',
      bottle:  { x: -25, y: 0,  tilt: -50 },
      camera:  { theta: 60,   phi: 78, radius: 7.4, fov: 25, targetY: -0.05, opacity: 1 },
      pour:    { o: 1 },
      hand:    { x: '130%',  o: 0 },
      cheers:  { x: '-140%', rot: -55, o: 0 },
      swoosh:  { o: 0 },
      clink:   { o: 0 },
      callout: { o: 0, y: -40, on: '0' },
      flood:   18,
      reticle: { o: 0.6, x: -25 },
      data:    { o: 0.85 },
      bgParallaxX: 6 },

    // 3. Landed — bottle vertical centre, the hero shot
    { name: 'landed',
      bottle:  { x: 0, y: 0, tilt: 0 },
      camera:  { theta: 140,  phi: 76, radius: 7.0, fov: 26, targetY: -0.05, opacity: 1 },
      pour:    { o: 0 },
      hand:    { x: '130%',  o: 0 },
      cheers:  { x: '-140%', rot: -55, o: 0 },
      swoosh:  { o: 0 },
      clink:   { o: 0 },
      callout: { o: 0, y: -40, on: '0' },
      flood:   8,
      reticle: { o: 1, x: 0 },
      data:    { o: 1 },
      bgParallaxX: 12 },

    // 4. Inspection — slow rotation, parallax in the back
    { name: 'inspection',
      bottle:  { x: 2, y: -2, tilt: 1 },
      camera:  { theta: 280,  phi: 72, radius: 6.4, fov: 27, targetY: -0.05, opacity: 1 },
      pour:    { o: 0 },
      hand:    { x: '130%',  o: 0 },
      cheers:  { x: '-140%', rot: -55, o: 0 },
      swoosh:  { o: 0 },
      clink:   { o: 0 },
      callout: { o: 0, y: -40, on: '0' },
      flood:   0,
      reticle: { o: 1, x: 2 },
      data:    { o: 1 },
      bgParallaxX: 18 },

    // 5. Hand inbound — fingers visibly reaching in from the right edge.
    //    translateX is element-width-relative; -8vw overhang means the
    //    hand's resting box is already past the viewport, so we need NEGATIVE
    //    translateX values to bring it visibly into the screen.
    { name: 'hand-inbound',
      bottle:  { x: -1, y: 0, tilt: 0 },
      camera:  { theta: 460,  phi: 74, radius: 5.6, fov: 28, targetY: -0.05, opacity: 1 },
      pour:    { o: 0 },
      hand:    { x: '-30%',  o: 0.9 },
      cheers:  { x: '-140%', rot: -55, o: 0 },
      swoosh:  { o: 0 },
      clink:   { o: 0 },
      callout: { o: 0, y: -40, on: '0' },
      flood:   0,
      reticle: { o: 0.5, x: -1 },
      data:    { o: 0.7 },
      bgParallaxX: 6 },

    // 6. Contact / jolt — fingers gripping the bottle, jolt visible
    { name: 'contact-jolt',
      bottle:  { x: -1, y: 0, tilt: 6 },
      camera:  { theta: 520,  phi: 73, radius: 5.0, fov: 28, targetY: -0.05, opacity: 1 },
      pour:    { o: 0 },
      hand:    { x: '-85%',  o: 1 },
      cheers:  { x: '-140%', rot: -55, o: 0 },
      swoosh:  { o: 0 },
      clink:   { o: 0 },
      callout: { o: 0, y: -40, on: '0' },
      flood:   0,
      reticle: { o: 0.3, x: -1 },
      data:    { o: 0.5 },
      bgParallaxX: -4 },

    // 7. Green inbound — bottle sweeping in from LEFT with swoosh
    { name: 'green-inbound',
      bottle:  { x: 8, y: 0, tilt: -2 },
      camera:  { theta: 720,  phi: 73, radius: 4.6, fov: 30, targetY: -0.05, opacity: 1 },
      pour:    { o: 0 },
      hand:    { x: '130%',  o: 0 },
      cheers:  { x: '-50%',  rot: -28, o: 0.85 },
      swoosh:  { o: 0.9 },
      clink:   { o: 0 },
      callout: { o: 0, y: -40, on: '0' },
      flood:   0,
      reticle: { o: 0.3, x: 8 },
      data:    { o: 0.5 },
      bgParallaxX: -14 },

    // 8. Clink — both bottles touching centre, spark burst
    { name: 'clink',
      bottle:  { x: 8, y: 0, tilt: -2 },
      camera:  { theta: 800,  phi: 72, radius: 4.2, fov: 31, targetY: -0.05, opacity: 1 },
      pour:    { o: 0 },
      hand:    { x: '130%',  o: 0 },
      cheers:  { x: '-8%',   rot: -8,  o: 1 },
      swoosh:  { o: 0.4 },
      clink:   { o: 1 },
      callout: { o: 0, y: -40, on: '0' },
      flood:   0,
      reticle: { o: 0.3, x: 8 },
      data:    { o: 0.5 },
      bgParallaxX: -18 },

    // 9. Approach — green gone, camera dollies in toward black
    { name: 'approach',
      bottle:  { x: 0, y: 0, tilt: 0 },
      camera:  { theta: 1080, phi: 86, radius: 2.4, fov: 32, targetY: -0.18, opacity: 1 },
      pour:    { o: 0 },
      hand:    { x: '130%',  o: 0 },
      cheers:  { x: '-140%', rot: -38, o: 0 },
      swoosh:  { o: 0 },
      clink:   { o: 0 },
      callout: { o: 0.35, y: -20, on: '1' },
      flood:   45,
      reticle: { o: 0.7, x: 0 },
      data:    { o: 0.7 },
      bgParallaxX: 0 },

    // 10. Label finale — close-up + callout fully revealed
    { name: 'label-finale',
      bottle:  { x: 0, y: 0, tilt: 0 },
      camera:  { theta: 1080, phi: 82, radius: 1.2, fov: 28, targetY: -0.40, opacity: 1 },
      pour:    { o: 0 },
      hand:    { x: '130%',  o: 0 },
      cheers:  { x: '-140%', rot: -38, o: 0 },
      swoosh:  { o: 0 },
      clink:   { o: 0 },
      callout: { o: 1, y: 0, on: '1' },
      flood:   65,
      reticle: { o: 0.95, x: 0 },
      data:    { o: 0.95 },
      bgParallaxX: 6 },
  ];

  function applyFrame(s) {
    if (!s) return;
    if (boldStage) boldStage.style.setProperty('--bg-parallax-x', s.bgParallaxX.toFixed(1) + 'vw');
    if (boldModelEl) {
      boldModelEl.setAttribute('camera-orbit',  `${s.camera.theta}deg ${s.camera.phi}deg ${s.camera.radius}m`);
      boldModelEl.setAttribute('field-of-view', `${s.camera.fov}deg`);
      boldModelEl.setAttribute('camera-target', `0m ${s.camera.targetY}m 0m`);
      boldModelEl.style.opacity = String(s.camera.opacity);
    }
    if (boldModelMount) {
      boldModelMount.style.setProperty('--mount-x',    s.bottle.x.toFixed(2) + 'vw');
      boldModelMount.style.setProperty('--mount-y',    s.bottle.y.toFixed(2) + 'vh');
      boldModelMount.style.setProperty('--mount-tilt', s.bottle.tilt.toFixed(2) + 'deg');
    }
    if (boldPour)         boldPour.style.opacity = String(s.pour.o);
    if (boldHand) {
      boldHand.style.setProperty('--hand-x', s.hand.x);
      boldHand.style.setProperty('--hand-o', String(s.hand.o));
    }
    if (boldCheers) {
      boldCheers.style.setProperty('--cheers-x', s.cheers.x);
      boldCheers.style.setProperty('--cheers-r', s.cheers.rot + 'deg');
      boldCheers.style.setProperty('--cheers-o', String(s.cheers.o));
    }
    if (boldCheersSwoosh) boldCheersSwoosh.style.opacity = String(s.swoosh.o);
    if (boldClink)        boldClink.style.setProperty('--clink-o', String(s.clink.o));
    if (boldLabelCallout) {
      boldLabelCallout.style.opacity = String(s.callout.o);
      boldLabelCallout.style.setProperty('--callout-y', s.callout.y + 'px');
      boldLabelCallout.dataset.on = s.callout.on;
    }
    if (boldFlood)   boldFlood.style.setProperty('--flood', s.flood + '%');
    if (boldReticle) {
      boldReticle.style.setProperty('--reticle-o', String(s.reticle.o));
      boldReticle.style.setProperty('--reticle-x', s.reticle.x + 'vw');
    }
    if (boldData)    boldData.style.setProperty('--data-o', String(s.data.o));
  }

  // URL param `?frame=N` (1..10) locks the page to FRAMES[N-1]
  const _frameParam = parseInt(new URLSearchParams(window.location.search).get('frame'), 10);
  const FRAME_LOCK_INDEX = (Number.isFinite(_frameParam) && _frameParam >= 1 && _frameParam <= FRAMES.length)
    ? _frameParam - 1 : -1;
  const isFrameLocked = () => FRAME_LOCK_INDEX >= 0;

  // Floating debug badge so we can see which frame is active
  function ensureFrameBadge() {
    if (!isFrameLocked()) return;
    if (document.getElementById('frameBadge')) return;
    const b = document.createElement('div');
    b.id = 'frameBadge';
    const f = FRAMES[FRAME_LOCK_INDEX];
    b.innerHTML = `<strong>Frame ${FRAME_LOCK_INDEX + 1}</strong> · ${f.name}`;
    b.style.cssText = `
      position:fixed; left:16px; bottom:16px; z-index:99999;
      padding:8px 14px; background:#E63946; color:#fff;
      font:600 12px/1 'JetBrains Mono', monospace; letter-spacing:.16em;
      text-transform:uppercase; border-radius:4px;
      box-shadow:0 4px 18px rgba(230,57,70,.45);
    `;
    document.body.appendChild(b);
  }

  // Bold-mode cinematic — frame-stack cross-fade.
  // Six designed beats (Veo stills composed in Figma) are layered in
  // .bold-frames. Each beat has a centre-of-attention scroll position p_i
  // = i / (N-1). For each frame we compute opacity as a triangle window
  // peaking at p_i and falling to 0 at the neighbouring beats — the
  // result is a smooth two-beat blend at every scroll position, no
  // jitter from a video element being seeked. This replaces the prior
  // Veo MP4 background and is a Figma-driven composition.
  const boldFrames = Array.from(document.querySelectorAll('#boldFrames .bold-frame'));
  const boldLockups = Array.from(document.querySelectorAll('#boldLockups .bold-lockup'));
  const BEAT_COUNT = boldFrames.length || 1;

  function updateBold() {
    if (!boldStage || currentBrand !== 'bold') return;
    if (isFrameLocked()) return;
    const p = clamp(window.scrollY / fullScrollEnd(), 0, 1);

    if (boldFrames.length > 1) {
      const segment = 1 / (BEAT_COUNT - 1); // distance between adjacent beats
      for (let i = 0; i < BEAT_COUNT; i++) {
        const center = i * segment;
        const dist = Math.abs(p - center);
        // Triangle window: 1 at the center, 0 at +/- one segment away.
        // Soft-easing the fade with a cubic so peaks feel held, not pointy.
        const t = clamp(1 - dist / segment, 0, 1);
        const eased = t * t * (3 - 2 * t); // smoothstep
        const opStr = eased.toFixed(3);
        boldFrames[i].style.opacity = opStr;
        // Sync the typography lockup for the same beat. We damp lockup
        // opacity slightly (×0.92 max) so the text never reaches "white-
        // out hard 100%" — keeps it feeling like a designed overlay
        // instead of a UI badge.
        if (boldLockups[i]) {
          boldLockups[i].style.opacity = (eased * 0.92).toFixed(3);
        }
      }
    }

    boldStage.style.opacity = 1 - smoothstep(0.97, 1.0, p);
  }

  window.addEventListener('scroll', updateBold, { passive: true });
  window.addEventListener('resize', updateBold);

  // ---------- bold-mode bottle roadmap ----------
  // The bold hero photo (.bold-hero-photo) is fixed-positioned in CSS and
  // travels down the page as the user scrolls, drifting between four
  // beats so each section's copy gets clear breathing room on the
  // opposite side. Past the product section it fades out.
  //
  // The bottle's *image* is a 60-frame pre-rendered 360° rotation
  // sequence — as the visitor scrolls, the img.src is swapped to the
  // frame index that matches scroll progress, so the bottle appears
  // to physically rotate. The frames are preloaded once on init.
  //
  // We mirror updateCine()'s pattern: passive scroll listener, read
  // anchor offsets on resize, lerp CSS custom props.
  let bottleRoadmapInit = false;
  function setupBottleRoadmap() {
    if (bottleRoadmapInit) return;
    const bottle = document.querySelector('.bold-hero-photo');
    if (!bottle) return;

    const reducedMotion = window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reducedMotion) return; // CSS holds it at HERO beat
    if (window.innerWidth <= 900) return; // CSS reverts to in-flow on mobile

    bottleRoadmapInit = true;

    const heroEl    = document.querySelector('.hero');
    const storyEl   = document.getElementById('story');
    const productEl = document.getElementById('product');
    if (!heroEl || !storyEl || !productEl) return;

    // Frame sequence: 60 PNGs of the bottle rotating 360°. We preload
    // them as Image objects so the browser caches them; src swaps then
    // hit cache instantly. If the sequence isn't deployed yet, the JS
    // simply skips the rotation and the original static photo remains.
    const FRAME_COUNT = 60;
    const FRAME_PREFIX = 'assets/bottle-sequence/bottle_';
    const FRAME_SUFFIX = '.webp';
    const frameUrls = [];
    const preloaded = [];
    let framesReady = false;
    for (let i = 0; i < FRAME_COUNT; i++) {
      const idx = String(i).padStart(3, '0');
      frameUrls.push(`${FRAME_PREFIX}${idx}${FRAME_SUFFIX}`);
    }
    // Probe the first frame; if it 404s, skip the swap entirely.
    const probe = new Image();
    probe.onload = () => {
      framesReady = true;
      // Now preload the rest in the background.
      frameUrls.forEach((url, i) => {
        if (i === 0) { preloaded[0] = probe; return; }
        const im = new Image();
        im.src = url;
        preloaded[i] = im;
      });
      // Set the initial frame on the visible img so it matches the
      // first beat (HERO has rotation 0, so frame 0 is correct).
      bottle.src = frameUrls[0];
    };
    probe.onerror = () => { framesReady = false; };
    probe.src = frameUrls[0];

    let lastFrameIndex = -1;
    function setFrame(scrollProgress) {
      if (!framesReady) return;
      // Map scroll progress 0..1 (hero to product-bottom) to frame 0..N-1.
      // Use full 360° rotation across the journey.
      const t = clamp01(scrollProgress);
      const idx = Math.min(FRAME_COUNT - 1, Math.floor(t * FRAME_COUNT));
      if (idx === lastFrameIndex) return;
      lastFrameIndex = idx;
      const img = preloaded[idx];
      if (img && img.complete) {
        bottle.src = frameUrls[idx];
      }
    }

    // Beats: offsets in vw/vh from viewport center. Element is positioned
    // at top:50% / left:50% with a -50%/-50% recentering translate, so
    // (0,0) here = perfectly centered. Note: r (CSS rotation) is now
    // additive to the bottle's intrinsic rotation in the rendered frames
    // — keep it small so it just adds tilt, not double-rotation.
    const BEATS = {
      HERO:     { x: 22,  y: 0,  s: 1.00, r: 0  },
      STORY:    { x: -26, y: 0,  s: 0.85, r: 0  },
      APPROACH: { x: 18,  y: 0,  s: 0.70, r: 0  },
      LANDED:   { x: 24,  y: -4, s: 0.55, r: 0  }
    };

    let heroTop, storyTop, productTop, productBottom;
    function cacheAnchors() {
      const sy = window.scrollY || window.pageYOffset || 0;
      heroTop       = heroEl.getBoundingClientRect().top + sy;
      storyTop      = storyEl.getBoundingClientRect().top + sy;
      productTop    = productEl.getBoundingClientRect().top + sy;
      productBottom = productTop + productEl.offsetHeight;
    }

    function lerp(a, b, t) { return a + (b - a) * t; }
    function easeInOutCubic(t) {
      return t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t + 2, 3) / 2;
    }
    function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }

    function lerpBeat(a, b, t) {
      const e = easeInOutCubic(clamp01(t));
      return {
        x: lerp(a.x, b.x, e),
        y: lerp(a.y, b.y, e),
        s: lerp(a.s, b.s, e),
        r: lerp(a.r, b.r, e)
      };
    }

    function update() {
      if (currentBrand !== 'bold') return;
      if (window.innerWidth <= 900) return;
      const sy = window.scrollY || window.pageYOffset || 0;

      // Use the viewport-mid as the "playhead" so beats trigger when a
      // section is roughly centered on screen, not when its top edge
      // first crosses zero.
      const playhead = sy + window.innerHeight * 0.5;

      let pose;
      if (playhead <= storyTop) {
        // HERO → STORY: hero centered → story centered
        const t = (playhead - (heroTop + window.innerHeight * 0.5)) /
                  (storyTop - (heroTop + window.innerHeight * 0.5));
        pose = lerpBeat(BEATS.HERO, BEATS.STORY, t);
      } else if (playhead <= productTop) {
        // STORY → APPROACH: hold at STORY through first half of the
        // story-to-product gap, then ease into APPROACH toward product.
        const mid = (storyTop + productTop) / 2;
        if (playhead <= mid) {
          pose = BEATS.STORY;
        } else {
          const t = (playhead - mid) / (productTop - mid);
          pose = lerpBeat(BEATS.STORY, BEATS.APPROACH, t);
        }
      } else if (playhead <= productTop + window.innerHeight * 0.4) {
        // APPROACH → LANDED: snap into the product section
        const t = (playhead - productTop) / (window.innerHeight * 0.4);
        pose = lerpBeat(BEATS.APPROACH, BEATS.LANDED, t);
      } else {
        // Past the landing point: hold at LANDED until past product bottom
        pose = BEATS.LANDED;
      }

      bottle.style.setProperty('--rb-x', pose.x.toFixed(2) + 'vw');
      bottle.style.setProperty('--rb-y', pose.y.toFixed(2) + 'vh');
      bottle.style.setProperty('--rb-s', pose.s.toFixed(3));
      bottle.style.setProperty('--rb-r', pose.r.toFixed(2) + 'deg');

      // Drive the rotation frame index from total scroll progress through
      // the journey (hero top → product bottom). Full 360° revolution.
      const journeyStart = heroTop;
      const journeyEnd   = productBottom;
      const journeyT = (sy - journeyStart) / Math.max(1, journeyEnd - journeyStart);
      setFrame(journeyT);

      // Past the product section, hide so trade/impact/contact stay clean.
      if (sy > productBottom - window.innerHeight * 0.2) {
        bottle.setAttribute('data-rb-state', 'hidden');
      } else {
        bottle.removeAttribute('data-rb-state');
      }
    }

    function onResize() {
      // If the user resized into mobile range, re-init logic would need
      // teardown — since CSS handles the static fallback at <=900px,
      // simply skip updates and bail update() on its own check.
      cacheAnchors();
      update();
    }

    function init() {
      cacheAnchors();
      update();
      window.addEventListener('scroll', update, { passive: true });
      window.addEventListener('resize', onResize);
    }

    if (bottle.complete && bottle.naturalWidth > 0) {
      init();
    } else {
      bottle.addEventListener('load', init, { once: true });
    }
  }

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
  // Motion graphics layer — each wrapped so a failure in one doesn't break others
  try { applyHeroReveal(); }     catch (e) { console.warn('[mg] hero reveal failed', e); }
  try { applyCounters(); }       catch (e) { console.warn('[mg] counters failed', e); }
  try { applyCardStagger(); }    catch (e) { console.warn('[mg] card stagger failed', e); }
  try { applySectionMotion(); }  catch (e) { console.warn('[mg] section motion failed', e); }
  try { applyCursorFollower(); } catch (e) { console.warn('[mg] cursor failed', e); }
  updateCine();
})();
