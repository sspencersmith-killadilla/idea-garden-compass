import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/Logo";

import { PENDING_INVITE_KEY } from "@/lib/invite";

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
  const { code } = Route.useParams();
  const navigate = useNavigate();
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        sessionStorage.setItem(PENDING_INVITE_KEY, code);
        navigate({ to: "/auth", replace: true });
        return;
      }
      const { data: teamId, error } = await supabase.rpc("join_team", { _code: code });
      if (error || !teamId) { setErr("This invite link isn't valid anymore. Ask your team admin for a new one."); return; }
      navigate({ to: "/dashboard", search: { space: teamId }, replace: true });
    })();
  }, [code, navigate]);
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
      <Logo />
      <p className="text-muted-foreground">{err ?? "Joining your team…"}</p>
    </div>
  );
}
