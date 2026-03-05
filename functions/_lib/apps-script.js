const APPS_SCRIPT_TIMEOUT_MS = 8000;

export class AppsScriptWebhookError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "AppsScriptWebhookError";
    this.code = code;
    this.details = details;
  }
}

export async function appendLeadViaAppsScript(env, leadRecord) {
  const webhookUrl = env.SIAMESA_APPS_SCRIPT_WEBHOOK_URL;
  const webhookSecret = env.APPS_SCRIPT_SHARED_SECRET;

  if (!webhookUrl || !webhookSecret) {
    throw new Error("Apps Script webhook is not configured.");
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), APPS_SCRIPT_TIMEOUT_MS);
  let response;

  try {
    response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json; charset=UTF-8",
        accept: "application/json"
      },
      signal: controller.signal,
      body: JSON.stringify({
        webhook_secret: webhookSecret,
        ...leadRecord
      })
    });
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new AppsScriptWebhookError("TIMEOUT", "Apps Script webhook timed out.");
    }

    throw new AppsScriptWebhookError("NETWORK_ERROR", "Apps Script webhook request failed.");
  } finally {
    clearTimeout(timeoutId);
  }

  let responseText = "";
  try {
    responseText = await response.text();
  } catch {
    throw new AppsScriptWebhookError("READ_ERROR", "Unable to read Apps Script response.");
  }

  if (!responseText) {
    throw new AppsScriptWebhookError("EMPTY_RESPONSE", "Apps Script returned empty response.", {
      status: response.status
    });
  }

  let responseData = {};
  try {
    responseData = JSON.parse(responseText);
  } catch {
    throw new AppsScriptWebhookError("INVALID_JSON", "Apps Script returned non-JSON response.", {
      status: response.status
    });
  }

  if (!response.ok) {
    throw new AppsScriptWebhookError("HTTP_ERROR", `Apps Script webhook failed (${response.status}).`, {
      status: response.status,
      responseData
    });
  }

  if (responseData?.ok !== true) {
    throw new AppsScriptWebhookError(
      "REJECTED",
      `Apps Script webhook rejected payload (${responseData?.error || "UNKNOWN_ERROR"}).`,
      {
        status: response.status,
        responseData
      }
    );
  }

  return responseData;
}
