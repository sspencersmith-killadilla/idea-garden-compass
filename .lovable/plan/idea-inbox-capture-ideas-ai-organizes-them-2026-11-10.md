# Idea Inbox: capture ideas, AI organizes them

A personal "second brain": people drop in ideas from a quick-capture box or by email, and AI turns each one into a tidy card on a searchable, sortable dashboard.

## What users get
- **Accounts**: sign up / sign in with email + password (Google optional later). Each person sees only their own ideas.
- **Quick capture**: a big, phone-friendly box at the top of the dashboard. Type or paste, hit Enter, done.
- **Email in**: each user gets a personal address (e.g. `ideas+abc123@yourdomain.com`). Anything emailed there lands in their inbox of ideas.
- **AI organizing** (runs on every new idea):
  - Short title + 1–2 sentence summary
  - Topic tags (reuses your existing tags when it fits)
  - Action items pulled out as checkable to-dos
  - Grouping into "themes" so related ideas cluster together
- **Dashboard**:
  - Card grid of ideas, with views: All, By theme, To-dos
  - Search across text, titles, summaries, tags
  - Sort by newest, oldest, theme, or most action items
  - Filter by tag, theme, source (typed vs email), and open to-dos
  - Click a card to see the original text, edit tags, check off to-dos, or delete
- **Landing page** at `/` explaining the app with a sign-in button; the dashboard lives at `/dashboard`.

## Look and feel
Warm "notebook" style: off-white paper background, deep ink text, one bold accent color, expressive serif headings with a clean sans for body. Cards feel like index cards; tags are colored chips; themes get their own soft color.

## Email-in: what's needed from you
Receiving email requires an inbound email service plus a domain you own. Plan: use **Postmark inbound** (free tier covers light use) — you'd create a Postmark account and point a subdomain's MX record to it; I'll give step-by-step instructions and build the receiving end. The quick-capture box works fully without this, so I'll build that first and add email-in once the account is ready.

## Build order
1. Turn on Lovable Cloud (database + logins), set up accounts.
2. Ideas, tags, themes, and to-dos storage, private per user.
3. Quick capture + AI organizing.
4. Dashboard: search, sort, filters, theme and to-do views, idea detail.
5. Email-in endpoint with per-user addresses (activate once Postmark is connected).

## Technical details
- Tables: `ideas` (user_id, raw_text, title, summary, source, theme_id, created_at, full-text search column), `tags` + `idea_tags`, `themes`, `action_items` (idea_id, text, done), `profiles` (inbound_token). RLS: owner-only on all; grants per table.
- AI: server function calling Lovable AI Gateway (`openai/gpt-6-astra`, Responses API, strict JSON schema output) with the user's existing tags/themes as context so it reuses them.
- Inbound email: public server route `/api/public/inbound-email` verifying a shared secret (basic auth on the Postmark webhook), resolving the user from the `+token` in the recipient address, inserting the idea, then running the same AI organizer.
- Search via Postgres full-text (`tsvector`) with client-side sort/filter on top.
