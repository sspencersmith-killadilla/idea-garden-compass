CREATE TABLE public.idea_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  idea_id uuid NOT NULL REFERENCES public.ideas(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  path text NOT NULL UNIQUE,
  name text NOT NULL,
  mime text NOT NULL DEFAULT 'application/octet-stream',
  size bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idea_files_idea_idx ON public.idea_files(idea_id);
GRANT SELECT, INSERT, DELETE ON public.idea_files TO authenticated;
GRANT ALL ON public.idea_files TO service_role;
ALTER TABLE public.idea_files ENABLE ROW LEVEL SECURITY;
CREATE POLICY "view files" ON public.idea_files FOR SELECT TO authenticated USING (public.can_view_idea(idea_id));
CREATE POLICY "add files" ON public.idea_files FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND public.can_edit_idea(idea_id) AND split_part(path, '/', 1) = idea_id::text);
CREATE POLICY "delete files" ON public.idea_files FOR DELETE TO authenticated USING (public.can_edit_idea(idea_id));

CREATE OR REPLACE FUNCTION public.path_idea(_name text) RETURNS uuid LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN split_part(_name,'/',1) ~ '^[0-9a-f-]{36}$' THEN split_part(_name,'/',1)::uuid END $$;

CREATE POLICY "idea files read" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'idea-files' AND public.can_view_idea(public.path_idea(name)));
CREATE POLICY "idea files upload" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'idea-files' AND public.can_edit_idea(public.path_idea(name)));
CREATE POLICY "idea files delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'idea-files' AND public.can_edit_idea(public.path_idea(name)));

CREATE OR REPLACE FUNCTION public.get_public_idea_files(_token text)
 RETURNS TABLE(path text, name text, mime text, size bigint)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT f.path, f.name, f.mime, f.size FROM public.idea_files f JOIN public.ideas i ON i.id = f.idea_id
  WHERE _token IS NOT NULL AND length(_token) >= 16 AND i.share_token = _token ORDER BY f.created_at
$$;
REVOKE EXECUTE ON FUNCTION public.get_public_idea_files(text) FROM anon, authenticated, public;
GRANT EXECUTE ON FUNCTION public.get_public_idea_files(text) TO service_role;