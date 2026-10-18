require("dotenv").config();
const express = require("express"), crypto = require("crypto"), nodemailer = require("nodemailer"), store = require("./store");
const KEY = process.env.ANTHROPIC_API_KEY, PROD = !!(process.env.VERCEL || process.env.NODE_ENV === "production");
const MODELS = { quick: process.env.MODEL_QUICK || "claude-haiku-5-5", default: process.env.MODEL_DEFAULT || "claude-sonnet-5-5", complex: process.env.MODEL_COMPLEX || "claude-sonnet-5-5" };
const DAILY = +process.env.DAILY_AI_LIMIT_PER_USER || 60;
const app = express(); app.set("trust proxy", 1); app.use(express.json({ limit: "4mb" }));
const ah = fn => (q, s, n) => fn(q, s, n).catch(e => { console.error(e); if (!s.headersSent) s.status(500).json({ error: "server_error" }); });
const today = () => new Date().toISOString().slice(0, 10);

app.use(ah(async (req, res, next) => {            // anonymous user id in a private cookie
  await store.ready;
  const m = /(?:^|; )uid=([a-f0-9]{32})/.exec(req.headers.cookie || ""); let uid = m && m[1];
  if (!uid) { uid = crypto.randomBytes(16).toString("hex"); res.setHeader("Set-Cookie", `uid=${uid}; HttpOnly; SameSite=Lax; Path=/; Max-Age=31536000${PROD ? "; Secure" : ""}`); }
  req.uid = uid; next();
}));
const burst = new Map();                          // per-IP burst limit (best effort; resets when the function restarts)
const limit = ah(async (req, res, next) => {
  const now = Date.now(), b = (burst.get(req.ip) || []).filter(t => now - t < 60000);
  if (b.length >= 20) return res.status(429).json({ error: "slow_down" });
  b.push(now); burst.set(req.ip, b);
  if (await store.bump(req.uid, "ai" + today()) > DAILY) return res.status(429).json({ error: "daily_limit" });
  next();
});
app.get("/api/health", (q, r) => r.json({ ai: !!KEY, email: !!process.env.SMTP_HOST, storage: store.kind }));

app.post("/api/ai", limit, ah(async (req, res) => {
  if (!KEY) return res.status(503).json({ error: "ai_not_configured" });
  const { prompt, tier } = req.body || {};
  if (typeof prompt !== "string" || !prompt.trim() || prompt.length > 80000) return res.status(400).json({ error: "bad_prompt" });
  const ac = new AbortController(), to = setTimeout(() => ac.abort(), 55000);
  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", { method: "POST", signal: ac.signal,
      headers: { "x-api-key": KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model: MODELS[tier] || MODELS.default, max_tokens: tier === "complex" ? 3500 : 2000, messages: [{ role: "user", content: prompt }] }) });
    const j = await r.json();
    if (!r.ok) { console.error("Anthropic error", r.status, j && j.error && j.error.type); return res.status(r.status === 429 ? 429 : 502).json({ error: r.status === 429 ? "busy" : "ai_error" }); }
    res.json({ text: (j.content || []).filter(c => c.type === "text").map(c => c.text).join("") });
  } catch (e) { res.status(504).json({ error: "ai_timeout" }); } finally { clearTimeout(to); }
}));

const okId = id => /^[A-Za-z0-9_.-]{1,120}$/.test(id);
app.get("/api/kv", ah(async (req, res) => res.json({ items: (await store.list(req.uid)).map(r => ({ id: r.id, data: JSON.parse(r.data) })) })));
app.get("/api/kv/:id", ah(async (req, res) => { const d = okId(req.params.id) && await store.get(req.uid, req.params.id); d ? res.json({ data: JSON.parse(d) }) : res.status(404).json({ error: "not_found" }); }));
app.put("/api/kv/:id", ah(async (req, res) => {
  if (!okId(req.params.id) || !req.body || typeof req.body.data !== "object") return res.status(400).json({ error: "bad_request" });
  if (!(await store.get(req.uid, req.params.id)) && (await store.count(req.uid)) >= 400) return res.status(413).json({ error: "storage_full" });
  await store.put(req.uid, req.params.id, JSON.stringify(req.body.data)); res.json({ ok: true });
}));
app.delete("/api/kv/:id", ah(async (req, res) => { if (okId(req.params.id)) await store.del(req.uid, req.params.id); res.json({ ok: true }); }));

app.post("/api/email", ah(async (req, res) => {
  if (!process.env.SMTP_HOST) return res.status(503).json({ error: "email_not_configured" });
  const { to, subject, filename, base64 } = req.body || {};
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to || "") || typeof base64 !== "string" || base64.length > 3e6) return res.status(400).json({ error: "bad_request" });
  if (await store.bump(req.uid, "mail" + today()) > 5) return res.status(429).json({ error: "daily_limit" });
  try {
    await nodemailer.createTransport({ host: process.env.SMTP_HOST, port: +process.env.SMTP_PORT || 587, auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined })
      .sendMail({ from: process.env.SMTP_FROM || process.env.SMTP_USER, to, subject: String(subject || "Your IDEA document").slice(0, 150), text: "Your document is attached. It is an AI-written draft: please review and verify it before sharing.\n\nIDEA by GIT GROUP", attachments: [{ filename: String(filename || "document.docx").replace(/[^\w.\- ]/g, ""), content: Buffer.from(base64, "base64") }] });
    res.json({ ok: true });
  } catch (e) { console.error("mail", e.message); res.status(502).json({ error: "email_failed" }); }
}));
module.exports = app;
