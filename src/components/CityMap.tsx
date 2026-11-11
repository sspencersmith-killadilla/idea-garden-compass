type Idea = { id: string; title: string | null; theme_id: string | null; status: string };
type Theme = { id: string; name: string; hue: number };
type Item = { done: boolean };

export function CityMap({ ideas, themes, itemsByIdea, onOpen }: { ideas: Idea[]; themes: Theme[]; itemsByIdea: Map<string, Item[]>; onOpen: (id: string) => void }) {
  const districts = [...themes, { id: "", name: "Unzoned land", hue: 200 }]
    .map((t) => ({ t, list: ideas.filter((i) => (i.theme_id ?? "") === t.id) }))
    .filter((d) => d.list.length);
  return (
    <div className="mt-6 rounded-xl border bg-muted/40 p-3 sm:p-5" style={{ backgroundImage: "linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px)", backgroundSize: "24px 24px" }}>
      <div className="grid gap-5 md:grid-cols-2 2xl:grid-cols-3">
        {districts.map(({ t, list }) => (
          <section key={t.id || "none"} className="rounded-lg border-2 border-dashed bg-card/90 p-3" style={{ borderColor: `oklch(0.65 0.12 ${t.hue})` }}>
            <h3 className="mb-3 flex items-center justify-between font-display text-sm font-bold uppercase tracking-wider" style={{ color: `oklch(0.45 0.12 ${t.hue})` }}>
              <span>{t.name} district</span><span className="text-xs font-medium text-muted-foreground">{list.length} {list.length === 1 ? "building" : "buildings"}</span>
            </h3>
            <div className="grid grid-cols-3 items-end gap-x-2 gap-y-4 border-b-4 border-muted-foreground/30 pb-1 sm:grid-cols-4">
              {list.map((i) => {
                const items = itemsByIdea.get(i.id) ?? [];
                const done = items.filter((x) => x.done).length;
                const pct = items.length ? Math.round((done / items.length) * 100) : 0;
                const floors = Math.min(6, 2 + items.length);
                return (
                  <button key={i.id} onClick={() => onOpen(i.id)} title={`${i.title ?? "Untitled"} — ${items.length ? `${done}/${items.length} to-dos done` : "no to-dos yet"}`} className="group flex flex-col items-center gap-1 text-left">
                    <div className="relative w-full rounded-t-md transition group-hover:-translate-y-1 group-hover:shadow-md" style={{ height: floors * 14, background: `oklch(0.7 0.1 ${t.hue})` }}>
                      <div className="absolute inset-x-1.5 top-1.5 grid grid-cols-3 gap-1">
                        {Array.from({ length: (floors - 1) * 3 }).map((_, k) => <span key={k} className="h-1.5 rounded-sm bg-card/70" />)}
                      </div>
                      {items.length > 0 && pct < 100 && <span className="absolute -top-3 right-1 text-[10px]" aria-hidden>🏗️</span>}
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted" aria-label={`${pct}% of to-dos done`}>
                      <div className="h-full bg-gradient-brand" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="line-clamp-2 w-full text-[11px] leading-tight text-foreground">{i.title ?? "Organizing…"}</span>
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </div>
      <p className="mt-4 text-xs text-muted-foreground">Taller buildings have more to-dos. The bar under each shows how much is built.</p>
    </div>
  );
}
