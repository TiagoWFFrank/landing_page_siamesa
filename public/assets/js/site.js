(() => {
  const FALLBACK_WHATSAPP_NUMBER = "5511911940366";
  const DEFAULT_MESSAGE = "Ola! Quero informacoes e vagas para o Bombeiro Mirim (idade do meu filho: __).";
  const TRACKING_STORAGE_KEY = "siamesa_tracking";
  const TRACKING_KEYS = [
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_content",
    "utm_term",
    "fbclid",
    "gclid",
    "fbp",
    "fbc"
  ];

  const headerEl = document.querySelector("header");
  const menuToggle = document.getElementById("menuToggle");
  const menuClose = document.getElementById("menuClose");
  const mobileMenuBackdrop = document.getElementById("mobileMenuBackdrop");
  const mobileMenu = document.getElementById("mobileMenu");

  let whatsappNumber = FALLBACK_WHATSAPP_NUMBER;

  function pickTrackingValues(source) {
    const tracking = {};

    for (const key of TRACKING_KEYS) {
      const value = String(source?.[key] || "").trim();
      if (value) tracking[key] = value;
    }

    return tracking;
  }

  function getStoredTracking() {
    try {
      const rawValue = window.sessionStorage.getItem(TRACKING_STORAGE_KEY);
      return pickTrackingValues(rawValue ? JSON.parse(rawValue) : {});
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

  function getMetaTrackingData() {
    return pickTrackingValues(window.SiamesaMeta?.getMetaBrowserIdentifiers?.() || {});
  }

  function persistTracking(tracking) {
    try {
      window.sessionStorage.setItem(TRACKING_STORAGE_KEY, JSON.stringify(tracking));
    } catch {
      /* noop */
    }
  }

  function syncTracking() {
    const mergedTracking = pickTrackingValues({
      ...getStoredTracking(),
      ...getTrackingFromUrl(),
      ...getMetaTrackingData()
    });

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
    const encodedMessage = encodeURIComponent(message || DEFAULT_MESSAGE);
    return `https://wa.me/${whatsappNumber}?text=${encodedMessage}`;
  }

  function applyWhatsAppLinks() {
    document.querySelectorAll("[data-whatsapp]").forEach((link) => {
      const message = link.getAttribute("data-message") || DEFAULT_MESSAGE;
      link.setAttribute("href", buildWhatsAppUrl(message));
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
    const lines = [
      `Ola! Quero informacoes e vagas para o Bombeiro Mirim (idade do meu filho: ${data.idade || "__"}).`
    ];

    if (data.nome) lines.push(`Responsavel: ${data.nome}`);
    if (data.bairro) lines.push(`Bairro/cidade: ${data.bairro}`);
    if (data.periodo) lines.push(`Preferencia de horario: ${data.periodo}`);
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
        obrigado.textContent = `Obrigado, ${data.nome}! Nossa equipe vai chamar voce no WhatsApp em instantes.`;
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
      const comment = (data.comentarioExtra || "").toString().trim();
      if (!comment) return;

      const name = (data.nomeComentario || "").toString().trim();
      const identification = name ? ` (${name})` : "";
      const message = `Ola! Quero deixar um comentario sobre a Siamesa${identification}: ${comment}`;

      window.open(buildWhatsAppUrl(message), "_blank", "noopener");
      form.reset();
    });
  }

  async function loadPublicRuntimeConfig() {
    if (window.SiamesaMeta?.loadPublicRuntimeConfig) {
      return window.SiamesaMeta.loadPublicRuntimeConfig();
    }

    try {
      const response = await fetch("/api/health", {
        headers: {
          accept: "application/json"
        }
      });

      return response.ok ? response.json() : {};
    } catch {
      return {};
    }
  }

  async function initPublicTracking() {
    const runtimeConfig = await loadPublicRuntimeConfig();
    if (runtimeConfig?.whatsapp_number_public) {
      whatsappNumber = runtimeConfig.whatsapp_number_public;
      applyWhatsAppLinks();
    }

    applyCadastroLinks();

    if (window.SiamesaMeta?.initMetaPixel) {
      window.SiamesaMeta.initMetaPixel(runtimeConfig);
      window.SiamesaMeta.trackMetaPageView();
      window.SiamesaMeta.trackMetaViewContent({
        content_name: "landing_siamesa",
        content_category: "landing"
      });
    }
  }

  document.querySelectorAll("form[data-lead-form]").forEach(handleLeadForm);
  applyWhatsAppLinks();
  applyCadastroLinks();
  handleComentarioExtraForm();
  setupMobileMenu();
  syncHeaderOffset();
  initPublicTracking();

  window.addEventListener("resize", syncHeaderOffset);
  window.addEventListener("orientationchange", syncHeaderOffset);

  if ("ResizeObserver" in window && headerEl) {
    const headerResizeObserver = new ResizeObserver(syncHeaderOffset);
    headerResizeObserver.observe(headerEl);
  }

  document.querySelectorAll("[data-whatsapp], [data-whatsapp-dynamic]").forEach((link) => {
    link.addEventListener("click", () => {
      if (typeof window.fbq === "function") {
        try {
          window.fbq("track", "Contact");
        } catch {
          /* noop */
        }
      }
    });
  });

  const year = document.getElementById("year");
  if (year) year.textContent = new Date().getFullYear();
})();
