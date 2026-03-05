import {
  getTurnstileSiteKey,
  hasTurnstileConfig
} from "../_lib/auth.js";
import { json } from "../_lib/response.js";

export async function onRequest({ env }) {
  return json({
    ok: true,
    env: {
      apps_script_webhook_url: Boolean(env.SIAMESA_APPS_SCRIPT_WEBHOOK_URL),
      apps_script_shared_secret: Boolean(env.APPS_SCRIPT_SHARED_SECRET),
      whatsapp_number: Boolean(env.SIAMESA_WHATSAPP_NUMBER)
    },
    turnstile_configured: hasTurnstileConfig(env),
    turnstile_site_key: getTurnstileSiteKey(env)
  });
}
