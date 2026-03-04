import { hasLeadPipelineConfig, verifyTurnstileToken } from "../_lib/auth.js";
import { AppsScriptWebhookError, appendLeadViaAppsScript } from "../_lib/apps-script.js";
import { buildLeadRecord } from "../_lib/normalize.js";
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
    const lead = validateLeadPayload({
      ...payload,
      referrer: payload?.referrer || getRequestReferrer(request),
      user_agent: payload?.user_agent || getRequestUserAgent(request)
    });

    const turnstileResult = await verifyTurnstileToken({
      env,
      token: lead.turnstile_token,
      remoteIp: getRemoteIp(request)
    });

    if (!turnstileResult.success) {
      return errorJson(400, "TURNSTILE_ERROR", "Nao foi possivel validar a verificacao de seguranca.");
    }

    const leadRecord = buildLeadRecord({
      lead,
      leadId: crypto.randomUUID(),
      createdAt: new Date(),
      contactNumber: env.WHATSAPP_NUMBER
    });

    await appendLeadViaAppsScript(env, leadRecord);

    return json({
      ok: true,
      lead_id: leadRecord.lead_id,
      created_at_utc: leadRecord.created_at_utc,
      created_at_brt: leadRecord.created_at_brt,
      whatsapp_url: leadRecord.whatsapp_url
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
