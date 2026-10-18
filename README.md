# IDEA by GIT GROUP: standalone version

Created by Frank Ssemakula, CEO, GIT GROUP (Home of Technology).
A web platform where anyone can build, research and expand an idea with AI. Your Claude API key stays on the SERVER and never reaches the browser.

## What is in this folder
- `server.js` : the backend. Calls the Claude API, stores ideas and documents (SQLite), optional email delivery, rate limits.
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

## 3. Put it online (example: Render.com; Railway and Fly.io work the same way)
1. Upload this folder to a private GitHub repository (the `.gitignore` already keeps `.env` and data out).
2. On Render: New > Web Service > connect the repo. Build command `npm install`, start command `npm start`.
3. Under Environment, add the variables from `.env.example`. Put your real key in `ANTHROPIC_API_KEY` here, not in a file.
4. IMPORTANT: add a Persistent Disk (e.g. mounted at `/data`) and set `DATA_DIR=/data`. Without it, saved ideas are erased on every restart.
5. Add your own domain in the host's settings when ready. Use HTTPS (the host provides it) and set `NODE_ENV=production`.

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
