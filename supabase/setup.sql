-- ==============================================================================
-- PROJETO VYBE — SETUP COMPLETO DO SUPABASE
-- Execute este arquivo inteiro no SQL Editor do Supabase (Dashboard -> SQL Editor).
-- É idempotente: pode ser executado novamente sem perder dados.
--
-- Conteúdo:
--   1. Extensões e tipos
--   2. Tabelas
--   3. Funções auxiliares de permissão
--   4. Gatilhos (criação de perfil, proteção de campos, contadores, notificações)
--   5. Funções RPC chamadas pelo app
--   6. Row Level Security (RLS)
--   7. Storage (buckets e políticas)
--   8. Realtime
-- ==============================================================================

-- E-mail do superadministrador principal. Ele só recebe o papel depois de
-- confirmar o e-mail no Supabase Auth.
CREATE OR REPLACE FUNCTION public.primary_admin_email()
RETURNS TEXT LANGUAGE sql IMMUTABLE AS $$ SELECT 'tomsilvaconsignado@gmail.com'::text $$;

-- ==============================================================================
-- 1. TIPOS (gen_random_uuid() é nativo do Postgres 13+, sem extensão)
-- ==============================================================================
DO $$ BEGIN
  CREATE TYPE profile_type_enum AS ENUM ('couple', 'single_female', 'single_male', 'joint_profile', 'polyamorous');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE user_status_enum AS ENUM ('active', 'warned', 'restricted', 'suspended', 'blocked');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE location_privacy_enum AS ENUM ('city', 'approximate_region', 'hidden');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE album_visibility_enum AS ENUM ('public', 'connections_only', 'private_vault');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE admin_role_enum AS ENUM ('superadmin', 'moderator', 'support', 'auditor');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE moderation_status_enum AS ENUM ('approved', 'pending_review', 'flagged', 'removed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ==============================================================================
-- 2. TABELAS
-- ==============================================================================

-- Perfil público (visível para usuários autenticados)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username VARCHAR(50) UNIQUE NOT NULL,
  display_name VARCHAR(100) NOT NULL,
  profile_type profile_type_enum NOT NULL DEFAULT 'couple',
  city VARCHAR(100) NOT NULL DEFAULT '',
  state VARCHAR(50) NOT NULL DEFAULT '',
  location_privacy location_privacy_enum NOT NULL DEFAULT 'approximate_region',
  age INTEGER NOT NULL CHECK (age >= 18),
  gender VARCHAR(50),
  orientation VARCHAR(50),
  bio TEXT NOT NULL DEFAULT '',
  avatar_url TEXT NOT NULL DEFAULT '',
  cover_url TEXT NOT NULL DEFAULT '',
  interests TEXT[] NOT NULL DEFAULT '{}',
  status_text VARCHAR(160),
  discreet_mode_enabled BOOLEAN NOT NULL DEFAULT false,
  -- Campos controlados pela moderação (protegidos por gatilho)
  is_verified BOOLEAN NOT NULL DEFAULT false,
  verified_badge_type VARCHAR(50),
  verification_requested BOOLEAN NOT NULL DEFAULT false,
  status user_status_enum NOT NULL DEFAULT 'active',
  restrictions JSONB NOT NULL DEFAULT '{}',
  -- Contadores mantidos por gatilhos
  followers_count INTEGER NOT NULL DEFAULT 0,
  following_count INTEGER NOT NULL DEFAULT 0,
  connections_count INTEGER NOT NULL DEFAULT 0,
  posts_count INTEGER NOT NULL DEFAULT 0,
  last_active_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_profiles_city_state ON public.profiles(city, state);
CREATE INDEX IF NOT EXISTS idx_profiles_status ON public.profiles(status);

-- Dados sensíveis: apenas o próprio usuário e a moderação podem ler
CREATE TABLE IF NOT EXISTS public.profile_private (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  birthdate DATE,
  adult_declared_at TIMESTAMPTZ,
  terms_accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.joint_partners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  age INTEGER NOT NULL CHECK (age >= 18),
  gender VARCHAR(50) NOT NULL,
  orientation VARCHAR(50),
  consent_confirmed BOOLEAN NOT NULL DEFAULT true,
  avatar_url TEXT,
  bio TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_joint_partners_profile ON public.joint_partners(profile_id);

CREATE TABLE IF NOT EXISTS public.compatibility_preferences (
  profile_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  objectives TEXT[] NOT NULL DEFAULT '{}',
  interested_in TEXT[] NOT NULL DEFAULT '{}',
  age_range_min INTEGER NOT NULL DEFAULT 18,
  age_range_max INTEGER NOT NULL DEFAULT 60,
  max_distance_km INTEGER NOT NULL DEFAULT 50,
  meeting_preference VARCHAR(50) NOT NULL DEFAULT 'virtual_first',
  pace_preference VARCHAR(50) NOT NULL DEFAULT 'slow_chat',
  discretion_level VARCHAR(50) NOT NULL DEFAULT 'high',
  group_readiness VARCHAR(50) NOT NULL DEFAULT 'curious',
  personal_limits TEXT[] NOT NULL DEFAULT '{}',
  lifestyle_tags TEXT[] NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seguir (unilateral)
CREATE TABLE IF NOT EXISTS public.follows (
  follower_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  following_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (follower_id, following_id),
  CHECK (follower_id <> following_id)
);
CREATE INDEX IF NOT EXISTS idx_follows_following ON public.follows(following_id);

-- Conexões (bilateral: pedido + aceite)
CREATE TABLE IF NOT EXISTS public.connections (
  requester_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  addressee_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  responded_at TIMESTAMPTZ,
  PRIMARY KEY (requester_id, addressee_id),
  CHECK (requester_id <> addressee_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_connections_pair
  ON public.connections (LEAST(requester_id, addressee_id), GREATEST(requester_id, addressee_id));
CREATE INDEX IF NOT EXISTS idx_connections_addressee ON public.connections(addressee_id);

CREATE TABLE IF NOT EXISTS public.communities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(150) NOT NULL,
  slug VARCHAR(150) UNIQUE NOT NULL,
  description TEXT NOT NULL,
  cover_url TEXT NOT NULL,
  icon_url VARCHAR(20) NOT NULL DEFAULT '🍷',
  category VARCHAR(50) NOT NULL,
  rules TEXT[] NOT NULL DEFAULT '{}',
  is_private BOOLEAN NOT NULL DEFAULT false,
  members_count INTEGER NOT NULL DEFAULT 0,
  posts_count INTEGER NOT NULL DEFAULT 0,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.community_members (
  community_id UUID NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role VARCHAR(30) NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'moderator', 'member')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (community_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_community_members_user ON public.community_members(user_id);

CREATE TABLE IF NOT EXISTS public.posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  community_id UUID REFERENCES public.communities(id) ON DELETE CASCADE,
  content TEXT NOT NULL DEFAULT '',
  media_urls TEXT[] NOT NULL DEFAULT '{}',
  media_type VARCHAR(20) NOT NULL DEFAULT 'image',
  tags TEXT[] NOT NULL DEFAULT '{}',
  location VARCHAR(120),
  visibility VARCHAR(30) NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'connections_only')),
  moderation_status moderation_status_enum NOT NULL DEFAULT 'approved',
  likes_count INTEGER NOT NULL DEFAULT 0,
  comments_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_posts_user_id ON public.posts(user_id);
CREATE INDEX IF NOT EXISTS idx_posts_created_at ON public.posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_community ON public.posts(community_id);

-- Enquete: opções em JSON [{ "id": "opt_0", "text": "..." }]; votos contados em post_poll_votes
CREATE TABLE IF NOT EXISTS public.post_polls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID UNIQUE NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  options JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.post_poll_votes (
  poll_id UUID NOT NULL REFERENCES public.post_polls(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  option_id VARCHAR(50) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (poll_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.post_likes (
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.post_saves (
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.post_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL CHECK (length(trim(content)) > 0),
  likes_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_post_comments_post ON public.post_comments(post_id, created_at);

-- Álbuns e cofres privados
CREATE TABLE IF NOT EXISTS public.albums (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title VARCHAR(120) NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  cover_url TEXT NOT NULL DEFAULT '',
  visibility album_visibility_enum NOT NULL DEFAULT 'public',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_albums_user ON public.albums(user_id);

-- url: link público (bucket public-media). storage_path: caminho no bucket private-vaults
-- no formato "<owner_uid>/<album_id>/<arquivo>", lido via signed URL.
CREATE TABLE IF NOT EXISTS public.album_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  album_id UUID NOT NULL REFERENCES public.albums(id) ON DELETE CASCADE,
  url TEXT,
  storage_path TEXT,
  type VARCHAR(20) NOT NULL DEFAULT 'image',
  caption TEXT,
  blur_preview BOOLEAN NOT NULL DEFAULT true,
  moderation_status moderation_status_enum NOT NULL DEFAULT 'approved',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (url IS NOT NULL OR storage_path IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS idx_album_items_album ON public.album_items(album_id);

CREATE TABLE IF NOT EXISTS public.album_permissions (
  album_id UUID NOT NULL REFERENCES public.albums(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status VARCHAR(30) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'granted', 'revoked')),
  granted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (album_id, user_id)
);

-- Mensagens privadas
CREATE TABLE IF NOT EXISTS public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  is_pending_request BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.conversation_participants (
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  last_read_at TIMESTAMPTZ,
  is_muted BOOLEAN NOT NULL DEFAULT false,
  is_archived BOOLEAN NOT NULL DEFAULT false,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (conversation_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_conv_participants_user ON public.conversation_participants(user_id);

CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL DEFAULT '',
  media_url TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'delivered', 'read')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (length(trim(content)) > 0 OR media_url IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON public.messages(conversation_id, created_at);

CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,
  title VARCHAR(120) NOT NULL,
  message TEXT NOT NULL,
  reference_id VARCHAR(100),
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications(user_id, created_at DESC);

-- Denúncias
CREATE TABLE IF NOT EXISTS public.moderation_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reported_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  target_type VARCHAR(30) NOT NULL CHECK (target_type IN ('profile', 'post', 'media', 'message')),
  target_id VARCHAR(100) NOT NULL,
  category VARCHAR(50) NOT NULL,
  description TEXT NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'under_review', 'resolved', 'dismissed')),
  priority VARCHAR(20) NOT NULL DEFAULT 'medium' CHECK (priority IN ('urgent', 'high', 'medium', 'low')),
  reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  resolution_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_reports_status ON public.moderation_reports(status, priority);

-- Administração
CREATE TABLE IF NOT EXISTS public.admin_users (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  email VARCHAR(255) UNIQUE NOT NULL,
  role admin_role_enum NOT NULL DEFAULT 'moderator',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.admin_user_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  admin_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  note TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Livro de auditoria: sem políticas de UPDATE/DELETE, portanto imutável via API
CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES public.profiles(id),
  admin_role admin_role_enum NOT NULL,
  action VARCHAR(100) NOT NULL,
  target_id VARCHAR(100) NOT NULL,
  target_type VARCHAR(50) NOT NULL,
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_admin_logs_created ON public.admin_audit_logs(created_at DESC);

-- ==============================================================================
-- 3. FUNÇÕES AUXILIARES DE PERMISSÃO
-- Papéis administrativos exigem sessão com MFA (aal2).
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.admin_role_of(uid UUID)
RETURNS admin_role_enum
LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE AS $$
  SELECT role FROM public.admin_users WHERE user_id = uid;
$$;

CREATE OR REPLACE FUNCTION public.has_mfa_session()
RETURNS BOOLEAN LANGUAGE sql STABLE AS $$
  SELECT coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2';
$$;

CREATE OR REPLACE FUNCTION public.is_superadmin()
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE AS $$
  SELECT public.has_mfa_session() AND public.admin_role_of(auth.uid()) = 'superadmin';
$$;

CREATE OR REPLACE FUNCTION public.is_moderator()
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE AS $$
  SELECT public.has_mfa_session() AND public.admin_role_of(auth.uid()) IN ('superadmin', 'moderator');
$$;

-- Qualquer papel administrativo (inclui suporte e auditoria) — leitura do painel
CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE AS $$
  SELECT public.has_mfa_session() AND public.admin_role_of(auth.uid()) IS NOT NULL;
$$;

CREATE OR REPLACE FUNCTION public.are_connected(a UUID, b UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.connections
    WHERE status = 'accepted'
      AND ((requester_id = a AND addressee_id = b) OR (requester_id = b AND addressee_id = a))
  );
$$;

CREATE OR REPLACE FUNCTION public.is_conversation_participant(conv UUID, uid UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.conversation_participants
    WHERE conversation_id = conv AND user_id = uid
  );
$$;

CREATE OR REPLACE FUNCTION public.has_vault_access(album UUID, uid UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.album_permissions
    WHERE album_id = album AND user_id = uid AND status = 'granted'
  );
$$;

-- ==============================================================================
-- 4. GATILHOS
-- ==============================================================================

-- 4.1 Criação automática do perfil no cadastro (dados vêm de options.data do signUp)
CREATE OR REPLACE FUNCTION public.create_profile_for_user(new_user auth.users)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  meta JSONB := coalesce(new_user.raw_user_meta_data, '{}'::jsonb);
  v_birthdate DATE := nullif(meta ->> 'birthdate', '')::date;
  v_age INTEGER;
  v_username TEXT;
  v_partner JSONB;
BEGIN
  IF v_birthdate IS NULL OR v_birthdate > (current_date - INTERVAL '18 years') THEN
    RAISE EXCEPTION 'Cadastro permitido apenas para maiores de 18 anos.';
  END IF;

  v_age := coalesce(nullif(meta ->> 'age', '')::int, date_part('year', age(v_birthdate))::int);

  v_username := lower(regexp_replace(coalesce(meta ->> 'username', ''), '[^a-zA-Z0-9_]', '', 'g'));
  IF length(v_username) < 3 THEN
    v_username := 'user_' || substr(replace(new_user.id::text, '-', ''), 1, 8);
  END IF;
  IF EXISTS (SELECT 1 FROM public.profiles WHERE username = v_username) THEN
    v_username := left(v_username, 40) || '_' || substr(replace(new_user.id::text, '-', ''), 1, 6);
  END IF;

  INSERT INTO public.profiles (
    id, username, display_name, profile_type, city, state, location_privacy, age,
    gender, orientation, bio, avatar_url, cover_url, interests, verification_requested
  ) VALUES (
    new_user.id,
    v_username,
    coalesce(nullif(meta ->> 'display_name', ''), v_username),
    coalesce(nullif(meta ->> 'profile_type', ''), 'couple')::profile_type_enum,
    coalesce(meta ->> 'city', ''),
    coalesce(meta ->> 'state', ''),
    coalesce(nullif(meta ->> 'location_privacy', ''), 'approximate_region')::location_privacy_enum,
    greatest(v_age, 18),
    meta ->> 'gender',
    meta ->> 'orientation',
    coalesce(meta ->> 'bio', ''),
    coalesce(meta ->> 'avatar_url', ''),
    coalesce(meta ->> 'cover_url', ''),
    coalesce(ARRAY(SELECT jsonb_array_elements_text(meta -> 'interests')), '{}'),
    coalesce((meta ->> 'verification_requested')::boolean, false)
  );

  INSERT INTO public.profile_private (user_id, email, birthdate, adult_declared_at, terms_accepted_at)
  VALUES (new_user.id, new_user.email, v_birthdate, now(), now());

  IF jsonb_typeof(meta -> 'partners') = 'array' THEN
    FOR v_partner IN SELECT * FROM jsonb_array_elements(meta -> 'partners') LOOP
      INSERT INTO public.joint_partners (profile_id, name, age, gender, orientation, consent_confirmed)
      VALUES (
        new_user.id,
        coalesce(nullif(v_partner ->> 'name', ''), 'Parceiro'),
        greatest(coalesce((v_partner ->> 'age')::int, 18), 18),
        coalesce(v_partner ->> 'gender', ''),
        v_partner ->> 'orientation',
        coalesce((v_partner ->> 'consentConfirmed')::boolean, true)
      );
    END LOOP;
  END IF;

  INSERT INTO public.compatibility_preferences (
    profile_id, objectives, interested_in, age_range_min, age_range_max, max_distance_km,
    meeting_preference, pace_preference, discretion_level, group_readiness, personal_limits, lifestyle_tags
  ) VALUES (
    new_user.id,
    coalesce(ARRAY(SELECT jsonb_array_elements_text(meta #> '{prefs,objectives}')), '{}'),
    coalesce(ARRAY(SELECT jsonb_array_elements_text(meta #> '{prefs,interestedIn}')), '{}'),
    coalesce((meta #>> '{prefs,ageRange,0}')::int, 18),
    coalesce((meta #>> '{prefs,ageRange,1}')::int, 60),
    coalesce((meta #>> '{prefs,maxDistanceKm}')::int, 50),
    coalesce(meta #>> '{prefs,meetingPreference}', 'virtual_first'),
    coalesce(meta #>> '{prefs,pacePreference}', 'slow_chat'),
    coalesce(meta #>> '{prefs,discretionLevel}', 'high'),
    coalesce(meta #>> '{prefs,groupReadiness}', 'curious'),
    coalesce(ARRAY(SELECT jsonb_array_elements_text(meta #> '{prefs,personalLimits}')), '{}'),
    coalesce(ARRAY(SELECT jsonb_array_elements_text(meta #> '{prefs,lifestyleTags}')), '{}')
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_profile_for_user(auth.users) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.create_profile_for_user(NEW);
  RETURN NEW;
END;
$$;

-- Contas criadas antes deste script (sem perfil) recebem o perfil agora.
-- Cadastros sem data de nascimento válida (+18) são ignorados e listados no aviso.
DO $$
DECLARE u auth.users;
BEGIN
  FOR u IN SELECT * FROM auth.users WHERE id NOT IN (SELECT id FROM public.profiles) LOOP
    BEGIN
      PERFORM public.create_profile_for_user(u);
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Perfil não criado para %: %', u.email, SQLERRM;
    END;
  END LOOP;
END $$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 4.2 Superadmin principal: concedido somente após confirmação do e-mail
CREATE OR REPLACE FUNCTION public.grant_primary_admin()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.email_confirmed_at IS NOT NULL
     AND lower(NEW.email) = public.primary_admin_email()
     AND EXISTS (SELECT 1 FROM public.profiles WHERE id = NEW.id) THEN
    INSERT INTO public.admin_users (user_id, email, role)
    VALUES (NEW.id, lower(NEW.email), 'superadmin')
    ON CONFLICT (user_id) DO UPDATE SET role = 'superadmin';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_confirmed ON auth.users;
-- Nome escolhido para disparar depois de on_auth_user_created (gatilhos rodam em ordem alfabética)
DROP TRIGGER IF EXISTS on_auth_user_verified ON auth.users;
CREATE TRIGGER on_auth_user_verified
  AFTER INSERT OR UPDATE OF email_confirmed_at ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.grant_primary_admin();

-- Caso o superadmin já tenha se cadastrado e confirmado antes deste script
INSERT INTO public.admin_users (user_id, email, role)
SELECT u.id, lower(u.email), 'superadmin'
FROM auth.users u
JOIN public.profiles p ON p.id = u.id
WHERE lower(u.email) = public.primary_admin_email() AND u.email_confirmed_at IS NOT NULL
ON CONFLICT (user_id) DO UPDATE SET role = 'superadmin';

-- 4.3 Proteção dos campos controlados pela moderação.
-- Chamadas pela API rodam como 'authenticated'; gatilhos internos rodam como dono.
CREATE OR REPLACE FUNCTION public.protect_profile_fields()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF current_user = 'authenticated' AND NOT public.is_moderator() THEN
    NEW.id := OLD.id;
    NEW.username := OLD.username;
    NEW.is_verified := OLD.is_verified;
    NEW.verified_badge_type := OLD.verified_badge_type;
    NEW.status := OLD.status;
    NEW.restrictions := OLD.restrictions;
    NEW.followers_count := OLD.followers_count;
    NEW.following_count := OLD.following_count;
    NEW.connections_count := OLD.connections_count;
    NEW.posts_count := OLD.posts_count;
    NEW.created_at := OLD.created_at;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_profile_fields ON public.profiles;
CREATE TRIGGER protect_profile_fields
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_profile_fields();

CREATE OR REPLACE FUNCTION public.protect_post_fields()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF current_user = 'authenticated' AND NOT public.is_moderator() THEN
    NEW.user_id := OLD.user_id;
    NEW.likes_count := OLD.likes_count;
    NEW.comments_count := OLD.comments_count;
    NEW.moderation_status := OLD.moderation_status;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_post_fields ON public.posts;
CREATE TRIGGER protect_post_fields
  BEFORE UPDATE ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.protect_post_fields();

-- 4.4 Contadores
CREATE OR REPLACE FUNCTION public.bump_counters()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  d INTEGER := CASE WHEN TG_OP = 'INSERT' THEN 1 ELSE -1 END;
  r RECORD;
BEGIN
  IF TG_OP = 'INSERT' THEN r := NEW; ELSE r := OLD; END IF;

  IF TG_TABLE_NAME = 'post_likes' THEN
    UPDATE public.posts SET likes_count = greatest(likes_count + d, 0) WHERE id = r.post_id;
  ELSIF TG_TABLE_NAME = 'post_comments' THEN
    UPDATE public.posts SET comments_count = greatest(comments_count + d, 0) WHERE id = r.post_id;
  ELSIF TG_TABLE_NAME = 'community_members' THEN
    UPDATE public.communities SET members_count = greatest(members_count + d, 0) WHERE id = r.community_id;
  ELSIF TG_TABLE_NAME = 'follows' THEN
    UPDATE public.profiles SET followers_count = greatest(followers_count + d, 0) WHERE id = r.following_id;
    UPDATE public.profiles SET following_count = greatest(following_count + d, 0) WHERE id = r.follower_id;
  ELSIF TG_TABLE_NAME = 'posts' THEN
    UPDATE public.profiles SET posts_count = greatest(posts_count + d, 0) WHERE id = r.user_id;
    IF r.community_id IS NOT NULL THEN
      UPDATE public.communities SET posts_count = greatest(posts_count + d, 0) WHERE id = r.community_id;
    END IF;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS count_post_likes ON public.post_likes;
CREATE TRIGGER count_post_likes AFTER INSERT OR DELETE ON public.post_likes
  FOR EACH ROW EXECUTE FUNCTION public.bump_counters();
DROP TRIGGER IF EXISTS count_post_comments ON public.post_comments;
CREATE TRIGGER count_post_comments AFTER INSERT OR DELETE ON public.post_comments
  FOR EACH ROW EXECUTE FUNCTION public.bump_counters();
DROP TRIGGER IF EXISTS count_community_members ON public.community_members;
CREATE TRIGGER count_community_members AFTER INSERT OR DELETE ON public.community_members
  FOR EACH ROW EXECUTE FUNCTION public.bump_counters();
DROP TRIGGER IF EXISTS count_follows ON public.follows;
CREATE TRIGGER count_follows AFTER INSERT OR DELETE ON public.follows
  FOR EACH ROW EXECUTE FUNCTION public.bump_counters();
DROP TRIGGER IF EXISTS count_posts ON public.posts;
CREATE TRIGGER count_posts AFTER INSERT OR DELETE ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.bump_counters();

-- Conexões aceitas contam para ambos os lados
CREATE OR REPLACE FUNCTION public.count_connections()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.status <> 'accepted' AND NEW.status = 'accepted' THEN
    UPDATE public.profiles SET connections_count = connections_count + 1
    WHERE id IN (NEW.requester_id, NEW.addressee_id);
  ELSIF TG_OP = 'DELETE' AND OLD.status = 'accepted' THEN
    UPDATE public.profiles SET connections_count = greatest(connections_count - 1, 0)
    WHERE id IN (OLD.requester_id, OLD.addressee_id);
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS count_connections ON public.connections;
CREATE TRIGGER count_connections AFTER UPDATE OR DELETE ON public.connections
  FOR EACH ROW EXECUTE FUNCTION public.count_connections();

-- 4.5 Notificações automáticas
CREATE OR REPLACE FUNCTION public.notify(
  p_user UUID, p_actor UUID, p_type TEXT, p_title TEXT, p_message TEXT, p_ref TEXT
) RETURNS VOID LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO public.notifications (user_id, actor_id, type, title, message, reference_id)
  SELECT p_user, p_actor, p_type, p_title, p_message, p_ref
  WHERE p_user IS DISTINCT FROM p_actor;
$$;

CREATE OR REPLACE FUNCTION public.notify_on_activity()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  actor_name TEXT;
  owner UUID;
BEGIN
  IF TG_TABLE_NAME = 'post_likes' THEN
    SELECT display_name INTO actor_name FROM public.profiles WHERE id = NEW.user_id;
    SELECT user_id INTO owner FROM public.posts WHERE id = NEW.post_id;
    PERFORM public.notify(owner, NEW.user_id, 'like', 'Nova curtida',
      actor_name || ' curtiu sua publicação.', NEW.post_id::text);

  ELSIF TG_TABLE_NAME = 'post_comments' THEN
    SELECT display_name INTO actor_name FROM public.profiles WHERE id = NEW.user_id;
    SELECT user_id INTO owner FROM public.posts WHERE id = NEW.post_id;
    PERFORM public.notify(owner, NEW.user_id, 'comment', 'Novo comentário',
      actor_name || ' comentou: ' || left(NEW.content, 80), NEW.post_id::text);

  ELSIF TG_TABLE_NAME = 'connections' THEN
    IF TG_OP = 'INSERT' THEN
      SELECT display_name INTO actor_name FROM public.profiles WHERE id = NEW.requester_id;
      PERFORM public.notify(NEW.addressee_id, NEW.requester_id, 'connection_request',
        'Pedido de conexão', actor_name || ' quer se conectar com você.', NEW.requester_id::text);
    ELSIF OLD.status <> 'accepted' AND NEW.status = 'accepted' THEN
      SELECT display_name INTO actor_name FROM public.profiles WHERE id = NEW.addressee_id;
      PERFORM public.notify(NEW.requester_id, NEW.addressee_id, 'connection_accepted',
        'Conexão aceita', actor_name || ' aceitou sua conexão.', NEW.addressee_id::text);
    END IF;

  ELSIF TG_TABLE_NAME = 'album_permissions' THEN
    SELECT user_id INTO owner FROM public.albums WHERE id = NEW.album_id;
    IF TG_OP = 'INSERT' THEN
      SELECT display_name INTO actor_name FROM public.profiles WHERE id = NEW.user_id;
      PERFORM public.notify(owner, NEW.user_id, 'vault_access_request', 'Pedido de acesso ao cofre',
        actor_name || ' pediu acesso ao seu cofre privado.', NEW.album_id::text);
    ELSIF OLD.status <> 'granted' AND NEW.status = 'granted' THEN
      SELECT display_name INTO actor_name FROM public.profiles WHERE id = owner;
      PERFORM public.notify(NEW.user_id, owner, 'vault_access_granted', 'Acesso liberado',
        actor_name || ' liberou acesso ao cofre privado.', NEW.album_id::text);
    END IF;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS notify_post_likes ON public.post_likes;
CREATE TRIGGER notify_post_likes AFTER INSERT ON public.post_likes
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_activity();
DROP TRIGGER IF EXISTS notify_post_comments ON public.post_comments;
CREATE TRIGGER notify_post_comments AFTER INSERT ON public.post_comments
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_activity();
DROP TRIGGER IF EXISTS notify_connections ON public.connections;
CREATE TRIGGER notify_connections AFTER INSERT OR UPDATE ON public.connections
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_activity();
DROP TRIGGER IF EXISTS notify_album_permissions ON public.album_permissions;
CREATE TRIGGER notify_album_permissions AFTER INSERT OR UPDATE ON public.album_permissions
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_activity();

-- 4.6 Conversa sobe na lista ao receber mensagem
CREATE OR REPLACE FUNCTION public.touch_conversation()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.conversations SET updated_at = now() WHERE id = NEW.conversation_id;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS touch_conversation ON public.messages;
CREATE TRIGGER touch_conversation AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.touch_conversation();

-- ==============================================================================
-- 5. FUNÇÕES RPC (chamadas pelo app com supabase.rpc)
-- ==============================================================================

-- Abre conversa 1:1 existente ou cria uma nova como pedido de mensagem
CREATE OR REPLACE FUNCTION public.start_conversation(target UUID)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  me UUID := auth.uid();
  conv UUID;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'Não autenticado.'; END IF;
  IF target = me THEN RAISE EXCEPTION 'Não é possível conversar consigo mesmo.'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = target AND status NOT IN ('blocked', 'suspended')) THEN
    RAISE EXCEPTION 'Perfil indisponível.';
  END IF;

  SELECT a.conversation_id INTO conv
  FROM public.conversation_participants a
  JOIN public.conversation_participants b ON b.conversation_id = a.conversation_id
  WHERE a.user_id = me AND b.user_id = target
  LIMIT 1;

  IF conv IS NULL THEN
    INSERT INTO public.conversations (created_by, is_pending_request)
    VALUES (me, NOT public.are_connected(me, target))
    RETURNING id INTO conv;
    INSERT INTO public.conversation_participants (conversation_id, user_id)
    VALUES (conv, me), (conv, target);
  END IF;

  RETURN conv;
END;
$$;

-- Destinatário aceita o pedido de mensagem
CREATE OR REPLACE FUNCTION public.accept_message_request(conv UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.conversations
  SET is_pending_request = false, updated_at = now()
  WHERE id = conv
    AND created_by IS DISTINCT FROM auth.uid()
    AND public.is_conversation_participant(conv, auth.uid());
END;
$$;

-- Marca a conversa como lida para o usuário atual
CREATE OR REPLACE FUNCTION public.mark_conversation_read(conv UUID)
RETURNS VOID
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.conversation_participants
  SET last_read_at = now()
  WHERE conversation_id = conv AND user_id = auth.uid();
  UPDATE public.messages
  SET status = 'read'
  WHERE conversation_id = conv AND sender_id <> auth.uid() AND status <> 'read'
    AND public.is_conversation_participant(conv, auth.uid());
$$;

-- Exclusão definitiva da própria conta (LGPD art. 18, VI). Apaga o usuário do Auth;
-- perfil, posts, mensagens, álbuns etc. são removidos em cascata.
-- Arquivos do Storage são apagados pelo app antes de chamar esta função.
CREATE OR REPLACE FUNCTION public.delete_own_account()
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Não autenticado.'; END IF;
  IF public.admin_role_of(auth.uid()) IS NOT NULL THEN
    RAISE EXCEPTION 'Contas administrativas não podem ser excluídas pelo app. Remova o papel em admin_users primeiro.';
  END IF;
  DELETE FROM auth.users WHERE id = auth.uid();
END;
$$;

-- ==============================================================================
-- 5.1 PAINEL ADMINISTRATIVO
-- Toda ação valida o papel (com MFA) e grava no livro de auditoria na mesma transação.
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.admin_log(p_action TEXT, p_target_id TEXT, p_target_type TEXT, p_reason TEXT)
RETURNS VOID LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO public.admin_audit_logs (admin_id, admin_role, action, target_id, target_type, reason)
  VALUES (auth.uid(), public.admin_role_of(auth.uid()), p_action, p_target_id, p_target_type, p_reason);
$$;
REVOKE EXECUTE ON FUNCTION public.admin_log(TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.require_moderator(p_reason TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_moderator() THEN
    RAISE EXCEPTION 'Acesso negado: requer papel de moderação com MFA ativo.';
  END IF;
  IF p_reason IS NULL OR length(trim(p_reason)) < 5 THEN
    RAISE EXCEPTION 'Informe uma justificativa (mínimo 5 caracteres).';
  END IF;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.require_moderator(TEXT) FROM PUBLIC, anon, authenticated;

-- Lista de usuários com dados privados (somente equipe administrativa)
CREATE OR REPLACE FUNCTION public.admin_list_users()
RETURNS TABLE (
  id UUID, username TEXT, display_name TEXT, email TEXT, birthdate DATE,
  profile_type profile_type_enum, city TEXT, state TEXT, age INTEGER,
  status user_status_enum, is_verified BOOLEAN, verified_badge_type TEXT,
  verification_requested BOOLEAN, restrictions JSONB, avatar_url TEXT, cover_url TEXT,
  created_at TIMESTAMPTZ, last_active_at TIMESTAMPTZ, posts_count INTEGER,
  albums_count BIGINT, reports_received BIGINT, admin_role admin_role_enum
)
LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE AS $$
  SELECT p.id, p.username::text, p.display_name::text, pp.email::text, pp.birthdate,
         p.profile_type, p.city::text, p.state::text, p.age,
         p.status, p.is_verified, p.verified_badge_type::text,
         p.verification_requested, p.restrictions, p.avatar_url, p.cover_url,
         p.created_at, p.last_active_at, p.posts_count,
         (SELECT count(*) FROM public.albums a WHERE a.user_id = p.id),
         (SELECT count(*) FROM public.moderation_reports r WHERE r.reported_user_id = p.id),
         au.role
  FROM public.profiles p
  LEFT JOIN public.profile_private pp ON pp.user_id = p.id
  LEFT JOIN public.admin_users au ON au.user_id = p.id
  WHERE public.is_staff()
  ORDER BY p.created_at DESC;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_user_status(target UUID, new_status user_status_enum, reason TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.require_moderator(reason);
  IF public.admin_role_of(target) IS NOT NULL AND NOT public.is_superadmin() THEN
    RAISE EXCEPTION 'Somente o superadministrador altera contas da equipe.';
  END IF;
  IF target = auth.uid() THEN RAISE EXCEPTION 'Você não pode alterar o status da própria conta.'; END IF;
  UPDATE public.profiles SET status = new_status WHERE id = target;
  PERFORM public.admin_log('SET_USER_STATUS_' || upper(new_status::text), target::text, 'profile', reason);
  PERFORM public.notify(target, NULL, 'system_safety', 'Atualização da sua conta',
    CASE new_status
      WHEN 'active' THEN 'Sua conta está ativa e sem restrições.'
      WHEN 'warned' THEN 'Sua conta recebeu uma advertência da moderação. Revise as diretrizes da comunidade.'
      WHEN 'restricted' THEN 'Algumas funções da sua conta foram restringidas pela moderação.'
      WHEN 'suspended' THEN 'Sua conta foi suspensa pela moderação.'
      ELSE 'Sua conta foi bloqueada pela moderação.'
    END, NULL);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_restrictions(target UUID, new_restrictions JSONB, reason TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE any_active BOOLEAN;
BEGIN
  PERFORM public.require_moderator(reason);
  IF target = auth.uid() THEN RAISE EXCEPTION 'Você não pode restringir a própria conta.'; END IF;
  any_active := coalesce((new_restrictions ->> 'cannotPost')::boolean, false)
             OR coalesce((new_restrictions ->> 'cannotMessage')::boolean, false)
             OR coalesce((new_restrictions ->> 'cannotRequestVault')::boolean, false);
  UPDATE public.profiles
  SET restrictions = new_restrictions,
      status = CASE
        WHEN any_active AND status IN ('active', 'warned') THEN 'restricted'::user_status_enum
        WHEN NOT any_active AND status = 'restricted' THEN 'active'::user_status_enum
        ELSE status END
  WHERE id = target;
  PERFORM public.admin_log(CASE WHEN any_active THEN 'APPLY_RESTRICTIONS' ELSE 'CLEAR_RESTRICTIONS' END,
    target::text, 'profile', reason || ' | ' || new_restrictions::text);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_verified(target UUID, verified BOOLEAN, badge TEXT, reason TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.require_moderator(reason);
  UPDATE public.profiles
  SET is_verified = verified,
      verified_badge_type = CASE WHEN verified THEN coalesce(badge, 'identity') ELSE NULL END,
      verification_requested = false
  WHERE id = target;
  PERFORM public.admin_log(CASE WHEN verified THEN 'APPROVE_VERIFIED_BADGE' ELSE 'REVOKE_VERIFIED_BADGE' END,
    target::text, 'profile', reason);
  IF verified THEN
    PERFORM public.notify(target, NULL, 'system_safety', 'Perfil verificado',
      'Seu perfil recebeu o selo de verificação do VYBE.', NULL);
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_add_note(target UUID, note TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.require_moderator(note);
  INSERT INTO public.admin_user_notes (user_id, admin_id, note) VALUES (target, auth.uid(), note);
  PERFORM public.admin_log('ADD_MODERATION_NOTE', target::text, 'profile', 'Nota interna registrada.');
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_resolve_report(report UUID, resolution TEXT, note TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.require_moderator(note);
  IF resolution NOT IN ('under_review', 'resolved', 'dismissed') THEN
    RAISE EXCEPTION 'Resolução inválida.';
  END IF;
  UPDATE public.moderation_reports
  SET status = resolution, reviewed_by = auth.uid(), resolution_note = note,
      resolved_at = CASE WHEN resolution = 'under_review' THEN NULL ELSE now() END
  WHERE id = report;
  PERFORM public.admin_log('REPORT_' || upper(resolution), report::text, 'moderation_report', note);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_moderate_post(post UUID, new_status moderation_status_enum, reason TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE owner UUID;
BEGIN
  PERFORM public.require_moderator(reason);
  UPDATE public.posts SET moderation_status = new_status WHERE id = post RETURNING user_id INTO owner;
  PERFORM public.admin_log('MODERATE_POST_' || upper(new_status::text), post::text, 'post', reason);
  IF new_status = 'removed' THEN
    PERFORM public.notify(owner, NULL, 'system_safety', 'Publicação removida',
      'Uma publicação sua foi removida por violar as diretrizes da comunidade.', post::text);
  END IF;
END;
$$;

-- Acesso a evidências: somente mensagens da conversa denunciada, com justificativa auditada
CREATE OR REPLACE FUNCTION public.admin_report_evidence(report UUID, justification TEXT)
RETURNS TABLE (message_id UUID, sender_id UUID, sender_name TEXT, content TEXT, media_url TEXT, created_at TIMESTAMPTZ)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
#variable_conflict use_column
DECLARE r public.moderation_reports;
BEGIN
  IF NOT public.is_moderator() THEN
    RAISE EXCEPTION 'Acesso negado: requer papel de moderação com MFA ativo.';
  END IF;
  IF justification IS NULL OR length(trim(justification)) < 10 THEN
    RAISE EXCEPTION 'A justificativa deve ter no mínimo 10 caracteres.';
  END IF;
  SELECT * INTO r FROM public.moderation_reports mr WHERE mr.id = report;
  IF r.id IS NULL OR r.target_type <> 'message' THEN
    RAISE EXCEPTION 'Denúncia não encontrada ou não se refere a mensagens.';
  END IF;
  -- O denunciante precisa ser participante da conversa denunciada
  IF NOT public.is_conversation_participant(r.target_id::uuid, r.reporter_user_id) THEN
    RAISE EXCEPTION 'A conversa denunciada não pertence ao denunciante.';
  END IF;

  PERFORM public.admin_log('INSPECT_REPORTED_CONVERSATION', report::text, 'moderation_report', justification);
  UPDATE public.moderation_reports SET status = 'under_review', reviewed_by = auth.uid()
  WHERE id = report AND status = 'pending';

  RETURN QUERY
  SELECT m.id, m.sender_id, p.display_name::text, m.content, m.media_url, m.created_at
  FROM public.messages m
  JOIN public.profiles p ON p.id = m.sender_id
  WHERE m.conversation_id = r.target_id::uuid
  ORDER BY m.created_at DESC
  LIMIT 200;
END;
$$;

-- Equipe: superadmin concede ou remove papéis
CREATE OR REPLACE FUNCTION public.admin_set_role(target UUID, new_role admin_role_enum, reason TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE target_email TEXT;
BEGIN
  IF NOT public.is_superadmin() THEN RAISE EXCEPTION 'Somente o superadministrador gerencia a equipe.'; END IF;
  IF target = auth.uid() THEN RAISE EXCEPTION 'Você não pode alterar o próprio papel.'; END IF;
  IF reason IS NULL OR length(trim(reason)) < 5 THEN RAISE EXCEPTION 'Informe uma justificativa.'; END IF;
  IF new_role IS NULL THEN
    DELETE FROM public.admin_users WHERE user_id = target;
    PERFORM public.admin_log('REVOKE_ADMIN_ROLE', target::text, 'profile', reason);
  ELSE
    SELECT email INTO target_email FROM public.profile_private WHERE user_id = target;
    INSERT INTO public.admin_users (user_id, email, role) VALUES (target, lower(target_email), new_role)
    ON CONFLICT (user_id) DO UPDATE SET role = new_role;
    PERFORM public.admin_log('GRANT_ADMIN_ROLE_' || upper(new_role::text), target::text, 'profile', reason);
  END IF;
END;
$$;

-- Quantidade de mídias por álbum (sem expor o conteúdo de cofres trancados)
CREATE OR REPLACE FUNCTION public.album_item_counts(owner UUID)
RETURNS TABLE (album_id UUID, item_count BIGINT)
LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE AS $fn$
  SELECT a.id, count(i.id)
  FROM public.albums a
  LEFT JOIN public.album_items i ON i.album_id = a.id AND i.moderation_status IN ('approved', 'pending_review')
  WHERE a.user_id = owner AND auth.uid() IS NOT NULL
  GROUP BY a.id;
$fn$;

-- ==============================================================================
-- 5.2 COMUNIDADES INICIAIS (contadores começam reais, em zero)
-- ==============================================================================
INSERT INTO public.communities (name, slug, description, cover_url, icon_url, category, rules)
VALUES
  ('Casais Liberais de São Paulo', 'casais-sp', 'Espaço exclusivo para casais da grande SP trocarem experiências, dicas de rooftops, lounges discretos e encontros sociais.', 'https://images.unsplash.com/photo-1517457373958-b7bdd4587205?w=800&auto=format&fit=crop&q=80', '🍷', 'regional', ARRAY['Respeito absoluto à privacidade e identidade dos membros.', 'Proibido postar conteúdo explícito no feed geral da comunidade.', 'Consentimento mútuo obrigatório em qualquer interação.', 'Não é permitida abordagem comercial ou spam.']::text[]),
  ('Iniciantes no Meio Liberal: Dúvidas & Diálogo', 'iniciantes-liberal', 'Para casais e pessoas solteiras que estão dando os primeiros passos no universo não-monogâmico com segurança emocional e respeito.', 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=800&auto=format&fit=crop&q=80', '🌱', 'beginners', ARRAY['Zero julgamento: todas as dúvidas sinceras são bem-vindas.', 'Sem mensagens privadas invasivas sem consentimento explícito.', 'Foco em comunicação não violenta e acordos de casal.']::text[]),
  ('Conexões a Três & Poliamor Ético', 'poliamor-etico', 'Debates sobre unicorn-hunting responsável, relações a três sem hierarquias tóxicas e desconstrução da posse.', 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=800&auto=format&fit=crop&q=80', '✨', 'lifestyle', ARRAY['Respeito prioritário à autonomia e bem-estar de pessoas solteiras.', 'Sem objetificação ou promessas irreais.', 'Comunicação clara de limites e expectativas.']::text[]),
  ('Festas & Noites Liberais Sofisticadas', 'festas-sofisticadas', 'Guia de eventos fechados, festas de máscaras, hotéis boutique liberais e encontros para quem valoriza discrição e elegância.', 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800&auto=format&fit=crop&q=80', '🎭', 'events', ARRAY['Proibido divulgar endereços exatos abertamente.', 'Dress code e etiqueta do meio devem ser observados.', 'O "Não" é definitivo em qualquer ambiente.']::text[])
ON CONFLICT (slug) DO NOTHING;

-- ==============================================================================
-- 6. ROW LEVEL SECURITY
-- ==============================================================================
DO $$
DECLARE t TEXT; pol TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'profiles', 'profile_private', 'joint_partners', 'compatibility_preferences', 'follows', 'connections',
    'communities', 'community_members', 'posts', 'post_polls', 'post_poll_votes', 'post_likes', 'post_saves',
    'post_comments', 'albums', 'album_items', 'album_permissions', 'conversations', 'conversation_participants',
    'messages', 'notifications', 'moderation_reports', 'admin_users', 'admin_user_notes', 'admin_audit_logs'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon', t);
    -- Remove políticas anteriores para permitir reexecução
    FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = t LOOP
      EXECUTE format('DROP POLICY %I ON public.%I', pol, t);
    END LOOP;
  END LOOP;
END $$;

GRANT EXECUTE ON FUNCTION public.start_conversation(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_message_request(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_conversation_read(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_own_account() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_users() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_user_status(UUID, user_status_enum, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_restrictions(UUID, JSONB, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_verified(UUID, BOOLEAN, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_add_note(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_resolve_report(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_moderate_post(UUID, moderation_status_enum, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_report_evidence(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_role(UUID, admin_role_enum, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.album_item_counts(UUID) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.delete_own_account() FROM PUBLIC, anon;

-- profiles
CREATE POLICY "profiles_select" ON public.profiles FOR SELECT TO authenticated
  USING (status <> 'blocked' OR id = auth.uid() OR public.is_staff());
CREATE POLICY "profiles_update" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid() OR public.is_moderator())
  WITH CHECK (id = auth.uid() OR public.is_moderator());
-- INSERT é feito somente pelo gatilho handle_new_user; DELETE via exclusão da conta no Auth.

-- profile_private
CREATE POLICY "profile_private_select" ON public.profile_private FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_staff());

-- joint_partners / compatibility_preferences
CREATE POLICY "joint_partners_select" ON public.joint_partners FOR SELECT TO authenticated USING (true);
CREATE POLICY "joint_partners_write" ON public.joint_partners FOR ALL TO authenticated
  USING (profile_id = auth.uid()) WITH CHECK (profile_id = auth.uid());

CREATE POLICY "prefs_select" ON public.compatibility_preferences FOR SELECT TO authenticated USING (true);
CREATE POLICY "prefs_write" ON public.compatibility_preferences FOR ALL TO authenticated
  USING (profile_id = auth.uid()) WITH CHECK (profile_id = auth.uid());

-- follows
CREATE POLICY "follows_select" ON public.follows FOR SELECT TO authenticated USING (true);
CREATE POLICY "follows_insert" ON public.follows FOR INSERT TO authenticated WITH CHECK (follower_id = auth.uid());
CREATE POLICY "follows_delete" ON public.follows FOR DELETE TO authenticated USING (follower_id = auth.uid());

-- connections
CREATE POLICY "connections_select" ON public.connections FOR SELECT TO authenticated
  USING (requester_id = auth.uid() OR addressee_id = auth.uid() OR status = 'accepted' OR public.is_staff());
CREATE POLICY "connections_insert" ON public.connections FOR INSERT TO authenticated
  WITH CHECK (requester_id = auth.uid() AND status = 'pending');
CREATE POLICY "connections_accept" ON public.connections FOR UPDATE TO authenticated
  USING (addressee_id = auth.uid()) WITH CHECK (addressee_id = auth.uid());
CREATE POLICY "connections_delete" ON public.connections FOR DELETE TO authenticated
  USING (requester_id = auth.uid() OR addressee_id = auth.uid());

-- communities
CREATE POLICY "communities_select" ON public.communities FOR SELECT TO authenticated USING (true);
CREATE POLICY "communities_manage" ON public.communities FOR ALL TO authenticated
  USING (public.is_moderator()) WITH CHECK (public.is_moderator());

CREATE POLICY "community_members_select" ON public.community_members FOR SELECT TO authenticated USING (true);
CREATE POLICY "community_members_join" ON public.community_members FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid() AND role = 'member'
    AND EXISTS (SELECT 1 FROM public.communities c WHERE c.id = community_id AND NOT c.is_private)
  );
CREATE POLICY "community_members_leave" ON public.community_members FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.is_moderator());

-- posts
CREATE POLICY "posts_select" ON public.posts FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_staff()
    OR (
      moderation_status IN ('approved', 'pending_review')
      AND (visibility = 'public' OR public.are_connected(user_id, auth.uid()))
    )
  );
CREATE POLICY "posts_insert" ON public.posts FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND coalesce((SELECT (restrictions ->> 'cannotPost')::boolean FROM public.profiles WHERE id = auth.uid()), false) = false
    AND (SELECT status FROM public.profiles WHERE id = auth.uid()) NOT IN ('suspended', 'blocked')
  );
CREATE POLICY "posts_update" ON public.posts FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.is_moderator());
CREATE POLICY "posts_delete" ON public.posts FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.is_moderator());

-- enquetes
CREATE POLICY "polls_select" ON public.post_polls FOR SELECT TO authenticated USING (true);
CREATE POLICY "polls_insert" ON public.post_polls FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.posts p WHERE p.id = post_id AND p.user_id = auth.uid()));
CREATE POLICY "poll_votes_select" ON public.post_poll_votes FOR SELECT TO authenticated USING (true);
CREATE POLICY "poll_votes_insert" ON public.post_poll_votes FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- curtidas, salvos, comentários
CREATE POLICY "likes_select" ON public.post_likes FOR SELECT TO authenticated USING (true);
CREATE POLICY "likes_insert" ON public.post_likes FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "likes_delete" ON public.post_likes FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE POLICY "saves_select" ON public.post_saves FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "saves_insert" ON public.post_saves FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "saves_delete" ON public.post_saves FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE POLICY "comments_select" ON public.post_comments FOR SELECT TO authenticated USING (true);
CREATE POLICY "comments_insert" ON public.post_comments FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "comments_delete" ON public.post_comments FOR DELETE TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_moderator()
    OR EXISTS (SELECT 1 FROM public.posts p WHERE p.id = post_id AND p.user_id = auth.uid())
  );

-- álbuns e cofres
CREATE POLICY "albums_select" ON public.albums FOR SELECT TO authenticated
  USING (
    visibility = 'public'
    OR visibility = 'private_vault'  -- capa/título do cofre são visíveis; itens não
    OR user_id = auth.uid()
    OR public.is_staff()
    OR (visibility = 'connections_only' AND public.are_connected(user_id, auth.uid()))
  );
CREATE POLICY "albums_write" ON public.albums FOR ALL TO authenticated
  USING (user_id = auth.uid() OR public.is_moderator())
  WITH CHECK (user_id = auth.uid() OR public.is_moderator());

CREATE POLICY "album_items_select" ON public.album_items FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.albums a
      WHERE a.id = album_id
        AND (
          a.user_id = auth.uid()
          OR public.is_staff()
          OR (moderation_status IN ('approved', 'pending_review') AND (
            a.visibility = 'public'
            OR (a.visibility = 'connections_only' AND public.are_connected(a.user_id, auth.uid()))
            OR (a.visibility = 'private_vault' AND public.has_vault_access(a.id, auth.uid()))
          ))
        )
    )
  );
CREATE POLICY "album_items_write" ON public.album_items FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.albums a WHERE a.id = album_id AND (a.user_id = auth.uid() OR public.is_moderator())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.albums a WHERE a.id = album_id AND (a.user_id = auth.uid() OR public.is_moderator())));

CREATE POLICY "album_permissions_select" ON public.album_permissions FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.albums a WHERE a.id = album_id AND a.user_id = auth.uid())
    OR public.is_staff()
  );
CREATE POLICY "album_permissions_request" ON public.album_permissions FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid() AND status = 'pending'
    AND coalesce((SELECT (restrictions ->> 'cannotRequestVault')::boolean FROM public.profiles WHERE id = auth.uid()), false) = false
    AND EXISTS (SELECT 1 FROM public.albums a WHERE a.id = album_id AND a.user_id <> auth.uid() AND a.visibility = 'private_vault')
  );
CREATE POLICY "album_permissions_owner_update" ON public.album_permissions FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.albums a WHERE a.id = album_id AND a.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.albums a WHERE a.id = album_id AND a.user_id = auth.uid()));
CREATE POLICY "album_permissions_delete" ON public.album_permissions FOR DELETE TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.albums a WHERE a.id = album_id AND a.user_id = auth.uid())
  );

-- conversas e mensagens (criação via RPC start_conversation)
CREATE POLICY "conversations_select" ON public.conversations FOR SELECT TO authenticated
  USING (public.is_conversation_participant(id, auth.uid()));

CREATE POLICY "conv_participants_select" ON public.conversation_participants FOR SELECT TO authenticated
  USING (public.is_conversation_participant(conversation_id, auth.uid()));
CREATE POLICY "conv_participants_update_own" ON public.conversation_participants FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "conv_participants_leave" ON public.conversation_participants FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- Moderação NÃO lê mensagens livremente: o acesso a evidências passará por
-- uma função auditada vinculada a uma denúncia (etapa do painel admin).
CREATE POLICY "messages_select" ON public.messages FOR SELECT TO authenticated
  USING (public.is_conversation_participant(conversation_id, auth.uid()));
-- Portão protetivo: enquanto o pedido não for aceito, só quem iniciou pode
-- escrever, e sem mídia.
CREATE POLICY "messages_insert" ON public.messages FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND public.is_conversation_participant(conversation_id, auth.uid())
    AND coalesce((SELECT (restrictions ->> 'cannotMessage')::boolean FROM public.profiles WHERE id = auth.uid()), false) = false
    AND EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = conversation_id
        AND (NOT c.is_pending_request OR (c.created_by = auth.uid() AND media_url IS NULL))
    )
  );

-- notificações
CREATE POLICY "notifications_select" ON public.notifications FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "notifications_update" ON public.notifications FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "notifications_delete" ON public.notifications FOR DELETE TO authenticated USING (user_id = auth.uid());

-- denúncias
CREATE POLICY "reports_insert" ON public.moderation_reports FOR INSERT TO authenticated
  WITH CHECK (reporter_user_id = auth.uid() AND status = 'pending' AND reviewed_by IS NULL);
CREATE POLICY "reports_select" ON public.moderation_reports FOR SELECT TO authenticated
  USING (reporter_user_id = auth.uid() OR public.is_staff());
CREATE POLICY "reports_update" ON public.moderation_reports FOR UPDATE TO authenticated
  USING (public.is_moderator()) WITH CHECK (public.is_moderator());

-- administração
CREATE POLICY "admin_users_select" ON public.admin_users FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_superadmin());
CREATE POLICY "admin_users_manage" ON public.admin_users FOR ALL TO authenticated
  USING (public.is_superadmin()) WITH CHECK (public.is_superadmin());

CREATE POLICY "admin_notes_select" ON public.admin_user_notes FOR SELECT TO authenticated USING (public.is_staff());
CREATE POLICY "admin_notes_insert" ON public.admin_user_notes FOR INSERT TO authenticated
  WITH CHECK (public.is_moderator() AND admin_id = auth.uid());

CREATE POLICY "audit_select" ON public.admin_audit_logs FOR SELECT TO authenticated USING (public.is_staff());
CREATE POLICY "audit_insert" ON public.admin_audit_logs FOR INSERT TO authenticated
  WITH CHECK (public.is_staff() AND admin_id = auth.uid() AND admin_role = public.admin_role_of(auth.uid()));

-- ==============================================================================
-- 7. STORAGE
-- Caminhos: public-media/<uid>/...   private-vaults/<owner_uid>/<album_id>/...
-- ==============================================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('public-media', 'public-media', true, 20971520,
        ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/quicktime'])
ON CONFLICT (id) DO UPDATE SET public = true, file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('private-vaults', 'private-vaults', false, 52428800,
        ARRAY['image/jpeg', 'image/png', 'image/webp', 'video/mp4'])
ON CONFLICT (id) DO UPDATE SET public = false, file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "vybe_public_media_read" ON storage.objects;
DROP POLICY IF EXISTS "vybe_public_media_insert" ON storage.objects;
DROP POLICY IF EXISTS "vybe_public_media_update" ON storage.objects;
DROP POLICY IF EXISTS "vybe_public_media_delete" ON storage.objects;
DROP POLICY IF EXISTS "vybe_vault_read" ON storage.objects;
DROP POLICY IF EXISTS "vybe_vault_insert" ON storage.objects;
DROP POLICY IF EXISTS "vybe_vault_delete" ON storage.objects;

CREATE POLICY "vybe_public_media_read" ON storage.objects FOR SELECT
  USING (bucket_id = 'public-media');
CREATE POLICY "vybe_public_media_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'public-media' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "vybe_public_media_update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'public-media' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "vybe_public_media_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'public-media' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "vybe_vault_read" ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'private-vaults' AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.is_moderator()
      OR EXISTS (
        SELECT 1 FROM public.albums a
        WHERE a.id::text = (storage.foldername(name))[2]
          AND a.user_id::text = (storage.foldername(name))[1]
          AND public.has_vault_access(a.id, auth.uid())
      )
    )
  );
CREATE POLICY "vybe_vault_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'private-vaults' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "vybe_vault_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'private-vaults' AND (storage.foldername(name))[1] = auth.uid()::text);

-- ==============================================================================
-- 8. REALTIME (mensagens e notificações ao vivo)
-- ==============================================================================
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['messages', 'notifications', 'conversations'] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;
