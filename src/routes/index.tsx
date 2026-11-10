import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, BookOpen, Database, Building2, MessagesSquare, Sparkles, Search, ListChecks, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo, LogoMark } from "@/components/Logo";
import { Skyline, PowerLine } from "@/components/City";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Common Ground — shared ideas for city teams" },
      { name: "description", content: "Capture ideas with your department or city project team. AI titles, tags, groups and pulls out to-dos into one shared, searchable board." },
      { property: "og:title", content: "Common Ground — shared ideas for city teams" },
      { property: "og:description", content: "One shared, AI-organized idea board for departments and city project teams." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const features = [
  { icon: Building2, title: "Spaces for every team", body: "Departments, city projects or working groups. Invite people with a link." },
  { icon: Sparkles, title: "Organized for you", body: "Every idea gets a title, summary, tags and a theme." },
  { icon: ListChecks, title: "To-dos pulled out", body: "Action items become checkboxes the whole team can see." },
  { icon: MessagesSquare, title: "Talk it through", body: "Comment on any idea to build on each other's thinking." },
  { icon: Search, title: "Find anything", body: "Search and filter by theme, tag, person or source." },
  { icon: Lock, title: "Your own notebook too", body: "Keep rough private thoughts until they're ready to share." },
];

function Landing() {
  return (
    <div className="relative min-h-screen overflow-hidden">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <Logo />
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost"><a href="#manuals">Manual</a></Button>
          <Button asChild><Link to="/auth">Sign in</Link></Button>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 pb-24 pt-12">
        <div className="grid items-center gap-12 md:grid-cols-[1.4fr_1fr]">
          <div>
            <span className="inline-block rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">Ideas in · shared thinking out · for every team</span>
            <h1 className="mt-6 font-display text-5xl font-extrabold leading-[1.05] tracking-tight text-primary md:text-6xl">
              Every idea, <span className="text-gradient-brand">on common ground.</span>
            </h1>
            <p className="mt-6 max-w-lg text-lg text-muted-foreground">
              Your department or project team drops in ideas as they come. Common Ground organizes them into one shared board of themes, tags and to-dos everyone can search.
            </p>
            <Button asChild size="lg" className="mt-8"><Link to="/auth">Start your team space <ArrowRight className="h-4 w-4" /></Link></Button>
          </div>
          <div className="flex justify-center"><LogoMark className="h-56 w-56 animate-rise" /></div>
        </div>
        <PowerLine className="mt-16 h-10" />
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div key={f.title} className="card-tilt animate-rise rounded-xl border bg-card p-6 shadow-[var(--shadow-card)]">
              <f.icon className="h-5 w-5 text-brand-green" />
              <h3 className="mt-4 font-display text-lg font-bold text-primary">{f.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{f.body}</p>
            </div>
          ))}
        </div>
        <section id="manuals" className="mt-20 rounded-xl border bg-card p-6 shadow-[var(--shadow-card)] md:p-8">
          <h2 className="road-underline font-display text-2xl font-extrabold text-primary">Manuals &amp; self-hosting</h2>
          <p className="mt-3 max-w-2xl text-muted-foreground">Everything you need to use Common Ground, plus step-by-step instructions to install and run it on your own servers.</p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Button asChild><a href="/manual/Common-Ground-User-Manual.md" download><BookOpen className="h-4 w-4" /> User &amp; install manual</a></Button>
            <Button asChild variant="outline"><a href="/manual/schema.sql" download><Database className="h-4 w-4" /> Database setup file</a></Button>
          </div>
        </section>
      </main>
      <Skyline className="absolute inset-x-0 bottom-0 h-24" />
    </div>
  );
}
