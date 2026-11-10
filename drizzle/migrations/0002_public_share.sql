ALTER TABLE public.ideas ADD COLUMN share_token text UNIQUE;

CREATE OR REPLACE FUNCTION public.get_public_idea(_token text) RETURNS json LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT json_build_object(
    'title', i.title, 'summary', i.summary, 'raw_text', i.raw_text, 'tags', i.tags, 'created_at', i.created_at,
    'theme_name', t.name, 'theme_hue', t.hue,
    'items', coalesce((SELECT json_agg(json_build_object('text', a.text, 'done', a.done) ORDER BY a.created_at) FROM public.action_items a WHERE a.idea_id = i.id), '[]'::json)
  )
  FROM public.ideas i LEFT JOIN public.themes t ON t.id = i.theme_id
  WHERE _token IS NOT NULL AND length(_token) >= 16 AND i.share_token = _token
$$;
REVOKE EXECUTE ON FUNCTION public.get_public_idea(text) FROM public;
GRANT EXECUTE ON FUNCTION public.get_public_idea(text) TO anon, authenticated;