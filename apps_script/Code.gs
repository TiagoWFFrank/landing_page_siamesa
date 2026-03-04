var DEFAULT_SHEET_NAME = "Leads_SBC";
var WEBHOOK_SECRET_PROPERTY = "WEBHOOK_SECRET";
var SHEET_NAME_PROPERTY = "SHEET_NAME";

var HEADER_ALIASES = {
  responsavel: "responsible_name",
  nome_responsavel: "responsible_name",
  unidade: "unit",
  unidade_desejada: "unit",
  data_hora: "created_at_brt",
  data_cadastro: "created_at_brt",
  data: "created_date_brt",
  hora: "created_time_brt",
  quantidade_filhos: "children_count",
  total_filhos: "children_count",
  filho_1_nome: "child_1_name",
  filho_1_idade: "child_1_age",
  filho_2_nome: "child_2_name",
  filho_2_idade: "child_2_age",
  filho_3_nome: "child_3_name",
  filho_3_idade: "child_3_age",
  filho_4_nome: "child_4_name",
  filho_4_idade: "child_4_age",
  filho_5_nome: "child_5_name",
  filho_5_idade: "child_5_age",
  mensagem_whatsapp: "whatsapp_message",
  url_whatsapp: "whatsapp_url",
  pagina: "page_path",
  contexto: "landing_context",
  status: "lead_status",
  origem: "source"
};

function doPost(e) {
  try {
    var payloadResult = parseJsonPayload_(e);
    if (!payloadResult.ok) {
      return jsonResponse_({ ok: false, error: payloadResult.error });
    }

    var payload = payloadResult.payload;
    if (!isAuthorized_(payload)) {
      return jsonResponse_({ ok: false, error: "UNAUTHORIZED" });
    }

    var validationError = validatePayload_(payload);
    if (validationError) {
      return jsonResponse_({ ok: false, error: validationError });
    }

    var sheetName = getSheetName_();
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
    if (!sheet) {
      return jsonResponse_({ ok: false, error: "SHEET_NOT_FOUND" });
    }

    var headers = readHeaders_(sheet);
    if (!headers.length) {
      return jsonResponse_({ ok: false, error: "EMPTY_HEADER" });
    }

    var row = buildRowFromHeaders_(headers, payload);
    sheet.appendRow(row);

    return jsonResponse_({
      ok: true,
      sheet: sheetName,
      row_appended: true
    });
  } catch (error) {
    return jsonResponse_({
      ok: false,
      error: "INTERNAL_ERROR",
      detail: String(error && error.message ? error.message : error)
    });
  }
}

function parseJsonPayload_(e) {
  if (!e || !e.postData || !e.postData.contents) {
    return { ok: false, error: "INVALID_JSON" };
  }

  try {
    var payload = JSON.parse(e.postData.contents);
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      return { ok: false, error: "INVALID_PAYLOAD" };
    }
    return { ok: true, payload: payload };
  } catch (error) {
    return { ok: false, error: "INVALID_JSON" };
  }
}

function isAuthorized_(payload) {
  var expectedSecret = String(
    PropertiesService.getScriptProperties().getProperty(WEBHOOK_SECRET_PROPERTY) || ""
  );
  var providedSecret = String(payload.webhook_secret || "");
  return Boolean(expectedSecret && providedSecret && expectedSecret === providedSecret);
}

function validatePayload_(payload) {
  var normalized = normalizePayloadKeys_(payload);
  var requiredFields = [
    "lead_id",
    "created_at_utc",
    "created_at_brt",
    "source",
    "page_path",
    "landing_context",
    "responsible_name",
    "whatsapp",
    "whatsapp_digits",
    "unit"
  ];

  for (var i = 0; i < requiredFields.length; i += 1) {
    var key = requiredFields[i];
    if (!toCellValue_(normalized[key])) {
      return "MISSING_" + key.toUpperCase();
    }
  }

  return "";
}

function getSheetName_() {
  return String(
    PropertiesService.getScriptProperties().getProperty(SHEET_NAME_PROPERTY) || DEFAULT_SHEET_NAME
  );
}

function readHeaders_(sheet) {
  var lastColumn = sheet.getLastColumn();
  if (lastColumn < 1) return [];

  var values = sheet.getRange(1, 1, 1, lastColumn).getValues();
  if (!values || !values.length) return [];

  return values[0];
}

function buildRowFromHeaders_(headers, payload) {
  var normalizedPayload = normalizePayloadKeys_(payload);

  return headers.map(function(headerCell) {
    var normalizedHeader = normalizeKey_(headerCell);
    if (!normalizedHeader) return "";

    var payloadKey = HEADER_ALIASES[normalizedHeader] || normalizedHeader;
    if (payloadKey === "webhook_secret") return "";

    return toCellValue_(normalizedPayload[payloadKey]);
  });
}

function normalizePayloadKeys_(payload) {
  var normalized = {};

  Object.keys(payload).forEach(function(key) {
    var normalizedKey = normalizeKey_(key);
    if (!normalizedKey) return;
    normalized[normalizedKey] = payload[key];
  });

  return normalized;
}

function normalizeKey_(value) {
  return String(value == null ? "" : value)
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}

function toCellValue_(value) {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);

  try {
    return JSON.stringify(value);
  } catch (error) {
    return "";
  }
}

function jsonResponse_(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}
