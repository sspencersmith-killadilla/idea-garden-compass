ALTER TABLE public.profiles ADD COLUMN display_name text;
UPDATE public.profiles p SET display_name = coalesce(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name', split_part(u.email,'@',1)) FROM auth.users u WHERE u.id = p.id;

CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, coalesce(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email,'@',1)))
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END; $$;

CREATE TABLE public.teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  kind text NOT NULL DEFAULT 'team',
  invite_code text NOT NULL UNIQUE DEFAULT substr(md5(gen_random_uuid()::text), 1, 12),
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.team_members (
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('admin','member')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (team_id, user_id)
);
GRANT SELECT, UPDATE, DELETE ON public.teams TO authenticated;
GRANT ALL ON public.teams TO service_role;
GRANT SELECT, UPDATE, DELETE ON public.team_members TO authenticated;
GRANT ALL ON public.team_members TO service_role;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_team_member(_team uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.team_members WHERE team_id = _team AND user_id = auth.uid()) $$;
CREATE OR REPLACE FUNCTION public.is_team_admin(_team uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.team_members WHERE team_id = _team AND user_id = auth.uid() AND role = 'admin') $$;
CREATE OR REPLACE FUNCTION public.shares_team(_other uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.team_members a JOIN public.team_members b ON a.team_id = b.team_id WHERE a.user_id = auth.uid() AND b.user_id = _other) $$;

CREATE POLICY "members read team" ON public.teams FOR SELECT TO authenticated USING (public.is_team_member(id));
CREATE POLICY "admins update team" ON public.teams FOR UPDATE TO authenticated USING (public.is_team_admin(id)) WITH CHECK (public.is_team_admin(id));
CREATE POLICY "admins delete team" ON public.teams FOR DELETE TO authenticated USING (public.is_team_admin(id));
CREATE POLICY "members read roster" ON public.team_members FOR SELECT TO authenticated USING (public.is_team_member(team_id));
CREATE POLICY "admins change roles" ON public.team_members FOR UPDATE TO authenticated USING (public.is_team_admin(team_id)) WITH CHECK (public.is_team_admin(team_id));
CREATE POLICY "admins remove or self leave" ON public.team_members FOR DELETE TO authenticated USING (public.is_team_admin(team_id) OR user_id = auth.uid());

CREATE POLICY "teammates profiles" ON public.profiles FOR SELECT TO authenticated USING (public.shares_team(id));

CREATE OR REPLACE FUNCTION public.create_team(_name text, _kind text DEFAULT 'team') RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE tid uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not signed in'; END IF;
  IF length(trim(_name)) < 1 OR length(_name) > 80 THEN RAISE EXCEPTION 'invalid name'; END IF;
  INSERT INTO public.teams (name, kind, created_by) VALUES (trim(_name), CASE WHEN _kind IN ('department','project','team') THEN _kind ELSE 'team' END, auth.uid()) RETURNING id INTO tid;
  INSERT INTO public.team_members (team_id, user_id, role) VALUES (tid, auth.uid(), 'admin');
  RETURN tid;
END; $$;
CREATE OR REPLACE FUNCTION public.join_team(_code text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE tid uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not signed in'; END IF;
  SELECT id INTO tid FROM public.teams WHERE invite_code = _code;
  IF tid IS NULL THEN RAISE EXCEPTION 'invalid invite'; END IF;
  INSERT INTO public.team_members (team_id, user_id, role) VALUES (tid, auth.uid(), 'member') ON CONFLICT DO NOTHING;
  RETURN tid;
END; $$;
REVOKE EXECUTE ON FUNCTION public.create_team(text, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.join_team(text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.create_team(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.join_team(text) TO authenticated;

ALTER TABLE public.ideas ADD COLUMN team_id uuid REFERENCES public.teams(id) ON DELETE CASCADE;
ALTER TABLE public.themes ADD COLUMN team_id uuid REFERENCES public.teams(id) ON DELETE CASCADE;
ALTER TABLE public.themes DROP CONSTRAINT IF EXISTS themes_user_id_name_key;
CREATE INDEX ideas_team_idx ON public.ideas(team_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.can_view_idea(_idea uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.ideas i WHERE i.id = _idea AND ((i.team_id IS NULL AND i.user_id = auth.uid()) OR (i.team_id IS NOT NULL AND public.is_team_member(i.team_id)))) $$;
CREATE OR REPLACE FUNCTION public.can_edit_idea(_idea uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.ideas i WHERE i.id = _idea AND (i.user_id = auth.uid() AND (i.team_id IS NULL OR public.is_team_member(i.team_id)) OR (i.team_id IS NOT NULL AND public.is_team_admin(i.team_id)))) $$;

DROP POLICY "own ideas" ON public.ideas;
CREATE POLICY "view ideas" ON public.ideas FOR SELECT TO authenticated USING ((team_id IS NULL AND user_id = auth.uid()) OR (team_id IS NOT NULL AND public.is_team_member(team_id)));
CREATE POLICY "add ideas" ON public.ideas FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND (team_id IS NULL OR public.is_team_member(team_id)));
CREATE POLICY "edit ideas" ON public.ideas FOR UPDATE TO authenticated USING (public.can_edit_idea(id)) WITH CHECK ((team_id IS NULL AND user_id = auth.uid()) OR (team_id IS NOT NULL AND public.is_team_member(team_id)));
CREATE POLICY "delete ideas" ON public.ideas FOR DELETE TO authenticated USING (public.can_edit_idea(id));

DROP POLICY "own themes" ON public.themes;
CREATE POLICY "view themes" ON public.themes FOR SELECT TO authenticated USING ((team_id IS NULL AND user_id = auth.uid()) OR (team_id IS NOT NULL AND public.is_team_member(team_id)));
CREATE POLICY "add themes" ON public.themes FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND (team_id IS NULL OR public.is_team_member(team_id)));
CREATE POLICY "edit themes" ON public.themes FOR UPDATE TO authenticated USING ((team_id IS NULL AND user_id = auth.uid()) OR (team_id IS NOT NULL AND public.is_team_admin(team_id)));
CREATE POLICY "delete themes" ON public.themes FOR DELETE TO authenticated USING ((team_id IS NULL AND user_id = auth.uid()) OR (team_id IS NOT NULL AND public.is_team_admin(team_id)));

DROP POLICY "own items" ON public.action_items;
CREATE POLICY "view items" ON public.action_items FOR SELECT TO authenticated USING (public.can_view_idea(idea_id));
CREATE POLICY "add items" ON public.action_items FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND public.can_edit_idea(idea_id));
CREATE POLICY "check items" ON public.action_items FOR UPDATE TO authenticated USING (public.can_view_idea(idea_id)) WITH CHECK (public.can_view_idea(idea_id));
CREATE POLICY "delete items" ON public.action_items FOR DELETE TO authenticated USING (public.can_edit_idea(idea_id));

CREATE TABLE public.idea_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  idea_id uuid NOT NULL REFERENCES public.ideas(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  body text NOT NULL CHECK (length(body) BETWEEN 1 AND 4000),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.idea_comments TO authenticated;
GRANT ALL ON public.idea_comments TO service_role;
ALTER TABLE public.idea_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "view comments" ON public.idea_comments FOR SELECT TO authenticated USING (public.can_view_idea(idea_id));
CREATE POLICY "add comments" ON public.idea_comments FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND public.can_view_idea(idea_id));
CREATE POLICY "delete own comments" ON public.idea_comments FOR DELETE TO authenticated USING (user_id = auth.uid() OR public.can_edit_idea(idea_id));