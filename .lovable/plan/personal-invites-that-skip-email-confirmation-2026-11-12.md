# Personal invites that skip email confirmation

Problem: confirmation emails come from a generic shared sender (no email domain is set up for this project), so they often land in spam or get capped. Fix: people who come in through an invite skip the confirmation email, and each invite only works for the one email address it was made for.

## What admins get
- In a team's **Members** panel: an **Invite by email** box. The admin types someone's email and gets a personal link (e.g. `/invite/k3x9...`) to copy and send by text, chat or their own email.
- A list of pending invites showing email, date, and status (waiting / accepted / expired), with **Copy link** and **Cancel**.
- Invites expire after 14 days and can be used once.
- The old shared team link is turned off. Any team link already sent will stop working; admins send personal invites instead.

## What the invited person sees
- Opening the link shows "You're invited to **Team name**", with the email it was made for already filled in and locked.
- **New to Common Ground:** they pick a password and they're in. No confirmation email.
- **Already has an account:** they sign in (password or Google) and join the team.
- **Signed in as a different email:** clear message: "This invite is for jane@city.gov. Sign out and use that account."
- Google sign-in counts only if the Google account email matches the invite.

## Everyone else
Regular sign-ups on the sign-in page still need the confirmation email. To make those emails more reliable, I'd suggest also sending them from civicplexus.org later (separate step).

## Technical details
- Migration: `team_invites` (id, team_id, email lowercased, token unique random, invited_by, created_at, expires_at, accepted_at, accepted_by). RLS: team admins select/insert/delete for their team; no anon access. Grants to authenticated.
- RPCs (security definer): `get_invite(_token)` granted to anon, returns team name + email + status only; `accept_invite(_token)` checks `auth.email()` equals invite email (case-insensitive), unused and unexpired, then inserts a member row and marks the invite accepted.
- Retire `join_team` (revoke execute / drop) and remove the shared link UI; `/join/$code` shows "This link is no longer used, ask your admin for a personal invite".
- Server function `signUpWithInvite({ token, password })` (public, no auth): verifies the token via admin client, creates the user with `auth.admin.createUser({ email: invite.email, password, email_confirm: true })`, refuses if the email already has an account. The browser then signs in with password and calls `accept_invite`. Email auto-confirm stays off project-wide.
- New public route `src/routes/invite.$token.tsx` (ssr false), with pending-token handoff through sessionStorage for the Google/sign-in path like today's invite key.
- Tests: accept fails for wrong email, expired, already used; succeeds for matching email.
- Update the user manual and `schema.sql` for the new invite flow.
