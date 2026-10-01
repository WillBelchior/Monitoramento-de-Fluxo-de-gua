const {
  cors,
  requireUser,
  getConnection,
  saveConnection,
  exchangeCode
} = require("../server/google-calendar");

module.exports = async function handler(req, res) {
  if (cors(req, res)) return;
  if (req.method !== "POST") return res.status(405).json({ error: "Método não permitido." });

  try {
    const user = await requireUser(req);
    const { code, redirectUri } = req.body || {};
    if (!code || !redirectUri) return res.status(400).json({ error: "Código OAuth ou origem ausente." });

    const requestOrigin = req.headers.origin;
    if (requestOrigin && new URL(redirectUri).origin !== new URL(requestOrigin).origin) {
      return res.status(400).json({ error: "Origem OAuth inválida." });
    }

    const existing = await getConnection(user.id);
    const tokenData = await exchangeCode(code, redirectUri);
    const saved = await saveConnection(user.id, tokenData, existing);

    if (!saved.refresh_token) {
      return res.status(409).json({
        error: "O Google não retornou um token de atualização. Remova o acesso anterior do Norte na sua Conta Google e conecte novamente."
      });
    }

    return res.status(200).json({ connected: true });
  } catch (err) {
    console.error("google-connect", err);
    return res.status(err.status || 500).json({ error: err.message || "Falha ao conectar Google Agenda." });
  }
};
