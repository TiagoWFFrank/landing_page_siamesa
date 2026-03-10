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
  quantidade_filhos: "children_count",
  total_filhos: "children_count",
  indice_filho: "child_index",
  nome_filho: "child_name",
  idade_filho: "child_age",
  mensagem_whatsapp: "whatsapp_message",
  url_whatsapp: "whatsapp_url",
  pagina: "page_path",
  contexto: "landing_context",
  status: "lead_status",
  origem: "source"
};

var REQUIRED_ROW_FIELDS = [
  "lead_id",
  "created_at_utc",
  "created_at_brt",
  "responsible_name",
  "whatsapp",
  "whatsapp_digits",
  "unit",
  "child_index",
  "child_name",
  "child_age",
  "children_count"
];

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

    var rowsResult = extractRows_(payload);
    if (!rowsResult.ok) {
      return jsonResponse_({ ok: false, error: rowsResult.error });
    }

    var sheet = getTargetSheet_();
    if (!sheet) {
      return jsonResponse_({ ok: false, error: "SHEET_NOT_FOUND" });
    }

    var headers = readHeaders_(sheet);
    if (!headers.length) {
      return jsonResponse_({ ok: false, error: "EMPTY_HEADER" });
    }

    var values = rowsResult.rows.map(function(row) {
      return buildRowFromHeaders_(headers, row);
    });

    var nextRow = Math.max(sheet.getLastRow(), 1) + 1;
    sheet.getRange(nextRow, 1, values.length, headers.length).setValues(values);

    return jsonResponse_({
      ok: true,
      rows_appended: values.length
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

function extractRows_(payload) {
  var candidateRows = Array.isArray(payload.rows) ? payload.rows : [payload];
  if (!candidateRows.length) {
    return { ok: false, error: "INVALID_ROWS" };
  }

  var rows = [];

  for (var index = 0; index < candidateRows.length; index += 1) {
    var row = normalizeLegacyRowPayload_(candidateRows[index]);
    if (!row) {
      return { ok: false, error: "INVALID_ROW_OBJECT" };
    }

    var validationError = validateRow_(row);
    if (validationError) {
      return { ok: false, error: validationError };
    }

    rows.push(row);
  }

  return { ok: true, rows: rows };
}

function validateRow_(payload) {
  var normalized = normalizePayloadKeys_(payload);

  for (var i = 0; i < REQUIRED_ROW_FIELDS.length; i += 1) {
    var key = REQUIRED_ROW_FIELDS[i];
    if (!hasCellValue_(normalized[key])) {
      return "MISSING_" + key.toUpperCase();
    }
  }

  return "";
}

function getTargetSheet_() {
  var sheetName = String(
    PropertiesService.getScriptProperties().getProperty(SHEET_NAME_PROPERTY) || DEFAULT_SHEET_NAME
  );

  return SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
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
    if (payloadKey === "webhook_secret" || payloadKey === "rows") return "";

    return toCellValue_(normalizedPayload[payloadKey]);
  });
}

function normalizeLegacyRowPayload_(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }

  var normalized = normalizePayloadKeys_(payload);
  var row = {};

  Object.keys(normalized).forEach(function(key) {
    if (key === "rows") return;
    row[key] = normalized[key];
  });

  if (!hasCellValue_(row.child_name) && hasCellValue_(normalized.child_1_name)) {
    row.child_name = normalized.child_1_name;
  }

  if (!hasCellValue_(row.child_age) && hasCellValue_(normalized.child_1_age)) {
    row.child_age = normalized.child_1_age;
  }

  if (!hasCellValue_(row.child_index) && hasCellValue_(row.child_name)) {
    row.child_index = 1;
  }

  if (!hasCellValue_(row.children_count)) {
    row.children_count =
      normalized.children_count ||
      normalized.total_filhos ||
      normalized.quantidade_filhos ||
      (hasCellValue_(row.child_name) ? 1 : "");
  }

  return row;
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

function hasCellValue_(value) {
  return toCellValue_(value) !== "";
}

function toCellValue_(value) {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return value;

  try {
    return JSON.stringify(value);
  } catch (error) {
    return "";
  }
}

function jsonResponse_(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}
