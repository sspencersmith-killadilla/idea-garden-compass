import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { organizeIdea } from "./organize.server";

export const captureIdea = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { text: string }) => z.object({ text: z.string().trim().min(1).max(10000) }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("ideas")
      .insert({ user_id: context.userId, raw_text: data.text, source: "web" })
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
