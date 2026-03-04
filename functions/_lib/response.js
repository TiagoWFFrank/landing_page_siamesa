export function json(data, init = {}) {
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json; charset=UTF-8");
  headers.set("cache-control", "no-store");

  return new Response(JSON.stringify(data), {
    ...init,
    headers
  });
}

export function errorJson(status, error, message, extra = {}, init = {}) {
  return json(
    {
      ok: false,
      error,
      message,
      ...extra
    },
    {
      ...init,
      status
    }
  );
}

export function methodNotAllowed(allowed = ["POST"]) {
  return errorJson(
    405,
    "METHOD_NOT_ALLOWED",
    `Metodo nao permitido. Use ${allowed.join(", ")}.`,
    {
      allowed_methods: allowed
    },
    {
      headers: {
        allow: allowed.join(", ")
      }
    }
  );
}
