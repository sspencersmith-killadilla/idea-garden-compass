# Common Ground — User Manual (v2)

Common Ground is a shared idea notebook for departments, city projects and teams. You jot down a thought (or email it in), and AI turns it into a titled, summarized, tagged card with to-dos — all searchable on one dashboard.

---

## Part 1 — Using Common Ground

### 1. Signing in
1. Open the site and click **Start your team space** / **Sign in**.
2. Sign in with email + password (confirm your email first), or with **Google** (the only two sign-in options).
3. You land on your **Dashboard**. Your personal **Notebook** is always there and only you can see it.

### 2. Capturing an idea
- Type or paste anything into the capture box at the top of the dashboard and press **Capture**.
- The prompt in the box changes every few seconds for inspiration; a small burst of "bricks" confirms each capture.
- Within a few seconds the card fills in: **title, short summary, tags, a theme, and to-dos** pulled from your text.
- Ideas go into whichever space is selected in the space switcher (Notebook or a team).

### 3. Finding ideas
- **Search** looks through titles, summaries and original text.
- **Sort** newest / oldest; **filter** by tag, theme or source (web / email).
- Views:
  - **All ideas** – card grid.
  - **By theme** – ideas grouped by broad theme ("districts").
  - **To-dos** – every action item; tick them off as you go.
  - **Timeline** – ideas laid along a road, grouped by day with time, theme and author.

**Build-stage icons** on each card show progress: *empty lot* = no to-dos yet, *crane* = to-dos still open, *finished building* = all to-dos done.

### 4. Working with one idea
Click a card to open it. You can:
- Edit tags, check off to-dos, or **Re-organize** (re-run the AI).
- **Comment** (team spaces).
- **Share publicly** – creates a read-only link anyone can open without an account. Turn sharing off to kill the link instantly. Only the author or a team admin can share.
- **Send to team space** (Notebook ideas only) – moves the idea and its to-dos into a team and re-files it under that team's themes.
- **Delete**.

### 5. Journal
The **Journal** page lists every idea you wrote, in all spaces, grouped by month and day. Search it and flip newest/oldest. Click an entry to jump to it.

### 6. Teams (departments, projects)
- **Create a space**: space switcher → *New space* → name it and pick Department, City project or Team. You become its admin.
- **Invite people**: open *Members* → copy the invite link and send it. Anyone signed in who opens it joins as a member.
- **Roles**: *Admins* manage members, rename, share or remove any idea. *Members* add ideas, comment, and edit their own.
- Team ideas are visible to all members; your Notebook never is.

### 7. Email-in
Open the **Email-in** panel to see your personal address (looks like `inbox+abc123@yourdomain`). Anything you send there becomes an idea in your Notebook: subject + body are used. If the panel says *not connected*, the administrator hasn't finished email setup (see Part 2, step 7).

### 8. The look and feel
Common Ground uses a light city-builder style: skyline silhouettes, power lines, road underlines and small animations. If your device has *Reduce motion* turned on, animations are switched off automatically.

### 9. Display name
Set your name in your profile/settings so teammates see who wrote what.

---

## Part 2 — Installing & self-hosting (no Lovable required)

### What you need
| Piece | Purpose | Free option |
|---|---|---|
| Node.js 20+ (or Bun) | build & run the app | yes |
| A Supabase project (cloud at supabase.com, or self-hosted Supabase via Docker) | database, sign-in, security rules | yes |
| An OpenAI-compatible AI API key (OpenAI, OpenRouter, etc.) | organizing ideas | paid per use |
| A host: Cloudflare Workers, or any Node server/VPS | serving the site | yes |
| Postmark (optional) | email-in | free tier |

### Step 1 — Get the code
Export the project to GitHub from Lovable (or use the source you were given), then:
```bash
git clone <your-repo-url> common-ground
cd common-ground
npm install        # or: bun install
```

### Step 2 — Create the database
1. Create a new Supabase project.
2. Open its **SQL editor**, paste the entire contents of `schema.sql` (included with this manual) and run it. This creates all tables, security rules, team functions, the public-share function and the new-user trigger.
3. **Authentication → Providers**: enable Email. Optionally enable Google (create an OAuth client in Google Cloud; redirect URL `https://<your-supabase-url>/auth/v1/callback`).
4. **Authentication → URL configuration**: set Site URL to your domain and add `https://yourdomain/auth` as a redirect URL.

### Step 3 — Remove Lovable-specific pieces
These only work on Lovable's platform:

1. **Google sign-in** — in `src/routes/auth.tsx`, replace the Lovable OAuth call with plain Supabase (the app only offers Google and email; the Lovable button is already removed):
   ```ts
   // remove: import { lovable } from "@/integrations/lovable/index";
   // remove: import "@lovable.dev/cloud-auth-js/styles.css";
   async function oauth(p: "google") {
     const { error } = await supabase.auth.signInWithOAuth({
       provider: p,
       options: { redirectTo: window.location.origin + "/auth" },
     });
     if (error) toast.error(error.message);
   }
   ```
   Then `npm uninstall @lovable.dev/cloud-auth-js` and delete `src/integrations/lovable/`.
2. **AI provider** — in `src/lib/organize.server.ts`, point the AI client at your own provider:
   ```ts
   const apiKey = process.env["AI_API_KEY"];
   const provider = createOpenAI({
     baseURL: process.env["AI_BASE_URL"] ?? "https://api.openai.com/v1",
     apiKey,
   });
   // model: provider.responses(process.env["AI_MODEL"] ?? "gpt-4o-mini"),
   ```
   Remove the Lovable headers. If your provider doesn't support the "responses" API (e.g. OpenRouter), use `provider.chat(...)` instead.
3. Optional: remove `lovable-tagger` / Lovable plugins from `vite.config.ts` and `package.json` if present, and `src/lib/lovable-error-reporting.ts` references.

### Step 4 — Environment variables
Create `.env` (never commit it):
```
# Browser (public, safe to expose)
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<anon / publishable key>
VITE_SUPABASE_PROJECT_ID=xxxx

# Server only
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_PUBLISHABLE_KEY=<anon / publishable key>
SUPABASE_SERVICE_ROLE_KEY=<service role key — secret!>
AI_API_KEY=<your AI key>
AI_BASE_URL=https://api.openai.com/v1
AI_MODEL=gpt-4o-mini

# Optional email-in
INBOUND_EMAIL_DOMAIN=inbound.yourdomain.org
INBOUND_EMAIL_SECRET=<long random string>
```
The keys are in Supabase under **Project Settings → API**. The service role key is only used by the email-in receiver.

### Step 5 — Run locally
```bash
npm run dev      # http://localhost:8080
```
Sign up, confirm your email, capture an idea, and confirm the card fills in.

### Step 6 — Deploy
**Option A: Cloudflare Workers (matches how the app is built)**
```bash
npm run build
npx wrangler login
npx wrangler deploy
```
Add the server-only variables as Worker secrets: `npx wrangler secret put AI_API_KEY` (repeat for each). `VITE_*` values must be present at build time.

**Option B: Your own server (VPS / Docker)**
Switch the build target to Node (in `vite.config.ts` set the TanStack Start / Nitro preset to `node-server`), then:
```bash
npm run build
node .output/server/index.mjs     # listens on PORT (default 3000)
```
Put it behind Nginx or Caddy for HTTPS, and keep it running with systemd or pm2. A minimal Dockerfile:
```dockerfile
FROM node:20-alpine AS build
WORKDIR /app
COPY . .
RUN npm ci && npm run build
FROM node:20-alpine
WORKDIR /app
COPY --from=build /app/.output ./.output
ENV PORT=3000
EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
```

After deploying, update Supabase **Site URL / redirect URLs** to the live domain.

### Step 7 — Email-in with Postmark (optional)
1. Create a Postmark server → **Inbound** stream.
2. Point your domain's MX record (e.g. `inbound.yourdomain.org`) to `inbound.postmarkapp.com`, and set it as the inbound domain in Postmark.
3. Inbound webhook URL:
   `https://postmark:<INBOUND_EMAIL_SECRET>@yourdomain.org/api/public/inbound-email`
4. Set `INBOUND_EMAIL_DOMAIN` and `INBOUND_EMAIL_SECRET` and redeploy. The Email-in panel will show each user's personal `+token` address.

### Step 8 — Make yourself admin of a space
Admins are per space: whoever creates a space is its admin. There's no global super-admin; to fix ownership manually, run in the SQL editor:
```sql
update team_members set role='admin' where team_id='<team uuid>' and user_id='<user uuid>';
```

### Backups & updates
- Supabase cloud takes daily backups on paid plans; otherwise `pg_dump` the database regularly.
- To update the app: `git pull && npm install && npm run build`, then redeploy.

### Troubleshooting
| Symptom | Fix |
|---|---|
| Ideas stay "pending" | AI key/base URL/model wrong — check server logs. |
| "Expected 3 parts in JWT" | You're using new `sb_publishable_` keys with an old client; update `@supabase/supabase-js`, or use the legacy anon key. |
| Google sign-in error | Provider not enabled, or redirect URL not whitelisted. |
| Can't see team ideas | User isn't a member — resend the invite link. |
| Email-in panel says not connected | Both `INBOUND_EMAIL_*` variables must be set. |
| Public link 404s | Sharing was turned off, or `schema.sql` grant for `get_public_idea` missing. |
