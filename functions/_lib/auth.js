const TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const DEFAULT_META_API_VERSION = "v22.0";

function normalizeEnvValue(value) {
  return String(value || "").trim();
}

function hasUsableValue(value, { exact = [], startsWith = [] } = {}) {
  const normalized = normalizeEnvValue(value);
  if (!normalized) return false;
  if (exact.includes(normalized)) return false;
  if (startsWith.some((prefix) => normalized.startsWith(prefix))) return false;
  return true;
}

export function hasAppsScriptWebhookUrlConfig(env) {
  return hasUsableValue(env.SIAMESA_APPS_SCRIPT_WEBHOOK_URL, {
    exact: ["https://script.google.com/macros/s/REPLACE_ME/exec"],
    startsWith: ["https://script.google.com/macros/s/REPLACE_ME"]
  });
}

export function hasAppsScriptSharedSecretConfig(env) {
  return hasUsableValue(env.APPS_SCRIPT_SHARED_SECRET, {
    exact: ["replace_with_shared_secret"],
    startsWith: ["replace_"]
  });
}

export function hasAppsScriptConfig(env) {
  return Boolean(hasAppsScriptWebhookUrlConfig(env) && hasAppsScriptSharedSecretConfig(env));
}

export function hasWhatsappConfig(env) {
  return /^\d{12,15}$/.test(normalizeEnvValue(env.SIAMESA_WHATSAPP_NUMBER));
}

export function getWhatsappNumber(env) {
  return hasWhatsappConfig(env) ? normalizeEnvValue(env.SIAMESA_WHATSAPP_NUMBER) : "";
}

export function hasLeadPipelineConfig(env) {
  return Boolean(hasAppsScriptConfig(env) && hasWhatsappConfig(env));
}

export function hasTurnstileConfig(env) {
  return Boolean(
    hasUsableValue(env.TURNSTILE_SITE_KEY, {
      exact: ["your_turnstile_site_key"],
      startsWith: ["your_turnstile_"]
    }) &&
    hasUsableValue(env.TURNSTILE_SECRET_KEY, {
      exact: ["your_turnstile_secret_key"],
      startsWith: ["your_turnstile_"]
    })
  );
}

export function getTurnstileSiteKey(env) {
  return hasTurnstileConfig(env) ? normalizeEnvValue(env.TURNSTILE_SITE_KEY) : "";
}

export function hasMetaPixelConfig(env) {
  return hasUsableValue(env.META_PIXEL_ID, {
    exact: ["your_meta_pixel_id"],
    startsWith: ["your_meta_"]
  });
}

export function getMetaPixelId(env) {
  return hasMetaPixelConfig(env) ? normalizeEnvValue(env.META_PIXEL_ID) : "";
}

export function hasMetaTestEventCode(env) {
  return hasUsableValue(env.META_TEST_EVENT_CODE, {
    exact: ["your_meta_test_event_code"]
  });
}

export function getMetaTestEventCode(env) {
  return hasMetaTestEventCode(env) ? normalizeEnvValue(env.META_TEST_EVENT_CODE) : "";
}

export function isMetaAdvancedMatchingEnabled(env) {
  const normalized = normalizeEnvValue(env.META_ENABLE_ADVANCED_MATCHING).toLowerCase();
  if (!normalized) return true;
  return !["0", "false", "no", "off"].includes(normalized);
}

export function getMetaApiVersion(env) {
  const normalized = normalizeEnvValue(env.META_API_VERSION);
  return /^v\d+\.\d+$/.test(normalized) ? normalized : DEFAULT_META_API_VERSION;
}

export function getSiteUrl(env) {
  const normalized = normalizeEnvValue(env.SIAMESA_SITE_URL).replace(/\/+$/g, "");
  return /^https?:\/\//i.test(normalized) ? normalized : "";
}

export async function verifyTurnstileToken({ env, token, remoteIp }) {
  if (!hasTurnstileConfig(env)) {
    return {
      configured: false,
      success: true
    };
  }

  if (!token) {
    return {
      configured: true,
      success: false,
      "error-codes": ["missing-input-response"]
    };
  }

  const body = new URLSearchParams({
    secret: normalizeEnvValue(env.TURNSTILE_SECRET_KEY),
    response: token
  });

  if (remoteIp) {
    body.set("remoteip", remoteIp);
  }

  const response = await fetch(TURNSTILE_VERIFY_URL, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded"
    },
    body: body.toString()
  });

  if (!response.ok) {
    throw new Error(`Turnstile verification failed (${response.status}).`);
  }

  return response.json();
}
