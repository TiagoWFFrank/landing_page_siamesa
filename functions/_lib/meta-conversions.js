import {
  getMetaApiVersion,
  getMetaPixelId,
  getMetaTestEventCode,
  getSiteUrl
} from "./auth.js";
import { normalizeBrazilWhatsappDigits } from "./normalize.js";

const META_TIMEOUT_MS = 6000;
const INTERNAL_META_CAPI_TOKEN = "EAAeqTn0zU7MBQZBvZBpEHnT7BMF2dMDLL1N4FctRBlKkaiFgv4HiPiyjo1ZBJY8huEx2enAkqcIwyfm9vUcDienZBJmmtlZCLCYZAFH7h78Eh2FMa0SA0GhtkTOZCMu5Skrd2kj6E8K6ms6t0EpNtRAdb7VFJwZBwHKuYh2kfBRWne4rk5dAA3AgLZBlN9myiJJasngZDZD";

function stripUrlHash(value) {
  const rawValue = String(value || "").trim();
  if (!rawValue) return "";

  try {
    const url = new URL(rawValue);
    url.hash = "";
    return url.toString();
  } catch {
    return "";
  }
}

function buildEventSourceUrl({ lead, env }) {
  const directUrl = stripUrlHash(lead.event_source_url);
  if (directUrl) return directUrl;

  const siteUrl = getSiteUrl(env);
  if (!siteUrl) return "";

  try {
    return new URL(lead.page_path || "/cadastro", `${siteUrl}/`).toString();
  } catch {
    return siteUrl;
  }
}

async function sha256Hex(value) {
  const normalizedValue = String(value || "").trim().toLowerCase();
  if (!normalizedValue) return "";

  const encoded = new TextEncoder().encode(normalizedValue);
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function buildUserData({ lead, leadBatch, clientIpAddress, clientUserAgent }) {
  const phoneHash = await sha256Hex(normalizeBrazilWhatsappDigits(lead.whatsapp_digits || lead.whatsapp));
  const externalIdHash = await sha256Hex(leadBatch.lead_id);
  const userData = {};

  if (phoneHash) userData.ph = [phoneHash];
  if (externalIdHash) userData.external_id = [externalIdHash];
  if (lead.fbp) userData.fbp = lead.fbp;
  if (lead.fbc) userData.fbc = lead.fbc;
  if (clientIpAddress) userData.client_ip_address = clientIpAddress;
  if (clientUserAgent) userData.client_user_agent = clientUserAgent;

  return userData;
}

function buildCustomData({ lead, leadBatch }) {
  return {
    content_name: "cadastro_siamesa",
    content_category: "lead",
    status: "completed",
    unit: lead.unit,
    children_count: lead.children.length,
    lead_id: leadBatch.lead_id,
    landing_context: lead.landing_context,
    source: lead.source
  };
}

export async function sendMetaLeadEvent({
  env,
  lead,
  leadBatch,
  clientIpAddress,
  clientUserAgent,
  eventTime = new Date()
}) {
  const pixelId = getMetaPixelId(env);
  const accessToken = String(INTERNAL_META_CAPI_TOKEN || "").trim();

  if (!pixelId || !accessToken) {
    return {
      ok: false,
      skipped: true,
      code: "META_NOT_CONFIGURED"
    };
  }

  const eventId = lead.event_id || `lead_${leadBatch.lead_id}`;
  const apiVersion = getMetaApiVersion(env);
  const testEventCode = getMetaTestEventCode(env);
  const requestUrl = new URL(`https://graph.facebook.com/${apiVersion}/${pixelId}/events`);
  requestUrl.searchParams.set("access_token", accessToken);
  const eventSourceUrl = buildEventSourceUrl({ lead, env });
  const event = {
    event_name: "Lead",
    event_time: Math.floor(eventTime.getTime() / 1000),
    event_id: eventId,
    action_source: "website",
    user_data: await buildUserData({
      lead,
      leadBatch,
      clientIpAddress,
      clientUserAgent
    }),
    custom_data: buildCustomData({ lead, leadBatch })
  };

  if (eventSourceUrl) {
    event.event_source_url = eventSourceUrl;
  }

  const payload = {
    data: [event]
  };

  if (testEventCode) {
    payload.test_event_code = testEventCode;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), META_TIMEOUT_MS);

  try {
    const response = await fetch(requestUrl.toString(), {
      method: "POST",
      headers: {
        "content-type": "application/json; charset=UTF-8",
        accept: "application/json"
      },
      signal: controller.signal,
      body: JSON.stringify(payload)
    });

    const responseText = await response.text();
    let responseData = {};

    if (responseText) {
      try {
        responseData = JSON.parse(responseText);
      } catch {
        responseData = {
          raw: responseText
        };
      }
    }

    if (!response.ok || responseData.error) {
      return {
        ok: false,
        skipped: false,
        code: responseData?.error?.code || "META_API_ERROR",
        status: response.status,
        responseData
      };
    }

    return {
      ok: true,
      skipped: false,
      status: response.status,
      event_id: eventId,
      responseData
    };
  } catch (error) {
    return {
      ok: false,
      skipped: false,
      code: error?.name === "AbortError" ? "META_TIMEOUT" : "META_NETWORK_ERROR",
      status: 0,
      error: String(error?.message || error)
    };
  } finally {
    clearTimeout(timeoutId);
  }
}
