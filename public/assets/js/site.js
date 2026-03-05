(() => {
  const SIAMESA_WHATSAPP_NUMBER = "5511963998061";
  const DEFAULT_MESSAGE = "Olá! Quero informações e vagas para o Bombeiro Mirim (idade do meu filho: __).";
  const TRACKING_STORAGE_KEY = "siamesa_tracking";
  const TRACKING_KEYS = [
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_content",
    "utm_term",
    "fbclid",
    "gclid"
  ];

  const headerEl = document.querySelector("header");
  const menuToggle = document.getElementById("menuToggle");
  const menuClose = document.getElementById("menuClose");
  const mobileMenuBackdrop = document.getElementById("mobileMenuBackdrop");
  const mobileMenu = document.getElementById("mobileMenu");

  function getStoredTracking() {
    try {
      const rawValue = window.sessionStorage.getItem(TRACKING_STORAGE_KEY);
      return rawValue ? JSON.parse(rawValue) : {};
    } catch {
      return {};
    }
  }

  function getTrackingFromUrl() {
    const searchParams = new URLSearchParams(window.location.search);
    const tracking = {};

    for (const key of TRACKING_KEYS) {
      const value = (searchParams.get(key) || "").trim();
      if (value) tracking[key] = value;
    }

    return tracking;
  }

  function persistTracking(tracking) {
    try {
      window.sessionStorage.setItem(TRACKING_STORAGE_KEY, JSON.stringify(tracking));
    } catch {
      /* noop */
    }
  }

  function syncTracking() {
    const mergedTracking = {
      ...getStoredTracking(),
      ...getTrackingFromUrl()
    };

    persistTracking(mergedTracking);
    return mergedTracking;
  }

  function buildTrackedCadastroHref(href, tracking) {
    const url = new URL(href, window.location.origin);
    if (url.origin !== window.location.origin || url.pathname !== "/cadastro") {
      return href;
    }

    for (const [key, value] of Object.entries(tracking)) {
      if (value) url.searchParams.set(key, value);
    }

    return `${url.pathname}${url.search}${url.hash}`;
  }

  function applyCadastroLinks() {
    const tracking = syncTracking();

    document.querySelectorAll('a[href="/cadastro"]').forEach((link) => {
      link.setAttribute("href", buildTrackedCadastroHref(link.getAttribute("href"), tracking));
    });
  }

  function syncHeaderOffset() {
    if (!headerEl) return;
    const headerHeight = Math.ceil(headerEl.getBoundingClientRect().height);
    document.documentElement.style.setProperty("--header-h", `${headerHeight + 12}px`);
    if (window.innerWidth > 980) closeMobileMenu();
  }

  function closeMobileMenu() {
    if (!mobileMenuBackdrop || !menuToggle) return;
    mobileMenuBackdrop.setAttribute("aria-hidden", "true");
    menuToggle.setAttribute("aria-expanded", "false");
    document.body.classList.remove("menu-open");
  }

  function openMobileMenu() {
    if (!mobileMenuBackdrop || !menuToggle) return;
    mobileMenuBackdrop.setAttribute("aria-hidden", "false");
    menuToggle.setAttribute("aria-expanded", "true");
    document.body.classList.add("menu-open");
  }

  function setupMobileMenu() {
    if (!menuToggle || !mobileMenuBackdrop || !mobileMenu) return;

    menuToggle.addEventListener("click", () => {
      const isOpen = menuToggle.getAttribute("aria-expanded") === "true";
      if (isOpen) closeMobileMenu();
      else openMobileMenu();
    });

    if (menuClose) {
      menuClose.addEventListener("click", closeMobileMenu);
    }

    mobileMenuBackdrop.addEventListener("click", (event) => {
      if (event.target === mobileMenuBackdrop) closeMobileMenu();
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeMobileMenu();
    });

    mobileMenu.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", closeMobileMenu);
    });
  }

  function buildWhatsAppUrl(message) {
    const msg = encodeURIComponent(message || DEFAULT_MESSAGE);
    return `https://wa.me/${SIAMESA_WHATSAPP_NUMBER}?text=${msg}`;
  }

  function applyWhatsAppLinks() {
    document.querySelectorAll("[data-whatsapp]").forEach((link) => {
      const msg = link.getAttribute("data-message") || DEFAULT_MESSAGE;
      link.setAttribute("href", buildWhatsAppUrl(msg));
      link.setAttribute("target", "_blank");
      link.setAttribute("rel", "noopener");
    });

    document.querySelectorAll("[data-whatsapp-dynamic]").forEach((link) => {
      link.setAttribute("href", buildWhatsAppUrl(DEFAULT_MESSAGE));
      link.setAttribute("target", "_blank");
      link.setAttribute("rel", "noopener");
    });
  }

  function buildMessageFromForm(data) {
    const base = `Olá! Quero informações e vagas para o Bombeiro Mirim (idade do meu filho: ${data.idade || "__"}).`;
    const lines = [base];

    if (data.nome) lines.push(`Responsável: ${data.nome}`);
    if (data.bairro) lines.push(`Bairro/cidade: ${data.bairro}`);
    if (data.periodo) lines.push(`Preferência de horário: ${data.periodo}`);
    if (data.interesse) lines.push(`Interesse: ${data.interesse}`);
    if (data.whatsapp) lines.push(`WhatsApp: ${data.whatsapp}`);
    if (data.mensagem) lines.push(`Mensagem: ${data.mensagem}`);

    return lines.join("\n");
  }

  function handleLeadForm(form) {
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(form).entries());
      const message = buildMessageFromForm(data);
      const url = buildWhatsAppUrl(message);

      document.querySelectorAll("[data-whatsapp-dynamic]").forEach((link) => {
        link.setAttribute("href", url);
        link.setAttribute("target", "_blank");
        link.setAttribute("rel", "noopener");
      });

      const success = form.querySelector(".form-success");
      if (success) success.hidden = false;

      const obrigado = document.getElementById("obrigadoTexto");
      if (obrigado && data.nome) {
        obrigado.textContent = `Obrigado, ${data.nome}! Nossa equipe vai chamar você no WhatsApp em instantes.`;
      }

      if (window.fbq) {
        window.fbq("track", "Lead");
      }

      form.reset();
      window.location.hash = "obrigado";
    });
  }

  function handleComentarioExtraForm() {
    const form = document.getElementById("comentarioExtraForm");
    if (!form) return;

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(form).entries());
      const comentario = (data.comentarioExtra || "").toString().trim();
      if (!comentario) return;

      const nome = (data.nomeComentario || "").toString().trim();
      const identificacao = nome ? ` (${nome})` : "";
      const message = `Olá! Quero deixar um comentário sobre a Siamesa${identificacao}: ${comentario}`;

      window.open(buildWhatsAppUrl(message), "_blank", "noopener");
      form.reset();
    });
  }

  document.querySelectorAll("form[data-lead-form]").forEach(handleLeadForm);
  applyWhatsAppLinks();
  applyCadastroLinks();
  handleComentarioExtraForm();
  setupMobileMenu();
  syncHeaderOffset();

  window.addEventListener("resize", syncHeaderOffset);
  window.addEventListener("orientationchange", syncHeaderOffset);
  if ("ResizeObserver" in window && headerEl) {
    const headerResizeObserver = new ResizeObserver(syncHeaderOffset);
    headerResizeObserver.observe(headerEl);
  }

  document.querySelectorAll("[data-whatsapp], [data-whatsapp-dynamic]").forEach((link) => {
    link.addEventListener("click", () => {
      if (window.fbq) {
        window.fbq("track", "Contact");
      }
    });
  });

  if (window.fbq) {
    window.fbq("track", "ViewContent");
  }

  const year = document.getElementById("year");
  if (year) year.textContent = new Date().getFullYear();
})();
