(() => {
  const SIAMESA_WHATSAPP_NUMBER = "5511911940366";
  const STATIC_MESSAGE = "Olá! Quero informações sobre matrícula no Projeto Bombeiro Mirim.";
  const DEFAULT_UNIT = "São Bernardo do Campo/SP";
  const MAX_CHILDREN = 5;
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

  const childList = document.getElementById("childList");
  const childTemplate = document.getElementById("childTemplate");
  const addChildButton = document.getElementById("addChildButton");
  const enrollmentForm = document.getElementById("enrollmentForm");
  const feedbackBox = document.getElementById("feedbackBox");
  const feedbackStatus = document.getElementById("feedbackStatus");
  const feedbackLink = document.getElementById("feedbackLink");
  const whatsappInput = document.getElementById("whatsapp");
  const submitButton = document.getElementById("submitButton");
  const turnstileShell = document.getElementById("turnstileShell");
  const turnstileWidget = document.getElementById("turnstileWidget");
  const turnstileNote = document.getElementById("turnstileNote");

  let turnstileWidgetId = null;
  let turnstileToken = "";
  let turnstileEnabled = false;

  function buildWhatsAppUrl(message) {
    return `https://wa.me/${SIAMESA_WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
  }

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

  function applyStaticWhatsAppLink() {
    document.querySelectorAll("[data-whatsapp-static]").forEach((link) => {
      link.href = buildWhatsAppUrl(STATIC_MESSAGE);
      link.target = "_blank";
      link.rel = "noopener";
    });
  }

  function updateChildTitles() {
    const cards = [...childList.querySelectorAll(".child-card")];

    cards.forEach((card, index) => {
      const position = index + 1;
      const title = card.querySelector(".child-title");
      const nameInput = card.querySelector("[data-child-name]");
      const ageSelect = card.querySelector("[data-child-age]");
      const removeButton = card.querySelector(".remove-child");
      const labels = card.querySelectorAll("label");

      title.textContent = `Filho(a) ${position}`;
      nameInput.name = `childName${position}`;
      nameInput.id = `child-name-${position}`;
      ageSelect.name = `childAge${position}`;
      ageSelect.id = `child-age-${position}`;

      if (labels[0]) labels[0].setAttribute("for", nameInput.id);
      if (labels[1]) labels[1].setAttribute("for", ageSelect.id);

      removeButton.hidden = cards.length === 1;
    });

    addChildButton.disabled = cards.length >= MAX_CHILDREN;
    addChildButton.style.opacity = cards.length >= MAX_CHILDREN ? "0.6" : "1";
    addChildButton.style.cursor = cards.length >= MAX_CHILDREN ? "not-allowed" : "pointer";
  }

  function addChildCard() {
    if (childList.children.length >= MAX_CHILDREN) return;
    childList.appendChild(childTemplate.content.cloneNode(true));
    updateChildTitles();
  }

  function resetChildren() {
    childList.innerHTML = "";
    addChildCard();
  }

  function removeChildCard(button) {
    const card = button.closest(".child-card");
    if (!card || childList.children.length === 1) return;
    card.remove();
    updateChildTitles();
  }

  function collectChildren() {
    return [...childList.querySelectorAll(".child-card")].map((card) => ({
      name: card.querySelector("[data-child-name]").value.trim(),
      age: card.querySelector("[data-child-age]").value.trim()
    }));
  }

  function formatWhatsApp(value) {
    const digits = value.replace(/\D/g, "").slice(0, 13);
    const hasCountryCode = digits.startsWith("55");
    const localDigits = hasCountryCode ? digits.slice(2, 13) : digits.slice(0, 11);
    const prefix = hasCountryCode ? "+55 " : "";

    if (!localDigits.length) return prefix;
    if (localDigits.length <= 2) return `${prefix}(${localDigits}`;
    if (localDigits.length <= 6) return `${prefix}(${localDigits.slice(0, 2)}) ${localDigits.slice(2)}`;
    if (localDigits.length <= 10) {
      return `${prefix}(${localDigits.slice(0, 2)}) ${localDigits.slice(2, 6)}-${localDigits.slice(6)}`;
    }

    return `${prefix}(${localDigits.slice(0, 2)}) ${localDigits.slice(2, 7)}-${localDigits.slice(7)}`;
  }

  function validateChildFields(children) {
    let firstInvalidField = null;

    [...childList.querySelectorAll("[data-child-name], [data-child-age]")].forEach((field) => {
      field.setCustomValidity("");
    });

    children.forEach((child, index) => {
      const card = childList.children[index];
      const nameInput = card.querySelector("[data-child-name]");
      const ageSelect = card.querySelector("[data-child-age]");
      const ageNumber = Number.parseInt(child.age, 10);

      if (!child.name) {
        nameInput.setCustomValidity("Informe o nome da criança.");
        firstInvalidField = firstInvalidField || nameInput;
      }

      if (!child.age) {
        ageSelect.setCustomValidity("Selecione a idade.");
        firstInvalidField = firstInvalidField || ageSelect;
      } else if (!Number.isInteger(ageNumber) || ageNumber < 5 || ageNumber > 13) {
        ageSelect.setCustomValidity("As idades permitidas são de 5 a 13 anos.");
        firstInvalidField = firstInvalidField || ageSelect;
      }
    });

    return firstInvalidField;
  }

  function showFeedback(message, { url = "", isError = false } = {}) {
    feedbackStatus.textContent = message;
    feedbackBox.classList.add("is-visible");
    feedbackBox.classList.toggle("is-error", isError);

    if (url) {
      feedbackLink.href = url;
      feedbackLink.hidden = false;
    } else {
      feedbackLink.removeAttribute("href");
      feedbackLink.hidden = true;
    }
  }

  function clearFeedback() {
    feedbackBox.classList.remove("is-visible", "is-error");
    feedbackLink.hidden = true;
  }

  function setSubmitting(isSubmitting) {
    submitButton.disabled = isSubmitting;
    submitButton.textContent = isSubmitting ? "Salvando..." : "Quero garantir a vaga";
  }

  function buildPayload(children, tracking) {
    return {
      source: "lp_siamesa_cadastro",
      page_path: window.location.pathname,
      landing_context: "SBC",
      responsible_name: enrollmentForm.elements.responsibleName.value.trim(),
      whatsapp: enrollmentForm.elements.whatsapp.value.trim(),
      unit: enrollmentForm.elements.unit.value.trim() || DEFAULT_UNIT,
      children,
      utm_source: tracking.utm_source || "",
      utm_medium: tracking.utm_medium || "",
      utm_campaign: tracking.utm_campaign || "",
      utm_content: tracking.utm_content || "",
      utm_term: tracking.utm_term || "",
      fbclid: tracking.fbclid || "",
      gclid: tracking.gclid || "",
      referrer: document.referrer || "",
      user_agent: navigator.userAgent || "",
      turnstile_token: turnstileToken
    };
  }

  async function loadHealthConfig() {
    try {
      const response = await fetch("/api/health", {
        headers: {
          accept: "application/json"
        }
      });

      if (!response.ok) return null;
      return response.json();
    } catch {
      return null;
    }
  }

  async function waitForTurnstile() {
    const startedAt = Date.now();

    while (Date.now() - startedAt < 6000) {
      if (window.turnstile?.render) return true;
      await new Promise((resolve) => window.setTimeout(resolve, 120));
    }

    return false;
  }

  function resetTurnstile() {
    turnstileToken = "";

    if (turnstileEnabled && window.turnstile && turnstileWidgetId !== null) {
      window.turnstile.reset(turnstileWidgetId);
      turnstileNote.textContent = "Confirme a verificação de segurança antes de enviar.";
    }
  }

  async function initTurnstile() {
    const health = await loadHealthConfig();
    const siteKey = health?.turnstile_site_key || "";

    if (!siteKey) {
      turnstileShell.hidden = true;
      turnstileEnabled = false;
      turnstileToken = "";
      return;
    }

    turnstileShell.hidden = false;
    turnstileEnabled = true;
    turnstileNote.textContent = "Carregando verificação de segurança...";

    const loaded = await waitForTurnstile();
    if (!loaded) {
      turnstileNote.textContent = "Não foi possível carregar a verificação de segurança. Tente recarregar a página.";
      return;
    }

    turnstileWidgetId = window.turnstile.render(turnstileWidget, {
      sitekey: siteKey,
      callback(token) {
        turnstileToken = token;
        turnstileNote.textContent = "Verificação concluída.";
      },
      "expired-callback"() {
        turnstileToken = "";
        turnstileNote.textContent = "A verificação expirou. Confirme novamente para enviar.";
      },
      "error-callback"() {
        turnstileToken = "";
        turnstileNote.textContent = "Não foi possível validar a segurança agora. Tente novamente.";
      }
    });

    turnstileNote.textContent = "Confirme a verificação de segurança antes de enviar.";
  }

  async function handleSubmit(event) {
    event.preventDefault();
    clearFeedback();

    const children = collectChildren();
    const firstInvalidChildField = validateChildFields(children);
    if (firstInvalidChildField) {
      firstInvalidChildField.reportValidity();
      firstInvalidChildField.focus();
      return;
    }

    const whatsappDigits = enrollmentForm.elements.whatsapp.value.replace(/\D/g, "");
    const localWhatsappDigits = whatsappDigits.startsWith("55") ? whatsappDigits.slice(2) : whatsappDigits;
    enrollmentForm.elements.whatsapp.setCustomValidity(
      localWhatsappDigits.length >= 10 && localWhatsappDigits.length <= 11 ? "" : "Informe um WhatsApp com DDD."
    );

    if (turnstileEnabled && !turnstileToken) {
      showFeedback("Confirme a verificacao de seguranca antes de enviar.", { isError: true });
      return;
    }

    if (!enrollmentForm.reportValidity()) return;

    const payload = buildPayload(children, syncTracking());
    setSubmitting(true);

    try {
      const response = await fetch("/api/leads", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.ok || !result.whatsapp_url) {
        throw new Error(result.message || "Nao foi possivel concluir o cadastro agora.");
      }

      showFeedback("Cadastro salvo com sucesso. Redirecionando para o WhatsApp...", {
        url: result.whatsapp_url
      });

      if (window.fbq) {
        window.fbq("track", "Lead");
      }

      window.setTimeout(() => {
        window.location.href = result.whatsapp_url;
      }, 150);
    } catch {
      showFeedback("Nao foi possivel salvar seu cadastro agora. Voce pode falar com a equipe no WhatsApp, mas este cadastro nao foi gravado.", {
        isError: true,
        url: buildWhatsAppUrl(STATIC_MESSAGE)
      });
      resetTurnstile();
      setSubmitting(false);
    }
  }
  addChildButton.addEventListener("click", addChildCard);

  childList.addEventListener("click", (event) => {
    const button = event.target.closest(".remove-child");
    if (!button) return;
    removeChildCard(button);
  });

  whatsappInput.addEventListener("input", () => {
    whatsappInput.setCustomValidity("");
    whatsappInput.value = formatWhatsApp(whatsappInput.value);
  });

  enrollmentForm.addEventListener("submit", handleSubmit);

  syncTracking();
  applyStaticWhatsAppLink();
  resetChildren();
  initTurnstile();
})();
