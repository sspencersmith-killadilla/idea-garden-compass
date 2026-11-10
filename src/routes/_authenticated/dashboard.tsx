import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { Search, LogOut, Mail, Loader2, Trash2, RotateCw, Send, Plus, Lock, Users, Settings, Copy, MessageSquare } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { captureIdea, organizeIdeaFn } from "@/lib/ideas.functions";
import { PENDING_INVITE_KEY } from "@/lib/invite";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const searchSchema = z.object({ space: z.string().optional() });

export const Route = createFileRoute("/_authenticated/dashboard")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Dashboard — Common Ground" },
      { name: "description", content: "Your notebook and team idea spaces, organized by AI." },
      { property: "og:title", content: "Dashboard — Common Ground" },
      { property: "og:description", content: "Your notebook and team idea spaces, organized by AI." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Dashboard,
});

type Team = { id: string; name: string; kind: string; invite_code: string; role: string };
type Theme = { id: string; name: string; hue: number };
type Item = { id: string; idea_id: string; text: string; done: boolean };
type Idea = {
  id: string; user_id: string; raw_text: string; title: string | null; summary: string | null; tags: string[];
  source: string; status: string; theme_id: string | null; created_at: string;
};
type Member = { user_id: string; role: string; name: string };

const KIND_LABEL: Record<string, string> = { department: "Department", project: "City project", team: "Team" };

function useMe() {
  return useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      const { data } = await supabase.auth.getUser();
      const id = data.user!.id;
      const [{ data: profile }, { data: mem }] = await Promise.all([
        supabase.from("profiles").select("inbound_token, display_name").eq("id", id).maybeSingle(),
        supabase.from("team_members").select("role, teams(id, name, kind, invite_code)").eq("user_id", id),
      ]);
      const teams: Team[] = (mem ?? [])
        .filter((m) => m.teams)
        .map((m) => ({ ...(m.teams as unknown as Omit<Team, "role">), role: m.role }))
        .sort((a, b) => a.name.localeCompare(b.name));
      return { id, token: profile?.inbound_token ?? null, name: profile?.display_name ?? "", teams };
    },
  });
}

function useBoard(space: string | null, me: string | undefined) {
  return useQuery({
    queryKey: ["board", space ?? "personal"],
    enabled: !!me,
    queryFn: async () => {
      const iq = supabase.from("ideas").select("id, user_id, raw_text, title, summary, tags, source, status, theme_id, created_at").order("created_at", { ascending: false });
      const tq = supabase.from("themes").select("id, name, hue").order("name");
      const [ideas, themes, members] = await Promise.all([
        space ? iq.eq("team_id", space) : iq.is("team_id", null).eq("user_id", me!),
        space ? tq.eq("team_id", space) : tq.is("team_id", null).eq("user_id", me!),
        space ? supabase.from("team_members").select("user_id, role").eq("team_id", space) : Promise.resolve({ data: [] as { user_id: string; role: string }[] }),
      ]);
      if (ideas.error) throw ideas.error;
      const ids = (ideas.data ?? []).map((i) => i.id);
      const items = ids.length ? await supabase.from("action_items").select("id, idea_id, text, done").in("idea_id", ids).order("created_at") : { data: [] };
      const memberRows = members.data ?? [];
      const { data: profs } = memberRows.length
        ? await supabase.from("profiles").select("id, display_name").in("id", memberRows.map((m) => m.user_id))
        : { data: [] as { id: string; display_name: string | null }[] };
      const nameOf = new Map((profs ?? []).map((p) => [p.id, p.display_name ?? "Someone"]));
      return {
        ideas: (ideas.data ?? []) as Idea[],
        themes: (themes.data ?? []) as Theme[],
        items: (items.data ?? []) as Item[],
        members: memberRows.map((m) => ({ user_id: m.user_id, role: m.role, name: nameOf.get(m.user_id) ?? "Someone" })) as Member[],
      };
    },
    refetchInterval: (q) => (q.state.data?.ideas.some((i) => i.status === "pending") ? 2500 : false),
  });
}

function Dashboard() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { space: spaceParam } = Route.useSearch();
  const meQ = useMe();
  const me = meQ.data;
  const team = me?.teams.find((t) => t.id === spaceParam) ?? null;
  const space = team?.id ?? null;
  const isAdmin = team?.role === "admin";
  const { data, isLoading } = useBoard(space, me?.id);
  const boardKey = ["board", space ?? "personal"];
  const capture = useServerFn(captureIdea);
  const organize = useServerFn(organizeIdeaFn);
  const [text, setText] = useState("");
  const [q, setQ] = useState("");
  const [view, setView] = useState<"all" | "themes" | "todos">("all");
  const [sort, setSort] = useState("newest");
  const [tag, setTag] = useState("any");
  const [theme, setTheme] = useState("any");
  const [person, setPerson] = useState("any");
  const [openTodosOnly, setOpenTodosOnly] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [showEmail, setShowEmail] = useState(false);
  const [showNewTeam, setShowNewTeam] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    const code = sessionStorage.getItem(PENDING_INVITE_KEY);
    if (!code) return;
    sessionStorage.removeItem(PENDING_INVITE_KEY);
    supabase.rpc("join_team", { _code: code }).then(({ data: tid, error }) => {
      if (error || !tid) return toast.error("That invite link isn't valid anymore.");
      qc.invalidateQueries({ queryKey: ["me"] });
      navigate({ to: "/dashboard", search: { space: tid } });
      toast.success("You joined the team");
    });
  }, [qc, navigate]);

  useEffect(() => { setTag("any"); setTheme("any"); setPerson("any"); setSelected(null); }, [space]);

  const goSpace = (id: string | null) => navigate({ to: "/dashboard", search: id ? { space: id } : {} });

  const runOrganize = async (id: string) => {
    try { await organize({ data: { id } }); } catch (e) { toast.error((e as Error).message); }
    qc.invalidateQueries({ queryKey: boardKey });
  };

  const add = useMutation({
    mutationFn: (t: string) => capture({ data: { text: t, teamId: space } }),
    onSuccess: ({ id }) => { setText(""); qc.invalidateQueries({ queryKey: boardKey }); runOrganize(id); },
    onError: (e) => toast.error((e as Error).message),
  });

  const themesById = useMemo(() => new Map((data?.themes ?? []).map((t) => [t.id, t])), [data]);
  const nameById = useMemo(() => new Map((data?.members ?? []).map((m) => [m.user_id, m.name])), [data]);
  const itemsByIdea = useMemo(() => {
    const m = new Map<string, Item[]>();
    data?.items.forEach((i) => m.set(i.idea_id, [...(m.get(i.idea_id) ?? []), i]));
    return m;
  }, [data]);
  const allTags = useMemo(() => [...new Set((data?.ideas ?? []).flatMap((i) => i.tags))].sort(), [data]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = (data?.ideas ?? []).filter((i) => {
      if (tag !== "any" && !i.tags.includes(tag)) return false;
      if (theme !== "any" && i.theme_id !== theme) return false;
      if (person !== "any" && i.user_id !== person) return false;
      if (openTodosOnly && !(itemsByIdea.get(i.id) ?? []).some((x) => !x.done)) return false;
      if (!needle) return true;
      const hay = [i.title, i.summary, i.raw_text, i.tags.join(" "), themesById.get(i.theme_id ?? "")?.name, nameById.get(i.user_id)].join(" ").toLowerCase();
      return needle.split(/\s+/).every((w) => hay.includes(w));
    });
    return [...list].sort((a, b) => {
      if (sort === "oldest") return a.created_at.localeCompare(b.created_at);
      if (sort === "theme") return (themesById.get(a.theme_id ?? "")?.name ?? "~").localeCompare(themesById.get(b.theme_id ?? "")?.name ?? "~");
      if (sort === "todos") return (itemsByIdea.get(b.id)?.length ?? 0) - (itemsByIdea.get(a.id)?.length ?? 0);
      return b.created_at.localeCompare(a.created_at);
    });
  }, [data, q, tag, theme, person, openTodosOnly, sort, itemsByIdea, themesById, nameById]);

  const toggleItem = async (item: Item) => {
    qc.setQueryData(boardKey, (old: typeof data) => old && { ...old, items: old.items.map((x) => (x.id === item.id ? { ...x, done: !x.done } : x)) });
    await supabase.from("action_items").update({ done: !item.done }).eq("id", item.id);
  };

  const signOut = async () => {
    await qc.cancelQueries(); qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  const current = data?.ideas.find((i) => i.id === selected) ?? null;
  const author = (uid: string) => (space ? (uid === me?.id ? "You" : nameById.get(uid) ?? "Former member") : null);
  const canEdit = (i: Idea) => i.user_id === me?.id || isAdmin;

  const spaceList = (
    <nav className="space-y-1">
      <SpaceButton active={!space} onClick={() => goSpace(null)} icon={<Lock className="h-4 w-4" />} label="My notebook" />
      <p className="px-3 pb-1 pt-5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Team spaces</p>
      {me?.teams.map((t) => (
        <SpaceButton key={t.id} active={space === t.id} onClick={() => goSpace(t.id)} icon={<Users className="h-4 w-4" />} label={t.name} hint={KIND_LABEL[t.kind]} />
      ))}
      <button onClick={() => setShowNewTeam(true)} className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-accent-foreground hover:bg-accent">
        <Plus className="h-4 w-4" /> New team space
      </button>
    </nav>
  );

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b bg-card/90 backdrop-blur">
        <div className="flex items-center justify-between px-4 py-3 md:px-6">
          <Logo />
          <div className="flex gap-1">
            {!space && <Button variant="ghost" size="sm" onClick={() => setShowEmail(true)}><Mail className="h-4 w-4" /><span className="hidden sm:inline">Email in</span></Button>}
            <Button variant="ghost" size="sm" onClick={signOut}><LogOut className="h-4 w-4" /><span className="hidden sm:inline">Sign out</span></Button>
          </div>
        </div>
      </header>

      <div className="flex">
        <aside className="hidden w-64 shrink-0 border-r bg-sidebar p-4 md:block md:min-h-[calc(100vh-57px)]">{spaceList}</aside>

        <main className="min-w-0 flex-1 px-4 pb-24 md:px-8">
          <div className="pt-4 md:hidden">
            <Select value={space ?? "personal"} onValueChange={(v) => (v === "__new" ? setShowNewTeam(true) : goSpace(v === "personal" ? null : v))}>
              <SelectTrigger className="bg-card"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="personal">My notebook</SelectItem>
                {me?.teams.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                <SelectItem value="__new">+ New team space</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="mt-6 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-brand-teal">{team ? KIND_LABEL[team.kind] : "Private"}</p>
              <h1 className="font-display text-3xl font-extrabold tracking-tight text-primary">{team?.name ?? "My notebook"}</h1>
              <p className="text-sm text-muted-foreground">{team ? `${data?.members.length ?? "…"} members · shared with everyone in this space` : "Only you can see ideas here."}</p>
            </div>
            {team && <Button variant="outline" size="sm" onClick={() => setShowSettings(true)}><Settings className="h-4 w-4" /> {isAdmin ? "Members & invite" : "Members"}</Button>}
          </div>

          <form className="mt-5 rounded-xl border bg-card p-4 shadow-[var(--shadow-card)] md:p-5" onSubmit={(e) => { e.preventDefault(); if (text.trim()) add.mutate(text); }}>
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); if (text.trim()) add.mutate(text); } }}
              placeholder={team ? `Share an idea with ${team.name}…` : "What's on your mind? Just dump it here…"}
              className="min-h-20 resize-none border-0 bg-transparent text-lg shadow-none focus-visible:ring-0"
            />
            <div className="flex items-center justify-between pt-2">
              <span className="text-xs text-muted-foreground">Enter to save · Shift+Enter for a new line</span>
              <Button disabled={add.isPending || !text.trim()}>{add.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Capture</Button>
            </div>
          </form>

          <div className="mt-6 flex flex-col gap-3 xl:flex-row xl:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search ideas…" className="bg-card pl-9" />
            </div>
            <div className="flex flex-wrap gap-2">
              <Filter value={sort} onChange={setSort} options={[["newest", "Newest"], ["oldest", "Oldest"], ["theme", "By theme"], ["todos", "Most to-dos"]]} />
              <Filter value={theme} onChange={setTheme} options={[["any", "All themes"], ...(data?.themes ?? []).map((t) => [t.id, t.name] as [string, string])]} />
              <Filter value={tag} onChange={setTag} options={[["any", "All tags"], ...allTags.map((t) => [t, `#${t}`] as [string, string])]} />
              {team && <Filter value={person} onChange={setPerson} options={[["any", "Everyone"], ...(data?.members ?? []).map((m) => [m.user_id, m.user_id === me?.id ? "You" : m.name] as [string, string])]} />}
              <label className="flex items-center gap-2 rounded-md border bg-card px-3 text-sm">
                <Checkbox checked={openTodosOnly} onCheckedChange={(v) => setOpenTodosOnly(!!v)} /> Open to-dos
              </label>
            </div>
          </div>

          <Tabs value={view} onValueChange={(v) => setView(v as typeof view)} className="mt-5">
            <TabsList><TabsTrigger value="all">All ideas</TabsTrigger><TabsTrigger value="themes">By theme</TabsTrigger><TabsTrigger value="todos">To-dos</TabsTrigger></TabsList>
          </Tabs>

          {isLoading || meQ.isLoading ? (
            <div className="py-20 text-center text-muted-foreground"><Loader2 className="mx-auto h-6 w-6 animate-spin" /></div>
          ) : !data?.ideas.length ? (
            <div className="py-20 text-center">
              <p className="font-display text-2xl font-bold text-primary">Nothing here yet.</p>
              <p className="mt-2 text-muted-foreground">{team ? "Be the first to share an idea with your team." : "Type your first idea above — however rough."}</p>
            </div>
          ) : !filtered.length ? (
            <p className="py-20 text-center text-muted-foreground">No ideas match those filters.</p>
          ) : view === "all" ? (
            <Grid ideas={filtered} themesById={themesById} itemsByIdea={itemsByIdea} author={author} onOpen={setSelected} />
          ) : view === "themes" ? (
            <div className="mt-6 space-y-10">
              {[...data.themes, { id: "", name: "Unsorted", hue: 230 }].map((t) => {
                const list = filtered.filter((i) => (i.theme_id ?? "") === t.id);
                if (!list.length) return null;
                return (
                  <section key={t.id || "none"}>
                    <h2 className="flex items-center gap-3 font-display text-xl font-bold text-primary">
                      <span style={{ ["--hue" as string]: t.hue }} className="theme-chip h-3 w-3 rounded-full" />{t.name}
                      <span className="text-sm font-normal text-muted-foreground">{list.length}</span>
                    </h2>
                    <Grid ideas={list} themesById={themesById} itemsByIdea={itemsByIdea} author={author} onOpen={setSelected} />
                  </section>
                );
              })}
            </div>
          ) : (
            <div className="mt-6 space-y-3">
              {filtered.filter((i) => itemsByIdea.get(i.id)?.length).map((i) => (
                <div key={i.id} className="rounded-xl border bg-card p-4">
                  <button onClick={() => setSelected(i.id)} className="font-display font-bold text-primary hover:text-brand-teal">{i.title ?? "Untitled"}</button>
                  {author(i.user_id) && <span className="ml-2 text-xs text-muted-foreground">by {author(i.user_id)}</span>}
                  <ul className="mt-2 space-y-1.5">
                    {itemsByIdea.get(i.id)!.map((it) => (
                      <li key={it.id} className="flex items-center gap-2 text-sm">
                        <Checkbox checked={it.done} onCheckedChange={() => toggleItem(it)} />
                        <span className={it.done ? "text-muted-foreground line-through" : ""}>{it.text}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
              {!filtered.some((i) => itemsByIdea.get(i.id)?.length) && <p className="py-16 text-center text-muted-foreground">No to-dos found yet.</p>}
            </div>
          )}
        </main>
      </div>

      <Sheet open={!!current} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          {current && (
            <IdeaDetail
              idea={current}
              theme={themesById.get(current.theme_id ?? "")}
              items={itemsByIdea.get(current.id) ?? []}
              author={author(current.user_id)}
              canEdit={canEdit(current)}
              isTeam={!!space}
              meId={me?.id ?? ""}
              onToggle={toggleItem}
              onReorganize={() => runOrganize(current.id)}
              onChanged={() => qc.invalidateQueries({ queryKey: boardKey })}
              onDeleted={() => { setSelected(null); qc.invalidateQueries({ queryKey: boardKey }); }}
            />
          )}
        </SheetContent>
      </Sheet>

      <Sheet open={showEmail} onOpenChange={setShowEmail}>
        <SheetContent>
          <SheetHeader><SheetTitle className="font-display text-2xl text-primary">Email ideas in</SheetTitle></SheetHeader>
          <div className="space-y-4 px-4 text-sm">
            <p>Soon you'll be able to email any thought to your personal address and it'll land in your notebook, organized.</p>
            <p className="rounded-lg border bg-muted p-3 font-mono">ideas+{me?.token ?? "…"}@your-domain</p>
            <p className="text-muted-foreground">This turns on once the inbox email service is connected.</p>
          </div>
        </SheetContent>
      </Sheet>

      <NewTeamDialog open={showNewTeam} onOpenChange={setShowNewTeam} onCreated={(id) => { qc.invalidateQueries({ queryKey: ["me"] }); goSpace(id); }} />

      {team && (
        <TeamSettings
          open={showSettings}
          onOpenChange={setShowSettings}
          team={team}
          members={data?.members ?? []}
          meId={me?.id ?? ""}
          onChanged={() => { qc.invalidateQueries({ queryKey: ["me"] }); qc.invalidateQueries({ queryKey: boardKey }); }}
          onLeft={() => { setShowSettings(false); qc.invalidateQueries({ queryKey: ["me"] }); goSpace(null); }}
        />
      )}
    </div>
  );
}

function SpaceButton({ active, onClick, icon, label, hint }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string; hint?: string | undefined }) {
  return (
    <button onClick={onClick} className={`flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm transition ${active ? "bg-primary text-primary-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent"}`}>
      {icon}
      <span className="min-w-0 flex-1 truncate font-medium">{label}</span>
      {hint && <span className={`text-[10px] uppercase tracking-wide ${active ? "opacity-80" : "text-muted-foreground"}`}>{hint === "City project" ? "Project" : hint === "Department" ? "Dept" : ""}</span>}
    </button>
  );
}

function Filter({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-auto min-w-32 bg-card"><SelectValue /></SelectTrigger>
      <SelectContent>{options.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
    </Select>
  );
}

function Grid({ ideas, themesById, itemsByIdea, author, onOpen }: { ideas: Idea[]; themesById: Map<string, Theme>; itemsByIdea: Map<string, Item[]>; author: (uid: string) => string | null; onOpen: (id: string) => void }) {
  return (
    <div className="mt-5 columns-1 gap-4 sm:columns-2 2xl:columns-3">
      {ideas.map((i) => {
        const t = themesById.get(i.theme_id ?? "");
        const items = itemsByIdea.get(i.id) ?? [];
        const open = items.filter((x) => !x.done).length;
        const by = author(i.user_id);
        return (
          <button
            key={i.id}
            onClick={() => onOpen(i.id)}
            style={{ ["--hue" as string]: t?.hue ?? 230 }}
            className="theme-edge animate-rise mb-4 block w-full break-inside-avoid rounded-lg border bg-card p-5 text-left shadow-[var(--shadow-card)] transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-lift)]"
          >
            {i.status === "pending" ? (
              <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Organizing…</p>
            ) : (
              <div className="flex items-center justify-between gap-2">
                {t && <span className="theme-chip rounded-full px-2.5 py-0.5 text-xs font-semibold">{t.name}</span>}
                <span className="ml-auto text-xs text-muted-foreground">{i.source === "email" && "✉ "}{new Date(i.created_at).toLocaleDateString()}</span>
              </div>
            )}
            <h3 className="mt-3 font-display text-lg font-bold leading-snug text-primary">{i.title ?? i.raw_text.slice(0, 80)}</h3>
            {i.summary && <p className="mt-1.5 text-sm text-muted-foreground">{i.summary}</p>}
            {i.status === "failed" && <p className="mt-2 text-xs text-destructive">Couldn't organize — open to retry.</p>}
            <div className="mt-3 flex flex-wrap gap-1.5">
              {i.tags.map((tg) => <span key={tg} className="tag-chip rounded px-2 py-0.5 text-xs">#{tg}</span>)}
            </div>
            {(items.length > 0 || by) && (
              <div className="mt-3 flex items-center justify-between text-xs">
                {items.length > 0 ? <span className="font-medium text-brand-teal">{open} of {items.length} to-dos open</span> : <span />}
                {by && <span className="text-muted-foreground">{by}</span>}
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}

type Comment = { id: string; user_id: string; body: string; created_at: string; name: string };

function IdeaDetail({ idea, theme, items, author, canEdit, isTeam, meId, onToggle, onReorganize, onChanged, onDeleted }: {
  idea: Idea; theme: Theme | undefined; items: Item[]; author: string | null; canEdit: boolean; isTeam: boolean; meId: string;
  onToggle: (i: Item) => void; onReorganize: () => void; onChanged: () => void; onDeleted: () => void;
}) {
  const qc = useQueryClient();
  const [tags, setTags] = useState(idea.tags.join(", "));
  const [comment, setComment] = useState("");
  const comments = useQuery({
    queryKey: ["comments", idea.id],
    enabled: isTeam,
    queryFn: async () => {
      const { data } = await supabase.from("idea_comments").select("id, user_id, body, created_at").eq("idea_id", idea.id).order("created_at");
      const ids = [...new Set((data ?? []).map((c) => c.user_id))];
      const { data: profs } = ids.length ? await supabase.from("profiles").select("id, display_name").in("id", ids) : { data: [] as { id: string; display_name: string | null }[] };
      const names = new Map((profs ?? []).map((p) => [p.id, p.display_name ?? "Someone"]));
      return (data ?? []).map((c) => ({ ...c, name: c.user_id === meId ? "You" : names.get(c.user_id) ?? "Former member" })) as Comment[];
    },
  });
  const saveTags = async () => {
    const next = [...new Set(tags.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean))];
    const { error } = await supabase.from("ideas").update({ tags: next }).eq("id", idea.id);
    if (error) return toast.error("Couldn't save tags");
    onChanged(); toast.success("Tags saved");
  };
  const del = async () => {
    const { error } = await supabase.from("ideas").delete().eq("id", idea.id);
    if (error) return toast.error("Couldn't delete");
    onDeleted(); toast.success("Idea deleted");
  };
  const postComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!comment.trim()) return;
    const { error } = await supabase.from("idea_comments").insert({ idea_id: idea.id, user_id: meId, body: comment.trim() });
    if (error) return toast.error("Couldn't post comment");
    setComment("");
    qc.invalidateQueries({ queryKey: ["comments", idea.id] });
  };
  return (
    <div className="space-y-6 px-4 pb-8">
      <SheetHeader className="px-0">
        {theme && <span style={{ ["--hue" as string]: theme.hue }} className="theme-chip w-fit rounded-full px-2.5 py-0.5 text-xs font-semibold">{theme.name}</span>}
        <SheetTitle className="font-display text-2xl font-bold text-primary">{idea.title ?? "Organizing…"}</SheetTitle>
        {author && <p className="text-xs text-muted-foreground">Shared by {author} · {new Date(idea.created_at).toLocaleString()}</p>}
        {idea.summary && <p className="text-sm text-muted-foreground">{idea.summary}</p>}
      </SheetHeader>
      {items.length > 0 && (
        <div>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">To-dos</h4>
          <ul className="space-y-2">{items.map((it) => (
            <li key={it.id} className="flex items-center gap-2 text-sm"><Checkbox checked={it.done} onCheckedChange={() => onToggle(it)} /><span className={it.done ? "text-muted-foreground line-through" : ""}>{it.text}</span></li>
          ))}</ul>
        </div>
      )}
      {canEdit ? (
        <div>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Tags</h4>
          <div className="flex gap-2"><Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="comma, separated" /><Button variant="secondary" onClick={saveTags}>Save</Button></div>
        </div>
      ) : null}
      <div>
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Original</h4>
        <p className="whitespace-pre-wrap rounded-lg border bg-muted p-4 text-sm leading-relaxed">{idea.raw_text}</p>
      </div>
      {isTeam && (
        <div>
          <h4 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground"><MessageSquare className="h-3.5 w-3.5" /> Discussion</h4>
          <div className="space-y-3">
            {comments.data?.map((c) => (
              <div key={c.id} className="rounded-lg bg-secondary p-3 text-sm">
                <p className="text-xs font-semibold text-secondary-foreground">{c.name} <span className="font-normal text-muted-foreground">· {new Date(c.created_at).toLocaleDateString()}</span></p>
                <p className="mt-1 whitespace-pre-wrap">{c.body}</p>
              </div>
            ))}
            {comments.data?.length === 0 && <p className="text-sm text-muted-foreground">No comments yet. Build on this idea.</p>}
            <form onSubmit={postComment} className="flex gap-2">
              <Input value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Add a comment…" maxLength={4000} />
              <Button disabled={!comment.trim()}>Post</Button>
            </form>
          </div>
        </div>
      )}
      {canEdit && (
        <div className="flex gap-2">
          <Button variant="outline" onClick={onReorganize}><RotateCw className="h-4 w-4" /> Re-organize</Button>
          <Button variant="ghost" className="text-destructive" onClick={del}><Trash2 className="h-4 w-4" /> Delete</Button>
        </div>
      )}
    </div>
  );
}

function NewTeamDialog({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (o: boolean) => void; onCreated: (id: string) => void }) {
  const [name, setName] = useState("");
  const [kind, setKind] = useState("department");
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { data, error } = await supabase.rpc("create_team", { _name: name, _kind: kind });
    setBusy(false);
    if (error || !data) return toast.error("Couldn't create the space");
    setName(""); onOpenChange(false); onCreated(data);
    toast.success("Space created — invite your team from Members & invite");
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle className="font-display text-primary">New team space</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <Select value={kind} onValueChange={setKind}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="department">Department</SelectItem>
              <SelectItem value="project">City project</SelectItem>
              <SelectItem value="team">Team / working group</SelectItem>
            </SelectContent>
          </Select>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={kind === "department" ? "e.g. Parks & Recreation" : kind === "project" ? "e.g. Main Street Revitalization" : "e.g. Budget Working Group"} maxLength={80} required />
          <Button className="w-full" disabled={busy || !name.trim()}>Create space</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function TeamSettings({ open, onOpenChange, team, members, meId, onChanged, onLeft }: {
  open: boolean; onOpenChange: (o: boolean) => void; team: Team; members: Member[]; meId: string; onChanged: () => void; onLeft: () => void;
}) {
  const isAdmin = team.role === "admin";
  const link = typeof window !== "undefined" ? `${window.location.origin}/join/${team.invite_code}` : "";
  const admins = members.filter((m) => m.role === "admin").length;
  const copy = async () => { await navigator.clipboard.writeText(link); toast.success("Invite link copied"); };
  const resetLink = async () => {
    const code = Array.from(crypto.getRandomValues(new Uint8Array(6))).map((b) => b.toString(16).padStart(2, "0")).join("");
    const { error } = await supabase.from("teams").update({ invite_code: code }).eq("id", team.id);
    if (error) return toast.error("Couldn't reset link");
    onChanged(); toast.success("Old link no longer works");
  };
  const setRole = async (uid: string, role: string) => {
    const { error } = await supabase.from("team_members").update({ role }).eq("team_id", team.id).eq("user_id", uid);
    if (error) return toast.error("Couldn't change role");
    onChanged();
  };
  const remove = async (uid: string) => {
    const { error } = await supabase.from("team_members").delete().eq("team_id", team.id).eq("user_id", uid);
    if (error) return toast.error("Couldn't remove");
    if (uid === meId) onLeft(); else onChanged();
  };
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto">
        <SheetHeader><SheetTitle className="font-display text-xl text-primary">{team.name}</SheetTitle></SheetHeader>
        <div className="space-y-6 px-4 pb-8">
          {isAdmin && (
            <div>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Invite link</h4>
              <p className="mb-2 text-sm text-muted-foreground">Anyone with this link can join as a member.</p>
              <div className="flex gap-2"><Input readOnly value={link} className="font-mono text-xs" /><Button variant="secondary" onClick={copy}><Copy className="h-4 w-4" /></Button></div>
              <button onClick={resetLink} className="mt-2 text-xs text-muted-foreground underline">Reset link</button>
            </div>
          )}
          <div>
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Members · {members.length}</h4>
            <ul className="divide-y rounded-lg border">
              {members.map((m) => (
                <li key={m.user_id} className="flex items-center gap-2 p-3 text-sm">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-brand text-xs font-bold text-primary-foreground">{m.name.slice(0, 1).toUpperCase()}</span>
                  <span className="min-w-0 flex-1 truncate">{m.user_id === meId ? `${m.name} (you)` : m.name}</span>
                  {isAdmin && m.user_id !== meId ? (
                    <>
                      <Select value={m.role} onValueChange={(v) => setRole(m.user_id, v)}>
                        <SelectTrigger className="h-8 w-24"><SelectValue /></SelectTrigger>
                        <SelectContent><SelectItem value="admin">Admin</SelectItem><SelectItem value="member">Member</SelectItem></SelectContent>
                      </Select>
                      <Button size="icon" variant="ghost" onClick={() => remove(m.user_id)} aria-label="Remove"><Trash2 className="h-4 w-4" /></Button>
                    </>
                  ) : (
                    <span className="text-xs capitalize text-muted-foreground">{m.role}</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
          {!(isAdmin && admins <= 1) ? (
            <Button variant="outline" className="text-destructive" onClick={() => remove(meId)}>Leave this space</Button>
          ) : (
            <p className="text-xs text-muted-foreground">You're the only admin. Make someone else an admin before leaving.</p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
