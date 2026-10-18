// Lets the IDEA front end talk to YOUR server instead of the Claude artifact environment.
(function () {
  const j = async (u, o) => { const r = await fetch(u, { credentials: "same-origin", headers: { "Content-Type": "application/json" }, ...o }); let b = {}; try { b = await r.json(); } catch (e) {} if (!r.ok) throw Object.assign(new Error(b.error || "request_failed"), { code: b.error }); return b; };
  const parse = t => { t = String(t).replace(/```json|```/g, ""); const a = t.indexOf("{"), b = t.lastIndexOf("}"); if (a < 0 || b < a) throw new Error("no json"); return JSON.parse(t.slice(a, b + 1)); };
  const ai = async (p, o) => j("/api/ai", { method: "POST", body: JSON.stringify({ prompt: p, tier: (o && o.modelTier) || "default" }) });
  ai.json = async (p, o) => parse((await ai(p + "\n\nReply with ONLY valid JSON, no code fences.", o)).text);
  const doc = id => ({ set: d => j("/api/kv/" + encodeURIComponent(id), { method: "PUT", body: JSON.stringify({ data: d }) }),
    get: async () => { try { const b = await j("/api/kv/" + encodeURIComponent(id)); return { exists: true, data: () => b.data }; } catch (e) { if (e.code === "not_found") return { exists: false, data: () => null }; throw e; } },
    delete: () => j("/api/kv/" + encodeURIComponent(id), { method: "DELETE" }) });
  const db = { collection: () => ({ doc, get: async () => { const b = await j("/api/kv"); return { docs: b.items.map(i => ({ id: i.id, data: () => i.data })) }; } }) };
  const dl = { save: async ({ filename, data }) => { const bl = data instanceof Blob ? data : new Blob([data], { type: "text/plain" }); const a = document.createElement("a"); a.href = URL.createObjectURL(bl); a.download = filename; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000); } };
  let H = null; const health = () => H || (H = j("/api/health").catch(() => ({})));
  window.IDEA_FEATURES = {}; health().then(h => { window.IDEA_FEATURES = h; });
  window.claude = { use: async n => n === "sample" ? ((await health()).ai ? ai : null) : n === "user" ? { id: async () => "me" } : n === "db" ? db : n === "downloads" ? dl : null };
})();
