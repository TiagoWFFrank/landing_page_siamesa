const TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
export function hasAppsScriptConfig(env) {
  return Boolean(env.SIAMESA_APPS_SCRIPT_WEBHOOK_URL && env.APPS_SCRIPT_SHARED_SECRET);
}

export function hasWhatsappConfig(env) {
  return Boolean(env.SIAMESA_WHATSAPP_NUMBER);
}

export function hasLeadPipelineConfig(env) {
  return Boolean(hasAppsScriptConfig(env) && hasWhatsappConfig(env));
}

export function hasTurnstileConfig(env) {
  return Boolean(env.TURNSTILE_SITE_KEY && env.TURNSTILE_SECRET_KEY);
}

export function getTurnstileSiteKey(env) {
  return env.TURNSTILE_SITE_KEY || "";
}

export async function verifyTurnstileToken({ env, token, remoteIp }) {
  if (!env.TURNSTILE_SECRET_KEY) {
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
    secret: env.TURNSTILE_SECRET_KEY,
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
