-- ==============================================================================
-- PROJETO Vybelog — SETUP COMPLETO DO SUPABASE
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

-- Prefixo das URLs públicas do Storage deste projeto. Fotos de perfil, posts, stories,
-- álbuns e mensagens só aceitam links que comecem por aqui: um link externo deixaria
-- o dono do servidor registrar o IP de quem visualiza. Troque ao mudar de projeto.
CREATE OR REPLACE FUNCTION public.app_media_prefix()
RETURNS TEXT LANGUAGE sql IMMUTABLE AS $$
  SELECT 'https://efztrffuovqxmkodpbkx.supabase.co/storage/v1/object/public/public-media/'::text
$$;

CREATE OR REPLACE FUNCTION public.is_app_media_url(u TEXT)
RETURNS BOOLEAN LANGUAGE sql IMMUTABLE AS $$
  SELECT u IS NULL OR u = ''
    OR (left(u, length(public.app_media_prefix())) = public.app_media_prefix() AND position('..' IN u) = 0);
$$;

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
-- Troca do @usuário pela RPC change_username (no máximo uma vez a cada 7 dias)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS username_changed_at TIMESTAMPTZ;
-- Status "online" (ligado por padrão). Quem desliga não aparece online e também não vê
-- o status dos outros (regra aplicada na RPC online_users).
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS show_online_status BOOLEAN NOT NULL DEFAULT true;

-- Último sinal de vida de cada sessão aberta. Ninguém lê direto: só pelas RPCs de presença.
CREATE TABLE IF NOT EXISTS public.user_presence (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Dados sensíveis: apenas o próprio usuário e a moderação podem ler
CREATE TABLE IF NOT EXISTS public.profile_private (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  birthdate DATE,
  adult_declared_at TIMESTAMPTZ,
  terms_accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Localização real. Em profiles fica só o que a privacidade escolhida permite mostrar
-- (gatilho mask_profile_location), pois qualquer usuário logado lê aquela tabela.
ALTER TABLE public.profile_private ADD COLUMN IF NOT EXISTS city VARCHAR(100);
ALTER TABLE public.profile_private ADD COLUMN IF NOT EXISTS state VARCHAR(50);
UPDATE public.profile_private pp SET city = p.city, state = p.state
FROM public.profiles p
WHERE p.id = pp.user_id AND pp.city IS NULL;

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
-- Respostas da aba opcional de preferências do perfil (perguntas que o cadastro não faz)
ALTER TABLE public.compatibility_preferences ADD COLUMN IF NOT EXISTS extras JSONB NOT NULL DEFAULT '{}';
DO $$ BEGIN
  ALTER TABLE public.compatibility_preferences ADD CONSTRAINT compatibility_extras_shape
    CHECK (jsonb_typeof(extras) = 'object' AND octet_length(extras::text) < 4000);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

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

-- Bloqueio entre usuários: quem bloqueia some para o bloqueado e nenhum dos dois
-- consegue mais seguir, conectar, conversar ou pedir acesso a cofre do outro.
CREATE TABLE IF NOT EXISTS public.user_blocks (
  blocker_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  blocked_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (blocker_id, blocked_id),
  CHECK (blocker_id <> blocked_id)
);
CREATE INDEX IF NOT EXISTS idx_user_blocks_blocked ON public.user_blocks(blocked_id);

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

-- Stories (somem após 24h)
CREATE TABLE IF NOT EXISTS public.stories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  media_url TEXT NOT NULL,
  media_type VARCHAR(20) NOT NULL DEFAULT 'image' CHECK (media_type IN ('image', 'video')),
  caption VARCHAR(200),
  audience VARCHAR(20) NOT NULL DEFAULT 'all' CHECK (audience IN ('all', 'connections')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '24 hours')
);
CREATE INDEX IF NOT EXISTS idx_stories_user_active ON public.stories(user_id, expires_at DESC);

CREATE TABLE IF NOT EXISTS public.story_views (
  story_id UUID NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE,
  viewer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  viewed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (story_id, viewer_id)
);

-- Eventos liberais (publicados após aprovação da moderação)
CREATE TABLE IF NOT EXISTS public.events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  title VARCHAR(150) NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  category VARCHAR(40) NOT NULL DEFAULT 'festa'
    CHECK (category IN ('festa', 'encontro', 'clube', 'viagem', 'workshop', 'outro')),
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ,
  venue_name VARCHAR(150) NOT NULL,
  city VARCHAR(100) NOT NULL,
  state VARCHAR(50) NOT NULL DEFAULT '',
  cover_url TEXT NOT NULL DEFAULT '',
  price_info VARCHAR(120),
  ticket_url TEXT,
  dress_code VARCHAR(120),
  audience VARCHAR(60),
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  is_featured BOOLEAN NOT NULL DEFAULT false,
  review_note TEXT,
  going_count INTEGER NOT NULL DEFAULT 0,
  interested_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (ends_at IS NULL OR ends_at >= starts_at)
);
CREATE INDEX IF NOT EXISTS idx_events_upcoming ON public.events(status, starts_at);
-- Link de ingresso só https (sem javascript:, data: ou http sem criptografia).
-- NOT VALID: vale para novos eventos e edições, sem travar o script por linhas antigas.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'events_ticket_url_https') THEN
    ALTER TABLE public.events ADD CONSTRAINT events_ticket_url_https
      CHECK (ticket_url IS NULL OR ticket_url = '' OR ticket_url ~* '^https://') NOT VALID;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.event_attendees (
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL CHECK (status IN ('going', 'interested')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (event_id, user_id)
);
-- Respostas na arte do evento: vou, não vou e não tenho interesse ("tenho interesse" é das versões anteriores)
ALTER TABLE public.event_attendees DROP CONSTRAINT IF EXISTS event_attendees_status_check;
ALTER TABLE public.event_attendees ADD CONSTRAINT event_attendees_status_check
  CHECK (status IN ('going', 'interested', 'not_going', 'not_interested'));

-- Alcance da arte do evento: uma linha por pessoa que abriu, com o total de aberturas.
-- Gravado só pela RPC record_event_view; lido só pela equipe (admin_event_stats).
CREATE TABLE IF NOT EXISTS public.event_views (
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  open_count INTEGER NOT NULL DEFAULT 1,
  first_opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (event_id, user_id)
);

-- Publicidade (gerida pelo superadmin)
CREATE TABLE IF NOT EXISTS public.ads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  advertiser VARCHAR(120) NOT NULL,
  title VARCHAR(120) NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  image_url TEXT NOT NULL DEFAULT '',
  link_url TEXT,
  cta_label VARCHAR(40) NOT NULL DEFAULT 'Saiba mais',
  placement VARCHAR(20) NOT NULL DEFAULT 'feed' CHECK (placement IN ('feed', 'sidebar', 'events')),
  starts_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ends_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  impressions INTEGER NOT NULL DEFAULT 0,
  clicks INTEGER NOT NULL DEFAULT 0,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

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

-- Algum dos dois bloqueou o outro
CREATE OR REPLACE FUNCTION public.is_blocked_between(a UUID, b UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_blocks
    WHERE (blocker_id = a AND blocked_id = b) OR (blocker_id = b AND blocked_id = a)
  );
$$;

-- "owner" bloqueou o usuário atual (o perfil de owner fica oculto para ele)
CREATE OR REPLACE FUNCTION public.has_blocked_me(owner UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_blocks WHERE blocker_id = owner AND blocked_id = auth.uid());
$$;

-- Mensagens já enviadas na conversa (o pedido de conversa permite só uma de apresentação)
CREATE OR REPLACE FUNCTION public.conversation_message_count(conv UUID)
RETURNS BIGINT LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE AS $$
  SELECT count(*) FROM public.messages WHERE conversation_id = conv;
$$;

-- Status da conta impede publicar ou interagir
CREATE OR REPLACE FUNCTION public.can_interact()
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE AS $$
  SELECT coalesce((SELECT status NOT IN ('suspended', 'blocked') FROM public.profiles WHERE id = auth.uid()), false);
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
    -- Links externos de foto são descartados (ver is_app_media_url)
    CASE WHEN public.is_app_media_url(meta ->> 'avatar_url') THEN coalesce(meta ->> 'avatar_url', '') ELSE '' END,
    CASE WHEN public.is_app_media_url(meta ->> 'cover_url') THEN coalesce(meta ->> 'cover_url', '') ELSE '' END,
    coalesce(ARRAY(SELECT jsonb_array_elements_text(meta -> 'interests')), '{}'),
    coalesce((meta ->> 'verification_requested')::boolean, false)
  );

  INSERT INTO public.profile_private (user_id, email, birthdate, adult_declared_at, terms_accepted_at, city, state)
  VALUES (new_user.id, new_user.email, v_birthdate, now(), now(), coalesce(meta ->> 'city', ''), coalesce(meta ->> 'state', ''));

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

-- Troca de e-mail (confirmada pelo link do Supabase): mantém a cópia de profile_private igual
CREATE OR REPLACE FUNCTION public.sync_private_email()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.profile_private SET email = NEW.email WHERE user_id = NEW.id AND email IS DISTINCT FROM NEW.email;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_email_changed ON auth.users;
CREATE TRIGGER on_auth_email_changed
  AFTER UPDATE OF email ON auth.users
  FOR EACH ROW WHEN (NEW.email IS NOT NULL) EXECUTE FUNCTION public.sync_private_email();

-- Caso o superadmin já tenha se cadastrado e confirmado antes deste script
INSERT INTO public.admin_users (user_id, email, role)
SELECT u.id, lower(u.email), 'superadmin'
FROM auth.users u
JOIN public.profiles p ON p.id = u.id
WHERE lower(u.email) = public.primary_admin_email() AND u.email_confirmed_at IS NOT NULL
ON CONFLICT (user_id) DO UPDATE SET role = 'superadmin';

-- 4.3 Proteção dos campos controlados pela moderação.
-- Chamadas pela API rodam como 'authenticated'; gatilhos e RPCs (SECURITY DEFINER)
-- rodam como dono. Moderadores também não têm exceção aqui: mudanças de moderação
-- passam pelas funções admin_*, que exigem justificativa e gravam auditoria.
CREATE OR REPLACE FUNCTION public.protect_profile_fields()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF current_user = 'authenticated' THEN
    NEW.id := OLD.id;
    NEW.username := OLD.username;
    NEW.username_changed_at := OLD.username_changed_at;
    NEW.age := OLD.age;  -- definida pela data de nascimento no cadastro
    NEW.is_verified := OLD.is_verified;
    NEW.verified_badge_type := OLD.verified_badge_type;
    NEW.status := OLD.status;
    NEW.restrictions := OLD.restrictions;
    NEW.followers_count := OLD.followers_count;
    NEW.following_count := OLD.following_count;
    NEW.connections_count := OLD.connections_count;
    NEW.posts_count := OLD.posts_count;
    NEW.created_at := OLD.created_at;
    IF NEW.avatar_url IS DISTINCT FROM OLD.avatar_url AND NOT public.is_app_media_url(NEW.avatar_url) THEN
      RAISE EXCEPTION 'Envie a foto pelo app; links externos não são aceitos.';
    END IF;
    IF NEW.cover_url IS DISTINCT FROM OLD.cover_url AND NOT public.is_app_media_url(NEW.cover_url) THEN
      RAISE EXCEPTION 'Envie a foto pelo app; links externos não são aceitos.';
    END IF;
  END IF;
  -- Modo discreto ou status online oculto: os outros só sabem o dia da última atividade, não a hora
  IF NEW.discreet_mode_enabled OR NOT NEW.show_online_status THEN
    NEW.last_active_at := date_trunc('day', NEW.last_active_at);
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

-- Localização: a real fica em profile_private; profiles guarda só o que pode ser exibido.
-- No cadastro o perfil é criado antes de profile_private, então vale o valor recebido.
CREATE OR REPLACE FUNCTION public.mask_profile_location()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE raw_city TEXT := NEW.city; raw_state TEXT := NEW.state;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    SELECT coalesce(pp.city, OLD.city), coalesce(pp.state, OLD.state) INTO raw_city, raw_state
    FROM public.profile_private pp WHERE pp.user_id = NEW.id;
    IF NOT FOUND THEN raw_city := NEW.city; raw_state := NEW.state; END IF;
  END IF;
  NEW.city := CASE WHEN NEW.location_privacy = 'city' THEN coalesce(raw_city, '') ELSE '' END;
  NEW.state := CASE WHEN NEW.location_privacy = 'hidden' THEN '' ELSE coalesce(raw_state, '') END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS mask_profile_location ON public.profiles;
CREATE TRIGGER mask_profile_location
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.mask_profile_location();

-- O usuário edita a própria localização em profile_private; os demais campos são fixos
CREATE OR REPLACE FUNCTION public.protect_private_fields()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF current_user = 'authenticated' THEN
    NEW.user_id := OLD.user_id;
    NEW.email := OLD.email;
    NEW.birthdate := OLD.birthdate;
    NEW.adult_declared_at := OLD.adult_declared_at;
    NEW.terms_accepted_at := OLD.terms_accepted_at;
    NEW.created_at := OLD.created_at;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_private_fields ON public.profile_private;
CREATE TRIGGER protect_private_fields
  BEFORE UPDATE ON public.profile_private
  FOR EACH ROW EXECUTE FUNCTION public.protect_private_fields();

-- Mudou a localização real: recalcula o que o perfil público exibe
CREATE OR REPLACE FUNCTION public.sync_profile_location()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.profiles SET city = city WHERE id = NEW.user_id;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS sync_profile_location ON public.profile_private;
CREATE TRIGGER sync_profile_location
  AFTER UPDATE OF city, state ON public.profile_private
  FOR EACH ROW EXECUTE FUNCTION public.sync_profile_location();

-- Aplica a máscara aos perfis já existentes
UPDATE public.profiles SET city = city
WHERE (location_privacy <> 'city' AND city <> '') OR (location_privacy = 'hidden' AND state <> '');

-- Links de mídia precisam vir do Storage do app (protege o IP de quem visualiza)
CREATE OR REPLACE FUNCTION public.enforce_media_urls()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
DECLARE u TEXT;
BEGIN
  IF current_user <> 'authenticated' THEN RETURN NEW; END IF;
  IF TG_TABLE_NAME = 'posts' THEN
    IF TG_OP = 'INSERT' OR NEW.media_urls IS DISTINCT FROM OLD.media_urls THEN
      FOREACH u IN ARRAY NEW.media_urls LOOP
        IF NOT public.is_app_media_url(u) THEN RAISE EXCEPTION 'Envie as fotos pelo app; links externos não são aceitos.'; END IF;
      END LOOP;
    END IF;
  ELSIF TG_TABLE_NAME = 'messages' THEN
    IF NOT public.is_app_media_url(NEW.media_url) THEN RAISE EXCEPTION 'Mídia inválida.'; END IF;
  ELSIF TG_TABLE_NAME = 'stories' THEN
    IF NOT public.is_app_media_url(NEW.media_url) THEN RAISE EXCEPTION 'Mídia inválida.'; END IF;
  ELSIF TG_TABLE_NAME = 'album_items' THEN
    IF TG_OP = 'INSERT' OR NEW.url IS DISTINCT FROM OLD.url THEN
      IF NOT public.is_app_media_url(NEW.url) THEN RAISE EXCEPTION 'Mídia inválida.'; END IF;
    END IF;
  ELSIF TG_TABLE_NAME = 'albums' THEN
    IF TG_OP = 'INSERT' OR NEW.cover_url IS DISTINCT FROM OLD.cover_url THEN
      IF NOT public.is_app_media_url(NEW.cover_url) THEN RAISE EXCEPTION 'Capa inválida.'; END IF;
    END IF;
  ELSIF TG_TABLE_NAME = 'joint_partners' THEN
    IF TG_OP = 'INSERT' OR NEW.avatar_url IS DISTINCT FROM OLD.avatar_url THEN
      IF NOT public.is_app_media_url(NEW.avatar_url) THEN RAISE EXCEPTION 'Foto inválida.'; END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['posts', 'messages', 'stories', 'album_items', 'albums', 'joint_partners'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS enforce_media_urls ON public.%I', t);
    EXECUTE format('CREATE TRIGGER enforce_media_urls BEFORE INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.enforce_media_urls()', t);
  END LOOP;
END $$;

-- Limpeza única dos links externos gravados antes desta regra (fotos de perfil por link
-- no cadastro, imagens coladas em posts e mensagens). Reexecutar não altera mais nada.
UPDATE public.profiles SET avatar_url = '' WHERE NOT public.is_app_media_url(avatar_url);
UPDATE public.profiles SET cover_url = '' WHERE NOT public.is_app_media_url(cover_url);
UPDATE public.joint_partners SET avatar_url = NULL WHERE NOT public.is_app_media_url(avatar_url);
UPDATE public.albums SET cover_url = '' WHERE NOT public.is_app_media_url(cover_url);
UPDATE public.posts
SET media_urls = ARRAY(SELECT u FROM unnest(media_urls) AS u WHERE public.is_app_media_url(u))
WHERE EXISTS (SELECT 1 FROM unnest(media_urls) AS u WHERE NOT public.is_app_media_url(u));
UPDATE public.messages
SET media_url = NULL,
    content = CASE WHEN length(trim(content)) > 0 THEN content ELSE '[imagem externa removida por segurança]' END
WHERE NOT public.is_app_media_url(media_url);

-- Participantes de conexões, conversas e permissões de cofre não podem ser trocados
-- por UPDATE (sem isso, quem recebe um pedido poderia reescrever a linha e se
-- "conectar" a qualquer pessoa, ou entrar numa conversa alheia).
CREATE OR REPLACE FUNCTION public.protect_relationship_keys()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF current_user = 'authenticated' THEN
    IF TG_TABLE_NAME = 'connections' THEN
      IF NEW.requester_id <> OLD.requester_id OR NEW.addressee_id <> OLD.addressee_id THEN
        RAISE EXCEPTION 'Não é permitido alterar os participantes da conexão.';
      END IF;
      NEW.created_at := OLD.created_at;
    ELSIF TG_TABLE_NAME = 'conversation_participants' THEN
      IF NEW.conversation_id <> OLD.conversation_id OR NEW.user_id <> OLD.user_id THEN
        RAISE EXCEPTION 'Não é permitido alterar os participantes da conversa.';
      END IF;
      NEW.joined_at := OLD.joined_at;
    ELSIF TG_TABLE_NAME = 'album_permissions' THEN
      IF NEW.album_id <> OLD.album_id OR NEW.user_id <> OLD.user_id THEN
        RAISE EXCEPTION 'Não é permitido alterar a permissão de outro cofre ou pessoa.';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['connections', 'conversation_participants', 'album_permissions'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS protect_relationship_keys ON public.%I', t);
    EXECUTE format('CREATE TRIGGER protect_relationship_keys BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.protect_relationship_keys()', t);
  END LOOP;
END $$;

-- Ao bloquear, desfaz os vínculos entre as duas pessoas
CREATE OR REPLACE FUNCTION public.apply_user_block()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  DELETE FROM public.follows
  WHERE (follower_id = NEW.blocker_id AND following_id = NEW.blocked_id)
     OR (follower_id = NEW.blocked_id AND following_id = NEW.blocker_id);
  DELETE FROM public.connections
  WHERE (requester_id = NEW.blocker_id AND addressee_id = NEW.blocked_id)
     OR (requester_id = NEW.blocked_id AND addressee_id = NEW.blocker_id);
  DELETE FROM public.album_permissions ap USING public.albums a
  WHERE a.id = ap.album_id
    AND ((a.user_id = NEW.blocker_id AND ap.user_id = NEW.blocked_id)
      OR (a.user_id = NEW.blocked_id AND ap.user_id = NEW.blocker_id));
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS apply_user_block ON public.user_blocks;
CREATE TRIGGER apply_user_block AFTER INSERT ON public.user_blocks
  FOR EACH ROW EXECUTE FUNCTION public.apply_user_block();

DROP TRIGGER IF EXISTS protect_profile_fields ON public.profiles;
CREATE TRIGGER protect_profile_fields
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_profile_fields();

CREATE OR REPLACE FUNCTION public.protect_post_fields()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF current_user = 'authenticated' THEN
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

  ELSIF TG_TABLE_NAME = 'follows' THEN
    -- Seguir/deixar de seguir várias vezes não enche a caixa de avisos: um por pessoa a cada 24 h
    IF NOT EXISTS (
      SELECT 1 FROM public.notifications
      WHERE user_id = NEW.following_id AND actor_id = NEW.follower_id AND type = 'follow'
        AND created_at > now() - INTERVAL '24 hours'
    ) THEN
      SELECT display_name INTO actor_name FROM public.profiles WHERE id = NEW.follower_id;
      PERFORM public.notify(NEW.following_id, NEW.follower_id, 'follow', 'Novo seguidor',
        actor_name || ' começou a seguir você.', NEW.follower_id::text);
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
DROP TRIGGER IF EXISTS notify_follows ON public.follows;
CREATE TRIGGER notify_follows AFTER INSERT ON public.follows
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
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = target AND status NOT IN ('blocked', 'suspended'))
     OR public.is_blocked_between(me, target) THEN
    RAISE EXCEPTION 'Perfil indisponível.';
  END IF;
  IF NOT public.can_interact() THEN RAISE EXCEPTION 'Sua conta está com essa função restrita.'; END IF;

  -- Reaproveita a conversa existente. Inclui as que eu criei e depois saí: sem isso,
  -- sair e abrir de novo permitiria mandar quantos pedidos quisesse.
  SELECT c.id INTO conv
  FROM public.conversations c
  JOIN public.conversation_participants b ON b.conversation_id = c.id AND b.user_id = target
  WHERE c.created_by = me OR public.is_conversation_participant(c.id, me)
  ORDER BY c.created_at
  LIMIT 1;

  IF conv IS NOT NULL THEN
    INSERT INTO public.conversation_participants (conversation_id, user_id)
    VALUES (conv, me)
    ON CONFLICT DO NOTHING;
    -- Abrir pelo perfil traz de volta uma conversa que eu tinha arquivado
    UPDATE public.conversation_participants SET is_archived = false
    WHERE conversation_id = conv AND user_id = me AND is_archived;
    -- Viraram conexão depois do pedido: a conversa deixa de ser pedido
    IF public.are_connected(me, target) THEN
      UPDATE public.conversations SET is_pending_request = false WHERE id = conv AND is_pending_request;
    END IF;
  ELSE
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

-- Destinatário recusa o pedido: a conversa é arquivada para ele, mas continua existindo.
-- Assim quem enviou não consegue abrir outra nem mandar mais mensagens (o pedido
-- pendente aceita só a primeira).
CREATE OR REPLACE FUNCTION public.decline_message_request(conv UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.conversations
    WHERE id = conv AND is_pending_request AND created_by IS DISTINCT FROM auth.uid()
  ) THEN
    RAISE EXCEPTION 'Pedido de conversa não encontrado.';
  END IF;
  UPDATE public.conversation_participants
  SET is_archived = true
  WHERE conversation_id = conv AND user_id = auth.uid();
END;
$$;

-- Bloqueio pelo app (o gatilho apply_user_block desfaz os vínculos)
CREATE OR REPLACE FUNCTION public.block_user(target UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Não autenticado.'; END IF;
  IF target = auth.uid() THEN RAISE EXCEPTION 'Não é possível bloquear a si mesmo.'; END IF;
  INSERT INTO public.user_blocks (blocker_id, blocked_id) VALUES (auth.uid(), target)
  ON CONFLICT DO NOTHING;
  -- Conversas com a pessoa saem da lista de quem bloqueou
  UPDATE public.conversation_participants mine
  SET is_archived = true
  FROM public.conversation_participants other
  WHERE other.conversation_id = mine.conversation_id
    AND mine.user_id = auth.uid() AND other.user_id = target;
END;
$$;

-- Presença: o app chama touch_presence a cada minuto enquanto está aberto
CREATE OR REPLACE FUNCTION public.touch_presence()
RETURNS VOID LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO public.user_presence (user_id, last_seen_at)
  SELECT auth.uid(), now() WHERE auth.uid() IS NOT NULL
  ON CONFLICT (user_id) DO UPDATE SET last_seen_at = now();
$$;

-- Quem está online agora entre os perfis pedidos. Recíproco: quem escondeu o próprio
-- status não recebe o de ninguém. Modo discreto, bloqueios e contas bloqueadas ficam de fora.
CREATE OR REPLACE FUNCTION public.online_users(ids UUID[])
RETURNS SETOF UUID LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE AS $$
  SELECT p.id
  FROM public.profiles p
  JOIN public.user_presence up ON up.user_id = p.id
  WHERE p.id = ANY(ids)
    AND auth.uid() IS NOT NULL
    AND up.last_seen_at > now() - INTERVAL '3 minutes'
    AND p.show_online_status AND NOT p.discreet_mode_enabled AND p.status <> 'blocked'
    AND (p.id = auth.uid() OR NOT public.is_blocked_between(p.id, auth.uid()))
    AND EXISTS (SELECT 1 FROM public.profiles me WHERE me.id = auth.uid() AND me.show_online_status)
  LIMIT 500;
$$;

-- Troca do @usuário: mesmo formato do cadastro, sem nomes que imitem a equipe
CREATE OR REPLACE FUNCTION public.change_username(new_username TEXT)
RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v TEXT := lower(trim(coalesce(new_username, ''))); last_change TIMESTAMPTZ;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Não autenticado.'; END IF;
  IF v !~ '^[a-z0-9_]{3,30}$' THEN
    RAISE EXCEPTION 'Use de 3 a 30 caracteres: letras sem acento, números ou _.';
  END IF;
  IF v ~ '^(admin|adm_|vybe|suporte|support|moderac|moderador|staff|equipe|oficial|sistema|root)' THEN
    RAISE EXCEPTION 'Este nome de usuário é reservado.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND username = v) THEN RETURN v; END IF;
  SELECT username_changed_at INTO last_change FROM public.profiles WHERE id = auth.uid();
  IF last_change > now() - INTERVAL '7 days' THEN
    RAISE EXCEPTION 'Você já trocou o nome de usuário nos últimos 7 dias.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.profiles WHERE username = v) THEN
    RAISE EXCEPTION 'Este nome de usuário já está em uso.';
  END IF;
  UPDATE public.profiles SET username = v, username_changed_at = now() WHERE id = auth.uid();
  RETURN v;
END;
$$;

-- Listas de seguidores / seguindo (como no Instagram). A tabela follows só mostra as
-- próprias relações; esta função expõe as de outro perfil sem revelar quem não deve
-- aparecer: perfis bloqueados (pela moderação ou entre as pessoas) e quem usa o modo
-- discreto ficam de fora das listas de terceiros.
CREATE OR REPLACE FUNCTION public.follow_list(target UUID, list_kind TEXT)
RETURNS TABLE (id UUID, username TEXT, display_name TEXT, avatar_url TEXT, profile_type profile_type_enum, is_verified BOOLEAN)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public STABLE AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Não autenticado.'; END IF;
  IF list_kind NOT IN ('followers', 'following') THEN RAISE EXCEPTION 'Lista inválida.'; END IF;
  IF target <> auth.uid() AND (public.is_blocked_between(target, auth.uid())
     OR EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = target AND status = 'blocked')) THEN
    RETURN;
  END IF;
  RETURN QUERY
  SELECT p.id, p.username::text, p.display_name::text, p.avatar_url, p.profile_type, p.is_verified
  FROM public.follows f
  JOIN public.profiles p ON p.id = CASE WHEN list_kind = 'followers' THEN f.follower_id ELSE f.following_id END
  WHERE (CASE WHEN list_kind = 'followers' THEN f.following_id ELSE f.follower_id END) = target
    AND p.status <> 'blocked'
    AND (p.id = auth.uid() OR NOT public.is_blocked_between(p.id, auth.uid()))
    AND (target = auth.uid() OR p.id = auth.uid() OR NOT p.discreet_mode_enabled)
  ORDER BY f.created_at DESC
  LIMIT 1000;
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

-- Compatibilidade calculada no banco: as preferências (inclusive os limites íntimos)
-- ficam legíveis só para o dono e as conexões; os demais recebem apenas o score.
-- Porte fiel de src/utils/compatibility.ts — mantenha os dois em sincronia.
CREATE OR REPLACE FUNCTION public.is_interested_in(looking TEXT[], target_type profile_type_enum)
RETURNS BOOLEAN LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN looking IS NULL THEN false
    WHEN 'all' = ANY(looking) THEN true
    WHEN target_type = 'couple'        AND 'couples'        = ANY(looking) THEN true
    WHEN target_type = 'single_female' AND 'singles_female' = ANY(looking) THEN true
    WHEN target_type = 'single_male'   AND 'singles_male'   = ANY(looking) THEN true
    WHEN target_type = 'joint_profile' AND 'couples'        = ANY(looking) THEN true
    WHEN target_type = 'polyamorous' THEN true
    ELSE false
  END;
$$;

CREATE OR REPLACE FUNCTION public.compatibility_with(target UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public STABLE AS $$
DECLARE
  me UUID := auth.uid();
  a_type profile_type_enum; b_type profile_type_enum;
  a_interests TEXT[]; b_interests TEXT[];
  a public.compatibility_preferences; b public.compatibility_preferences;
  match_ab BOOLEAN; match_ba BOOLEAN; mutual BOOLEAN;
  pts INT := 0; combined INT; dist INT := 30; max_dist INT;
  shared_obj TEXT[]; shared_int TEXT[]; shared_tags TEXT[];
  reasons TEXT[] := '{}'; score INT; tier TEXT; color TEXT;
BEGIN
  IF me IS NULL OR target IS NULL OR me = target THEN RETURN NULL; END IF;
  -- Bloqueio em qualquer direção: nada a calcular
  IF EXISTS (SELECT 1 FROM public.user_blocks
             WHERE (blocker_id = me AND blocked_id = target) OR (blocker_id = target AND blocked_id = me)) THEN
    RETURN NULL;
  END IF;

  SELECT profile_type, interests INTO a_type, a_interests FROM public.profiles WHERE id = me;
  SELECT profile_type, interests INTO b_type, b_interests FROM public.profiles WHERE id = target;
  IF a_type IS NULL OR b_type IS NULL THEN RETURN NULL; END IF;
  SELECT * INTO a FROM public.compatibility_preferences WHERE profile_id = me;
  SELECT * INTO b FROM public.compatibility_preferences WHERE profile_id = target;

  -- 1. Interesse recíproco no formato de perfil (30)
  match_ab := public.is_interested_in(a.interested_in, b_type);
  match_ba := public.is_interested_in(b.interested_in, a_type);
  mutual := match_ab AND match_ba;
  IF mutual THEN pts := pts + 30; reasons := reasons || 'Interesse recíproco no formato de perfil'::text;
  ELSIF match_ab OR match_ba THEN pts := pts + 12; reasons := reasons || 'Interesse parcial no perfil'::text;
  ELSE pts := pts + 4; END IF;

  -- 2. Objetivos em comum (25)
  SELECT coalesce(array_agg(o), '{}') INTO shared_obj
    FROM unnest(coalesce(a.objectives, '{}')) o
    WHERE o = ANY (coalesce(b.objectives, '{}'));
  IF coalesce(array_length(shared_obj, 1), 0) >= 3 THEN
    pts := pts + 25; reasons := reasons || ('Forte alinhamento de intenções (' || array_length(shared_obj, 1) || ' objetivos mútuos)');
  ELSIF coalesce(array_length(shared_obj, 1), 0) >= 1 THEN
    pts := pts + 15; reasons := reasons || 'Objetivos compatíveis em comum'::text;
  ELSE pts := pts + 2; END IF;

  -- 3. Interesses + estilo de vida (20), sem diferenciar maiúsculas
  SELECT coalesce(array_agg(i), '{}') INTO shared_int
    FROM unnest(coalesce(a_interests, '{}')) i
    WHERE lower(i) IN (SELECT lower(x) FROM unnest(coalesce(b_interests, '{}')) x);
  SELECT coalesce(array_agg(t), '{}') INTO shared_tags
    FROM unnest(coalesce(a.lifestyle_tags, '{}')) t
    WHERE lower(t) IN (SELECT lower(x) FROM unnest(coalesce(b.lifestyle_tags, '{}')) x);
  combined := coalesce(array_length(shared_int, 1), 0) + coalesce(array_length(shared_tags, 1), 0);
  IF combined >= 4 THEN pts := pts + 20; reasons := reasons || 'Altíssima afinidade cultural e de estilo de vida'::text;
  ELSIF combined >= 2 THEN pts := pts + 14; reasons := reasons || 'Gostos e afinidades em comum'::text;
  ELSIF combined >= 1 THEN pts := pts + 8; END IF;

  -- 4. Distância (15): sem geolocalização real, usa 30 km como o app
  max_dist := greatest(coalesce(a.max_distance_km, 50), coalesce(b.max_distance_km, 50));
  IF dist <= 30 THEN pts := pts + 15; reasons := reasons || 'Mesma região metropolitana / proximidade geográfica'::text;
  ELSIF dist <= max_dist THEN pts := pts + 10; reasons := reasons || 'Distância dentro da faixa desejada'::text;
  ELSE pts := pts + 3; reasons := reasons || 'Perfis em cidades diferentes (conexão virtual ou viagens)'::text; END IF;

  -- 5. Ritmo e discrição (10)
  IF a.pace_preference IS NOT DISTINCT FROM b.pace_preference THEN
    pts := pts + 5; reasons := reasons || 'Mesmo ritmo de aproximação desejado'::text;
  END IF;
  IF a.discretion_level IS NOT DISTINCT FROM b.discretion_level THEN
    pts := pts + 5; reasons := reasons || 'Nível de discrição e privacidade harmonizado'::text;
  END IF;

  score := least(greatest(pts, 18), 98);
  IF    score >= 80 THEN tier := 'Altíssima Sintonia'; color := '#10b981';
  ELSIF score >= 65 THEN tier := 'Boa Sintonia';       color := '#a855f7';
  ELSIF score >= 45 THEN tier := 'Sintonia Parcial';   color := '#f59e0b';
  ELSE                   tier := 'Baixa Sintonia';     color := '#ef4444'; END IF;

  RETURN jsonb_build_object(
    'score', score, 'tier', tier, 'color', color,
    'reasons', to_jsonb(reasons),
    'sharedObjectives', to_jsonb(shared_obj),
    'sharedInterests', to_jsonb(shared_int),
    'sharedLifestyleTags', to_jsonb(shared_tags),
    'distanceKm', dist, 'isMutualTargetMatch', mutual
  );
END;
$$;

-- Versão em lote para a Descoberta (limitada para não virar varredura da base)
CREATE OR REPLACE FUNCTION public.compatibility_scores(targets UUID[])
RETURNS TABLE (target UUID, breakdown JSONB)
LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE AS $$
  SELECT s.target, s.breakdown
  FROM (SELECT t AS target, public.compatibility_with(t) AS breakdown FROM unnest(targets[1:500]) AS t) s
  WHERE s.breakdown IS NOT NULL;
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
         p.profile_type, coalesce(pp.city, p.city)::text, coalesce(pp.state, p.state)::text, p.age,
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
      'Seu perfil recebeu o selo de verificação do Vybelog.', NULL);
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

-- Acesso integral do superadministrador a conversas e cofres (segurança da plataforma e
-- obrigações legais; informado na Política de Privacidade). Exige MFA e justificativa, e
-- cada acesso fica no livro de auditoria. Moderadores, suporte e auditoria não têm este acesso.
CREATE OR REPLACE FUNCTION public.require_superadmin_reason(p_reason TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_superadmin() THEN
    RAISE EXCEPTION 'Acesso negado: requer superadministrador com MFA ativo.';
  END IF;
  IF p_reason IS NULL OR length(trim(p_reason)) < 10 THEN
    RAISE EXCEPTION 'A justificativa deve ter no mínimo 10 caracteres.';
  END IF;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.require_superadmin_reason(TEXT) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.admin_list_conversations(justification TEXT)
RETURNS TABLE (conversation_id UUID, participants JSONB, message_count BIGINT, last_message_at TIMESTAMPTZ, is_pending BOOLEAN)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
#variable_conflict use_column
BEGIN
  PERFORM public.require_superadmin_reason(justification);
  PERFORM public.admin_log('LIST_ALL_CONVERSATIONS', 'all', 'conversation', justification);
  RETURN QUERY
  SELECT c.id,
    (SELECT coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'username', p.username, 'display_name', p.display_name, 'avatar_url', p.avatar_url)), '[]')
     FROM public.conversation_participants cp JOIN public.profiles p ON p.id = cp.user_id
     WHERE cp.conversation_id = c.id),
    (SELECT count(*) FROM public.messages m WHERE m.conversation_id = c.id),
    (SELECT max(m.created_at) FROM public.messages m WHERE m.conversation_id = c.id),
    c.is_pending_request
  FROM public.conversations c
  ORDER BY 4 DESC NULLS LAST
  LIMIT 1000;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_read_conversation(conv UUID, justification TEXT)
RETURNS TABLE (message_id UUID, sender_id UUID, sender_name TEXT, content TEXT, media_url TEXT, created_at TIMESTAMPTZ)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
#variable_conflict use_column
BEGIN
  PERFORM public.require_superadmin_reason(justification);
  IF NOT EXISTS (SELECT 1 FROM public.conversations WHERE id = conv) THEN
    RAISE EXCEPTION 'Conversa não encontrada.';
  END IF;
  PERFORM public.admin_log('READ_CONVERSATION', conv::text, 'conversation', justification);
  RETURN QUERY
  SELECT m.id, m.sender_id, p.display_name::text, m.content, m.media_url, m.created_at
  FROM public.messages m
  JOIN public.profiles p ON p.id = m.sender_id
  WHERE m.conversation_id = conv
  ORDER BY m.created_at ASC
  LIMIT 2000;
END;
$$;

-- Itens de todos os álbuns de um usuário, inclusive cofres privados. Arquivos do cofre
-- são abertos por URL assinada (a política vybe_vault_read libera o superadmin).
CREATE OR REPLACE FUNCTION public.admin_vault_items(target UUID, justification TEXT)
RETURNS TABLE (item_id UUID, album_title TEXT, album_visibility TEXT, url TEXT, storage_path TEXT, media_type TEXT, caption TEXT, created_at TIMESTAMPTZ)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
#variable_conflict use_column
BEGIN
  PERFORM public.require_superadmin_reason(justification);
  PERFORM public.admin_log('INSPECT_PRIVATE_VAULT', target::text, 'user', justification);
  RETURN QUERY
  SELECT i.id, a.title::text, a.visibility::text, i.url, i.storage_path, i.type::text, i.caption, i.created_at
  FROM public.album_items i
  JOIN public.albums a ON a.id = i.album_id
  WHERE a.user_id = target
  ORDER BY i.created_at DESC
  LIMIT 500;
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
-- 5.3 EVENTOS E PUBLICIDADE
-- ==============================================================================

-- Contadores de "vou" / "tenho interesse"
CREATE OR REPLACE FUNCTION public.count_event_attendees()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE ev UUID := coalesce(NEW.event_id, OLD.event_id);
BEGIN
  UPDATE public.events SET
    going_count = (SELECT count(*) FROM public.event_attendees WHERE event_id = ev AND status = 'going'),
    interested_count = (SELECT count(*) FROM public.event_attendees WHERE event_id = ev AND status = 'interested')
  WHERE id = ev;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS count_event_attendees ON public.event_attendees;
CREATE TRIGGER count_event_attendees AFTER INSERT OR UPDATE OR DELETE ON public.event_attendees
  FOR EACH ROW EXECUTE FUNCTION public.count_event_attendees();

-- Abrir a arte de um evento publicado conta para o alcance (pessoas únicas e total de aberturas)
CREATE OR REPLACE FUNCTION public.record_event_view(event UUID)
RETURNS VOID LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO public.event_views (event_id, user_id)
  SELECT event, auth.uid()
  WHERE auth.uid() IS NOT NULL AND EXISTS (SELECT 1 FROM public.events e WHERE e.id = event AND e.status = 'approved')
  ON CONFLICT (event_id, user_id) DO UPDATE
    SET open_count = event_views.open_count + 1, last_opened_at = now();
$$;

-- Alcance e interações por evento (somente a equipe)
CREATE OR REPLACE FUNCTION public.admin_event_stats()
RETURNS TABLE (event_id UUID, viewers BIGINT, opens BIGINT, going BIGINT, interested BIGINT, not_going BIGINT, not_interested BIGINT, interacted BIGINT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public STABLE AS $$
#variable_conflict use_column
BEGIN
  IF NOT public.is_staff() THEN
    RAISE EXCEPTION 'Acesso negado: requer papel administrativo com MFA ativo.';
  END IF;
  RETURN QUERY
  SELECT e.id,
    (SELECT count(*) FROM public.event_views v WHERE v.event_id = e.id),
    (SELECT coalesce(sum(v.open_count), 0)::bigint FROM public.event_views v WHERE v.event_id = e.id),
    (SELECT count(*) FROM public.event_attendees a WHERE a.event_id = e.id AND a.status = 'going'),
    (SELECT count(*) FROM public.event_attendees a WHERE a.event_id = e.id AND a.status = 'interested'),
    (SELECT count(*) FROM public.event_attendees a WHERE a.event_id = e.id AND a.status = 'not_going'),
    (SELECT count(*) FROM public.event_attendees a WHERE a.event_id = e.id AND a.status = 'not_interested'),
    (SELECT count(*) FROM public.event_attendees a WHERE a.event_id = e.id)
  FROM public.events e;
END;
$$;

-- Usuário não altera status, destaque nem contadores do próprio evento
CREATE OR REPLACE FUNCTION public.protect_event_fields()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF current_user = 'authenticated' THEN
    IF TG_OP = 'INSERT' THEN
      NEW.status := 'pending';
      NEW.is_featured := false;
      NEW.review_note := NULL;
      NEW.going_count := 0;
      NEW.interested_count := 0;
    ELSE
      NEW.created_by := OLD.created_by;
      NEW.status := 'pending';  -- edição volta para análise
      NEW.is_featured := OLD.is_featured;
      NEW.going_count := OLD.going_count;
      NEW.interested_count := OLD.interested_count;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_event_fields ON public.events;
CREATE TRIGGER protect_event_fields BEFORE INSERT OR UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.protect_event_fields();

-- Moderação de eventos (auditada; avisa quem enviou)
CREATE OR REPLACE FUNCTION public.admin_review_event(event UUID, new_status TEXT, featured BOOLEAN, note TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE ev public.events;
BEGIN
  PERFORM public.require_moderator(note);
  IF new_status NOT IN ('approved', 'rejected', 'pending') THEN RAISE EXCEPTION 'Status inválido.'; END IF;
  UPDATE public.events
  SET status = new_status, is_featured = (new_status = 'approved' AND featured), review_note = note
  WHERE id = event
  RETURNING * INTO ev;
  IF ev.id IS NULL THEN RAISE EXCEPTION 'Evento não encontrado.'; END IF;
  PERFORM public.admin_log('EVENT_' || upper(new_status), event::text, 'event', note);
  IF new_status = 'approved' THEN
    PERFORM public.notify(ev.created_by, NULL, 'system_safety', 'Evento publicado',
      'Seu evento "' || ev.title || '" foi aprovado e já aparece na agenda.', event::text);
  ELSIF new_status = 'rejected' THEN
    PERFORM public.notify(ev.created_by, NULL, 'system_safety', 'Evento não aprovado',
      'Seu evento "' || ev.title || '" não foi aprovado: ' || note, event::text);
  END IF;
END;
$$;

-- Contagem de visualizações e cliques de anúncios ativos
CREATE OR REPLACE FUNCTION public.record_ad_event(ad UUID, kind TEXT)
RETURNS VOID LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.ads
  SET impressions = impressions + CASE WHEN kind = 'impression' THEN 1 ELSE 0 END,
      clicks = clicks + CASE WHEN kind = 'click' THEN 1 ELSE 0 END
  WHERE id = ad AND is_active AND starts_at <= now() AND (ends_at IS NULL OR ends_at > now())
    AND kind IN ('impression', 'click') AND auth.uid() IS NOT NULL;
$$;

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
-- Regras gerais:
--  * Moderação não altera tabelas diretamente: só pelas funções admin_* (justificativa + auditoria).
--  * Bloqueios valem nos dois sentidos para conteúdo e interações.
--  * Listas de quem segue, quem é conexão, quem curtiu e quem vai a eventos são privadas;
--    os perfis mostram apenas os contadores.
DO $$
DECLARE t TEXT; pol TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'profiles', 'profile_private', 'joint_partners', 'compatibility_preferences', 'follows', 'connections',
    'user_blocks', 'communities', 'community_members', 'posts', 'post_polls', 'post_poll_votes', 'post_likes',
    'post_saves', 'post_comments', 'albums', 'album_items', 'album_permissions', 'conversations',
    'conversation_participants', 'messages', 'notifications', 'moderation_reports', 'admin_users',
    'admin_user_notes', 'admin_audit_logs', 'stories', 'story_views', 'events', 'event_attendees', 'event_views', 'ads', 'user_presence'
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

-- Funções são executáveis por PUBLIC por padrão no Postgres. O visitante sem login não
-- precisa de nenhuma; usuários logados precisam das auxiliares usadas nas políticas.
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC, anon;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated, service_role;
-- notify() grava notificação para qualquer pessoa com qualquer texto: chamada direta
-- permitiria forjar avisos "da Equipe de Segurança". Só gatilhos e RPCs a usam.
REVOKE EXECUTE ON FUNCTION public.notify(UUID, UUID, TEXT, TEXT, TEXT, TEXT) FROM authenticated;

GRANT EXECUTE ON FUNCTION public.start_conversation(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_message_request(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.decline_message_request(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.block_user(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.change_username(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.follow_list(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.touch_presence() TO authenticated;
GRANT EXECUTE ON FUNCTION public.online_users(UUID[]) TO authenticated;
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
GRANT EXECUTE ON FUNCTION public.admin_list_conversations(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_read_conversation(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_vault_items(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_role(UUID, admin_role_enum, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.album_item_counts(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_review_event(UUID, TEXT, BOOLEAN, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_ad_event(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_event_view(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_event_stats() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.delete_own_account() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_log(TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.require_moderator(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.require_superadmin_reason(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.create_profile_for_user(auth.users) FROM PUBLIC, anon, authenticated;

-- profiles (quem bloqueou o usuário atual some para ele)
CREATE POLICY "profiles_select" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.is_staff() OR (status <> 'blocked' AND NOT public.has_blocked_me(id)));
CREATE POLICY "profiles_update" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());
-- INSERT é feito somente pelo gatilho handle_new_user; DELETE via exclusão da conta no Auth.

-- profile_private (o usuário só consegue alterar a própria localização; ver protect_private_fields)
CREATE POLICY "profile_private_select" ON public.profile_private FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_staff());
CREATE POLICY "profile_private_update" ON public.profile_private FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- joint_partners / compatibility_preferences
CREATE POLICY "joint_partners_select" ON public.joint_partners FOR SELECT TO authenticated
  USING (profile_id = auth.uid() OR NOT public.has_blocked_me(profile_id));
CREATE POLICY "joint_partners_write" ON public.joint_partners FOR ALL TO authenticated
  USING (profile_id = auth.uid()) WITH CHECK (profile_id = auth.uid());

-- Preferências incluem limites íntimos: só o dono, as conexões e a equipe leem.
-- Os demais veem apenas o score, pela RPC compatibility_with / compatibility_scores.
CREATE POLICY "prefs_select" ON public.compatibility_preferences FOR SELECT TO authenticated
  USING (
    profile_id = auth.uid()
    OR public.is_staff()
    OR (public.are_connected(profile_id, auth.uid()) AND NOT public.has_blocked_me(profile_id))
  );
CREATE POLICY "prefs_write" ON public.compatibility_preferences FOR ALL TO authenticated
  USING (profile_id = auth.uid()) WITH CHECK (profile_id = auth.uid());

-- bloqueios: só quem bloqueou vê a própria lista; bloquear é pela RPC block_user
CREATE POLICY "blocks_select" ON public.user_blocks FOR SELECT TO authenticated
  USING (blocker_id = auth.uid());
CREATE POLICY "blocks_delete" ON public.user_blocks FOR DELETE TO authenticated
  USING (blocker_id = auth.uid());

-- follows
CREATE POLICY "follows_select" ON public.follows FOR SELECT TO authenticated
  USING (follower_id = auth.uid() OR following_id = auth.uid() OR public.is_staff());
CREATE POLICY "follows_insert" ON public.follows FOR INSERT TO authenticated
  WITH CHECK (follower_id = auth.uid() AND public.can_interact() AND NOT public.is_blocked_between(follower_id, following_id));
-- Quem segue pode deixar de seguir; quem é seguido pode remover o seguidor (como no Instagram)
CREATE POLICY "follows_delete" ON public.follows FOR DELETE TO authenticated
  USING (follower_id = auth.uid() OR following_id = auth.uid());

-- connections (aceitar só muda pending -> accepted; os participantes são fixos, ver protect_relationship_keys)
CREATE POLICY "connections_select" ON public.connections FOR SELECT TO authenticated
  USING (requester_id = auth.uid() OR addressee_id = auth.uid() OR public.is_staff());
CREATE POLICY "connections_insert" ON public.connections FOR INSERT TO authenticated
  WITH CHECK (
    requester_id = auth.uid() AND status = 'pending' AND responded_at IS NULL
    AND public.can_interact()
    AND NOT public.is_blocked_between(requester_id, addressee_id)
  );
CREATE POLICY "connections_accept" ON public.connections FOR UPDATE TO authenticated
  USING (addressee_id = auth.uid() AND status = 'pending')
  WITH CHECK (addressee_id = auth.uid() AND status = 'accepted');
CREATE POLICY "connections_delete" ON public.connections FOR DELETE TO authenticated
  USING (requester_id = auth.uid() OR addressee_id = auth.uid());

-- communities
CREATE POLICY "communities_select" ON public.communities FOR SELECT TO authenticated USING (true);
CREATE POLICY "communities_manage" ON public.communities FOR ALL TO authenticated
  USING (public.is_superadmin()) WITH CHECK (public.is_superadmin());

CREATE POLICY "community_members_select" ON public.community_members FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_staff());
CREATE POLICY "community_members_join" ON public.community_members FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid() AND role = 'member' AND public.can_interact()
    AND EXISTS (SELECT 1 FROM public.communities c WHERE c.id = community_id AND NOT c.is_private)
  );
CREATE POLICY "community_members_leave" ON public.community_members FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- posts
CREATE POLICY "posts_select" ON public.posts FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_staff()
    OR (
      moderation_status IN ('approved', 'pending_review')
      AND NOT public.is_blocked_between(user_id, auth.uid())
      AND (visibility = 'public' OR public.are_connected(user_id, auth.uid()))
    )
  );
CREATE POLICY "posts_insert" ON public.posts FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND public.can_interact()
    AND coalesce((SELECT (restrictions ->> 'cannotPost')::boolean FROM public.profiles WHERE id = auth.uid()), false) = false
  );
CREATE POLICY "posts_update" ON public.posts FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "posts_delete" ON public.posts FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- enquetes, curtidas e comentários seguem a visibilidade do post
-- (o EXISTS em posts aplica a política posts_select de quem consulta)
CREATE POLICY "polls_select" ON public.post_polls FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.posts p WHERE p.id = post_id));
CREATE POLICY "polls_insert" ON public.post_polls FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.posts p WHERE p.id = post_id AND p.user_id = auth.uid()));
CREATE POLICY "poll_votes_select" ON public.post_poll_votes FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.post_polls pp WHERE pp.id = poll_id));
CREATE POLICY "poll_votes_insert" ON public.post_poll_votes FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.post_polls pp
      WHERE pp.id = poll_id AND pp.options @> jsonb_build_array(jsonb_build_object('id', option_id))
    )
  );

CREATE POLICY "likes_select" ON public.post_likes FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.posts p WHERE p.id = post_id AND p.user_id = auth.uid()));
CREATE POLICY "likes_insert" ON public.post_likes FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.posts p WHERE p.id = post_id));
CREATE POLICY "likes_delete" ON public.post_likes FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE POLICY "saves_select" ON public.post_saves FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "saves_insert" ON public.post_saves FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.posts p WHERE p.id = post_id));
CREATE POLICY "saves_delete" ON public.post_saves FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE POLICY "comments_select" ON public.post_comments FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.posts p WHERE p.id = post_id)
    AND (user_id = auth.uid() OR public.is_staff() OR NOT public.is_blocked_between(user_id, auth.uid()))
  );
CREATE POLICY "comments_insert" ON public.post_comments FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND public.can_interact()
    AND coalesce((SELECT (restrictions ->> 'cannotPost')::boolean FROM public.profiles WHERE id = auth.uid()), false) = false
    AND EXISTS (SELECT 1 FROM public.posts p WHERE p.id = post_id AND p.moderation_status <> 'removed')
  );
CREATE POLICY "comments_delete" ON public.post_comments FOR DELETE TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.posts p WHERE p.id = post_id AND p.user_id = auth.uid())
  );

-- álbuns e cofres
CREATE POLICY "albums_select" ON public.albums FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_staff()
    OR (
      NOT public.is_blocked_between(user_id, auth.uid())
      AND (
        visibility = 'public'
        OR visibility = 'private_vault'  -- capa/título do cofre são visíveis; itens não
        OR (visibility = 'connections_only' AND public.are_connected(user_id, auth.uid()))
      )
    )
  );
CREATE POLICY "albums_write" ON public.albums FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

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
  USING (EXISTS (SELECT 1 FROM public.albums a WHERE a.id = album_id AND a.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.albums a WHERE a.id = album_id AND a.user_id = auth.uid()));

-- Recusa e revogação ficam registradas como 'revoked': quem pediu não consegue
-- apagar a própria linha para pedir de novo (só cancelar enquanto está pendente).
CREATE POLICY "album_permissions_select" ON public.album_permissions FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.albums a WHERE a.id = album_id AND a.user_id = auth.uid())
    OR public.is_staff()
  );
CREATE POLICY "album_permissions_request" ON public.album_permissions FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid() AND status = 'pending' AND granted_at IS NULL
    AND public.can_interact()
    AND coalesce((SELECT (restrictions ->> 'cannotRequestVault')::boolean FROM public.profiles WHERE id = auth.uid()), false) = false
    AND EXISTS (
      SELECT 1 FROM public.albums a
      WHERE a.id = album_id AND a.user_id <> auth.uid() AND a.visibility = 'private_vault'
        AND NOT public.is_blocked_between(a.user_id, auth.uid())
    )
  );
CREATE POLICY "album_permissions_owner_update" ON public.album_permissions FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.albums a WHERE a.id = album_id AND a.user_id = auth.uid()))
  WITH CHECK (
    status IN ('granted', 'revoked')
    AND EXISTS (SELECT 1 FROM public.albums a WHERE a.id = album_id AND a.user_id = auth.uid())
  );
CREATE POLICY "album_permissions_delete" ON public.album_permissions FOR DELETE TO authenticated
  USING (
    (user_id = auth.uid() AND status = 'pending')
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

-- Ninguém da equipe lê mensagens direto pela tabela: moderadores só pela função auditada
-- admin_report_evidence (ligada a uma denúncia) e o superadmin pelas auditadas admin_*_conversation(s).
-- Mensagens não podem ser editadas nem apagadas: preservam a evidência em caso de assédio.
CREATE POLICY "messages_select" ON public.messages FOR SELECT TO authenticated
  USING (public.is_conversation_participant(conversation_id, auth.uid()));
-- Portão protetivo: enquanto o pedido não for aceito, só quem iniciou pode
-- escrever, uma única mensagem de texto. Bloqueio entre os participantes impede o envio.
CREATE POLICY "messages_insert" ON public.messages FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND status = 'sent'
    AND public.is_conversation_participant(conversation_id, auth.uid())
    AND public.can_interact()
    AND coalesce((SELECT (restrictions ->> 'cannotMessage')::boolean FROM public.profiles WHERE id = auth.uid()), false) = false
    AND NOT EXISTS (
      SELECT 1 FROM public.conversation_participants cp
      WHERE cp.conversation_id = messages.conversation_id AND cp.user_id <> auth.uid()
        AND public.is_blocked_between(cp.user_id, auth.uid())
    )
    AND EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = conversation_id
        AND (
          NOT c.is_pending_request
          OR (c.created_by = auth.uid() AND media_url IS NULL AND public.conversation_message_count(c.id) = 0)
        )
    )
  );

-- notificações
CREATE POLICY "notifications_select" ON public.notifications FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "notifications_update" ON public.notifications FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "notifications_delete" ON public.notifications FOR DELETE TO authenticated USING (user_id = auth.uid());

-- denúncias (andamento só pela RPC admin_resolve_report)
CREATE POLICY "reports_insert" ON public.moderation_reports FOR INSERT TO authenticated
  WITH CHECK (
    reporter_user_id = auth.uid() AND reporter_user_id <> reported_user_id
    AND status = 'pending' AND reviewed_by IS NULL AND resolution_note IS NULL AND resolved_at IS NULL
  );
CREATE POLICY "reports_select" ON public.moderation_reports FOR SELECT TO authenticated
  USING (reporter_user_id = auth.uid() OR public.is_staff());

-- administração: papéis, notas e auditoria só mudam pelas RPCs (que registram no livro)
CREATE POLICY "admin_users_select" ON public.admin_users FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_superadmin());

CREATE POLICY "admin_notes_select" ON public.admin_user_notes FOR SELECT TO authenticated USING (public.is_staff());

CREATE POLICY "audit_select" ON public.admin_audit_logs FOR SELECT TO authenticated USING (public.is_staff());

-- stories
CREATE POLICY "stories_select" ON public.stories FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_staff()
    OR (
      expires_at > now()
      AND NOT public.is_blocked_between(user_id, auth.uid())
      AND (audience = 'all' OR public.are_connected(user_id, auth.uid()))
    )
  );
CREATE POLICY "stories_insert" ON public.stories FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND expires_at <= now() + INTERVAL '25 hours'
    AND public.can_interact()
    AND coalesce((SELECT (restrictions ->> 'cannotPost')::boolean FROM public.profiles WHERE id = auth.uid()), false) = false
  );
CREATE POLICY "stories_delete" ON public.stories FOR DELETE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "story_views_select" ON public.story_views FOR SELECT TO authenticated
  USING (viewer_id = auth.uid() OR EXISTS (SELECT 1 FROM public.stories s WHERE s.id = story_id AND s.user_id = auth.uid()));
CREATE POLICY "story_views_insert" ON public.story_views FOR INSERT TO authenticated
  WITH CHECK (viewer_id = auth.uid() AND EXISTS (SELECT 1 FROM public.stories s WHERE s.id = story_id));

-- eventos (status e destaque só pela RPC admin_review_event)
CREATE POLICY "events_select" ON public.events FOR SELECT TO authenticated
  USING (status = 'approved' OR created_by = auth.uid() OR public.is_staff());
CREATE POLICY "events_insert" ON public.events FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid() AND public.can_interact()
    -- mesma regra de posts e stories: quem a moderação proibiu de postar não publica eventos
    AND coalesce((SELECT (restrictions ->> 'cannotPost')::boolean FROM public.profiles WHERE id = auth.uid()), false) = false
  );
CREATE POLICY "events_update" ON public.events FOR UPDATE TO authenticated
  USING (created_by = auth.uid()) WITH CHECK (created_by = auth.uid());
CREATE POLICY "events_delete" ON public.events FOR DELETE TO authenticated
  USING (created_by = auth.uid());

-- Quem abriu a arte de cada evento: só a equipe lê; a gravação é pela RPC record_event_view
CREATE POLICY "event_views_select" ON public.event_views FOR SELECT TO authenticated
  USING (public.is_staff());

-- Presença em evento é informação sensível: cada um vê só a sua (os totais ficam no evento)
CREATE POLICY "event_attendees_select" ON public.event_attendees FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_staff());
CREATE POLICY "event_attendees_write" ON public.event_attendees FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.status = 'approved'));

-- publicidade
CREATE POLICY "ads_select" ON public.ads FOR SELECT TO authenticated
  USING (public.is_staff() OR (is_active AND starts_at <= now() AND (ends_at IS NULL OR ends_at > now())));
CREATE POLICY "ads_manage" ON public.ads FOR ALL TO authenticated
  USING (public.is_superadmin()) WITH CHECK (public.is_superadmin());

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

-- O download pelo link público não passa por RLS. Esta política controla a LISTAGEM:
-- cada um lista só a própria pasta (antes, qualquer visitante listava o bucket inteiro).
CREATE POLICY "vybe_public_media_read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'public-media' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "vybe_public_media_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'public-media' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "vybe_public_media_update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'public-media' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'public-media' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "vybe_public_media_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'public-media' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Cofre: o dono; quem tem acesso liberado (item não removido pela moderação e sem
-- bloqueio entre os dois); moderação somente para itens com denúncia em aberto;
-- superadmin (MFA) para qualquer item, listado antes pela RPC auditada admin_vault_items.
CREATE POLICY "vybe_vault_read" ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'private-vaults' AND (
      (storage.foldername(objects.name))[1] = auth.uid()::text
      OR public.is_superadmin()
      OR EXISTS (
        SELECT 1 FROM public.album_items i
        JOIN public.albums a ON a.id = i.album_id
        WHERE i.storage_path = objects.name
          AND a.visibility = 'private_vault'
          AND a.user_id::text = (storage.foldername(objects.name))[1]
          AND i.moderation_status IN ('approved', 'pending_review')
          AND public.has_vault_access(a.id, auth.uid())
          AND NOT public.is_blocked_between(a.user_id, auth.uid())
      )
      OR (
        public.is_moderator()
        AND EXISTS (
          SELECT 1 FROM public.album_items i
          JOIN public.moderation_reports r
            ON r.target_type = 'media' AND r.target_id = i.id::text AND r.status IN ('pending', 'under_review')
          WHERE i.storage_path = objects.name
        )
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
