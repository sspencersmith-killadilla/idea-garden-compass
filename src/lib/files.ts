import { supabase } from "@/integrations/supabase/client";

export const MAX_FILE_BYTES = 20 * 1024 * 1024;
export const BUCKET = "idea-files";
export type IdeaFile = { id?: string; idea_id?: string; path: string; name: string; mime: string; size: number; url?: string | null };

export const isImage = (mime: string) => mime.startsWith("image/");
export const prettySize = (n: number) => (n < 1024 ? `${n} B` : n < 1048576 ? `${Math.round(n / 1024)} KB` : `${(n / 1048576).toFixed(1)} MB`);
export const safeName = (n: string) => (n.replace(/[^\w.\- ]+/g, "_").trim() || "file").slice(0, 120);

/** Upload files to an idea the current user can edit. Returns names that failed. */
export async function uploadIdeaFiles(ideaId: string, userId: string, files: File[]) {
  const failed: string[] = [];
  for (const f of files) {
    if (f.size > MAX_FILE_BYTES) { failed.push(`${f.name} (over 20 MB)`); continue; }
    const path = `${ideaId}/${crypto.randomUUID()}-${safeName(f.name)}`;
    const up = await supabase.storage.from(BUCKET).upload(path, f, { contentType: f.type || "application/octet-stream" });
    if (up.error) { failed.push(f.name); continue; }
    const { error } = await supabase.from("idea_files").insert({ idea_id: ideaId, user_id: userId, path, name: f.name.slice(0, 200), mime: f.type || "application/octet-stream", size: f.size });
    if (error) { failed.push(f.name); await supabase.storage.from(BUCKET).remove([path]); }
  }
  return failed;
}

export async function deleteIdeaFile(file: IdeaFile) {
  await supabase.from("idea_files").delete().eq("path", file.path);
  await supabase.storage.from(BUCKET).remove([file.path]);
}

export async function withSignedUrls<T extends IdeaFile>(files: T[]): Promise<T[]> {
  if (!files.length) return files;
  const { data } = await supabase.storage.from(BUCKET).createSignedUrls(files.map((f) => f.path), 3600);
  const m = new Map((data ?? []).map((d) => [d.path, d.signedUrl]));
  return files.map((f) => ({ ...f, url: m.get(f.path) ?? null }));
}
