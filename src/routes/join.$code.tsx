import { createFileRoute, Link } from "@tanstack/react-router";
import { Logo } from "@/components/Logo";

export const Route = createFileRoute("/join/$code")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Join a team — Common Ground" },
      { name: "description", content: "You've been invited to a Common Ground team space." },
      { property: "og:title", content: "Join a team on Common Ground" },
      { property: "og:description", content: "You've been invited to a shared idea space." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Join,
});

function Join() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
      <Logo />
      <p className="max-w-sm text-muted-foreground">Shared team links are no longer used. Ask your team admin to send you a personal invite for your email address.</p>
      <Link to="/auth" className="text-sm underline">Go to sign in</Link>
    </div>
  );
}
