import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ArrowLeft, ArrowDownUp, Loader2, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/journal")({
  head: () => ({
    meta: [
      { title: "Journal — Common Ground" },
      { name: "description", content: "Every idea you've captured, in order." },
      { property: "og:title", content: "Journal — Common Ground" },
      { property: "og:description", content: "Every idea you've captured, in order." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Journal,
});

function Journal() {
  const [q, setQ] = useState("");
  const [newest, setNewest] = useState(true);
  const { data, isLoading } = useQuery({
    queryKey: ["journal"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const [ideas, teams, themes] = await Promise.all([
        supabase.from("ideas").select("id, raw_text, title, tags, team_id, theme_id, created_at, source").eq("user_id", u.user!.id).order("created_at", { ascending: false }).limit(1000),
        supabase.from("teams").select("id, name"),
        supabase.from("themes").select("id, name, hue"),
      ]);
      return {
        ideas: ideas.data ?? [],
        teams: new Map((teams.data ?? []).map((t) => [t.id, t.name])),
        themes: new Map((themes.data ?? []).map((t) => [t.id, t])),
      };
    },
  });

  const groups = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let list = (data?.ideas ?? []).filter((i) => !needle || [i.title, i.raw_text, i.tags.join(" ")].join(" ").toLowerCase().includes(needle));
    if (!newest) list = [...list].reverse();
    const months: { label: string; days: { label: string; ideas: typeof list }[] }[] = [];
    for (const i of list) {
      const d = new Date(i.created_at);
      const m = d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
      const day = d.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
      let mg = months.at(-1);
      if (!mg || mg.label !== m) { mg = { label: m, days: [] }; months.push(mg); }
      let dg = mg.days.at(-1);
      if (!dg || dg.label !== day) { dg = { label: day, ideas: [] }; mg.days.push(dg); }
      dg.ideas.push(i);
    }
    return months;
  }, [data, q, newest]);

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b bg-card/90 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <Logo />
          <Button asChild variant="ghost" size="sm"><Link to="/dashboard" search={{}}><ArrowLeft className="h-4 w-4" /> Dashboard</Link></Button>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 pb-24">
        <h1 className="mt-8 font-display text-4xl font-extrabold tracking-tight text-primary">Journal</h1>
        <p className="text-muted-foreground">Everything you've captured, across your notebook and team spaces.</p>
        <div className="mt-6 flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search your journal…" className="bg-card pl-9" />
          </div>
          <Button variant="outline" onClick={() => setNewest(!newest)}><ArrowDownUp className="h-4 w-4" /> {newest ? "Newest first" : "Oldest first"}</Button>
        </div>
        {isLoading ? (
          <Loader2 className="mx-auto mt-20 h-6 w-6 animate-spin text-muted-foreground" />
        ) : !groups.length ? (
          <p className="mt-20 text-center text-muted-foreground">No entries yet.</p>
        ) : (
          groups.map((m) => (
            <section key={m.label} className="mt-10">
              <h2 className="sticky top-14 z-10 bg-background/95 py-2 font-display text-xl font-bold text-brand-teal">{m.label}</h2>
              {m.days.map((d) => (
                <div key={d.label} className="mt-4">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{d.label}</h3>
                  <div className="mt-2 space-y-3">
                    {d.ideas.map((i) => {
                      const theme = data!.themes.get(i.theme_id ?? "");
                      return (
                        <Link key={i.id} to="/dashboard" search={i.team_id ? { space: i.team_id, idea: i.id } : { idea: i.id }}
                          style={{ ["--hue" as string]: theme?.hue ?? 230 }}
                          className="theme-edge block rounded-lg border bg-card p-5 shadow-[var(--shadow-card)] transition hover:shadow-[var(--shadow-lift)]">
                          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            <span>{new Date(i.created_at).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}</span>
                            <span className="rounded bg-secondary px-1.5 py-0.5 font-medium text-secondary-foreground">{i.team_id ? data!.teams.get(i.team_id) ?? "Team" : "Notebook"}</span>
                            {theme && <span className="theme-chip rounded-full px-2 py-0.5 font-semibold">{theme.name}</span>}
                            {i.source === "email" && <span>✉ email</span>}
                          </div>
                          {i.title && <h4 className="mt-2 font-display text-lg font-bold text-primary">{i.title}</h4>}
                          <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed">{i.raw_text}</p>
                          {i.tags.length > 0 && <div className="mt-2 flex flex-wrap gap-1.5">{i.tags.map((t) => <span key={t} className="tag-chip rounded px-2 py-0.5 text-xs">#{t}</span>)}</div>}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}
            </section>
          ))
        )}
      </main>
    </div>
  );
}
