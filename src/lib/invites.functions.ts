import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const input = z.object({
  token: z.string().regex(/^[a-f0-9]{16,64}$/),
  password: z.string().min(8).max(200),
  name: z.string().trim().max(80).optional(),
});

// Creates an already-confirmed account, but only for the exact email an admin invited.
export const signUpWithInvite = createServerFn({ method: "POST" })
  .inputValidator((d: z.infer<typeof input>) => input.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: inv } = await supabaseAdmin
      .from("team_invites").select("email, accepted_at, expires_at").eq("token", data.token).maybeSingle();
    if (!inv) return { ok: false as const, error: "This invite link isn't valid." };
    if (inv.accepted_at) return { ok: false as const, error: "This invite has already been used." };
    if (new Date(inv.expires_at) < new Date()) return { ok: false as const, error: "This invite has expired. Ask your admin for a new one." };
    const { error } = await supabaseAdmin.auth.admin.createUser({
      email: inv.email, password: data.password, email_confirm: true,
      ...(data.name ? { user_metadata: { display_name: data.name, full_name: data.name } } : {}),
    });
    if (error) {
      const exists = /already|registered|exists/i.test(error.message);
      return { ok: false as const, exists, error: exists ? "You already have an account. Sign in below to join." : "Couldn't create your account." };
    }
    return { ok: true as const, email: inv.email };
  });
