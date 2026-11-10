import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Mail, Sparkles, Search, ListChecks } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Idea Inbox — dump your thoughts, get them organized" },
      { name: "description", content: "Type or email any idea. AI titles, tags, groups and pulls out to-dos into one searchable dashboard." },
      { property: "og:title", content: "Idea Inbox — dump your thoughts, get them organized" },
      { property: "og:description", content: "Type or email any idea. AI titles, tags, groups and pulls out to-dos." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const features = [
  { icon: Sparkles, title: "Instantly organized", body: "Every idea gets a title, summary, and topic tags." },
  { icon: ListChecks, title: "To-dos pulled out", body: "Action items become checkboxes you can tick off." },
  { icon: Search, title: "Find anything", body: "Search, sort and filter by theme, tag or source." },
  { icon: Mail, title: "Email it in", body: "Forward a thought to your personal inbox address." },
];

function Landing() {
  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <span className="font-display text-2xl font-extrabold tracking-tight">Idea Inbox<span className="text-primary">.</span></span>
        <Button asChild variant="ghost"><Link to="/auth">Sign in</Link></Button>
      </header>
      <main className="mx-auto max-w-6xl px-6 pb-24 pt-10">
        <div className="grid items-center gap-12 md:grid-cols-[1.1fr_1fr]">
          <div>
            <h1 className="font-display text-5xl font-extrabold leading-[1.02] tracking-tight md:text-7xl">
              Brain dump.<br /><span className="italic text-primary">We'll sort it.</span>
            </h1>
            <p className="mt-6 max-w-md text-lg text-muted-foreground">
              Throw half-baked thoughts in as fast as they come. Idea Inbox turns them into a tidy, searchable board of themes, tags and to-dos.
            </p>
            <div className="mt-8 flex gap-3">
              <Button asChild size="lg"><Link to="/auth">Start capturing — it's free</Link></Button>
            </div>
          </div>
          <div className="relative h-80">
            {[
              { t: "Podcast about small-town diners", tag: "side projects", rot: "-rotate-3", pos: "left-0 top-4", hue: 25 },
              { t: "Call Sam re: kitchen quote", tag: "home", rot: "rotate-2", pos: "right-0 top-20", hue: 145 },
              { t: "Q3 pricing: try annual discount", tag: "work", rot: "-rotate-1", pos: "left-10 bottom-0", hue: 210 },
            ].map((c) => (
              <div key={c.t} style={{ ["--hue" as string]: c.hue }} className={`theme-edge absolute w-64 rounded-lg bg-card p-5 shadow-[var(--shadow-lift)] ${c.rot} ${c.pos}`}>
                <p className="font-display text-lg font-semibold leading-snug">{c.t}</p>
                <span className="theme-chip mt-3 inline-block rounded-full px-2.5 py-0.5 text-xs font-medium">{c.tag}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-24 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((f) => (
            <div key={f.title} className="rounded-xl border bg-card p-6">
              <f.icon className="h-5 w-5 text-primary" />
              <h3 className="mt-4 font-display text-lg font-semibold">{f.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{f.body}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
