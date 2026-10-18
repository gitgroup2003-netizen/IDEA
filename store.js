// Storage: Postgres when DATABASE_URL is set (use this on Vercel), otherwise a local SQLite file (local/Render/Railway).
const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
let impl;
if (url) {
  const { Pool } = require("pg");
  const pool = global.__ideaPool || (global.__ideaPool = new Pool({ connectionString: url, ssl: /localhost|127\.0\.0\.1/.test(url) ? false : { rejectUnauthorized: false }, max: 3 }));
  const ready = (async () => {
    await pool.query("CREATE TABLE IF NOT EXISTS kv(uid text, id text, data text, updated bigint, PRIMARY KEY(uid,id))");
    await pool.query("CREATE TABLE IF NOT EXISTS usage(uid text, k text, n int, PRIMARY KEY(uid,k))");
  })();
  impl = {
    kind: "postgres", ready,
    list: async uid => (await pool.query("SELECT id,data FROM kv WHERE uid=$1 ORDER BY updated DESC", [uid])).rows,
    get: async (uid, id) => ((await pool.query("SELECT data FROM kv WHERE uid=$1 AND id=$2", [uid, id])).rows[0] || {}).data,
    count: async uid => +(await pool.query("SELECT COUNT(*) AS c FROM kv WHERE uid=$1", [uid])).rows[0].c,
    put: async (uid, id, data) => { await pool.query("INSERT INTO kv(uid,id,data,updated) VALUES($1,$2,$3,$4) ON CONFLICT(uid,id) DO UPDATE SET data=EXCLUDED.data, updated=EXCLUDED.updated", [uid, id, data, Date.now()]); },
    del: async (uid, id) => { await pool.query("DELETE FROM kv WHERE uid=$1 AND id=$2", [uid, id]); },
    bump: async (uid, k) => +(await pool.query("INSERT INTO usage(uid,k,n) VALUES($1,$2,1) ON CONFLICT(uid,k) DO UPDATE SET n=usage.n+1 RETURNING n", [uid, k])).rows[0].n,
  };
} else {
  const fs = require("fs"), path = require("path"), Database = require("better-sqlite3");
  const dir = process.env.DATA_DIR || "./data"; fs.mkdirSync(dir, { recursive: true });
  const db = new Database(path.join(dir, "idea.db"));
  db.exec("CREATE TABLE IF NOT EXISTS kv(uid TEXT, id TEXT, data TEXT, updated INTEGER, PRIMARY KEY(uid,id)); CREATE TABLE IF NOT EXISTS usage(uid TEXT, k TEXT, n INTEGER, PRIMARY KEY(uid,k))");
  impl = {
    kind: "sqlite", ready: Promise.resolve(),
    list: async uid => db.prepare("SELECT id,data FROM kv WHERE uid=? ORDER BY updated DESC").all(uid),
    get: async (uid, id) => (db.prepare("SELECT data FROM kv WHERE uid=? AND id=?").get(uid, id) || {}).data,
    count: async uid => db.prepare("SELECT COUNT(*) c FROM kv WHERE uid=?").get(uid).c,
    put: async (uid, id, data) => { db.prepare("INSERT INTO kv(uid,id,data,updated) VALUES(?,?,?,?) ON CONFLICT(uid,id) DO UPDATE SET data=excluded.data, updated=excluded.updated").run(uid, id, data, Date.now()); },
    del: async (uid, id) => { db.prepare("DELETE FROM kv WHERE uid=? AND id=?").run(uid, id); },
    bump: async (uid, k) => { db.prepare("INSERT INTO usage(uid,k,n) VALUES(?,?,1) ON CONFLICT(uid,k) DO UPDATE SET n=n+1").run(uid, k); return db.prepare("SELECT n FROM usage WHERE uid=? AND k=?").get(uid, k).n; },
  };
}
module.exports = impl;
