const {
  cors,
  requireUser,
  getConnection,
  deleteConnection
} = require("../server/google-calendar");

module.exports = async function handler(req, res) {
  if (cors(req, res)) return;
  if (req.method !== "DELETE") return res.status(405).json({ error: "Método não permitido." });

  try {
    const user = await requireUser(req);
    const connection = await getConnection(user.id);
    const token = connection?.refresh_token || connection?.access_token;

    if (token) {
      await fetch("https://oauth2.googleapis.com/revoke?token=" + encodeURIComponent(token), {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" }
      }).catch(() => null);
    }

    await deleteConnection(user.id);
    return res.status(200).json({ connected: false });
  } catch (err) {
    console.error("google-disconnect", err);
    return res.status(err.status || 500).json({ error: err.message || "Falha ao desconectar Google Agenda." });
  }
};
