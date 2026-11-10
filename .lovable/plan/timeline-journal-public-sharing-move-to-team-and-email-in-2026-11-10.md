# Timeline, journal, public sharing, move-to-team, and email-in

## 1. Timeline view (dashboard)
- New **Timeline** tab next to All ideas / By theme / To-dos.
- Ideas are grouped by day ("Today", "Yesterday", "Mon, Nov 9"…) on a vertical line with a dot per idea, showing the time, title, theme chip and who shared it (in team spaces).
- The current search and filters still apply.

## 2. Journal page
- New **Journal** page (link in the header) listing **all your ideas** across your notebook and every team space you belong to, in date order.
- Grouped by month, then day, with a reading-friendly layout: full original text, title, theme, tags, and a small "Notebook" or team-name label.
- Toggle between newest-first and oldest-first, plus a search box. Clicking an entry opens it in its space.

## 3. Public share links
- In an idea's detail panel: **Share publicly** switch. When on, you get a link like `/i/abc123xyz` to copy.
- Anyone with the link sees a clean, branded, read-only page with the title, summary, original text, tags and to-dos. No sign-in needed. They don't see comments, the author's email, or anything else in the space.
- Turning the switch off kills the link right away. Turning it on again creates a new link, so old ones never come back.
- Who can share: the idea's author, or a team admin for team ideas.

## 4. Send a notebook idea to a team
- In a private idea's detail panel: **Send to team space**, with a picker of your teams.
- The idea moves into that team. The AI re-sorts it into that team's themes and tags, and it disappears from your notebook. Its to-dos come with it.

## 5. Email-in with Postmark
Inbound emails land in your **notebook**, organized like any other idea.
- The receiving endpoint already exists. I'll finish it and connect the dashboard panel.
- The **Email in** panel will show your personal address (e.g. `ideas+a1b2c3@inbound.yourdomain.com`), a copy button, and short setup steps.
- Any email you send there shows up on the dashboard in a few seconds, marked with an email icon. The dashboard checks for new ones every so often while open.
- Security: a secret password that only Postmark knows protects the endpoint, and unknown addresses are ignored.

**What you'll need to do (I'll guide you):**
1. Create a free Postmark account and an "Inbound" stream.
2. Tell me the inbound address Postmark gives you, or the custom domain you point at Postmark (an MX record).
3. I'll generate the secret and give you the exact webhook URL to paste into Postmark.

Until step 3 is done, everything else works and the panel shows "Not connected yet."

## Technical details
- Migration: `ideas.share_token text unique null`; a security-definer RPC `get_public_idea(_token)` returns only safe fields (title, summary, raw_text, tags, created_at, theme name/hue, action item text/done). Granted to `anon`, so the ideas table needs no anon policy.
- Public route `src/routes/i.$token.tsx` (SSR, with head() and noindex) loads the idea via a server function that uses a publishable-key client and calls the RPC.
- Share toggle and move go through `requireSupabaseAuth` server functions. Moving checks `can_edit_idea` plus team membership, sets `team_id`, clears `theme_id`, then reruns `organizeIdea`.
- Inbound address domain is stored as a non-secret setting (`INBOUND_EMAIL_DOMAIN`) and returned to the panel by a server function. `INBOUND_EMAIL_SECRET` is generated as a secret, and Postmark sends it via basic auth in the webhook URL (`https://postmark:SECRET@…/api/public/inbound-email`).
- Journal fetches ideas from all accessible spaces (RLS already scopes them), plus team names.
