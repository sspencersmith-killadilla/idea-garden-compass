-- Common Ground database schema. Run once on a fresh Supabase project (SQL editor or psql).
set check_function_bodies = off;

create table public.profiles (id uuid not null, inbound_token text default substr(md5(gen_random_uuid()::text),1,10) not null, created_at timestamptz default now() not null, display_name text);
create table public.teams (id uuid default gen_random_uuid() not null, name text not null, kind text default 'team' not null, invite_code text default substr(md5(gen_random_uuid()::text),1,12) not null, created_by uuid not null, created_at timestamptz default now() not null);
create table public.team_members (team_id uuid not null, user_id uuid not null, role text default 'member' not null, created_at timestamptz default now() not null);
create table public.themes (id uuid default gen_random_uuid() not null, user_id uuid not null, name text not null, hue integer default 30 not null, created_at timestamptz default now() not null, team_id uuid);
create table public.ideas (id uuid default gen_random_uuid() not null, user_id uuid not null, raw_text text not null, title text, summary text, tags text[] default '{}' not null, source text default 'web' not null, status text default 'pending' not null, theme_id uuid, created_at timestamptz default now() not null, search tsvector generated always as (to_tsvector('english', coalesce(title,'') || ' ' || coalesce(summary,'') || ' ' || raw_text)) stored, team_id uuid, share_token text);
create table public.action_items (id uuid default gen_random_uuid() not null, user_id uuid not null, idea_id uuid not null, text text not null, done boolean default false not null, created_at timestamptz default now() not null);
create table public.idea_comments (id uuid default gen_random_uuid() not null, idea_id uuid not null, user_id uuid not null, body text not null, created_at timestamptz default now() not null);

alter table public.action_items add constraint action_items_pkey PRIMARY KEY (id);
alter table public.idea_comments add constraint idea_comments_body_check CHECK (((length(body) >= 1) AND (length(body) <= 4000)));
alter table public.idea_comments add constraint idea_comments_pkey PRIMARY KEY (id);
alter table public.ideas add constraint ideas_pkey PRIMARY KEY (id);
alter table public.ideas add constraint ideas_share_token_key UNIQUE (share_token);
alter table public.profiles add constraint profiles_inbound_token_key UNIQUE (inbound_token);
alter table public.profiles add constraint profiles_pkey PRIMARY KEY (id);
alter table public.team_members add constraint team_members_pkey PRIMARY KEY (team_id, user_id);
alter table public.team_members add constraint team_members_role_check CHECK ((role = ANY (ARRAY['admin'::text, 'member'::text])));
alter table public.teams add constraint teams_invite_code_key UNIQUE (invite_code);
alter table public.teams add constraint teams_pkey PRIMARY KEY (id);
alter table public.themes add constraint themes_pkey PRIMARY KEY (id);
alter table public.action_items add constraint action_items_idea_id_fkey FOREIGN KEY (idea_id) REFERENCES ideas(id) ON DELETE CASCADE;
alter table public.idea_comments add constraint idea_comments_idea_id_fkey FOREIGN KEY (idea_id) REFERENCES ideas(id) ON DELETE CASCADE;
alter table public.ideas add constraint ideas_team_id_fkey FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE;
alter table public.ideas add constraint ideas_theme_id_fkey FOREIGN KEY (theme_id) REFERENCES themes(id) ON DELETE SET NULL;
alter table public.profiles add constraint profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.team_members add constraint team_members_team_id_fkey FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE;
alter table public.themes add constraint themes_team_id_fkey FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE;

CREATE INDEX ideas_user_idx ON public.ideas USING btree (user_id, created_at DESC);
CREATE INDEX ideas_search_idx ON public.ideas USING gin (search);
CREATE INDEX ideas_team_idx ON public.ideas USING btree (team_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.create_team(_name text, _kind text DEFAULT 'team'::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE tid uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not signed in'; END IF;
  IF length(trim(_name)) < 1 OR length(_name) > 80 THEN RAISE EXCEPTION 'invalid name'; END IF;
  INSERT INTO public.teams (name, kind, created_by) VALUES (trim(_name), CASE WHEN _kind IN ('department','project','team') THEN _kind ELSE 'team' END, auth.uid()) RETURNING id INTO tid;
  INSERT INTO public.team_members (team_id, user_id, role) VALUES (tid, auth.uid(), 'admin');
  RETURN tid;
END; $function$;

CREATE OR REPLACE FUNCTION public.can_view_idea(_idea uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (SELECT 1 FROM public.ideas i WHERE i.id = _idea AND ((i.team_id IS NULL AND i.user_id = auth.uid()) OR (i.team_id IS NOT NULL AND public.is_team_member(i.team_id)))) $function$;

CREATE OR REPLACE FUNCTION public.can_edit_idea(_idea uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (SELECT 1 FROM public.ideas i WHERE i.id = _idea AND (i.user_id = auth.uid() AND (i.team_id IS NULL OR public.is_team_member(i.team_id)) OR (i.team_id IS NOT NULL AND public.is_team_admin(i.team_id)))) $function$;

CREATE OR REPLACE FUNCTION public.get_public_idea(_token text)
 RETURNS json
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT json_build_object(
    'title', i.title, 'summary', i.summary, 'raw_text', i.raw_text, 'tags', i.tags, 'created_at', i.created_at,
    'theme_name', t.name, 'theme_hue', t.hue,
    'items', coalesce((SELECT json_agg(json_build_object('text', a.text, 'done', a.done) ORDER BY a.created_at) FROM public.action_items a WHERE a.idea_id = i.id), '[]'::json)
  )
  FROM public.ideas i LEFT JOIN public.themes t ON t.id = i.theme_id
  WHERE _token IS NOT NULL AND length(_token) >= 16 AND i.share_token = _token
$function$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, coalesce(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email,'@',1)))
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END; $function$;

CREATE OR REPLACE FUNCTION public.is_team_member(_team uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (SELECT 1 FROM public.team_members WHERE team_id = _team AND user_id = auth.uid()) $function$;

CREATE OR REPLACE FUNCTION public.is_team_admin(_team uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (SELECT 1 FROM public.team_members WHERE team_id = _team AND user_id = auth.uid() AND role = 'admin') $function$;

CREATE OR REPLACE FUNCTION public.shares_team(_other uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (SELECT 1 FROM public.team_members a JOIN public.team_members b ON a.team_id = b.team_id WHERE a.user_id = auth.uid() AND b.user_id = _other) $function$;

CREATE OR REPLACE FUNCTION public.join_team(_code text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE tid uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not signed in'; END IF;
  SELECT id INTO tid FROM public.teams WHERE invite_code = _code;
  IF tid IS NULL THEN RAISE EXCEPTION 'invalid invite'; END IF;
  INSERT INTO public.team_members (team_id, user_id, role) VALUES (tid, auth.uid(), 'member') ON CONFLICT DO NOTHING;
  RETURN tid;
END; $function$;

create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

alter table public.action_items enable row level security;
grant select, insert, update, delete on public.action_items to authenticated;
alter table public.idea_comments enable row level security;
grant select, insert, update, delete on public.idea_comments to authenticated;
alter table public.ideas enable row level security;
grant select, insert, update, delete on public.ideas to authenticated;
alter table public.profiles enable row level security;
grant select, insert, update, delete on public.profiles to authenticated;
alter table public.team_members enable row level security;
grant select, insert, update, delete on public.team_members to authenticated;
alter table public.teams enable row level security;
grant select, insert, update, delete on public.teams to authenticated;
alter table public.themes enable row level security;
grant select, insert, update, delete on public.themes to authenticated;

create policy "teammates profiles" on public.profiles for select to authenticated using (shares_team(id));
create policy "own profile" on public.profiles for select to authenticated using ((auth.uid() = id));
create policy "delete themes" on public.themes for delete to authenticated using ((((team_id IS NULL) AND (user_id = auth.uid())) OR ((team_id IS NOT NULL) AND is_team_admin(team_id))));
create policy "edit themes" on public.themes for update to authenticated using ((((team_id IS NULL) AND (user_id = auth.uid())) OR ((team_id IS NOT NULL) AND is_team_admin(team_id))));
create policy "add themes" on public.themes for insert to authenticated with check (((user_id = auth.uid()) AND ((team_id IS NULL) OR is_team_member(team_id))));
create policy "view themes" on public.themes for select to authenticated using ((((team_id IS NULL) AND (user_id = auth.uid())) OR ((team_id IS NOT NULL) AND is_team_member(team_id))));
create policy "delete items" on public.action_items for delete to authenticated using (can_edit_idea(idea_id));
create policy "check items" on public.action_items for update to authenticated using (can_view_idea(idea_id)) with check (can_view_idea(idea_id));
create policy "add items" on public.action_items for insert to authenticated with check (((user_id = auth.uid()) AND can_edit_idea(idea_id)));
create policy "view items" on public.action_items for select to authenticated using (can_view_idea(idea_id));
create policy "delete ideas" on public.ideas for delete to authenticated using (can_edit_idea(id));
create policy "edit ideas" on public.ideas for update to authenticated using (can_edit_idea(id)) with check ((((team_id IS NULL) AND (user_id = auth.uid())) OR ((team_id IS NOT NULL) AND is_team_member(team_id))));
create policy "add ideas" on public.ideas for insert to authenticated with check (((user_id = auth.uid()) AND ((team_id IS NULL) OR is_team_member(team_id))));
create policy "view ideas" on public.ideas for select to authenticated using ((((team_id IS NULL) AND (user_id = auth.uid())) OR ((team_id IS NOT NULL) AND is_team_member(team_id))));
create policy "admins delete team" on public.teams for delete to authenticated using (is_team_admin(id));
create policy "admins update team" on public.teams for update to authenticated using (is_team_admin(id)) with check (is_team_admin(id));
create policy "members read team" on public.teams for select to authenticated using (is_team_member(id));
create policy "admins remove or self leave" on public.team_members for delete to authenticated using ((is_team_admin(team_id) OR (user_id = auth.uid())));
create policy "admins change roles" on public.team_members for update to authenticated using (is_team_admin(team_id)) with check (is_team_admin(team_id));
create policy "members read roster" on public.team_members for select to authenticated using (is_team_member(team_id));
create policy "delete own comments" on public.idea_comments for delete to authenticated using (((user_id = auth.uid()) OR can_edit_idea(idea_id)));
create policy "add comments" on public.idea_comments for insert to authenticated with check (((user_id = auth.uid()) AND can_view_idea(idea_id)));
create policy "view comments" on public.idea_comments for select to authenticated using (can_view_idea(idea_id));
grant execute on function public.get_public_idea(text) to anon, authenticated;
grant execute on function public.create_team(text,text), public.join_team(text) to authenticated;
CREATE TABLE public.team_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  email text NOT NULL,
  token text NOT NULL UNIQUE DEFAULT encode(extensions.gen_random_bytes(18), 'hex'),
  invited_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT now() + interval '14 days',
  accepted_at timestamptz,
  accepted_by uuid
);
CREATE INDEX team_invites_team_idx ON public.team_invites(team_id);
GRANT SELECT, INSERT, DELETE ON public.team_invites TO authenticated;
GRANT ALL ON public.team_invites TO service_role;
ALTER TABLE public.team_invites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins view invites" ON public.team_invites FOR SELECT TO authenticated USING (public.is_team_admin(team_id));
CREATE POLICY "admins create invites" ON public.team_invites FOR INSERT TO authenticated WITH CHECK (public.is_team_admin(team_id) AND invited_by = auth.uid() AND email = lower(trim(email)) AND accepted_at IS NULL);
CREATE POLICY "admins delete invites" ON public.team_invites FOR DELETE TO authenticated USING (public.is_team_admin(team_id));

CREATE OR REPLACE FUNCTION public.get_invite(_token text)
RETURNS TABLE(team_name text, email text, status text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT t.name, i.email,
    CASE WHEN i.accepted_at IS NOT NULL THEN 'accepted' WHEN i.expires_at < now() THEN 'expired' ELSE 'pending' END
  FROM public.team_invites i JOIN public.teams t ON t.id = i.team_id WHERE i.token = _token;
$$;
REVOKE ALL ON FUNCTION public.get_invite(text) FROM public;
GRANT EXECUTE ON FUNCTION public.get_invite(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.accept_invite(_token text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE inv public.team_invites;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not signed in'; END IF;
  SELECT * INTO inv FROM public.team_invites WHERE token = _token FOR UPDATE;
  IF inv.id IS NULL THEN RAISE EXCEPTION 'invalid invite'; END IF;
  IF lower(coalesce(auth.email(), '')) <> inv.email THEN RAISE EXCEPTION 'wrong email'; END IF;
  IF inv.accepted_at IS NOT NULL THEN
    IF inv.accepted_by = auth.uid() THEN RETURN inv.team_id; END IF;
    RAISE EXCEPTION 'invite already used';
  END IF;
  IF inv.expires_at < now() THEN RAISE EXCEPTION 'invite expired'; END IF;
  INSERT INTO public.team_members (team_id, user_id, role) VALUES (inv.team_id, auth.uid(), 'member') ON CONFLICT DO NOTHING;
  UPDATE public.team_invites SET accepted_at = now(), accepted_by = auth.uid() WHERE id = inv.id;
  RETURN inv.team_id;
END; $$;
REVOKE ALL ON FUNCTION public.accept_invite(text) FROM public;
GRANT EXECUTE ON FUNCTION public.accept_invite(text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.join_team(text) FROM public, anon, authenticated;
COMMENT ON FUNCTION public.join_team(text) IS 'DEPRECATED: replaced by personal invites (accept_invite)';
COMMENT ON COLUMN public.teams.invite_code IS 'DEPRECATED: shared invite links replaced by team_invites';