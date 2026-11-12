import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { signUpWithInvite } from "@/lib/invites.functions";
import { PENDING_INVITE_KEY } from "@/lib/invite";
import { Logo } from "@/components/Logo";
import { Skyline } from "@/components/City";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/invite/$token")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "You're invited — Common Ground" },
      { name: "description", content: "Accept your personal invite to a Common Ground team space." },
      { property: "og:title", content: "You're invited to Common Ground" },
      { property: "og:description", content: "Accept your personal invite to a shared idea space." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: InvitePage,
});

type Inv = { team_name: string; email: string; status: string };

function InvitePage() {
  const { token } = Route.useParams();
  const navigate = useNavigate();
  const signUp = useServerFn(signUpWithInvite);
  const [inv, setInv] = useState<Inv | null | undefined>(undefined);
  const [userEmail, setUserEmail] = useState<string | null | undefined>(undefined);
  const [mode, setMode] = useState<"new" | "signin">("new");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function accept() {
    const { data: tid, error } = await supabase.rpc("accept_invite", { _token: token });
    if (error || !tid) { setErr(error?.message.includes("wrong email") ? "wrong" : "This invite can't be used anymore. Ask your admin for a new one."); return; }
    sessionStorage.removeItem(PENDING_INVITE_KEY);
    toast.success(`Welcome to ${inv?.team_name ?? "the team"}`);
    navigate({ to: "/dashboard", search: { space: tid as string }, replace: true });
  }

  useEffect(() => {
    supabase.rpc("get_invite", { _token: token }).then(({ data }) => setInv((data as Inv[] | null)?.[0] ?? null));
    supabase.auth.getUser().then(({ data }) => setUserEmail(data.user?.email?.toLowerCase() ?? null));
  }, [token]);

  useEffect(() => {
    if (inv && inv.status === "pending" && userEmail && userEmail === inv.email) void accept();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inv, userEmail]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!inv) return;
    setBusy(true); setErr(null);
    if (mode === "new") {
      const r = await signUp({ data: { token, password, name: name || undefined } });
      if (!r.ok) { setBusy(false); setErr(r.error); if ("exists" in r && r.exists) setMode("signin"); return; }
    }
    const { data, error } = await supabase.auth.signInWithPassword({ email: inv.email, password });
    setBusy(false);
    if (error || !data.user) { setErr(error?.message ?? "Sign-in failed"); return; }
    setUserEmail(data.user.email?.toLowerCase() ?? null);
  }

  async function google() {
    sessionStorage.setItem(PENDING_INVITE_KEY, token);
    const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin + "/invite/" + token, extraParams: { login_hint: inv?.email ?? "" } });
    if (r.error) { toast.error(r.error.message ?? "Sign-in failed"); return; }
    if (!r.redirected) { const { data } = await supabase.auth.getUser(); setUserEmail(data.user?.email?.toLowerCase() ?? null); }
  }

  async function signOut() { await supabase.auth.signOut(); setUserEmail(null); setErr(null); }

  let body: React.ReactNode;
  if (inv === undefined || userEmail === undefined) body = <p className="mt-6 text-sm text-muted-foreground">Checking your invite…</p>;
  else if (!inv) body = <p className="mt-6 text-sm">This invite link isn't valid. Ask your team admin for a new one.</p>;
  else if (inv.status !== "pending") body = <p className="mt-6 text-sm">This invite has {inv.status === "accepted" ? "already been used" : "expired"}. <Link to="/auth" className="underline">Sign in</Link> or ask your admin for a new one.</p>;
  else if (userEmail && (userEmail !== inv.email || err === "wrong")) body = (
    <div className="mt-6 space-y-3 text-sm">
      <p>This invite is for <b>{inv.email}</b>, but you're signed in as <b>{userEmail}</b>.</p>
      <Button variant="outline" className="w-full" onClick={signOut}>Sign out and use {inv.email}</Button>
    </div>
  );
  else if (userEmail) body = <p className="mt-6 text-sm text-muted-foreground">{err ?? "Joining your team…"}</p>;
  else body = (
    <>
      <h1 className="mt-6 font-display text-xl font-bold text-primary">You're invited to {inv.team_name}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{mode === "new" ? "Pick a password and you're in. No confirmation email needed." : "Sign in to join the team."}</p>
      <button type="button" onClick={google} className="mt-5 flex h-10 w-full items-center justify-center gap-2.5 rounded-md border border-[#747775] bg-[#FFFFFF] text-sm font-medium text-[#1F1F1F]">
        <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"/><path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z"/><path fill="#FBBC05" d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z"/><path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z"/></svg>
        Continue with Google
      </button>
      <div className="my-4 flex items-center gap-3 text-xs text-muted-foreground"><div className="h-px flex-1 bg-border" />or<div className="h-px flex-1 bg-border" /></div>
      <form onSubmit={submit} className="space-y-3">
        <div><Label htmlFor="email">Email</Label><Input id="email" value={inv.email} readOnly disabled /></div>
        {mode === "new" && <div><Label htmlFor="name">Your name</Label><Input id="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} /></div>}
        <div><Label htmlFor="pw">Password</Label><Input id="pw" type="password" required minLength={mode === "new" ? 8 : 6} value={password} onChange={(e) => setPassword(e.target.value)} /></div>
        {err && err !== "wrong" && <p className="text-sm text-destructive">{err}</p>}
        <Button className="w-full" disabled={busy}>{mode === "new" ? "Create account & join" : "Sign in & join"}</Button>
      </form>
      <button className="mt-4 text-sm text-muted-foreground underline" onClick={() => { setMode(mode === "new" ? "signin" : "new"); setErr(null); }}>
        {mode === "new" ? "Already have an account? Sign in" : "New here? Create an account"}
      </button>
    </>
  );

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4">
      <Skyline className="absolute inset-x-0 bottom-0 h-28" />
      <div className="w-full max-w-sm rounded-2xl border bg-card p-8 shadow-[var(--shadow-lift)]">
        <Link to="/"><Logo /></Link>
        {body}
      </div>
    </div>
  );
}
