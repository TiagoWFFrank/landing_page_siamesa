import {
  formatBrazilWhatsapp,
  normalizeBrazilWhatsappDigits,
  sanitizeOptionalText,
  sanitizeText
} from "./normalize.js";

const EXPECTED_UNIT = "sao bernardo do campo/sp";

export class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "ValidationError";
    this.code = "VALIDATION_ERROR";
  }
}

function compareLooseText(value) {
  return sanitizeText(value, { maxLength: 150 })
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function ensureRequiredText(value, message, options) {
  const sanitized = sanitizeText(value, options);
  if (!sanitized) {
    throw new ValidationError(message);
  }
  return sanitized;
}

function sanitizeEventSourceUrl(value) {
  const sanitized = sanitizeOptionalText(value, { maxLength: 1000 });
  return /^https?:\/\//i.test(sanitized) ? sanitized : "";
}

function normalizeChild(child, index) {
  if (!child || typeof child !== "object" || Array.isArray(child)) {
    throw new ValidationError(`Informe nome e idade validos para o filho ${index + 1}.`);
  }

  const name = ensureRequiredText(child.name, "Informe ao menos um filho com nome e idade validos.", {
    maxLength: 120
  });
  const ageText = ensureRequiredText(child.age, "Informe ao menos um filho com nome e idade validos.", {
    maxLength: 3
  });
  const age = Number.parseInt(ageText, 10);

  if (!Number.isInteger(age) || age < 5 || age > 13) {
    throw new ValidationError("As idades permitidas sao de 5 a 13 anos.");
  }

  return {
    name,
    age: String(age)
  };
}

export function validateLeadPayload(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new ValidationError("Envie um objeto JSON valido.");
  }

  const responsibleName = ensureRequiredText(payload.responsible_name, "Informe o nome do responsavel.", {
    maxLength: 120
  });
  const whatsapp = ensureRequiredText(payload.whatsapp, "Informe um WhatsApp valido com DDD.", {
    maxLength: 30
  });
  const whatsappDigits = normalizeBrazilWhatsappDigits(whatsapp);
  const localWhatsappDigits = whatsappDigits.startsWith("55") ? whatsappDigits.slice(2) : "";

  if (!whatsappDigits.startsWith("55") || !/^\d+$/.test(whatsappDigits) || ![10, 11].includes(localWhatsappDigits.length)) {
    throw new ValidationError("Informe um WhatsApp valido com DDD.");
  }

  const unit = ensureRequiredText(payload.unit, "Informe a unidade desejada.", {
    maxLength: 120
  });

  if (compareLooseText(unit) !== EXPECTED_UNIT) {
    throw new ValidationError("Esta landing atende apenas Sao Bernardo do Campo/SP.");
  }

  if (!Array.isArray(payload.children) || payload.children.length < 1 || payload.children.length > 5) {
    throw new ValidationError("Informe ao menos um filho com nome e idade validos.");
  }

  const children = payload.children.map(normalizeChild);
  return {
    source: sanitizeText(payload.source || "lp_siamesa_cadastro", { maxLength: 50 }) || "lp_siamesa_cadastro",
    page_path: sanitizeText(payload.page_path || "/cadastro", { maxLength: 80 }) || "/cadastro",
    landing_context: sanitizeText(payload.landing_context || "SBC", { maxLength: 50 }) || "SBC",
    responsible_name: responsibleName,
    whatsapp: formatBrazilWhatsapp(whatsappDigits),
    whatsapp_digits: whatsappDigits,
    unit,
    children,
    utm_source: sanitizeOptionalText(payload.utm_source, { maxLength: 120 }),
    utm_medium: sanitizeOptionalText(payload.utm_medium, { maxLength: 120 }),
    utm_campaign: sanitizeOptionalText(payload.utm_campaign, { maxLength: 160 }),
    utm_content: sanitizeOptionalText(payload.utm_content, { maxLength: 160 }),
    utm_term: sanitizeOptionalText(payload.utm_term, { maxLength: 160 }),
    fbclid: sanitizeOptionalText(payload.fbclid, { maxLength: 255 }),
    gclid: sanitizeOptionalText(payload.gclid, { maxLength: 255 }),
    fbp: sanitizeOptionalText(payload.fbp, { maxLength: 255 }),
    fbc: sanitizeOptionalText(payload.fbc, { maxLength: 255 }),
    event_id: sanitizeOptionalText(payload.event_id, { maxLength: 120 }),
    event_source_url: sanitizeEventSourceUrl(payload.event_source_url),
    referrer: sanitizeOptionalText(payload.referrer, { maxLength: 500 }),
    user_agent: sanitizeOptionalText(payload.user_agent, { maxLength: 500 }),
    lead_status: sanitizeText(payload.lead_status || "novo", { maxLength: 50 }) || "novo",
    obs_tecnica: sanitizeOptionalText(payload.obs_tecnica, { maxLength: 500 }),
    turnstile_token: sanitizeOptionalText(payload.turnstile_token, { maxLength: 4096 })
  };
}
