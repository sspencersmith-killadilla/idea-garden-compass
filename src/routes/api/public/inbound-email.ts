import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const payload = z.object({
  MailboxHash: z.string().optional(),
  ToFull: z.array(z.object({ Email: z.string(), MailboxHash: z.string().optional() })).optional(),
  Subject: z.string().optional(),
  TextBody: z.string().optional(),
  StrippedTextReply: z.string().optional(),
  Attachments: z.array(z.object({ Name: z.string(), Content: z.string(), ContentType: z.string().optional(), ContentLength: z.number().optional() })).optional(),
});

const MAX_BYTES = 20 * 1024 * 1024;
const safeName = (n: string) => (n.replace(/[^\w.\- ]+/g, "_").trim() || "file").slice(0, 120);
function b64ToBytes(b64: string) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

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
        const attachments = (p.Attachments ?? []).slice(0, 10);
        if (!text && !attachments.length) return new Response("ok");

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: profile } = await supabaseAdmin
          .from("profiles")
          .select("id")
          .eq("inbound_token", token)
          .maybeSingle();
        if (!profile) return new Response("ok");

        const { data: idea } = await supabaseAdmin
          .from("ideas")
          .insert({ user_id: profile.id, raw_text: text || attachments.map((a) => a.Name).join(", "), source: "email" })
          .select("id")
          .single();
        if (idea) {
          for (const a of attachments) {
            try {
              const bytes = b64ToBytes(a.Content);
              if (!bytes.length || bytes.length > MAX_BYTES) continue;
              const mime = a.ContentType || "application/octet-stream";
              const path = `${idea.id}/${crypto.randomUUID()}-${safeName(a.Name)}`;
              const up = await supabaseAdmin.storage.from("idea-files").upload(path, bytes, { contentType: mime });
              if (up.error) { console.error(up.error); continue; }
              await supabaseAdmin.from("idea_files").insert({ idea_id: idea.id, user_id: profile.id, path, name: a.Name.slice(0, 200), mime, size: bytes.length });
            } catch (e) { console.error(e); }
          }
          const { organizeIdea } = await import("@/lib/organize.server");
          await organizeIdea(supabaseAdmin, profile.id, idea.id).catch((e) => console.error(e));
        }
        return new Response("ok");
      },
    },
  },
});
