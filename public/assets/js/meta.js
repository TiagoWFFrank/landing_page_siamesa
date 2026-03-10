(() => {
  const HEALTH_ENDPOINT = "/api/health";
  const META_COOKIE_MAX_AGE_SECONDS = 90 * 24 * 60 * 60;

  let runtimeConfigPromise = null;
  let pixelScriptPromise = null;
  let initializedPixelId = "";

  function normalizeText(value, maxLength = 255) {
    return String(value || "").trim().slice(0, maxLength);
  }

  function getCookie(name) {
    const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const match = document.cookie.match(new RegExp(`(?:^|; )${escapedName}=([^;]*)`));
    return match ? decodeURIComponent(match[1]) : "";
  }

  function setCookie(name, value, maxAgeSeconds = META_COOKIE_MAX_AGE_SECONDS) {
    if (!name || !value) return;

    const cookieValue = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAgeSeconds}; samesite=lax`;
    document.cookie = window.location.protocol === "https:" ? `${cookieValue}; secure` : cookieValue;
  }

  function getUrlWithoutHash() {
    try {
      const url = new URL(window.location.href);
      url.hash = "";
      return url.toString();
    } catch {
      return window.location.href.split("#")[0] || "";
    }
  }

  function getFbclidFromUrl() {
    try {
      return normalizeText(new URLSearchParams(window.location.search).get("fbclid"), 255);
    } catch {
      return "";
    }
  }

  function buildFbcFromFbclid(fbclid) {
    if (!fbclid) return "";
    return `fb.1.${Date.now()}.${fbclid}`;
  }

  function ensureFbcCookie() {
    const existingFbc = getCookie("_fbc");
    if (existingFbc) return existingFbc;

    const fbclid = getFbclidFromUrl();
    const derivedFbc = buildFbcFromFbclid(fbclid);
    if (derivedFbc) {
      setCookie("_fbc", derivedFbc);
    }

    return derivedFbc;
  }

  function ensureFbqStub() {
    if (typeof window.fbq === "function") return;

    const fbq = function() {
      if (fbq.callMethod) {
        fbq.callMethod.apply(fbq, arguments);
      } else {
        fbq.queue.push(arguments);
      }
    };

    fbq.push = fbq;
    fbq.loaded = true;
    fbq.version = "2.0";
    fbq.queue = [];

    window.fbq = fbq;
    window._fbq = fbq;
  }

  function loadPixelScript() {
    if (pixelScriptPromise) return pixelScriptPromise;

    pixelScriptPromise = new Promise((resolve) => {
      ensureFbqStub();

      const script = document.createElement("script");
      script.async = true;
      script.src = "https://connect.facebook.net/en_US/fbevents.js";
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.head.appendChild(script);
    });

    return pixelScriptPromise;
  }

  function sanitizeAdvancedMatchingData(matchingData = {}) {
    const sanitized = {};

    ["em", "ph", "fn", "ln", "external_id"].forEach((key) => {
      const value = normalizeText(matchingData[key], 255);
      if (value) sanitized[key] = value;
    });

    return sanitized;
  }

  function sanitizeEventParams(params = {}) {
    const sanitized = {};

    Object.entries(params).forEach(([key, value]) => {
      if (value === null || value === undefined || value === "") return;
      sanitized[key] = value;
    });

    return sanitized;
  }

  async function loadPublicRuntimeConfig() {
    if (runtimeConfigPromise) return runtimeConfigPromise;

    runtimeConfigPromise = fetch(HEALTH_ENDPOINT, {
      headers: {
        accept: "application/json"
      }
    })
      .then((response) => (response.ok ? response.json() : {}))
      .catch(() => ({}));

    return runtimeConfigPromise;
  }

  function initMetaPixel(config = {}, advancedMatchingData = {}) {
    const pixelId = normalizeText(config.meta_pixel_id_public, 64);
    if (!pixelId) return false;

    ensureFbqStub();
    loadPixelScript();

    if (initializedPixelId !== pixelId) {
      const matchingEnabled = config.meta_enable_advanced_matching !== false;
      const matchingData = matchingEnabled ? sanitizeAdvancedMatchingData(advancedMatchingData) : {};

      try {
        if (Object.keys(matchingData).length) {
          window.fbq("init", pixelId, matchingData);
        } else {
          window.fbq("init", pixelId);
        }

        initializedPixelId = pixelId;
      } catch {
        return false;
      }
    }

    return true;
  }

  function safeTrack(eventName, params = {}, eventOptions = {}) {
    if (typeof window.fbq !== "function") return false;

    try {
      const sanitizedParams = sanitizeEventParams(params);

      if (Object.keys(eventOptions).length) {
        window.fbq("track", eventName, sanitizedParams, eventOptions);
      } else if (Object.keys(sanitizedParams).length) {
        window.fbq("track", eventName, sanitizedParams);
      } else {
        window.fbq("track", eventName);
      }

      return true;
    } catch {
      return false;
    }
  }

  function trackMetaPageView() {
    return safeTrack("PageView");
  }

  function trackMetaViewContent(params = {}) {
    return safeTrack("ViewContent", params);
  }

  function trackMetaLead(params = {}, eventId = "") {
    return safeTrack("Lead", params, eventId ? { eventID: eventId } : {});
  }

  function getMetaBrowserIdentifiers() {
    const fbclid = getFbclidFromUrl();
    const fbc = getCookie("_fbc") || ensureFbcCookie();
    const fbp = getCookie("_fbp");

    return {
      fbp: normalizeText(fbp, 255),
      fbc: normalizeText(fbc, 255),
      fbclid: normalizeText(fbclid, 255),
      event_source_url: getUrlWithoutHash()
    };
  }

  function getOrCreateLeadEventId() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return `lead_${window.crypto.randomUUID()}`;
    }

    return `lead_${Date.now()}_${Math.random().toString(16).slice(2, 10)}`;
  }

  ensureFbcCookie();

  window.SiamesaMeta = {
    initMetaPixel,
    trackMetaPageView,
    trackMetaViewContent,
    trackMetaLead,
    getMetaBrowserIdentifiers,
    getOrCreateLeadEventId,
    loadPublicRuntimeConfig
  };
})();
