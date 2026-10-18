require("dotenv").config();
const express = require("express"), crypto = require("crypto"), fs = require("fs"), path = require("path");
const Database = require("better-sqlite3"), nodemailer = require("nodemailer");
const KEY = process.env.ANTHROPIC_API_KEY, PROD = process.env.NODE_ENV === "production";
const MODELS = { quick: process.env.MODEL_QUICK || "claude-haiku-5-5", default: process.env.MODEL_DEFAULT || "claude-sonnet-5-5", complex: process.env.MODEL_COMPLEX || "claude-sonnet-5-5" };
const DAILY = +process.env.DAILY_AI_LIMIT_PER_USER || 60;
const DIR = process.env.DATA_DIR || "./data"; fs.mkdirSync(DIR, { recursive: true });
const db = new Database(path.join(DIR, "idea.db"));
db.exec("CREATE TABLE IF NOT EXISTS kv(uid TEXT, id TEXT, data TEXT, updated INTEGER, PRIMARY KEY(uid,id))");
const app = express(); app.set("trust proxy", 1); app.use(express.json({ limit: "7mb" }));

// anonymous user id in a private cookie (add real logins later if you need accounts)
app.use((req, res, next) => {
  const m = /(?:^|; )uid=([a-f0-9]{32})/.exec(req.headers.cookie || ""); let uid = m && m[1];
  if (!uid) { uid = crypto.randomBytes(16).toString("hex"); res.setHeader("Set-Cookie", `uid=${uid}; HttpOnly; SameSite=Lax; Path=/; Max-Age=31536000${PROD ? "; Secure" : ""}`); }
  req.uid = uid; next();
});
// small in-memory rate limiter: per-user daily cap and per-IP burst cap
const day = new Map(), burst = new Map();
function limit(req, res, next) {
  const d = new Date().toISOString().slice(0, 10), k = req.uid + d, now = Date.now();
  const b = (burst.get(req.ip) || []).filter(t => now - t < 60000);
  if (b.length >= 20) return res.status(429).json({ error: "slow_down" });
  if ((day.get(k) || 0) >= DAILY) return res.status(429).json({ error: "daily_limit" });
  b.push(now); burst.set(req.ip, b); day.set(k, (day.get(k) || 0) + 1); next();
}
app.get("/api/health", (q, r) => r.json({ ai: !!KEY, email: !!process.env.SMTP_HOST, storage: true }));

app.post("/api/ai", limit, async (req, res) => {
  if (!KEY) return res.status(503).json({ error: "ai_not_configured" });
  const { prompt, tier } = req.body || {};
  if (typeof prompt !== "string" || !prompt.trim() || prompt.length > 80000) return res.status(400).json({ error: "bad_prompt" });
  const ac = new AbortController(), to = setTimeout(() => ac.abort(), 120000);
  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", { method: "POST", signal: ac.signal,
      headers: { "x-api-key": KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model: MODELS[tier] || MODELS.default, max_tokens: tier === "complex" ? 3500 : 2000, messages: [{ role: "user", content: prompt }] }) });
    const j = await r.json();
    if (!r.ok) { console.error("Anthropic error", r.status, j && j.error && j.error.type); return res.status(r.status === 429 ? 429 : 502).json({ error: r.status === 429 ? "busy" : "ai_error" }); }
    res.json({ text: (j.content || []).filter(c => c.type === "text").map(c => c.text).join("") });
  } catch (e) { res.status(504).json({ error: "ai_timeout" }); } finally { clearTimeout(to); }
});

const okId = id => /^[A-Za-z0-9_.-]{1,120}$/.test(id);
app.get("/api/kv", (req, res) => res.json({ items: db.prepare("SELECT id,data FROM kv WHERE uid=? ORDER BY updated DESC").all(req.uid).map(r => ({ id: r.id, data: JSON.parse(r.data) })) }));
app.get("/api/kv/:id", (req, res) => { const r = okId(req.params.id) && db.prepare("SELECT data FROM kv WHERE uid=? AND id=?").get(req.uid, req.params.id); r ? res.json({ data: JSON.parse(r.data) }) : res.status(404).json({ error: "not_found" }); });
app.put("/api/kv/:id", (req, res) => {
  if (!okId(req.params.id) || !req.body || typeof req.body.data !== "object") return res.status(400).json({ error: "bad_request" });
  const n = db.prepare("SELECT COUNT(*) c FROM kv WHERE uid=?").get(req.uid).c, ex = db.prepare("SELECT 1 FROM kv WHERE uid=? AND id=?").get(req.uid, req.params.id);
  if (!ex && n >= 400) return res.status(413).json({ error: "storage_full" });
  db.prepare("INSERT INTO kv(uid,id,data,updated) VALUES(?,?,?,?) ON CONFLICT(uid,id) DO UPDATE SET data=excluded.data, updated=excluded.updated").run(req.uid, req.params.id, JSON.stringify(req.body.data), Date.now());
  res.json({ ok: true });
});
app.delete("/api/kv/:id", (req, res) => { if (okId(req.params.id)) db.prepare("DELETE FROM kv WHERE uid=? AND id=?").run(req.uid, req.params.id); res.json({ ok: true }); });

const mails = new Map();
app.post("/api/email", async (req, res) => {
  if (!process.env.SMTP_HOST) return res.status(503).json({ error: "email_not_configured" });
  const { to, subject, filename, base64 } = req.body || {}, k = req.uid + new Date().toISOString().slice(0, 10);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to || "") || typeof base64 !== "string" || base64.length > 6e6) return res.status(400).json({ error: "bad_request" });
  if ((mails.get(k) || 0) >= 5) return res.status(429).json({ error: "daily_limit" });
  mails.set(k, (mails.get(k) || 0) + 1);
  try {
    await nodemailer.createTransport({ host: process.env.SMTP_HOST, port: +process.env.SMTP_PORT || 587, auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined })
      .sendMail({ from: process.env.SMTP_FROM || process.env.SMTP_USER, to, subject: String(subject || "Your IDEA document").slice(0, 150), text: "Your document is attached. It is an AI-written draft: please review and verify it before sharing.\n\nIDEA by GIT GROUP", attachments: [{ filename: String(filename || "document.docx").replace(/[^\w.\- ]/g, ""), content: Buffer.from(base64, "base64") }] });
    res.json({ ok: true });
  } catch (e) { console.error("mail", e.message); res.status(502).json({ error: "email_failed" }); }
});
app.use(express.static(path.join(__dirname, "public")));
app.listen(process.env.PORT || 3000, () => console.log("IDEA running on port " + (process.env.PORT || 3000) + (KEY ? "" : "  (no ANTHROPIC_API_KEY set: AI is off)")));
