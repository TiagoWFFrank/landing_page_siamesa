const BRT_TIMEZONE = "America/Sao_Paulo";

export function sanitizeText(value, { maxLength = 250 } = {}) {
  if (value === null || value === undefined) return "";

  return String(value)
    .replace(/[\u0000-\u001F\u007F-\u009F]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

export function sanitizeOptionalText(value, options) {
  return sanitizeText(value, options);
}

export function normalizeDigits(value) {
  return String(value || "").replace(/\D/g, "");
}

export function normalizeBrazilWhatsappDigits(value) {
  const digits = normalizeDigits(value);

  if (!digits) return "";
  if (digits.startsWith("55")) return digits;
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;

  return digits;
}

export function formatBrazilWhatsapp(value) {
  const digits = normalizeBrazilWhatsappDigits(value);
  const localDigits = digits.startsWith("55") ? digits.slice(2) : digits;

  if (localDigits.length === 10) {
    return `(${localDigits.slice(0, 2)}) ${localDigits.slice(2, 6)}-${localDigits.slice(6)}`;
  }

  if (localDigits.length === 11) {
    return `(${localDigits.slice(0, 2)}) ${localDigits.slice(2, 7)}-${localDigits.slice(7)}`;
  }

  return sanitizeText(value, { maxLength: 30 });
}

export function getTimestampFields(date = new Date()) {
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: BRT_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23"
  })
    .formatToParts(date)
    .reduce((accumulator, part) => {
      if (part.type !== "literal") accumulator[part.type] = part.value;
      return accumulator;
    }, {});

  const createdDate = `${parts.year}-${parts.month}-${parts.day}`;
  const createdTime = `${parts.hour}:${parts.minute}:${parts.second}`;

  return {
    created_at_utc: date.toISOString(),
    created_at_brt: `${createdDate} ${createdTime}`,
    created_date_brt: createdDate,
    created_time_brt: createdTime
  };
}

export function buildWhatsAppMessage(record) {
  const lines = [
    "Ola! Quero garantir a vaga no Projeto Bombeiro Mirim.",
    `Responsavel: ${record.responsible_name}`,
    `WhatsApp: ${record.whatsapp}`,
    `Unidade desejada: ${record.unit}`,
    "Filhos cadastrados:"
  ];

  for (let index = 0; index < record.children.length; index += 1) {
    const child = record.children[index];
    lines.push(`${index + 1}. ${child.name} - ${child.age} anos`);
  }

  lines.push(`ID do cadastro: ${record.lead_id}`);
  lines.push("Pode me passar os proximos passos da matricula?");

  return lines.join("\n");
}

export function buildWhatsAppUrl(phoneNumber, message) {
  return `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`;
}

export function buildLeadRows({ lead, leadId, createdAt, contactNumber }) {
  const timestamps = getTimestampFields(createdAt);
  const whatsappContact = normalizeBrazilWhatsappDigits(contactNumber);
  const children = lead.children;
  const whatsappMessage = buildWhatsAppMessage({
    lead_id: leadId,
    responsible_name: lead.responsible_name,
    whatsapp: lead.whatsapp,
    unit: lead.unit,
    children
  });
  const whatsappUrl = buildWhatsAppUrl(whatsappContact, whatsappMessage);
  const baseRow = {
    lead_id: leadId,
    created_at_utc: timestamps.created_at_utc,
    created_at_brt: timestamps.created_at_brt,
    responsible_name: lead.responsible_name,
    whatsapp: lead.whatsapp,
    whatsapp_digits: lead.whatsapp_digits,
    unit: lead.unit,
    children_count: children.length,
    whatsapp_message: whatsappMessage,
    whatsapp_url: whatsappUrl,
    page_path: lead.page_path,
    referrer: lead.referrer,
    utm_source: lead.utm_source,
    utm_medium: lead.utm_medium,
    utm_campaign: lead.utm_campaign,
    utm_content: lead.utm_content,
    utm_term: lead.utm_term,
    fbclid: lead.fbclid,
    gclid: lead.gclid,
    landing_context: lead.landing_context,
    source: lead.source,
    lead_status: lead.lead_status,
    obs_tecnica: lead.obs_tecnica
  };

  const rows = children.map((child, index) => ({
    ...baseRow,
    child_index: index + 1,
    child_name: child.name,
    child_age: child.age
  }));

  return {
    lead_id: leadId,
    created_at_utc: timestamps.created_at_utc,
    created_at_brt: timestamps.created_at_brt,
    whatsapp_message: whatsappMessage,
    whatsapp_url: whatsappUrl,
    rows
  };
}
