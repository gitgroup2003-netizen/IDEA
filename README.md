# IDEA by GIT GROUP: standalone version

Created by Frank Ssemakula, CEO, GIT GROUP (Home of Technology).
A web platform where anyone can build, research and expand an idea with AI. Your Claude API key stays on the SERVER and never reaches the browser.

## What is in this folder
- `app.js` : the backend (AI calls, storage, email, limits). `server.js` runs it as a normal server; `api/index.js` runs it on Vercel. `store.js` picks Postgres or SQLite.
- `server.js` : local start. 
- `public/index.html` : the app people see (same interface and flow as the demo).
- `public/claude-shim.js` : connects the page to your server.
- `.env.example` : the list of settings. Copy to `.env`. Never share `.env`.

## 1. Get a key safely
1. Go to console.anthropic.com and sign in to YOUR account.
2. Create a NEW API key named "IDEA" (do not reuse a key you use elsewhere).
3. Set a monthly spending limit on the account so a bug or abuse cannot run up a large bill.
4. Never paste the key into chats, emails, GitHub or the website code. If it leaks, delete it in the Console and create another.

## 2. Run it on your computer (needs Node.js 18 or newer)
```
npm install
cp .env.example .env      # then open .env and paste your key after ANTHROPIC_API_KEY=
npm start
```
Open http://localhost:3000

## 3A. Put it online on VERCEL
Vercel runs short-lived, read-only functions, so it cannot keep a local database file. This version stores data in a hosted Postgres database instead.
1. Replace the files in your GitHub repository with the files from this folder and commit.
2. In Vercel, open the project > Settings > General: Framework Preset = "Other". Leave Build Command empty.
3. Add a database: Vercel dashboard > Storage (or Marketplace) > create a Postgres database (Neon) and connect it to this project. This adds `DATABASE_URL` automatically.
4. Settings > Environment Variables: add `ANTHROPIC_API_KEY` (your new key). Add the optional ones from `.env.example` if wanted.
5. Redeploy (environment changes only apply to new deployments).
6. Open `https://YOUR-SITE.vercel.app/api/health`. You should see `{"ai":true,...,"storage":"postgres"}`. If `ai` is false the key is missing; if you see an error page, open Vercel > project > Logs and read the first red line.
Notes: drafts can take 20 to 50 seconds, so the function allows up to 60 seconds (`vercel.json`); if your Vercel plan caps functions lower, long drafts will time out. Vercel's free Hobby plan is meant for personal, non-commercial use, so check their terms before a commercial launch.

## 3B. Or put it online on Render / Railway / Fly.io (runs `server.js` as a normal server)
1. Build command `npm install`, start command `npm start`.
2. Add the environment variables from `.env.example`.
3. Add a Persistent Disk and set `DATA_DIR` to its path, or set `DATABASE_URL` to a Postgres database. Without one of these, saved ideas are erased on restart.
4. Add your own domain in the host's settings (HTTPS is automatic) and set `NODE_ENV=production`.

## Optional: email documents to users
Fill in `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` from any email provider (Brevo, Mailgun, Postmark, Gmail SMTP, etc.). When set, a "Send" box appears under each drafted document. Limit: 5 emails per user per day.

## Cost and safety controls already built in
- `DAILY_AI_LIMIT_PER_USER` caps AI calls per visitor per day; there is also a per-IP burst limit.
- Prompts are limited in size; uploads are read in the browser and capped.
- Each visitor only ever sees their own saved ideas.

## Be aware of (not built yet)
- Visitors are anonymous (a private cookie). Clearing cookies or switching device loses access to saved ideas. For real accounts add a login (Auth0, Clerk, Supabase Auth).
- The AI works from its general knowledge plus the user's uploaded files. It does NOT search the live web, so research is labelled "verify". Adding a search provider is a future step.
- SQLite on one disk suits early use. For many thousands of users, move to Postgres.
- Scanned (image-only) PDFs are not readable yet (no OCR).
- Free-text AI output should be reviewed by a person before it is relied on or published.
