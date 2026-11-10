import { createOpenAI } from "@ai-sdk/openai";
import { streamText, Output } from "ai";
import { z } from "zod/v4";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

const schema = z.object({
  title: z.string(),
  summary: z.string(),
  tags: z.array(z.string()),
  theme: z.string(),
  action_items: z.array(z.string()),
});

export type Organized = z.infer<typeof schema>;

export async function runOrganizer(
  rawText: string,
  existingTags: string[],
  existingThemes: string[],
): Promise<Organized> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("AI is not configured");
  const provider = createOpenAI({
    baseURL: "https://ai.gateway.lovable.dev/v1",
    apiKey,
    headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
  });
  const result = streamText({
    model: provider.responses("openai/gpt-6-astra"),
    instructions:
      "You organize a person's raw thoughts. Return: a short punchy title (max 8 words); a 1-2 sentence summary; 1-4 lowercase topic tags (reuse existing tags when they fit); one broad theme name, 1-3 words, Title Case (strongly prefer reusing an existing theme); and concrete action items/to-dos explicitly or clearly implied (empty array if none). Never invent facts.",
    messages: [
      {
        role: "user",
        content: `Existing tags: ${existingTags.join(", ") || "(none)"}\nExisting themes: ${existingThemes.join(", ") || "(none)"}\n\nIdea:\n${rawText.slice(0, 8000)}`,
      },
    ],
    output: Output.object({ schema }),
    providerOptions: {
      openai: {
        forceReasoning: true,
        reasoningEffort: "low",
        reasoningSummary: "auto",
        store: false,
        include: ["reasoning.encrypted_content"],
      },
    },
  });
  return (await result.output) as Organized;
}

const HUES = [25, 145, 210, 330, 60, 265, 175, 5, 95, 290];

export async function organizeIdea(
  db: SupabaseClient<Database>,
  userId: string,
  ideaId: string,
) {
  const { data: idea, error } = await db
    .from("ideas")
    .select("id, raw_text, team_id")
    .eq("id", ideaId)
    .eq("user_id", userId)
    .single();
  if (error || !idea) throw new Error("Idea not found");

  const teamId = idea.team_id;
  const themeQ = db.from("themes").select("id, name");
  const tagQ = db.from("ideas").select("tags").limit(500);
  const [{ data: themes }, { data: tagRows }] = await Promise.all([
    teamId ? themeQ.eq("team_id", teamId) : themeQ.is("team_id", null).eq("user_id", userId),
    teamId ? tagQ.eq("team_id", teamId) : tagQ.is("team_id", null).eq("user_id", userId),
  ]);
  const tagSet = new Set<string>();
  tagRows?.forEach((r) => r.tags.forEach((t) => tagSet.add(t)));

  let org: Organized;
  try {
    org = await runOrganizer(idea.raw_text, [...tagSet], (themes ?? []).map((t) => t.name));
  } catch (e) {
    console.error("organize failed", e);
    await db.from("ideas").update({ status: "failed" }).eq("id", ideaId);
    throw new Error("The AI couldn't organize this idea right now. Try again shortly.");
  }

  const themeName = org.theme.trim() || "Misc";
  let theme = themes?.find((t) => t.name.toLowerCase() === themeName.toLowerCase());
  if (!theme) {
    const { data: created } = await db
      .from("themes")
      .insert({ user_id: userId, team_id: teamId, name: themeName, hue: HUES[(themes?.length ?? 0) % HUES.length] ?? 30 })
      .select("id, name")
      .single();
    theme = created ?? undefined;
  }

  await db
    .from("ideas")
    .update({
      title: org.title,
      summary: org.summary,
      tags: [...new Set(org.tags.map((t) => t.toLowerCase().trim()).filter(Boolean))].slice(0, 6),
      theme_id: theme?.id ?? null,
      status: "ready",
    })
    .eq("id", ideaId);

  await db.from("action_items").delete().eq("idea_id", ideaId);
  if (org.action_items.length) {
    await db.from("action_items").insert(
      org.action_items.map((text) => ({ user_id: userId, idea_id: ideaId, text })),
    );
  }
}
