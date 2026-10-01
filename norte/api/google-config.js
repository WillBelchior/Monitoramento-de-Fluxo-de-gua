const { GOOGLE_CLIENT_ID, cors } = require("../server/google-calendar");

module.exports = async function handler(req, res) {
  if (cors(req, res)) return;
  if (req.method !== "GET") return res.status(405).json({ error: "Método não permitido." });
  if (!GOOGLE_CLIENT_ID) return res.status(503).json({ configured: false });
  return res.status(200).json({ configured: true, clientId: GOOGLE_CLIENT_ID });
};
