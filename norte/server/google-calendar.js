const SUPABASE_URL = process.env.SUPABASE_URL || "https://hvkivvlslfetglmatfrg.supabase.co";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

function requireEnv() {
  const missing = [];
  if (!SERVICE_ROLE_KEY) missing.push("SUPABASE_SERVICE_ROLE_KEY");
  if (!GOOGLE_CLIENT_ID) missing.push("GOOGLE_CLIENT_ID");
  if (!GOOGLE_CLIENT_SECRET) missing.push("GOOGLE_CLIENT_SECRET");
  if (missing.length) throw new Error("Configuração ausente: " + missing.join(", "));
}

function cors(req, res) {
  const origin = req.headers.origin || "";
  res.setHeader("Access-Control-Allow-Origin", origin || "*");
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type, X-Requested-With");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,DELETE,OPTIONS");
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return true;
  }
  return false;
}

function bearer(req) {
  const value = req.headers.authorization || "";
  return value.startsWith("Bearer ") ? value.slice(7) : "";
}

async function requireUser(req) {
  requireEnv();
  const token = bearer(req);
  if (!token) throw Object.assign(new Error("Sessão ausente."), { status: 401 });

  const r = await fetch(SUPABASE_URL + "/auth/v1/user", {
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: "Bearer " + token
    }
  });
  const user = await r.json().catch(() => null);
  if (!r.ok || !user?.id) {
    throw Object.assign(new Error("Sessão inválida ou expirada."), { status: 401 });
  }
  return user;
}

function serviceHeaders(extra = {}) {
  return {
    apikey: SERVICE_ROLE_KEY,
    Authorization: "Bearer " + SERVICE_ROLE_KEY,
    "Content-Type": "application/json",
    ...extra
  };
}

async function getConnection(userId) {
  const url = new URL(SUPABASE_URL + "/rest/v1/google_calendar_connections");
  url.searchParams.set("user_id", "eq." + userId);
  url.searchParams.set("select", "*");
  url.searchParams.set("limit", "1");
  const r = await fetch(url, { headers: serviceHeaders() });
  const rows = await r.json().catch(() => []);
  if (!r.ok) throw new Error(rows?.message || "Falha ao consultar conexão do Google.");
  return rows?.[0] || null;
}

async function saveConnection(userId, tokenData, existing = null) {
  const expiresAt = tokenData.expires_in
    ? new Date(Date.now() + Number(tokenData.expires_in) * 1000).toISOString()
    : existing?.expires_at || null;

  const body = {
    user_id: userId,
    access_token: tokenData.access_token || existing?.access_token || null,
    refresh_token: tokenData.refresh_token || existing?.refresh_token || null,
    token_type: tokenData.token_type || existing?.token_type || "Bearer",
    scope: tokenData.scope || existing?.scope || null,
    expires_at: expiresAt,
    updated_at: new Date().toISOString()
  };

  const url = SUPABASE_URL + "/rest/v1/google_calendar_connections?on_conflict=user_id";
  const r = await fetch(url, {
    method: "POST",
    headers: serviceHeaders({
      Prefer: "resolution=merge-duplicates,return=representation"
    }),
    body: JSON.stringify(body)
  });
  const rows = await r.json().catch(() => []);
  if (!r.ok) throw new Error(rows?.message || "Falha ao salvar conexão do Google.");
  return rows?.[0] || body;
}

async function deleteConnection(userId) {
  const url = SUPABASE_URL + "/rest/v1/google_calendar_connections?user_id=eq." + encodeURIComponent(userId);
  const r = await fetch(url, {
    method: "DELETE",
    headers: serviceHeaders()
  });
  if (!r.ok) {
    const body = await r.json().catch(() => null);
    throw new Error(body?.message || "Falha ao remover conexão.");
  }
}

async function exchangeCode(code, redirectUri) {
  requireEnv();
  const body = new URLSearchParams({
    code,
    client_id: GOOGLE_CLIENT_ID,
    client_secret: GOOGLE_CLIENT_SECRET,
    redirect_uri: redirectUri,
    grant_type: "authorization_code"
  });
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data?.error_description || data?.error || "Falha ao autorizar Google.");
  return data;
}

async function refreshAccessToken(connection) {
  if (!connection?.refresh_token) {
    throw Object.assign(new Error("Conecte novamente o Google Agenda."), { status: 401 });
  }
  const body = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    client_secret: GOOGLE_CLIENT_SECRET,
    refresh_token: connection.refresh_token,
    grant_type: "refresh_token"
  });
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body
  });
  const data = await r.json();
  if (!r.ok) throw Object.assign(new Error(data?.error_description || "Falha ao renovar acesso ao Google."), { status: 401 });
  return data;
}

async function validConnection(userId) {
  let connection = await getConnection(userId);
  if (!connection) throw Object.assign(new Error("Google Agenda não conectado."), { status: 401 });

  const expires = connection.expires_at ? new Date(connection.expires_at).getTime() : 0;
  if (!connection.access_token || expires < Date.now() + 60_000) {
    const refreshed = await refreshAccessToken(connection);
    connection = await saveConnection(userId, refreshed, connection);
  }
  return connection;
}

async function googleFetch(path, accessToken, options = {}) {
  const r = await fetch("https://www.googleapis.com/calendar/v3" + path, {
    ...options,
    headers: {
      Authorization: "Bearer " + accessToken,
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });
  const body = await r.json().catch(() => null);
  if (!r.ok) {
    const message = body?.error?.message || "Erro ao acessar Google Agenda.";
    const err = new Error(message);
    err.status = r.status;
    throw err;
  }
  return body;
}

module.exports = {
  GOOGLE_CLIENT_ID,
  cors,
  requireUser,
  getConnection,
  saveConnection,
  deleteConnection,
  exchangeCode,
  validConnection,
  googleFetch
};
