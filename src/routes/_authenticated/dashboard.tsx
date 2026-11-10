import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Search, LogOut, Mail, Loader2, Trash2, RotateCw, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { captureIdea, organizeIdeaFn } from "@/lib/ideas.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Your ideas — Idea Inbox" },
      { name: "description", content: "All your captured ideas, organized by AI." },
      { property: "og:title", content: "Your ideas — Idea Inbox" },
      { property: "og:description", content: "All your captured ideas, organized by AI." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Dashboard,
});

type Theme = { id: string; name: string; hue: number };
type Item = { id: string; idea_id: string; text: string; done: boolean };
type Idea = {
  id: string; raw_text: string; title: string | null; summary: string | null; tags: string[];
  source: string; status: string; theme_id: string | null; created_at: string;
};

function useData() {
  return useQuery({
    queryKey: ["board"],
    queryFn: async () => {
      const [ideas, themes, items, profile] = await Promise.all([
        supabase.from("ideas").select("id, raw_text, title, summary, tags, source, status, theme_id, created_at").order("created_at", { ascending: false }),
        supabase.from("themes").select("id, name, hue").order("name"),
        supabase.from("action_items").select("id, idea_id, text, done").order("created_at"),
        supabase.from("profiles").select("inbound_token").maybeSingle(),
      ]);
      if (ideas.error) throw ideas.error;
      return {
        ideas: (ideas.data ?? []) as Idea[],
        themes: (themes.data ?? []) as Theme[],
        items: (items.data ?? []) as Item[],
        token: profile.data?.inbound_token ?? null,
      };
    },
    refetchInterval: (q) => (q.state.data?.ideas.some((i) => i.status === "pending") ? 2500 : false),
  });
}

function Dashboard() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data, isLoading } = useData();
  const capture = useServerFn(captureIdea);
  const organize = useServerFn(organizeIdeaFn);
  const [text, setText] = useState("");
  const [q, setQ] = useState("");
  const [view, setView] = useState<"all" | "themes" | "todos">("all");
  const [sort, setSort] = useState("newest");
  const [tag, setTag] = useState("any");
  const [theme, setTheme] = useState("any");
  const [source, setSource] = useState("any");
  const [openTodosOnly, setOpenTodosOnly] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [showEmail, setShowEmail] = useState(false);

  const runOrganize = async (id: string) => {
    try { await organize({ data: { id } }); } catch (e) { toast.error((e as Error).message); }
    qc.invalidateQueries({ queryKey: ["board"] });
  };

  const add = useMutation({
    mutationFn: (t: string) => capture({ data: { text: t } }),
    onSuccess: ({ id }) => {
      setText("");
      qc.invalidateQueries({ queryKey: ["board"] });
      runOrganize(id);
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const themesById = useMemo(() => new Map((data?.themes ?? []).map((t) => [t.id, t])), [data]);
  const itemsByIdea = useMemo(() => {
    const m = new Map<string, Item[]>();
    data?.items.forEach((i) => m.set(i.idea_id, [...(m.get(i.idea_id) ?? []), i]));
    return m;
  }, [data]);
  const allTags = useMemo(() => [...new Set((data?.ideas ?? []).flatMap((i) => i.tags))].sort(), [data]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let list = (data?.ideas ?? []).filter((i) => {
      if (tag !== "any" && !i.tags.includes(tag)) return false;
      if (theme !== "any" && i.theme_id !== theme) return false;
      if (source !== "any" && i.source !== source) return false;
      if (openTodosOnly && !(itemsByIdea.get(i.id) ?? []).some((x) => !x.done)) return false;
      if (!needle) return true;
      const hay = [i.title, i.summary, i.raw_text, i.tags.join(" "), themesById.get(i.theme_id ?? "")?.name].join(" ").toLowerCase();
      return needle.split(/\s+/).every((w) => hay.includes(w));
    });
    list = [...list].sort((a, b) => {
      if (sort === "oldest") return a.created_at.localeCompare(b.created_at);
      if (sort === "theme") return (themesById.get(a.theme_id ?? "")?.name ?? "~").localeCompare(themesById.get(b.theme_id ?? "")?.name ?? "~");
      if (sort === "todos") return (itemsByIdea.get(b.id)?.length ?? 0) - (itemsByIdea.get(a.id)?.length ?? 0);
      return b.created_at.localeCompare(a.created_at);
    });
    return list;
  }, [data, q, tag, theme, source, openTodosOnly, sort, itemsByIdea, themesById]);

  const toggleItem = async (item: Item) => {
    qc.setQueryData(["board"], (old: typeof data) => old && { ...old, items: old.items.map((x) => (x.id === item.id ? { ...x, done: !x.done } : x)) });
    await supabase.from("action_items").update({ done: !item.done }).eq("id", item.id);
  };

  const signOut = async () => {
    await qc.cancelQueries(); qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  const current = data?.ideas.find((i) => i.id === selected) ?? null;

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b bg-background/85 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 md:px-8">
          <span className="font-display text-xl font-extrabold">Idea Inbox<span className="text-primary">.</span></span>
          <div className="flex gap-1">
            <Button variant="ghost" size="sm" onClick={() => setShowEmail(true)}><Mail className="h-4 w-4" /> Email in</Button>
            <Button variant="ghost" size="sm" onClick={signOut}><LogOut className="h-4 w-4" /> Sign out</Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 pb-24 md:px-8">
        <form
          className="paper-lines mt-6 rounded-2xl border bg-card p-4 shadow-[var(--shadow-card)] md:p-6"
          onSubmit={(e) => { e.preventDefault(); if (text.trim()) add.mutate(text); }}
        >
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); if (text.trim()) add.mutate(text); } }}
            placeholder="What's on your mind? Just dump it here…"
            className="min-h-24 resize-none border-0 bg-transparent font-display text-xl shadow-none focus-visible:ring-0 md:text-2xl"
          />
          <div className="flex items-center justify-between pt-2">
            <span className="text-xs text-muted-foreground">Enter to save · Shift+Enter for a new line</span>
            <Button disabled={add.isPending || !text.trim()}>
              {add.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Capture
            </Button>
          </div>
        </form>

        <div className="mt-8 flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search your thinking…" className="bg-card pl-9" />
          </div>
          <div className="flex flex-wrap gap-2">
            <Filter value={sort} onChange={setSort} options={[["newest", "Newest"], ["oldest", "Oldest"], ["theme", "By theme"], ["todos", "Most to-dos"]]} />
            <Filter value={theme} onChange={setTheme} options={[["any", "All themes"], ...(data?.themes ?? []).map((t) => [t.id, t.name] as [string, string])]} />
            <Filter value={tag} onChange={setTag} options={[["any", "All tags"], ...allTags.map((t) => [t, `#${t}`] as [string, string])]} />
            <Filter value={source} onChange={setSource} options={[["any", "Any source"], ["web", "Typed"], ["email", "Email"]]} />
            <label className="flex items-center gap-2 rounded-md border bg-card px-3 text-sm">
              <Checkbox checked={openTodosOnly} onCheckedChange={(v) => setOpenTodosOnly(!!v)} /> Open to-dos
            </label>
          </div>
        </div>

        <Tabs value={view} onValueChange={(v) => setView(v as typeof view)} className="mt-6">
          <TabsList><TabsTrigger value="all">All ideas</TabsTrigger><TabsTrigger value="themes">By theme</TabsTrigger><TabsTrigger value="todos">To-dos</TabsTrigger></TabsList>
        </Tabs>

        {isLoading ? (
          <div className="py-20 text-center text-muted-foreground"><Loader2 className="mx-auto h-6 w-6 animate-spin" /></div>
        ) : !data?.ideas.length ? (
          <div className="py-24 text-center">
            <p className="font-display text-3xl font-semibold">Your inbox is empty.</p>
            <p className="mt-2 text-muted-foreground">Type your first idea above — anything, however rough.</p>
          </div>
        ) : !filtered.length ? (
          <p className="py-20 text-center text-muted-foreground">No ideas match those filters.</p>
        ) : view === "all" ? (
          <Grid ideas={filtered} themesById={themesById} itemsByIdea={itemsByIdea} onOpen={setSelected} />
        ) : view === "themes" ? (
          <div className="mt-6 space-y-10">
            {[...data.themes, { id: "", name: "Unsorted", hue: 260 }].map((t) => {
              const list = filtered.filter((i) => (i.theme_id ?? "") === t.id);
              if (!list.length) return null;
              return (
                <section key={t.id || "none"}>
                  <h2 className="flex items-center gap-3 font-display text-2xl font-semibold">
                    <span style={{ ["--hue" as string]: t.hue }} className="theme-chip h-3 w-3 rounded-full" />{t.name}
                    <span className="text-sm font-normal text-muted-foreground">{list.length}</span>
                  </h2>
                  <Grid ideas={list} themesById={themesById} itemsByIdea={itemsByIdea} onOpen={setSelected} />
                </section>
              );
            })}
          </div>
        ) : (
          <div className="mt-6 space-y-3">
            {filtered.filter((i) => itemsByIdea.get(i.id)?.length).map((i) => (
              <div key={i.id} className="rounded-xl border bg-card p-4">
                <button onClick={() => setSelected(i.id)} className="font-display text-lg font-semibold hover:text-primary">{i.title ?? "Untitled"}</button>
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

      <Sheet open={!!current} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          {current && (
            <IdeaDetail
              idea={current}
              theme={themesById.get(current.theme_id ?? "")}
              items={itemsByIdea.get(current.id) ?? []}
              onToggle={toggleItem}
              onReorganize={() => runOrganize(current.id)}
              onChanged={() => qc.invalidateQueries({ queryKey: ["board"] })}
              onDeleted={() => { setSelected(null); qc.invalidateQueries({ queryKey: ["board"] }); }}
            />
          )}
        </SheetContent>
      </Sheet>

      <Sheet open={showEmail} onOpenChange={setShowEmail}>
        <SheetContent>
          <SheetHeader><SheetTitle className="font-display text-2xl">Email ideas in</SheetTitle></SheetHeader>
          <div className="space-y-4 px-4 text-sm">
            <p>Soon you'll be able to email any thought to your personal address and it'll appear here, organized.</p>
            <p className="rounded-lg border bg-muted p-3 font-mono">ideas+{data?.token ?? "…"}@your-domain</p>
            <p className="text-muted-foreground">This turns on once the inbox email service is connected.</p>
          </div>
        </SheetContent>
      </Sheet>
    </div>
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

function Grid({ ideas, themesById, itemsByIdea, onOpen }: { ideas: Idea[]; themesById: Map<string, Theme>; itemsByIdea: Map<string, Item[]>; onOpen: (id: string) => void }) {
  return (
    <div className="mt-6 columns-1 gap-5 sm:columns-2 lg:columns-3">
      {ideas.map((i) => {
        const t = themesById.get(i.theme_id ?? "");
        const items = itemsByIdea.get(i.id) ?? [];
        const open = items.filter((x) => !x.done).length;
        return (
          <button
            key={i.id}
            onClick={() => onOpen(i.id)}
            style={{ ["--hue" as string]: t?.hue ?? 260 }}
            className="theme-edge animate-rise mb-5 block w-full break-inside-avoid rounded-lg bg-card p-5 text-left shadow-[var(--shadow-card)] transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-lift)]"
          >
            {i.status === "pending" ? (
              <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Organizing…</p>
            ) : (
              <div className="flex items-center justify-between gap-2">
                {t && <span className="theme-chip rounded-full px-2.5 py-0.5 text-xs font-semibold">{t.name}</span>}
                <span className="ml-auto text-xs text-muted-foreground">{i.source === "email" && "✉ "}{new Date(i.created_at).toLocaleDateString()}</span>
              </div>
            )}
            <h3 className="mt-3 font-display text-xl font-semibold leading-snug">{i.title ?? i.raw_text.slice(0, 80)}</h3>
            {i.summary && <p className="mt-2 text-sm text-muted-foreground">{i.summary}</p>}
            {i.status === "failed" && <p className="mt-2 text-xs text-destructive">Couldn't organize — open to retry.</p>}
            <div className="mt-3 flex flex-wrap gap-1.5">
              {i.tags.map((tg) => <span key={tg} className="tag-chip rounded px-2 py-0.5 text-xs">#{tg}</span>)}
            </div>
            {items.length > 0 && <p className="mt-3 text-xs font-medium text-primary">{open} of {items.length} to-dos open</p>}
          </button>
        );
      })}
    </div>
  );
}

function IdeaDetail({ idea, theme, items, onToggle, onReorganize, onChanged, onDeleted }: {
  idea: Idea; theme: Theme | undefined; items: Item[]; onToggle: (i: Item) => void; onReorganize: () => void; onChanged: () => void; onDeleted: () => void;
}) {
  const [tags, setTags] = useState(idea.tags.join(", "));
  const saveTags = async () => {
    const next = [...new Set(tags.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean))];
    await supabase.from("ideas").update({ tags: next }).eq("id", idea.id);
    onChanged(); toast.success("Tags saved");
  };
  const del = async () => {
    await supabase.from("ideas").delete().eq("id", idea.id);
    onDeleted(); toast.success("Idea deleted");
  };
  return (
    <div className="space-y-6 px-4 pb-8">
      <SheetHeader className="px-0">
        {theme && <span style={{ ["--hue" as string]: theme.hue }} className="theme-chip w-fit rounded-full px-2.5 py-0.5 text-xs font-semibold">{theme.name}</span>}
        <SheetTitle className="font-display text-2xl">{idea.title ?? "Organizing…"}</SheetTitle>
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
      <div>
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Tags</h4>
        <div className="flex gap-2"><Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="comma, separated" /><Button variant="secondary" onClick={saveTags}>Save</Button></div>
      </div>
      <div>
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Original</h4>
        <p className="paper-lines whitespace-pre-wrap rounded-lg border bg-card p-4 font-display leading-8">{idea.raw_text}</p>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" onClick={onReorganize}><RotateCw className="h-4 w-4" /> Re-organize</Button>
        <Button variant="ghost" className="text-destructive" onClick={del}><Trash2 className="h-4 w-4" /> Delete</Button>
      </div>
    </div>
  );
}
