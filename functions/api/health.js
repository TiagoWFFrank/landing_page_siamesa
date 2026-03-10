import {
  getMetaPixelId,
  getTurnstileSiteKey,
  getWhatsappNumber,
  hasAppsScriptSharedSecretConfig,
  hasAppsScriptWebhookUrlConfig,
  hasMetaPixelConfig,
  hasMetaTestEventCode,
  hasTurnstileConfig,
  hasWhatsappConfig,
  isMetaAdvancedMatchingEnabled
} from "../_lib/auth.js";
import { json } from "../_lib/response.js";

export async function onRequest({ env }) {
  return json({
    ok: true,
    env: {
      apps_script_webhook_url: hasAppsScriptWebhookUrlConfig(env),
      apps_script_shared_secret: hasAppsScriptSharedSecretConfig(env),
      whatsapp_number: hasWhatsappConfig(env)
    },
    whatsapp_number_public: getWhatsappNumber(env),
    turnstile_configured: hasTurnstileConfig(env),
    turnstile_site_key: getTurnstileSiteKey(env),
    meta_pixel_configured: hasMetaPixelConfig(env),
    meta_pixel_id_public: getMetaPixelId(env),
    meta_test_event_code_present: hasMetaTestEventCode(env),
    meta_enable_advanced_matching: isMetaAdvancedMatchingEnabled(env)
  });
}
