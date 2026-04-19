// site-v3 — scroll-scrubbed pour video, EN/ES i18n, reveals, form stub
(function () {
  const root = document.documentElement;
  root.setAttribute('data-theme', 'deep');
  root.setAttribute('data-motion', 'full');
  root.setAttribute('data-cine', 'sage');

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const smoothstep = (e0, e1, x) => {
    const t = clamp((x - e0) / (e1 - e0), 0, 1);
    return t * t * (3 - 2 * t);
  };

  // ---------- i18n dictionary ----------
  // Placeholder English translated into believable Spanish. Real client copy
  // replaces both sides after signature.
  const COPY = {
    en: {
      'nav.product': 'Product', 'nav.story': 'Story', 'nav.trade': 'Trade', 'nav.impact': 'Impact',
      'nav.talk': 'Talk to us', 'nav.become': 'Become a distributor',
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
      'story.s3.k': 'Distance', 'story.s3.v': '&lt; 40 km from source to bottle',
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
      'form.successHead': 'Thank you — we\'ll be in touch within one business day.',
      'form.successWA': 'Prefer to chat now? WhatsApp us →',
      'foot.tag': 'Luxury water for the people. Bottled in Colombia since 2024.',
      'foot.meta': '© 2026 · Bogotá, CO',
      'select.type': ['Restaurant','Hotel','Gym / Wellness','Retail','Distributor','Event / Catering','Other'],
      'select.volume': ['< 10 cases','10–49 cases','50–249 cases','250+ cases','Not sure yet'],
      'marquee': ['Colombian owned','Bottled at source','Glass first','Wholesale ready','Cold-chain delivery','Bogotá · Medellín · Cartagena']
    },
    es: {
      'nav.product': 'Producto', 'nav.story': 'Historia', 'nav.trade': 'Mayoreo', 'nav.impact': 'Impacto',
      'nav.talk': 'Hablemos', 'nav.become': 'Ser distribuidor',
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
      'story.s3.k': 'Distancia',  'story.s3.v': '&lt; 40 km de fuente a botella',
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
      'form.successHead': 'Gracias — te contactamos en un día hábil.',
      'form.successWA': '¿Prefieres hablar ahora? Escríbenos por WhatsApp →',
      'foot.tag': 'Agua de lujo, para la gente. Embotellada en Colombia desde 2024.',
      'foot.meta': '© 2026 · Bogotá, CO',
      'select.type': ['Restaurante','Hotel','Gimnasio / Bienestar','Retail','Distribuidor','Evento / Catering','Otro'],
      'select.volume': ['< 10 cajas','10–49 cajas','50–249 cajas','250+ cajas','Aún no lo sé'],
      'marquee': ['Propiedad colombiana','Embotellada en la fuente','Vidrio primero','Lista para mayoreo','Entrega en frío','Bogotá · Medellín · Cartagena']
    }
  };

  let currentLang = localStorage.getItem('pw:lang') || 'en';

  function applyLang(lang) {
    if (!COPY[lang]) lang = 'en';
    currentLang = lang;
    const dict = COPY[lang];
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

  // ---------- lead form (demo stub) ----------
  const form = document.getElementById('leadForm');
  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const data = Object.fromEntries(new FormData(form));
      console.log('Lead submitted (demo):', data);
      form.querySelectorAll('input, select, textarea, button').forEach(el => el.disabled = true);
      const s = document.getElementById('formSuccess');
      if (s) s.hidden = false;
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

  // ---------- init ----------
  applyLang(currentLang);
  setupReveal();
  updateCine();
})();
