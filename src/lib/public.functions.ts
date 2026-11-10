import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";

export type PublicIdea = {
  title: string | null; summary: string | null; raw_text: string; tags: string[]; created_at: string;
  theme_name: string | null; theme_hue: number | null; items: { text: string; done: boolean }[];
};

export const getPublicIdea = createServerFn({ method: "GET" })
  .inputValidator((d: { token: string }) => z.object({ token: z.string().regex(/^[a-f0-9]{16,64}$/) }).parse(d))
  .handler(async ({ data }) => {
    const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
    const db = createClient<Database>(process.env["SUPABASE_URL"]!, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        fetch: (input, init) => {
          const h = new Headers(init?.headers);
          if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
          h.set("apikey", key);
          return fetch(input, { ...init, headers: h });
        },
      },
    });
    const { data: idea } = await db.rpc("get_public_idea", { _token: data.token });
    return (idea as unknown as PublicIdea | null) ?? null;
  });
