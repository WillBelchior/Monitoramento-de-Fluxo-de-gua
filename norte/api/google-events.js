const {
  cors,
  requireUser,
  validConnection,
  googleFetch
} = require("../server/google-calendar");

module.exports = async function handler(req, res) {
  if (cors(req, res)) return;

  try {
    const user = await requireUser(req);
    const connection = await validConnection(user.id);

    if (req.method === "GET") {
      const now = new Date();
      const timeMin = req.query.timeMin || now.toISOString();
      const timeMax = req.query.timeMax || new Date(now.getTime() + 7 * 86400000).toISOString();

      const qs = new URLSearchParams({
        singleEvents: "true",
        orderBy: "startTime",
        maxResults: "50",
        timeMin,
        timeMax
      });

      const data = await googleFetch(
        "/calendars/primary/events?" + qs.toString(),
        connection.access_token
      );

      const events = (data.items || []).map((e) => ({
        id: e.id,
        summary: e.summary || "(Sem título)",
        description: e.description || "",
        htmlLink: e.htmlLink || "",
        status: e.status,
        start: e.start || null,
        end: e.end || null
      }));

      return res.status(200).json({ connected: true, events });
    }

    if (req.method === "POST") {
      const { summary, description, start, end, timeZone, allDay } = req.body || {};
      if (!summary || !start || !end) {
        return res.status(400).json({ error: "Título, início e fim são obrigatórios." });
      }

      const event = allDay
        ? {
            summary,
            description: description || "",
            start: { date: start },
            end: { date: end }
          }
        : {
            summary,
            description: description || "",
            start: { dateTime: start, timeZone: timeZone || "America/Fortaleza" },
            end: { dateTime: end, timeZone: timeZone || "America/Fortaleza" }
          };

      const created = await googleFetch(
        "/calendars/primary/events",
        connection.access_token,
        { method: "POST", body: JSON.stringify(event) }
      );

      return res.status(201).json({
        id: created.id,
        summary: created.summary,
        htmlLink: created.htmlLink,
        start: created.start,
        end: created.end
      });
    }

    return res.status(405).json({ error: "Método não permitido." });
  } catch (err) {
    console.error("google-events", err);
    return res.status(err.status || 500).json({ error: err.message || "Falha no Google Agenda." });
  }
};
