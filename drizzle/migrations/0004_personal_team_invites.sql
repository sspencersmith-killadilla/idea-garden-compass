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