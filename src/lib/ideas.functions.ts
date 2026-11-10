import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { organizeIdea } from "./organize.server";

export const captureIdea = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { text: string; teamId: string | null }) =>
    z.object({ text: z.string().trim().min(1).max(10000), teamId: z.string().uuid().nullable() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("ideas")
      .insert({ user_id: context.userId, raw_text: data.text, source: "web", team_id: data.teamId })
      .select("id")
      .single();
    if (error || !row) throw new Error("Couldn't save your idea");
    return { id: row.id };
  });

export const organizeIdeaFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await organizeIdea(context.supabase, context.userId, data.id);
    return { ok: true };
  });

export const setIdeaSharing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; enabled: boolean }) => z.object({ id: z.string().uuid(), enabled: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: canEdit } = await context.supabase.rpc("can_edit_idea", { _idea: data.id });
    if (!canEdit) throw new Error("Only the author or a team admin can share this idea");
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    const token = data.enabled ? Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("") : null;
    const { error } = await context.supabase.from("ideas").update({ share_token: token }).eq("id", data.id);
    if (error) throw new Error("Couldn't update sharing");
    return { token };
  });

export const moveIdeaToTeam = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; teamId: string }) => z.object({ id: z.string().uuid(), teamId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const db = context.supabase;
    const { data: idea } = await db.from("ideas").select("id, user_id, team_id").eq("id", data.id).maybeSingle();
    if (!idea || idea.user_id !== context.userId || idea.team_id) throw new Error("You can only send your own notebook ideas");
    const { data: member } = await db.rpc("is_team_member", { _team: data.teamId });
    if (!member) throw new Error("You're not in that team");
    const { error } = await db.from("ideas").update({ team_id: data.teamId, theme_id: null, status: "pending" }).eq("id", data.id);
    if (error) throw new Error("Couldn't move the idea");
    await organizeIdea(db, context.userId, data.id).catch(() => undefined);
    return { ok: true };
  });

export const getEmailInConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => ({
    domain: process.env["INBOUND_EMAIL_DOMAIN"] ?? null,
    connected: !!process.env["INBOUND_EMAIL_SECRET"] && !!process.env["INBOUND_EMAIL_DOMAIN"],
  }));
