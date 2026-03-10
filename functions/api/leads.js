import { hasLeadPipelineConfig, verifyTurnstileToken } from "../_lib/auth.js";
import { AppsScriptWebhookError, appendLeadViaAppsScript } from "../_lib/apps-script.js";
import { sendMetaLeadEvent } from "../_lib/meta-conversions.js";
import { buildLeadRows } from "../_lib/normalize.js";
import { errorJson, json, methodNotAllowed } from "../_lib/response.js";
import { ValidationError, validateLeadPayload } from "../_lib/validate-lead.js";

const MAX_BODY_BYTES = 32 * 1024;

function getBodySizeInBytes(bodyText) {
  return new TextEncoder().encode(bodyText).byteLength;
}

function getRemoteIp(request) {
  return request.headers.get("cf-connecting-ip") || "";
}

function getRequestUserAgent(request) {
  return request.headers.get("user-agent") || "";
}

function getRequestReferrer(request) {
  return request.headers.get("referer") || "";
}

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method !== "POST") {
    return methodNotAllowed(["POST"]);
  }

  if (!hasLeadPipelineConfig(env)) {
    return errorJson(500, "CONFIGURATION_ERROR", "A API de cadastro nao esta configurada.");
  }

  const contentType = request.headers.get("content-type") || "";
  if (!contentType.toLowerCase().includes("application/json")) {
    return errorJson(415, "UNSUPPORTED_MEDIA_TYPE", "Envie JSON com Content-Type application/json.");
  }

  let rawBody = "";
  try {
    rawBody = await request.text();
  } catch {
    return errorJson(400, "INVALID_JSON", "Nao foi possivel ler o corpo da requisicao.");
  }

  if (!rawBody) {
    return errorJson(400, "INVALID_JSON", "Envie um payload JSON valido.");
  }

  if (getBodySizeInBytes(rawBody) > MAX_BODY_BYTES) {
    return errorJson(413, "PAYLOAD_TOO_LARGE", "O payload excede o limite permitido.");
  }

  let payload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return errorJson(400, "INVALID_JSON", "JSON malformado.");
  }

  try {
    const remoteIp = getRemoteIp(request);
    const requestUserAgent = getRequestUserAgent(request);
    const lead = validateLeadPayload({
      ...payload,
      referrer: payload?.referrer || getRequestReferrer(request),
      user_agent: payload?.user_agent || requestUserAgent
    });

    const turnstileResult = await verifyTurnstileToken({
      env,
      token: lead.turnstile_token,
      remoteIp
    });

    if (!turnstileResult.success) {
      return errorJson(400, "TURNSTILE_ERROR", "Nao foi possivel validar a verificacao de seguranca.");
    }

    const createdAt = new Date();
    const leadBatch = buildLeadRows({
      lead,
      leadId: crypto.randomUUID(),
      createdAt,
      contactNumber: env.SIAMESA_WHATSAPP_NUMBER
    });

    await appendLeadViaAppsScript(env, leadBatch.rows);

    const metaResult = await sendMetaLeadEvent({
      env,
      lead,
      leadBatch,
      clientIpAddress: remoteIp,
      clientUserAgent: requestUserAgent,
      eventTime: createdAt
    });

    if (!metaResult.ok && !metaResult.skipped) {
      console.error("meta_conversion_failed", {
        code: metaResult.code,
        status: metaResult.status || 0
      });
    }

    return json({
      ok: true,
      lead_id: leadBatch.lead_id,
      created_at_utc: leadBatch.created_at_utc,
      created_at_brt: leadBatch.created_at_brt,
      whatsapp_url: leadBatch.whatsapp_url
    });
  } catch (error) {
    if (error instanceof ValidationError) {
      return errorJson(400, error.code, error.message);
    }

    if (error instanceof AppsScriptWebhookError) {
      console.error("apps_script_webhook_failed", {
        code: error.code,
        status: error.details?.status || 0
      });

      return errorJson(502, "UPSTREAM_ERROR", "Nao foi possivel salvar o cadastro agora.");
    }

    console.error("lead_submission_failed", {
      name: error?.name,
      message: error?.message
    });

    return errorJson(500, "INTERNAL_ERROR", "Nao foi possivel concluir o cadastro agora.");
  }
}
