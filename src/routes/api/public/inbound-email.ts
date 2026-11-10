import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const payload = z.object({
  MailboxHash: z.string().optional(),
  ToFull: z.array(z.object({ Email: z.string(), MailboxHash: z.string().optional() })).optional(),
  Subject: z.string().optional(),
  TextBody: z.string().optional(),
  StrippedTextReply: z.string().optional(),
});

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

export const Route = createFileRoute("/api/public/inbound-email")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["INBOUND_EMAIL_SECRET"];
        if (!secret) return new Response("Not configured", { status: 503 });
        const expected = "Basic " + btoa(`postmark:${secret}`);
        if (!safeEqual(request.headers.get("authorization") ?? "", expected)) {
          return new Response("Unauthorized", { status: 401 });
        }

        const parsed = payload.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return new Response("Bad payload", { status: 400 });
        const p = parsed.data;
        const token = (p.MailboxHash || p.ToFull?.find((t) => t.MailboxHash)?.MailboxHash || "")
          .trim()
          .toLowerCase();
        if (!/^[a-z0-9]{6,20}$/.test(token)) return new Response("ok"); // unknown recipient: drop

        const body = (p.StrippedTextReply || p.TextBody || "").trim();
        const text = [p.Subject?.trim(), body].filter(Boolean).join("\n\n").slice(0, 10000);
        if (!text) return new Response("ok");

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: profile } = await supabaseAdmin
          .from("profiles")
          .select("id")
          .eq("inbound_token", token)
          .maybeSingle();
        if (!profile) return new Response("ok");

        const { data: idea } = await supabaseAdmin
          .from("ideas")
          .insert({ user_id: profile.id, raw_text: text, source: "email" })
          .select("id")
          .single();
        if (idea) {
          const { organizeIdea } = await import("@/lib/organize.server");
          await organizeIdea(supabaseAdmin, profile.id, idea.id).catch((e) => console.error(e));
        }
        return new Response("ok");
      },
    },
  },
});
