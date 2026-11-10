import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { CheckCircle2, Circle } from "lucide-react";
import { getPublicIdea } from "@/lib/public.functions";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/i/$token")({
  loader: async ({ params }) => {
    const idea = await getPublicIdea({ data: { token: params.token } }).catch(() => null);
    if (!idea) throw notFound();
    return idea;
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: loaderData?.title ? `${loaderData.title} — Common Ground` : "Shared idea — Common Ground" },
      { name: "description", content: loaderData?.summary ?? "An idea shared from Common Ground." },
      { property: "og:title", content: loaderData?.title ?? "Shared idea" },
      { property: "og:description", content: loaderData?.summary ?? "An idea shared from Common Ground." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PublicIdeaPage,
  notFoundComponent: () => (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
      <Logo />
      <p className="text-muted-foreground">This idea isn't shared anymore, or the link is wrong.</p>
    </div>
  ),
  errorComponent: () => <div className="p-10 text-center text-muted-foreground">Couldn't load this idea.</div>,
});

function PublicIdeaPage() {
  const idea = Route.useLoaderData();
  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-3xl items-center justify-between px-6 py-5">
        <Logo />
        <Button asChild variant="outline" size="sm"><Link to="/">What is this?</Link></Button>
      </header>
      <main className="mx-auto max-w-3xl px-6 pb-20">
        <article style={{ ["--hue" as string]: idea.theme_hue ?? 230 }} className="theme-edge rounded-xl border bg-card p-8 shadow-[var(--shadow-card)]">
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            {idea.theme_name && <span className="theme-chip rounded-full px-2.5 py-0.5 font-semibold">{idea.theme_name}</span>}
            {new Date(idea.created_at).toLocaleDateString(undefined, { dateStyle: "long" })}
          </div>
          <h1 className="mt-4 font-display text-3xl font-extrabold tracking-tight text-primary">{idea.title ?? "Shared idea"}</h1>
          {idea.summary && <p className="mt-3 text-lg text-muted-foreground">{idea.summary}</p>}
          {idea.items.length > 0 && (
            <ul className="mt-6 space-y-2">
              {idea.items.map((it, n) => (
                <li key={n} className="flex items-start gap-2 text-sm">
                  {it.done ? <CheckCircle2 className="mt-0.5 h-4 w-4 text-brand-green" /> : <Circle className="mt-0.5 h-4 w-4 text-muted-foreground" />}
                  <span className={it.done ? "text-muted-foreground line-through" : ""}>{it.text}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-6 whitespace-pre-wrap rounded-lg bg-muted p-5 leading-relaxed">{idea.raw_text}</p>
          <div className="mt-5 flex flex-wrap gap-1.5">{idea.tags.map((t) => <span key={t} className="tag-chip rounded px-2 py-0.5 text-xs">#{t}</span>)}</div>
        </article>
      </main>
    </div>
  );
}
