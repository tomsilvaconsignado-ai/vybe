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

-- Localização aproximada para a busca por distância (opcional; o usuário autoriza o GPS no app).
-- Guardada já arredondada numa grade de 0,02° (~2 km): a posição exata nunca chega ao banco.
-- Só o dono lê a própria linha; distâncias saem arredondadas pelas RPCs profile_distances / nearby_profiles.
CREATE TABLE IF NOT EXISTS public.user_geo (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  lat NUMERIC(6,2) NOT NULL CHECK (lat BETWEEN -90 AND 90),
  lng NUMERIC(6,2) NOT NULL CHECK (lng BETWEEN -180 AND 180),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

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

-- Comentários nos eventos da agenda (imutáveis; o autor, o organizador e a moderação podem apagar)
CREATE TABLE IF NOT EXISTS public.event_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL CHECK (length(trim(content)) BETWEEN 1 AND 1000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_event_comments_event ON public.event_comments(event_id, created_at);
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS comments_count INTEGER NOT NULL DEFAULT 0;

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
  placement VARCHAR(20) NOT NULL DEFAULT 'feed' CHECK (placement IN ('feed', 'sidebar', 'events', 'carousel', 'destaques')),
  starts_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ends_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  impressions INTEGER NOT NULL DEFAULT 0,
  clicks INTEGER NOT NULL DEFAULT 0,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Carrossel de slides na coluna lateral ("carousel" é das versões novas)
ALTER TABLE public.ads DROP CONSTRAINT IF EXISTS ads_placement_check;
ALTER TABLE public.ads ADD CONSTRAINT ads_placement_check
  CHECK (placement IN ('feed', 'sidebar', 'events', 'carousel', 'destaques'));

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

-- Fotos e GIFs do direct ficam no bucket privado chat-media, em <conversa>/<remetente>/<arquivo>.
-- A mensagem guarda 'chat-media/<caminho>' e o app gera um link assinado de curta duração.
CREATE OR REPLACE FUNCTION public.is_chat_media_path(u TEXT, conv UUID, sender UUID)
RETURNS BOOLEAN LANGUAGE sql IMMUTABLE AS $$
  SELECT u ~ ('^chat-media/' || conv::text || '/' || sender::text || '/[A-Za-z0-9_-]{1,80}\.(jpg|jpeg|png|webp|gif)$');
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
    IF NOT (public.is_app_media_url(NEW.media_url)
            OR public.is_chat_media_path(NEW.media_url, NEW.conversation_id, NEW.sender_id)) THEN
      RAISE EXCEPTION 'Mídia inválida.';
    END IF;
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

  ELSIF TG_TABLE_NAME = 'event_comments' THEN
    SELECT display_name INTO actor_name FROM public.profiles WHERE id = NEW.user_id;
    SELECT created_by INTO owner FROM public.events WHERE id = NEW.event_id;
    -- Evento de conta já excluída (created_by vazio) não tem a quem avisar
    IF owner IS NOT NULL THEN
      PERFORM public.notify(owner, NEW.user_id, 'event_comment', 'Comentário no seu evento',
        actor_name || ' comentou: ' || left(NEW.content, 80), NEW.event_id::text);
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
DROP TRIGGER IF EXISTS notify_event_comments ON public.event_comments;
CREATE TRIGGER notify_event_comments AFTER INSERT ON public.event_comments
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

-- ---------- Distância entre perfis ----------
-- Distância em km entre dois pontos (fórmula de haversine)
CREATE OR REPLACE FUNCTION public.geo_distance_km(lat1 NUMERIC, lng1 NUMERIC, lat2 NUMERIC, lng2 NUMERIC)
RETURNS DOUBLE PRECISION LANGUAGE sql IMMUTABLE AS $$
  SELECT 2 * 6371 * asin(least(1, sqrt(
    power(sin(radians((lat2 - lat1)::float8) / 2), 2)
    + cos(radians(lat1::float8)) * cos(radians(lat2::float8)) * power(sin(radians((lng2 - lng1)::float8) / 2), 2)
  )));
$$;

-- O que os outros veem: "região aproximada" arredonda de 5 em 5 km; localização oculta não mostra nada
CREATE OR REPLACE FUNCTION public.shown_distance_km(km DOUBLE PRECISION, privacy location_privacy_enum)
RETURNS INTEGER LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN km IS NULL OR privacy = 'hidden' THEN NULL
    WHEN privacy = 'approximate_region' THEN greatest(5, (ceil(km / 5) * 5)::int)
    ELSE greatest(2, ceil(km)::int)
  END;
$$;

-- Grava a localização do próprio usuário já na grade de ~2 km. Trocas seguidas (menos de
-- 10 min) são ignoradas, o que impede "triangular" alguém mudando a própria posição várias vezes.
CREATE OR REPLACE FUNCTION public.set_my_location(p_lat DOUBLE PRECISION, p_lng DOUBLE PRECISION)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE g_lat NUMERIC(6,2); g_lng NUMERIC(6,2); previous public.user_geo;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Não autenticado.'; END IF;
  IF p_lat IS NULL OR p_lng IS NULL OR p_lat NOT BETWEEN -90 AND 90 OR p_lng NOT BETWEEN -180 AND 180 THEN
    RAISE EXCEPTION 'Localização inválida.';
  END IF;
  g_lat := round((p_lat / 0.02)::numeric) * 0.02;
  g_lng := round((p_lng / 0.02)::numeric) * 0.02;
  SELECT * INTO previous FROM public.user_geo WHERE user_id = auth.uid();
  IF previous.user_id IS NOT NULL THEN
    IF previous.lat = g_lat AND previous.lng = g_lng THEN
      UPDATE public.user_geo SET updated_at = now() WHERE user_id = auth.uid();
      RETURN true;
    END IF;
    IF previous.updated_at > now() - INTERVAL '10 minutes' THEN RETURN false; END IF;
  END IF;
  INSERT INTO public.user_geo (user_id, lat, lng, updated_at) VALUES (auth.uid(), g_lat, g_lng, now())
  ON CONFLICT (user_id) DO UPDATE SET lat = EXCLUDED.lat, lng = EXCLUDED.lng, updated_at = now();
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.clear_my_location()
RETURNS VOID LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  DELETE FROM public.user_geo WHERE user_id = auth.uid();
$$;

-- Distância (arredondada) até os perfis pedidos. Sem a própria localização, não vê a de ninguém.
CREATE OR REPLACE FUNCTION public.profile_distances(ids UUID[])
RETURNS TABLE (profile_id UUID, distance_km INTEGER)
LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE AS $$
  SELECT p.id, public.shown_distance_km(public.geo_distance_km(me.lat, me.lng, g.lat, g.lng), p.location_privacy)
  FROM public.user_geo me
  JOIN public.profiles mine ON mine.id = me.user_id AND mine.location_privacy <> 'hidden'
  JOIN public.profiles p ON p.id = ANY(ids) AND p.id <> me.user_id
  JOIN public.user_geo g ON g.user_id = p.id
  WHERE me.user_id = auth.uid()
    AND p.location_privacy <> 'hidden' AND p.status <> 'blocked'
    AND NOT public.is_blocked_between(p.id, auth.uid())
  LIMIT 500;
$$;

-- Perfis dentro do raio, do mais perto ao mais longe (a busca "Só perto de mim")
CREATE OR REPLACE FUNCTION public.nearby_profiles(max_km INTEGER)
RETURNS TABLE (profile_id UUID, distance_km INTEGER)
LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE AS $$
  SELECT id, shown FROM (
    SELECT p.id,
      public.geo_distance_km(me.lat, me.lng, g.lat, g.lng) AS km,
      public.shown_distance_km(public.geo_distance_km(me.lat, me.lng, g.lat, g.lng), p.location_privacy) AS shown
    FROM public.user_geo me
    JOIN public.profiles mine ON mine.id = me.user_id AND mine.location_privacy <> 'hidden'
    JOIN public.user_geo g ON g.user_id <> me.user_id
    JOIN public.profiles p ON p.id = g.user_id
    WHERE me.user_id = auth.uid()
      AND p.location_privacy <> 'hidden' AND p.status <> 'blocked'
      AND NOT public.is_blocked_between(p.id, auth.uid())
      -- Caixa de latitude/longitude antes do cálculo exato (barato e evita varrer o país)
      AND g.lat BETWEEN me.lat - (least(greatest(max_km, 1), 2000) / 111.0) AND me.lat + (least(greatest(max_km, 1), 2000) / 111.0)
  ) candidates
  WHERE km <= least(greatest(max_km, 1), 2000)
  ORDER BY km
  LIMIT 300;
$$;

-- ---------- Mesma cidade / mesmo estado (pelo cadastro) ----------
-- Complementa a distância por GPS: funciona para quem não ativou a localização.
-- Compara sem acento e sem diferença de maiúsculas; estado por extenso ou sigla ("Sergipe" = "SE").
CREATE OR REPLACE FUNCTION public.norm_place(t TEXT)
RETURNS TEXT LANGUAGE sql IMMUTABLE AS $$
  SELECT regexp_replace(
    translate(lower(trim(coalesce(t, ''))), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc'),
    '\s+', ' ', 'g');
$$;

CREATE OR REPLACE FUNCTION public.norm_uf(t TEXT)
RETURNS TEXT LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE public.norm_place(t)
    WHEN 'acre' THEN 'AC' WHEN 'alagoas' THEN 'AL' WHEN 'amapa' THEN 'AP' WHEN 'amazonas' THEN 'AM'
    WHEN 'bahia' THEN 'BA' WHEN 'ceara' THEN 'CE' WHEN 'distrito federal' THEN 'DF' WHEN 'espirito santo' THEN 'ES'
    WHEN 'goias' THEN 'GO' WHEN 'maranhao' THEN 'MA' WHEN 'mato grosso' THEN 'MT' WHEN 'mato grosso do sul' THEN 'MS'
    WHEN 'minas gerais' THEN 'MG' WHEN 'para' THEN 'PA' WHEN 'paraiba' THEN 'PB' WHEN 'parana' THEN 'PR'
    WHEN 'pernambuco' THEN 'PE' WHEN 'piaui' THEN 'PI' WHEN 'rio de janeiro' THEN 'RJ' WHEN 'rio grande do norte' THEN 'RN'
    WHEN 'rio grande do sul' THEN 'RS' WHEN 'rondonia' THEN 'RO' WHEN 'roraima' THEN 'RR' WHEN 'santa catarina' THEN 'SC'
    WHEN 'sao paulo' THEN 'SP' WHEN 'sergipe' THEN 'SE' WHEN 'tocantins' THEN 'TO'
    ELSE upper(public.norm_place(t))
  END;
$$;

-- Perfis da mesma cidade ('city') ou do mesmo estado ('state'), pelo cadastro.
-- Cidade só casa com quem mostra a cidade (e se quem busca também mostra a sua);
-- estado inclui quem escolheu "região aproximada". Localização oculta fica de fora dos dois lados.
CREATE OR REPLACE FUNCTION public.same_region_profiles(scope TEXT)
RETURNS TABLE (profile_id UUID, match TEXT)
LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE AS $$
  SELECT p.id,
    CASE WHEN mine.location_privacy = 'city' AND p.location_privacy = 'city'
              AND public.norm_place(pp.city) = public.norm_place(mypp.city) THEN 'city' ELSE 'state' END
  FROM public.profile_private mypp
  JOIN public.profiles mine ON mine.id = mypp.user_id AND mine.location_privacy <> 'hidden'
  JOIN public.profile_private pp ON pp.user_id <> mypp.user_id
  JOIN public.profiles p ON p.id = pp.user_id
  WHERE mypp.user_id = auth.uid()
    AND scope IN ('city', 'state')
    AND public.norm_uf(mypp.state) <> '' AND public.norm_uf(pp.state) = public.norm_uf(mypp.state)
    AND p.location_privacy <> 'hidden' AND p.status <> 'blocked'
    AND NOT public.is_blocked_between(p.id, auth.uid())
    AND (scope = 'state' OR (
      mine.location_privacy = 'city' AND p.location_privacy = 'city'
      AND public.norm_place(mypp.city) <> '' AND public.norm_place(pp.city) = public.norm_place(mypp.city)
    ))
  ORDER BY p.last_active_at DESC
  LIMIT 300;
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
  real_km DOUBLE PRECISION; shown_km INT;
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

  -- Distância real quando os dois compartilham localização (e o alvo não a ocultou)
  SELECT public.geo_distance_km(ga.lat, ga.lng, gb.lat, gb.lng),
         public.shown_distance_km(public.geo_distance_km(ga.lat, ga.lng, gb.lat, gb.lng), p.location_privacy)
    INTO real_km, shown_km
    FROM public.user_geo ga, public.user_geo gb, public.profiles p, public.profiles mine
    WHERE ga.user_id = me AND gb.user_id = target AND p.id = target AND p.location_privacy <> 'hidden'
      AND mine.id = me AND mine.location_privacy <> 'hidden';
  IF real_km IS NOT NULL THEN dist := ceil(real_km)::int; END IF;
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

  -- 4. Distância (15): real quando há localização dos dois; senão, 30 km (sem pontuar como "longe")
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
    -- Só a distância arredondada sai daqui (nula quando não há localização dos dois)
    'distanceKm', shown_km, 'isMutualTargetMatch', mutual
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

-- Contador de comentários do evento
CREATE OR REPLACE FUNCTION public.count_event_comments()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE ev UUID := coalesce(NEW.event_id, OLD.event_id);
BEGIN
  UPDATE public.events SET comments_count = (SELECT count(*) FROM public.event_comments WHERE event_id = ev) WHERE id = ev;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS count_event_comments ON public.event_comments;
CREATE TRIGGER count_event_comments AFTER INSERT OR DELETE ON public.event_comments
  FOR EACH ROW EXECUTE FUNCTION public.count_event_comments();

-- Alcance e interações por evento (somente a equipe). "Interagiram" = pessoas que
-- responderam (vou / não vou / sem interesse) ou comentaram.
DROP FUNCTION IF EXISTS public.admin_event_stats();
CREATE OR REPLACE FUNCTION public.admin_event_stats()
RETURNS TABLE (event_id UUID, viewers BIGINT, opens BIGINT, going BIGINT, interested BIGINT, not_going BIGINT, not_interested BIGINT, comments BIGINT, commenters BIGINT, interacted BIGINT)
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
    (SELECT count(*) FROM public.event_comments c WHERE c.event_id = e.id),
    (SELECT count(DISTINCT c.user_id) FROM public.event_comments c WHERE c.event_id = e.id),
    (SELECT count(*) FROM (
      SELECT a.user_id FROM public.event_attendees a WHERE a.event_id = e.id
      UNION
      SELECT c.user_id FROM public.event_comments c WHERE c.event_id = e.id
    ) people)
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
      NEW.comments_count := 0;
    ELSE
      NEW.created_by := OLD.created_by;
      NEW.status := 'pending';  -- edição volta para análise
      NEW.is_featured := OLD.is_featured;
      NEW.going_count := OLD.going_count;
      NEW.interested_count := OLD.interested_count;
      NEW.comments_count := OLD.comments_count;
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

-- Lembrete periódico para quem ainda não colocou foto no perfil: no máximo um a cada
-- 7 dias, só depois do primeiro dia de conta e até 8 vezes (para não virar insistência).
CREATE OR REPLACE FUNCTION public.send_avatar_reminder(uid UUID)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = uid AND p.avatar_url = '' AND p.status IN ('active', 'warned')
      AND p.created_at < now() - interval '1 day'
  ) THEN
    RETURN false;
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.notifications n
    WHERE n.user_id = uid AND n.type = 'profile_photo_reminder' AND n.created_at > now() - interval '7 days'
  ) OR (
    SELECT count(*) FROM public.notifications n WHERE n.user_id = uid AND n.type = 'profile_photo_reminder'
  ) >= 8 THEN
    RETURN false;
  END IF;
  PERFORM public.notify(uid, NULL, 'profile_photo_reminder', 'Seu perfil ainda está sem foto 📸',
    'Perfis com foto têm muito mais chances de receber visitas, curtidas e mensagens: é a primeira coisa que as pessoas olham. '
    || 'Coloque a sua (pode ser discreta, sem mostrar o rosto) e aumente suas chances de conexão.', NULL);
  RETURN true;
END;
$$;

-- Rodada diária (pg_cron) para todos os perfis sem foto; devolve quantos lembretes saíram
CREATE OR REPLACE FUNCTION public.send_avatar_reminders()
RETURNS INTEGER LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT count(*)::int FROM public.profiles p
  WHERE p.avatar_url = '' AND public.send_avatar_reminder(p.id);
$$;

-- O app também pede o lembrete ao abrir (garante o aviso mesmo sem o agendamento)
CREATE OR REPLACE FUNCTION public.request_avatar_reminder()
RETURNS VOID LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT public.send_avatar_reminder(auth.uid()) WHERE auth.uid() IS NOT NULL;
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
    'admin_user_notes', 'admin_audit_logs', 'stories', 'story_views', 'events', 'event_attendees', 'event_views', 'ads', 'user_presence', 'event_comments', 'user_geo'
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
GRANT EXECUTE ON FUNCTION public.set_my_location(DOUBLE PRECISION, DOUBLE PRECISION) TO authenticated;
GRANT EXECUTE ON FUNCTION public.clear_my_location() TO authenticated;
GRANT EXECUTE ON FUNCTION public.profile_distances(UUID[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.nearby_profiles(INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.same_region_profiles(TEXT) TO authenticated;
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
REVOKE EXECUTE ON FUNCTION public.send_avatar_reminder(UUID), public.send_avatar_reminders() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.request_avatar_reminder() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_avatar_reminder() TO authenticated;
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

-- Comentários de eventos: visíveis onde o evento é visível, sem quem bloqueou/foi bloqueado.
-- Comentar exige conta ativa, sem restrição de postar, em evento publicado.
CREATE POLICY "event_comments_select" ON public.event_comments FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id
            AND (e.status = 'approved' OR e.created_by = auth.uid() OR public.is_staff()))
    AND (user_id = auth.uid() OR public.is_staff() OR NOT public.is_blocked_between(user_id, auth.uid()))
  );
CREATE POLICY "event_comments_insert" ON public.event_comments FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND public.can_interact()
    AND coalesce((SELECT (restrictions ->> 'cannotPost')::boolean FROM public.profiles WHERE id = auth.uid()), false) = false
    AND EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.status = 'approved')
    AND NOT EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND public.is_blocked_between(e.created_by, auth.uid()))
  );
CREATE POLICY "event_comments_delete" ON public.event_comments FOR DELETE TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.created_by = auth.uid())
    OR public.is_moderator()
  );

-- Localização aproximada: cada um lê só a própria; gravar e apagar é pelas RPCs set/clear_my_location
CREATE POLICY "user_geo_select_own" ON public.user_geo FOR SELECT TO authenticated
  USING (user_id = auth.uid());

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
VALUES ('chat-media', 'chat-media', false, 10485760,
        ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
ON CONFLICT (id) DO UPDATE SET public = false, file_size_limit = EXCLUDED.file_size_limit,
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
DROP POLICY IF EXISTS "vybe_chat_media_read" ON storage.objects;
DROP POLICY IF EXISTS "vybe_chat_media_insert" ON storage.objects;

-- Lê a foto quem participa da conversa; o superadmin (MFA); a moderação só com denúncia aberta da conversa
CREATE OR REPLACE FUNCTION public.can_read_chat_media(obj_name TEXT)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE AS $$
  SELECT EXISTS (
      SELECT 1 FROM public.conversation_participants cp
      WHERE cp.conversation_id::text = split_part(obj_name, '/', 1) AND cp.user_id = auth.uid()
    )
    OR public.is_superadmin()
    OR (public.is_moderator() AND EXISTS (
      SELECT 1 FROM public.moderation_reports r
      WHERE r.target_type = 'message' AND r.target_id = split_part(obj_name, '/', 1)
        AND r.status IN ('pending', 'under_review')
    ));
$$;

-- Envia quem participa de uma conversa já aceita, na própria pasta (pedido pendente aceita só texto)
CREATE OR REPLACE FUNCTION public.can_upload_chat_media(obj_name TEXT)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE AS $$
  SELECT split_part(obj_name, '/', 2) = auth.uid()::text
    AND position('..' IN obj_name) = 0
    AND public.can_interact()
    AND EXISTS (
      SELECT 1 FROM public.conversations c
      JOIN public.conversation_participants cp ON cp.conversation_id = c.id
      WHERE c.id::text = split_part(obj_name, '/', 1) AND cp.user_id = auth.uid() AND NOT c.is_pending_request
    );
$$;

REVOKE EXECUTE ON FUNCTION public.can_read_chat_media(TEXT), public.can_upload_chat_media(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_read_chat_media(TEXT), public.can_upload_chat_media(TEXT) TO authenticated;

-- Fotos do direct não podem ser apagadas nem trocadas (como as mensagens, preservam a evidência)
CREATE POLICY "vybe_chat_media_read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'chat-media' AND public.can_read_chat_media(name));
CREATE POLICY "vybe_chat_media_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'chat-media' AND public.can_upload_chat_media(name));

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

-- ==============================================================================
-- 9. AGENDAMENTOS (pg_cron)
-- Lembrete de foto de perfil todo dia às 12h de Brasília (15h UTC). Se o pg_cron não
-- estiver disponível, nada quebra: o app pede o lembrete quando a pessoa entra.
-- ==============================================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'pg_cron') THEN
    CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
    PERFORM cron.schedule('vybelog-lembrete-foto-perfil', '0 15 * * *', 'SELECT public.send_avatar_reminders()');
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Agendamento do lembrete de foto não criado: %', SQLERRM;
END $$;

-- ==============================================================================
-- 10. NOTIFICAÇÕES PUSH (Web Push / VAPID)
-- Cada notificação criada pelo banco (curtida, comentário, seguidor, mensagem, evento...) entra numa
-- fila por aparelho autorizado, respeitando as preferências (categorias, silenciar, horário silencioso).
-- A Edge Function "push" envia com a chave VAPID privada (só no servidor) e devolve o resultado.
-- O conteúdo da tela bloqueada é discreto: nada de texto de mensagem, comentário ou mídia.
-- ==============================================================================

-- 10.1 Notificação: link de destino, chave anti-duplicidade e texto para a tela bloqueada
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS link TEXT;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS dedupe_key TEXT;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS category VARCHAR(30);
CREATE UNIQUE INDEX IF NOT EXISTS uq_notifications_dedupe ON public.notifications(user_id, dedupe_key) WHERE dedupe_key IS NOT NULL;

-- Categoria (preferências) e destino de cada tipo de notificação
CREATE OR REPLACE FUNCTION public.notification_category(p_type TEXT)
RETURNS TEXT LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN p_type = 'follow' THEN 'follows'
    WHEN p_type IN ('like', 'comment_like') THEN 'likes'
    WHEN p_type IN ('comment', 'event_comment') THEN 'comments'
    WHEN p_type = 'comment_reply' THEN 'replies'
    WHEN p_type = 'mention' THEN 'mentions'
    WHEN p_type IN ('message', 'message_request') THEN 'messages'
    WHEN p_type IN ('connection_request', 'connection_accepted') THEN 'connections'
    WHEN p_type LIKE 'group\_%' OR p_type LIKE 'community\_%' THEN 'groups'
    WHEN p_type LIKE 'event\_%' THEN 'events'
    WHEN p_type IN ('vault_access_request', 'vault_access_granted') THEN 'vault'
    WHEN p_type = 'admin_broadcast' THEN 'announcements'
    WHEN p_type IN ('system_safety', 'security_alert') THEN 'essential'
    ELSE 'other'
  END;
$$;

CREATE OR REPLACE FUNCTION public.notification_link(p_type TEXT, p_ref TEXT, p_actor UUID)
RETURNS TEXT LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN p_ref IS NULL OR p_ref = '' THEN '/notificacoes'
    WHEN p_type IN ('like', 'comment', 'comment_reply', 'mention', 'comment_like') THEN '/publicacao/' || split_part(p_ref, '#', 1)
      || CASE WHEN position('#' IN p_ref) > 0 THEN '?comentario=' || split_part(p_ref, '#', 2) ELSE '' END
    WHEN p_type IN ('follow', 'connection_request', 'connection_accepted') THEN '/perfil/' || p_ref
    WHEN p_type IN ('message', 'message_request') THEN '/mensagens/' || p_ref
    WHEN p_type LIKE 'event\_%' THEN '/eventos/' || p_ref
    WHEN p_type LIKE 'group\_%' OR p_type LIKE 'community\_%' THEN '/comunidades/' || p_ref
    WHEN p_type = 'vault_access_request' THEN '/perfil'
    WHEN p_type = 'vault_access_granted' AND p_actor IS NOT NULL THEN '/perfil/' || p_actor
    WHEN p_type = 'profile_photo_reminder' THEN '/perfil'
    ELSE '/notificacoes'
  END;
$$;

CREATE OR REPLACE FUNCTION public.notifications_fill() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
  NEW.category := coalesce(NEW.category, public.notification_category(NEW.type));
  NEW.link := coalesce(NEW.link, public.notification_link(NEW.type, NEW.reference_id, NEW.actor_id));
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS notifications_fill ON public.notifications;
CREATE TRIGGER notifications_fill BEFORE INSERT ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION public.notifications_fill();

-- notificações já existentes: categoria e destino (só preenche o que está vazio)
UPDATE public.notifications SET category = public.notification_category(type) WHERE category IS NULL;
UPDATE public.notifications SET link = public.notification_link(type, reference_id, actor_id) WHERE link IS NULL;

-- 10.2 Preferências por pessoa
CREATE TABLE IF NOT EXISTS public.notification_preferences (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  categories JSONB NOT NULL DEFAULT '{}',          -- {"likes": false, ...}; ausente = ligado
  muted_until TIMESTAMPTZ,                          -- silenciar temporariamente
  quiet_start TIME,                                 -- horário silencioso (ex.: 23:00)
  quiet_end TIME,                                   -- (ex.: 07:00); atravessa a meia-noite
  timezone TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
  show_names BOOLEAN NOT NULL DEFAULT false,        -- nomes na tela bloqueada (padrão: discreto)
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS notification_preferences_own ON public.notification_preferences;
CREATE POLICY notification_preferences_own ON public.notification_preferences FOR SELECT TO authenticated USING (user_id = auth.uid());
REVOKE INSERT, UPDATE, DELETE ON public.notification_preferences FROM authenticated, anon;
REVOKE ALL ON public.notification_preferences FROM anon;

-- 10.3 Aparelhos inscritos (um por navegador/aparelho; vários por pessoa)
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE CHECK (endpoint ~ '^https://'),
  p256dh TEXT NOT NULL CHECK (length(p256dh) BETWEEN 40 AND 200),
  auth TEXT NOT NULL CHECK (length(auth) BETWEEN 10 AND 100),
  device_label VARCHAR(120),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_success_at TIMESTAMPTZ,
  active BOOLEAN NOT NULL DEFAULT true,
  failures INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user ON public.push_subscriptions(user_id) WHERE active;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.push_subscriptions FROM anon, authenticated;   -- chaves nunca saem para a tela

-- 10.4 Fila de envio (uma linha por notificação × aparelho)
CREATE TABLE IF NOT EXISTS public.push_queue (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  notification_id UUID NOT NULL REFERENCES public.notifications(id) ON DELETE CASCADE,
  subscription_id UUID NOT NULL REFERENCES public.push_subscriptions(id) ON DELETE CASCADE,
  status VARCHAR(12) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sending', 'sent', 'failed', 'skipped')),
  attempts INTEGER NOT NULL DEFAULT 0,
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  claimed_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  http_status INTEGER,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (notification_id, subscription_id)
);
CREATE INDEX IF NOT EXISTS idx_push_queue_due ON public.push_queue(next_attempt_at) WHERE status IN ('pending', 'sending');
ALTER TABLE public.push_queue ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.push_queue FROM anon, authenticated;

-- Configuração pública (chave VAPID pública, lida pelo app)
CREATE TABLE IF NOT EXISTS public.app_settings (
  key VARCHAR(60) PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS app_settings_public_read ON public.app_settings;
CREATE POLICY app_settings_public_read ON public.app_settings FOR SELECT TO authenticated USING (key LIKE 'public.%');
REVOKE INSERT, UPDATE, DELETE ON public.app_settings FROM anon, authenticated;

-- 10.5 Regras de envio
-- A pessoa quer push desta categoria agora? Devolve o momento de envio (adiado no horário silencioso)
-- ou NULL para não enviar. Categoria "essential" (segurança da conta) ignora as preferências.
CREATE OR REPLACE FUNCTION public.push_send_time(p_user UUID, p_category TEXT)
RETURNS TIMESTAMPTZ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  pref public.notification_preferences;
  local_now TIMESTAMP;
  t TIME;
  fim TIMESTAMP;
BEGIN
  SELECT * INTO pref FROM public.notification_preferences WHERE user_id = p_user;
  IF p_category = 'essential' OR pref.user_id IS NULL THEN RETURN now(); END IF;
  IF coalesce((pref.categories ->> p_category)::boolean, true) = false THEN RETURN NULL; END IF;
  IF pref.muted_until IS NOT NULL AND pref.muted_until > now() THEN RETURN NULL; END IF;
  IF pref.quiet_start IS NULL OR pref.quiet_end IS NULL OR pref.quiet_start = pref.quiet_end THEN RETURN now(); END IF;
  local_now := now() AT TIME ZONE pref.timezone;
  t := local_now::time;
  IF (pref.quiet_start < pref.quiet_end AND t >= pref.quiet_start AND t < pref.quiet_end)
     OR (pref.quiet_start > pref.quiet_end AND (t >= pref.quiet_start OR t < pref.quiet_end)) THEN
    fim := local_now::date + pref.quiet_end;
    IF fim <= local_now THEN fim := fim + INTERVAL '1 day'; END IF;
    RETURN fim AT TIME ZONE pref.timezone;   -- entrega ao fim do horário silencioso
  END IF;
  RETURN now();
END;
$$;

-- Texto da tela bloqueada: discreto por padrão; com "mostrar nomes", cita quem agiu (nunca o conteúdo)
CREATE OR REPLACE FUNCTION public.push_text(p_type TEXT, p_actor UUID, p_user UUID, p_title TEXT, p_message TEXT)
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  nomes BOOLEAN := coalesce((SELECT show_names FROM public.notification_preferences WHERE user_id = p_user), false);
  quem TEXT := CASE WHEN nomes AND p_actor IS NOT NULL THEN (SELECT display_name FROM public.profiles WHERE id = p_actor) END;
BEGIN
  RETURN CASE
    WHEN p_type = 'follow' THEN jsonb_build_object('t', 'Novo seguidor!', 'b', coalesce(quem || ' começou a seguir você no Vybelog.', 'Você tem um novo seguidor no Vybelog.'))
    WHEN p_type = 'like' THEN jsonb_build_object('t', 'Nova curtida!', 'b', coalesce(quem || ' curtiu sua publicação.', 'Alguém curtiu sua publicação.'))
    WHEN p_type IN ('comment', 'event_comment') THEN jsonb_build_object('t', 'Nova interação!', 'b', coalesce(quem || ' comentou na sua publicação.', 'Há um novo comentário para você.'))
    WHEN p_type = 'comment_reply' THEN jsonb_build_object('t', 'Nova resposta!', 'b', coalesce(quem || ' respondeu ao seu comentário.', 'Responderam ao seu comentário.'))
    WHEN p_type = 'mention' THEN jsonb_build_object('t', 'Você foi mencionado!', 'b', coalesce(quem || ' mencionou você.', 'Mencionaram você em uma publicação.'))
    WHEN p_type = 'message' THEN jsonb_build_object('t', 'Nova mensagem!', 'b', coalesce('Você recebeu uma nova mensagem de ' || quem || '.', 'Você recebeu uma nova mensagem.'))
    WHEN p_type = 'message_request' THEN jsonb_build_object('t', 'Novo pedido de mensagem', 'b', 'Alguém quer conversar com você.')
    WHEN p_type = 'connection_request' THEN jsonb_build_object('t', 'Pedido de conexão', 'b', coalesce(quem || ' quer se conectar com você.', 'Você recebeu um pedido de conexão.'))
    WHEN p_type = 'connection_accepted' THEN jsonb_build_object('t', 'Conexão aceita!', 'b', coalesce(quem || ' aceitou sua conexão.', 'Um pedido de conexão foi aceito.'))
    WHEN p_type LIKE 'vault\_%' THEN jsonb_build_object('t', 'Cofre privado', 'b', 'Há uma novidade no seu cofre privado.')
    WHEN p_type LIKE 'event\_%' THEN jsonb_build_object('t', 'Eventos', 'b', 'Há uma novidade em um evento.')
    WHEN p_type LIKE 'group\_%' OR p_type LIKE 'community\_%' THEN jsonb_build_object('t', 'Comunidades', 'b', 'Há uma novidade em uma comunidade.')
    WHEN p_type = 'admin_broadcast' THEN jsonb_build_object('t', left(p_title, 80), 'b', left(p_message, 160))
    ELSE jsonb_build_object('t', 'Vybelog', 'b', 'Você tem uma nova notificação.')
  END;
END;
$$;

-- Cada notificação nova entra na fila dos aparelhos ativos da pessoa (com limite contra abuso)
CREATE OR REPLACE FUNCTION public.push_enqueue() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n INTEGER;
BEGIN
  INSERT INTO public.push_queue (notification_id, subscription_id, next_attempt_at, status, error)
  SELECT x.id, s.id, coalesce(x.quando, now()),
         CASE WHEN x.quando IS NULL THEN 'skipped'
              WHEN x.recentes >= 30 AND x.category <> 'essential' THEN 'skipped' ELSE 'pending' END,
         CASE WHEN x.quando IS NULL THEN 'preferências' WHEN x.recentes >= 30 AND x.category <> 'essential' THEN 'limite de envio' END
    FROM (SELECT nn.id, nn.user_id, nn.category, public.push_send_time(nn.user_id, nn.category) AS quando,
                 (SELECT count(*) FROM public.push_queue q JOIN public.notifications o ON o.id = q.notification_id
                   WHERE o.user_id = nn.user_id AND q.created_at > now() - INTERVAL '10 minutes' AND q.status <> 'skipped')
                 + row_number() OVER (PARTITION BY nn.user_id ORDER BY nn.created_at, nn.id) - 1 AS recentes
            FROM novas nn) x
    JOIN public.push_subscriptions s ON s.user_id = x.user_id AND s.active
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n > 0 THEN PERFORM public.push_wake(); END IF;
  RETURN NULL;
END;
$$;

-- Acorda a Edge Function (pg_net, depois do commit). Sem pg_net/segredo: o agendamento de 1 min envia.
CREATE OR REPLACE FUNCTION public.push_wake() RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE url TEXT; segredo TEXT;
BEGIN
  IF to_regprocedure('net.http_post(text,jsonb,jsonb,jsonb,integer)') IS NULL THEN RETURN; END IF;
  SELECT value INTO url FROM public.app_settings WHERE key = 'push.function_url';
  IF url IS NULL THEN RETURN; END IF;
  BEGIN
    EXECUTE 'SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = $1' INTO segredo USING 'vybelog_push_secret';
  EXCEPTION WHEN OTHERS THEN segredo := NULL;
  END;
  IF segredo IS NULL THEN RETURN; END IF;
  EXECUTE 'SELECT net.http_post(url := $1, body := $2, headers := $3, timeout_milliseconds := 30000)'
    USING url, '{}'::jsonb, jsonb_build_object('Content-Type', 'application/json', 'x-push-secret', segredo);
EXCEPTION WHEN OTHERS THEN NULL;   -- o envio nunca derruba a ação que gerou a notificação
END;
$$;

DROP TRIGGER IF EXISTS notifications_push ON public.notifications;
CREATE TRIGGER notifications_push AFTER INSERT ON public.notifications REFERENCING NEW TABLE AS novas
  FOR EACH STATEMENT EXECUTE FUNCTION public.push_enqueue();

-- 10.6 Mensagens privadas avisam o destinatário (sem o conteúdo). Conversa silenciada não avisa;
-- várias mensagens seguidas da mesma conversa viram um aviso só enquanto não for lido.
CREATE OR REPLACE FUNCTION public.notify_on_message() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  dest RECORD;
  pendente BOOLEAN;
  nome TEXT;
BEGIN
  SELECT is_pending_request INTO pendente FROM public.conversations WHERE id = NEW.conversation_id;
  SELECT display_name INTO nome FROM public.profiles WHERE id = NEW.sender_id;
  FOR dest IN
    SELECT cp.user_id FROM public.conversation_participants cp
     WHERE cp.conversation_id = NEW.conversation_id AND cp.user_id <> NEW.sender_id AND NOT cp.is_muted
       AND NOT public.is_blocked_between(cp.user_id, NEW.sender_id)
  LOOP
    IF EXISTS (SELECT 1 FROM public.notifications
                WHERE user_id = dest.user_id AND type IN ('message', 'message_request') AND reference_id = NEW.conversation_id::text AND NOT read) THEN
      CONTINUE;
    END IF;
    INSERT INTO public.notifications (user_id, actor_id, type, title, message, reference_id)
    VALUES (dest.user_id, NEW.sender_id, CASE WHEN pendente THEN 'message_request' ELSE 'message' END,
            CASE WHEN pendente THEN 'Novo pedido de mensagem' ELSE 'Nova mensagem' END,
            'Você recebeu uma nova mensagem de ' || coalesce(nome, 'um membro') || '.', NEW.conversation_id::text);
  END LOOP;
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS notify_messages ON public.messages;
CREATE TRIGGER notify_messages AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_message();

-- Abrir a conversa marca os avisos dela como lidos
CREATE OR REPLACE FUNCTION public.mark_conversation_notifications_read(conv UUID)
RETURNS VOID LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.notifications SET read = true
   WHERE user_id = auth.uid() AND type IN ('message', 'message_request') AND reference_id = conv::text AND NOT read;
$$;

-- 10.7 Funções do app (a própria pessoa)
CREATE OR REPLACE FUNCTION public.push_subscribe(p_endpoint TEXT, p_p256dh TEXT, p_auth TEXT, p_device TEXT)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v UUID;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Faça login.'; END IF;
  INSERT INTO public.push_subscriptions (user_id, endpoint, p256dh, auth, device_label)
  VALUES (auth.uid(), p_endpoint, p_p256dh, p_auth, left(p_device, 120))
  ON CONFLICT (endpoint) DO UPDATE SET user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth,
    device_label = excluded.device_label, active = true, failures = 0, updated_at = now()
  RETURNING id INTO v;
  RETURN v;
END;
$$;

CREATE OR REPLACE FUNCTION public.push_unsubscribe(p_id UUID DEFAULT NULL, p_endpoint TEXT DEFAULT NULL)
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n INTEGER;
BEGIN
  UPDATE public.push_subscriptions SET active = false, updated_at = now()
   WHERE user_id = auth.uid() AND active AND (id = p_id OR endpoint = p_endpoint);
  GET DIAGNOSTICS n = ROW_COUNT;
  UPDATE public.push_queue SET status = 'skipped', error = 'aparelho removido'
   WHERE status IN ('pending', 'sending') AND subscription_id IN (SELECT id FROM public.push_subscriptions WHERE user_id = auth.uid() AND NOT active);
  RETURN n;
END;
$$;

CREATE OR REPLACE FUNCTION public.my_push_devices()
RETURNS TABLE (id UUID, device_label TEXT, created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ, last_success_at TIMESTAMPTZ, active BOOLEAN, endpoint_tail TEXT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT s.id, s.device_label::text, s.created_at, s.updated_at, s.last_success_at, s.active, right(s.endpoint, 16)
    FROM public.push_subscriptions s
   WHERE s.user_id = auth.uid() AND (s.active OR s.updated_at > now() - INTERVAL '30 days')
   ORDER BY s.active DESC, s.updated_at DESC;
$$;

CREATE OR REPLACE FUNCTION public.save_notification_preferences(p JSONB)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Faça login.'; END IF;
  INSERT INTO public.notification_preferences (user_id, categories, muted_until, quiet_start, quiet_end, timezone, show_names, updated_at)
  VALUES (auth.uid(), coalesce(p -> 'categories', '{}'), nullif(p ->> 'muted_until', '')::timestamptz,
          nullif(p ->> 'quiet_start', '')::time, nullif(p ->> 'quiet_end', '')::time,
          coalesce(nullif(p ->> 'timezone', ''), 'America/Sao_Paulo'), coalesce((p ->> 'show_names')::boolean, false), now())
  ON CONFLICT (user_id) DO UPDATE SET categories = excluded.categories, muted_until = excluded.muted_until,
    quiet_start = excluded.quiet_start, quiet_end = excluded.quiet_end, timezone = excluded.timezone,
    show_names = excluded.show_names, updated_at = now();
END;
$$;

-- 10.8 Fila: usada só pela Edge Function (chave de serviço)
CREATE OR REPLACE FUNCTION public.push_claim(p_limit INTEGER DEFAULT 50)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v JSONB;
BEGIN
  UPDATE public.push_queue SET status = 'pending' WHERE status = 'sending' AND claimed_at < now() - INTERVAL '5 minutes';
  WITH alvo AS (
    SELECT q.id FROM public.push_queue q
     WHERE q.status = 'pending' AND q.next_attempt_at <= now()
     ORDER BY q.next_attempt_at LIMIT least(greatest(p_limit, 1), 200)
     FOR UPDATE SKIP LOCKED
  ), marcados AS (
    UPDATE public.push_queue q SET status = 'sending', claimed_at = now(), attempts = q.attempts + 1
      FROM alvo WHERE q.id = alvo.id RETURNING q.*
  )
  SELECT coalesce(jsonb_agg(jsonb_build_object(
      'id', m.id, 'endpoint', s.endpoint, 'p256dh', s.p256dh, 'auth', s.auth,
      'payload', public.push_text(n.type, n.actor_id, n.user_id, n.title, n.message)
                 || jsonb_build_object('link', coalesce(n.link, '/notificacoes'), 'tag', coalesce(n.type, 'vybe') || ':' || coalesce(n.reference_id, n.id::text), 'id', n.id))), '[]')
    INTO v
    FROM marcados m JOIN public.push_subscriptions s ON s.id = m.subscription_id JOIN public.notifications n ON n.id = m.notification_id;
  RETURN v;
END;
$$;

-- p_results: [{id, ok, status, error}]
CREATE OR REPLACE FUNCTION public.push_complete(p_results JSONB)
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r JSONB; q public.push_queue; n INTEGER := 0;
BEGIN
  FOR r IN SELECT * FROM jsonb_array_elements(p_results) LOOP
    SELECT * INTO q FROM public.push_queue WHERE id = (r ->> 'id')::bigint;
    IF q.id IS NULL THEN CONTINUE; END IF;
    IF (r ->> 'ok')::boolean THEN
      UPDATE public.push_queue SET status = 'sent', sent_at = now(), http_status = (r ->> 'status')::int, error = NULL WHERE id = q.id;
      UPDATE public.push_subscriptions SET last_success_at = now(), failures = 0 WHERE id = q.subscription_id;
    ELSIF (r ->> 'status')::int IN (404, 410) THEN
      -- inscrição expirada ou revogada no aparelho: desativa e não tenta mais
      UPDATE public.push_queue SET status = 'skipped', http_status = (r ->> 'status')::int, error = left(r ->> 'error', 300) WHERE id = q.id;
      UPDATE public.push_subscriptions SET active = false, updated_at = now() WHERE id = q.subscription_id;
    ELSE
      UPDATE public.push_queue SET
        status = CASE WHEN q.attempts >= 5 THEN 'failed' ELSE 'pending' END,
        next_attempt_at = now() + (CASE q.attempts WHEN 1 THEN 1 WHEN 2 THEN 5 WHEN 3 THEN 15 ELSE 60 END) * INTERVAL '1 minute',
        http_status = nullif(r ->> 'status', '')::int, error = left(r ->> 'error', 300)
       WHERE id = q.id;
      UPDATE public.push_subscriptions SET failures = failures + 1,
             active = CASE WHEN failures + 1 >= 20 THEN false ELSE active END WHERE id = q.subscription_id;
    END IF;
    n := n + 1;
  END LOOP;
  RETURN n;
END;
$$;

-- Limpeza: fila antiga e aparelhos inativos há muito tempo
CREATE OR REPLACE FUNCTION public.push_cleanup() RETURNS VOID
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  DELETE FROM public.push_queue WHERE created_at < now() - INTERVAL '30 days';
  DELETE FROM public.push_subscriptions WHERE NOT active AND updated_at < now() - INTERVAL '90 days';
$$;

-- 10.9 Comunicados administrativos (avisos da plataforma por push e na central)
CREATE TABLE IF NOT EXISTS public.admin_broadcasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(80) NOT NULL CHECK (length(trim(title)) >= 3),
  body VARCHAR(300) NOT NULL CHECK (length(trim(body)) >= 3),
  audience VARCHAR(20) NOT NULL CHECK (audience IN ('all', 'active_30d', 'event', 'community', 'verified')),
  audience_ref UUID,
  link TEXT,
  scheduled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at TIMESTAMPTZ,
  recipients INTEGER,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  cancelled_at TIMESTAMPTZ
);
ALTER TABLE public.admin_broadcasts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS admin_broadcasts_staff ON public.admin_broadcasts;
CREATE POLICY admin_broadcasts_staff ON public.admin_broadcasts FOR SELECT TO authenticated USING (public.is_staff());
REVOKE INSERT, UPDATE, DELETE ON public.admin_broadcasts FROM anon, authenticated;

-- Dispara os comunicados vencidos (agora ou programados). Público só por critérios não sensíveis.
CREATE OR REPLACE FUNCTION public.dispatch_broadcasts() RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE b public.admin_broadcasts; total INTEGER := 0; n INTEGER;
BEGIN
  FOR b IN SELECT * FROM public.admin_broadcasts WHERE sent_at IS NULL AND cancelled_at IS NULL AND scheduled_at <= now() FOR UPDATE SKIP LOCKED LOOP
    INSERT INTO public.notifications (user_id, actor_id, type, title, message, reference_id, link, dedupe_key)
    SELECT p.id, NULL, 'admin_broadcast', b.title, b.body, b.id::text, coalesce(b.link, '/notificacoes'), 'broadcast:' || b.id
      FROM public.profiles p
     WHERE p.status::text <> 'suspended'
       AND CASE b.audience
             WHEN 'all' THEN true
             WHEN 'active_30d' THEN EXISTS (SELECT 1 FROM public.user_presence up WHERE up.user_id = p.id AND up.last_seen_at > now() - INTERVAL '30 days')
             WHEN 'verified' THEN coalesce(p.is_verified, false)
             WHEN 'event' THEN EXISTS (SELECT 1 FROM public.event_attendees ea WHERE ea.event_id = b.audience_ref AND ea.user_id = p.id AND ea.status IN ('going', 'interested'))
             WHEN 'community' THEN EXISTS (SELECT 1 FROM public.community_members cm WHERE cm.community_id = b.audience_ref AND cm.user_id = p.id)
           END
    ON CONFLICT DO NOTHING;
    GET DIAGNOSTICS n = ROW_COUNT;
    UPDATE public.admin_broadcasts SET sent_at = now(), recipients = n WHERE id = b.id;
    total := total + n;
  END LOOP;
  RETURN total;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_create_broadcast(p_title TEXT, p_body TEXT, p_audience TEXT, p_ref UUID, p_link TEXT, p_when TIMESTAMPTZ, justification TEXT)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v UUID;
BEGIN
  IF NOT public.is_superadmin() THEN RAISE EXCEPTION 'Somente o superadministrador (com MFA) envia comunicados.'; END IF;
  IF coalesce(length(trim(justification)), 0) < 5 THEN RAISE EXCEPTION 'Informe a justificativa do comunicado.'; END IF;
  IF p_link IS NOT NULL AND p_link !~ '^/[a-z0-9/_-]*$' THEN RAISE EXCEPTION 'O destino precisa ser um endereço interno do Vybelog.'; END IF;
  INSERT INTO public.admin_broadcasts (title, body, audience, audience_ref, link, scheduled_at, created_by)
  VALUES (trim(p_title), trim(p_body), p_audience, p_ref, p_link, coalesce(p_when, now()), auth.uid())
  RETURNING id INTO v;
  INSERT INTO public.admin_audit_logs (admin_id, admin_role, action, target_type, target_id, reason)
  VALUES (auth.uid(), public.admin_role_of(auth.uid()), 'broadcast_created', 'broadcast', v::text, trim(justification));
  IF coalesce(p_when, now()) <= now() THEN PERFORM public.dispatch_broadcasts(); END IF;
  RETURN v;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_cancel_broadcast(p_id UUID, justification TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_superadmin() THEN RAISE EXCEPTION 'Somente o superadministrador (com MFA).'; END IF;
  UPDATE public.admin_broadcasts SET cancelled_at = now() WHERE id = p_id AND sent_at IS NULL;
  INSERT INTO public.admin_audit_logs (admin_id, admin_role, action, target_type, target_id, reason)
  VALUES (auth.uid(), public.admin_role_of(auth.uid()), 'broadcast_cancelled', 'broadcast', p_id::text, coalesce(nullif(trim(justification), ''), 'Comunicado cancelado'));
END;
$$;

-- Histórico com o resultado do envio (equipe administrativa)
CREATE OR REPLACE FUNCTION public.admin_broadcast_history()
RETURNS TABLE (id UUID, title TEXT, body TEXT, audience TEXT, scheduled_at TIMESTAMPTZ, sent_at TIMESTAMPTZ, cancelled_at TIMESTAMPTZ,
               recipients INTEGER, read_count BIGINT, push_sent BIGINT, push_failed BIGINT, push_pending BIGINT)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_staff() THEN RAISE EXCEPTION 'Acesso restrito à equipe.'; END IF;
  RETURN QUERY
    SELECT b.id, b.title::text, b.body::text, b.audience::text, b.scheduled_at, b.sent_at, b.cancelled_at, b.recipients,
           (SELECT count(*) FROM public.notifications n WHERE n.dedupe_key = 'broadcast:' || b.id AND n.read),
           (SELECT count(*) FROM public.push_queue q JOIN public.notifications n ON n.id = q.notification_id WHERE n.dedupe_key = 'broadcast:' || b.id AND q.status = 'sent'),
           (SELECT count(*) FROM public.push_queue q JOIN public.notifications n ON n.id = q.notification_id WHERE n.dedupe_key = 'broadcast:' || b.id AND q.status = 'failed'),
           (SELECT count(*) FROM public.push_queue q JOIN public.notifications n ON n.id = q.notification_id WHERE n.dedupe_key = 'broadcast:' || b.id AND q.status IN ('pending', 'sending'))
      FROM public.admin_broadcasts b ORDER BY b.created_at DESC LIMIT 100;
END;
$$;

-- Painel do push (equipe): aparelhos, envios e falhas recentes
CREATE OR REPLACE FUNCTION public.admin_push_stats()
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_staff() THEN RAISE EXCEPTION 'Acesso restrito à equipe.'; END IF;
  RETURN jsonb_build_object(
    'devices', (SELECT count(*) FROM public.push_subscriptions WHERE active),
    'users_with_push', (SELECT count(DISTINCT user_id) FROM public.push_subscriptions WHERE active),
    'sent_7d', (SELECT count(*) FROM public.push_queue WHERE status = 'sent' AND sent_at > now() - INTERVAL '7 days'),
    'failed_7d', (SELECT count(*) FROM public.push_queue WHERE status = 'failed' AND created_at > now() - INTERVAL '7 days'),
    'pending', (SELECT count(*) FROM public.push_queue WHERE status IN ('pending', 'sending')),
    'last_errors', coalesce((SELECT jsonb_agg(x) FROM (SELECT q.created_at, q.http_status, q.error FROM public.push_queue q WHERE q.status = 'failed' ORDER BY q.created_at DESC LIMIT 10) x), '[]'));
END;
$$;

-- 10.10 Permissões das funções
REVOKE EXECUTE ON FUNCTION public.push_send_time(UUID, TEXT), public.push_text(TEXT, UUID, UUID, TEXT, TEXT), public.push_enqueue(), public.push_wake(),
  public.notify_on_message(), public.push_claim(INTEGER), public.push_complete(JSONB), public.push_cleanup(), public.dispatch_broadcasts(),
  public.notifications_fill()
  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.push_subscribe(TEXT, TEXT, TEXT, TEXT), public.push_unsubscribe(UUID, TEXT), public.my_push_devices(),
  public.save_notification_preferences(JSONB), public.mark_conversation_notifications_read(UUID),
  public.admin_create_broadcast(TEXT, TEXT, TEXT, UUID, TEXT, TIMESTAMPTZ, TEXT), public.admin_cancel_broadcast(UUID, TEXT),
  public.admin_broadcast_history(), public.admin_push_stats()
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.push_subscribe(TEXT, TEXT, TEXT, TEXT), public.push_unsubscribe(UUID, TEXT), public.my_push_devices(),
  public.save_notification_preferences(JSONB), public.mark_conversation_notifications_read(UUID),
  public.admin_create_broadcast(TEXT, TEXT, TEXT, UUID, TEXT, TIMESTAMPTZ, TEXT), public.admin_cancel_broadcast(UUID, TEXT),
  public.admin_broadcast_history(), public.admin_push_stats()
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.push_claim(INTEGER), public.push_complete(JSONB) TO service_role;

-- 10.11 Agendamentos: novas tentativas (1 min), comunicados programados (1 min) e limpeza (diária)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'pg_net') THEN
    CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'pg_cron') THEN
    CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
    PERFORM cron.schedule('vybelog-push-fila', '* * * * *',
      $c$SELECT public.dispatch_broadcasts(); SELECT public.push_wake() WHERE EXISTS (SELECT 1 FROM public.push_queue WHERE status = 'pending' AND next_attempt_at <= now())$c$);
    PERFORM cron.schedule('vybelog-push-limpeza', '30 6 * * *', 'SELECT public.push_cleanup()');
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Agendamentos do push não criados: %', SQLERRM;
END $$;

-- ==============================================================================
-- 11. FEED E INTERAÇÕES (respostas, menções, "Para você", vídeo)
-- ==============================================================================

-- 11.1 Respostas a comentários (um nível, como no Instagram)
ALTER TABLE public.post_comments ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES public.post_comments(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_post_comments_parent ON public.post_comments(parent_id) WHERE parent_id IS NOT NULL;

-- A resposta precisa ser da mesma publicação; resposta de resposta vira resposta ao comentário principal
CREATE OR REPLACE FUNCTION public.prepare_comment_reply() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE pai public.post_comments;
BEGIN
  IF NEW.parent_id IS NULL THEN RETURN NEW; END IF;
  SELECT * INTO pai FROM public.post_comments WHERE id = NEW.parent_id;
  IF pai.id IS NULL OR pai.post_id <> NEW.post_id THEN
    RAISE EXCEPTION 'O comentário respondido não pertence a esta publicação.';
  END IF;
  IF pai.parent_id IS NOT NULL THEN NEW.parent_id := pai.parent_id; END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS comments_prepare_reply ON public.post_comments;
CREATE TRIGGER comments_prepare_reply BEFORE INSERT ON public.post_comments
  FOR EACH ROW EXECUTE FUNCTION public.prepare_comment_reply();

-- 11.2 Menções: @usuario em publicações e comentários avisam quem foi mencionado — só se a pessoa
-- puder ver a publicação e não houver bloqueio. No máximo 10 menções avisadas por texto.
CREATE OR REPLACE FUNCTION public.notify_mentions(p_text TEXT, p_actor UUID, p_post UUID, p_comment UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  alvo RECORD;
  post public.posts;
  nome TEXT;
BEGIN
  IF p_text IS NULL OR position('@' IN p_text) = 0 THEN RETURN; END IF;
  SELECT * INTO post FROM public.posts WHERE id = p_post;
  SELECT display_name INTO nome FROM public.profiles WHERE id = p_actor;
  FOR alvo IN
    SELECT DISTINCT p.id FROM public.profiles p
     WHERE p.username IN (SELECT lower(m[1]) FROM regexp_matches(p_text, '@([A-Za-z0-9_]{3,50})', 'g') AS m LIMIT 10)
       AND p.id <> p_actor
       AND NOT public.is_blocked_between(p.id, p_actor)
       AND (post.visibility = 'public' OR p.id = post.user_id OR public.are_connected(p.id, post.user_id))
  LOOP
    INSERT INTO public.notifications (user_id, actor_id, type, title, message, reference_id, dedupe_key)
    VALUES (alvo.id, p_actor, 'mention', 'Você foi mencionado',
            coalesce(nome, 'Alguém') || CASE WHEN p_comment IS NULL THEN ' mencionou você em uma publicação.' ELSE ' mencionou você em um comentário.' END,
            p_post::text || CASE WHEN p_comment IS NULL THEN '' ELSE '#' || p_comment END,
            'mention:' || coalesce(p_comment, p_post)::text || ':' || alvo.id)
    ON CONFLICT DO NOTHING;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_on_post_text() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  autor_pai UUID;
  dono UUID;
  nome TEXT;
BEGIN
  IF TG_TABLE_NAME = 'posts' THEN
    PERFORM public.notify_mentions(NEW.content, NEW.user_id, NEW.id, NULL);
  ELSE
    IF NEW.parent_id IS NOT NULL THEN
      SELECT user_id INTO autor_pai FROM public.post_comments WHERE id = NEW.parent_id;
      SELECT user_id INTO dono FROM public.posts WHERE id = NEW.post_id;
      SELECT display_name INTO nome FROM public.profiles WHERE id = NEW.user_id;
      -- o dono da publicação já recebe o aviso de comentário; quem foi respondido recebe "resposta"
      IF autor_pai IS DISTINCT FROM dono AND NOT public.is_blocked_between(autor_pai, NEW.user_id) THEN
        PERFORM public.notify(autor_pai, NEW.user_id, 'comment_reply', 'Nova resposta',
          coalesce(nome, 'Alguém') || ' respondeu ao seu comentário.', NEW.post_id::text || '#' || NEW.id);
      END IF;
    END IF;
    PERFORM public.notify_mentions(NEW.content, NEW.user_id, NEW.post_id, NEW.id);
  END IF;
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS notify_post_mentions ON public.posts;
CREATE TRIGGER notify_post_mentions AFTER INSERT ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_post_text();
DROP TRIGGER IF EXISTS notify_comment_text ON public.post_comments;
CREATE TRIGGER notify_comment_text AFTER INSERT ON public.post_comments
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_post_text();

-- 11.3 "Para você": publicações dos últimos 30 dias que a pessoa pode ver (regras de acesso valem:
-- a função roda com as permissões de quem chama), ordenadas por interações recentes, por seguir o
-- autor e pela novidade. Paginação por posição.
CREATE OR REPLACE FUNCTION public.feed_for_you(p_limit INTEGER DEFAULT 20, p_offset INTEGER DEFAULT 0)
RETURNS TABLE (post_id UUID, score DOUBLE PRECISION)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT p.id,
         ((p.likes_count + 2.0 * p.comments_count + 1.0)
           * CASE WHEN EXISTS (SELECT 1 FROM public.follows f WHERE f.follower_id = auth.uid() AND f.following_id = p.user_id) THEN 1.8 ELSE 1.0 END
           * CASE WHEN p.user_id = auth.uid() THEN 0.6 ELSE 1.0 END
           * CASE WHEN cardinality(p.media_urls) > 0 THEN 1.2 ELSE 1.0 END)
         / power(extract(epoch FROM (now() - p.created_at)) / 3600.0 + 2.0, 1.4) AS score
    FROM public.posts p
   WHERE p.community_id IS NULL
     AND p.created_at > now() - INTERVAL '30 days'
     AND p.moderation_status = 'approved'
   ORDER BY score DESC, p.created_at DESC
   LIMIT least(greatest(p_limit, 1), 50) OFFSET greatest(p_offset, 0);
$$;
REVOKE EXECUTE ON FUNCTION public.feed_for_you(INTEGER, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.feed_for_you(INTEGER, INTEGER) TO authenticated;

-- 11.4 @usuario → perfil (para os links das menções)
CREATE OR REPLACE FUNCTION public.profile_id_by_username(p_username TEXT)
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id FROM public.profiles p
   WHERE p.username = lower(p_username) AND NOT public.is_blocked_between(p.id, auth.uid())
   LIMIT 1;
$$;
REVOKE EXECUTE ON FUNCTION public.profile_id_by_username(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.profile_id_by_username(TEXT) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.prepare_comment_reply(), public.notify_mentions(TEXT, UUID, UUID, UUID), public.notify_on_post_text()
  FROM PUBLIC, anon, authenticated;

-- ==============================================================================
-- 12. CHAT (vídeo e áudio no direct, "entregue" e busca nas conversas)
-- "Digitando" e "online na conversa" usam o Realtime (presença/transmissão), sem gravar no banco.
-- ==============================================================================

-- 12.1 Vídeo e áudio no direct (mesmas regras das fotos: conversa aceita, pasta própria, sem apagar)
CREATE OR REPLACE FUNCTION public.is_chat_media_path(u TEXT, conv UUID, sender UUID)
RETURNS BOOLEAN LANGUAGE sql IMMUTABLE AS $$
  SELECT u ~ ('^chat-media/' || conv::text || '/' || sender::text || '/[A-Za-z0-9_-]{1,80}\.(jpg|jpeg|png|webp|gif|mp4|mov|webm|m4a|ogg|mp3)$');
$$;

UPDATE storage.buckets SET file_size_limit = 26214400,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/quicktime', 'video/webm',
                             'audio/webm', 'audio/mp4', 'audio/mpeg', 'audio/ogg', 'audio/x-m4a']
 WHERE id = 'chat-media';

-- 12.2 Entregue: o app do destinatário confirma o recebimento (vira "visualizada" ao abrir a conversa)
CREATE OR REPLACE FUNCTION public.mark_messages_delivered()
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n INTEGER;
BEGIN
  UPDATE public.messages m SET status = 'delivered'
   WHERE m.status = 'sent' AND m.sender_id <> auth.uid()
     AND m.conversation_id IN (SELECT cp.conversation_id FROM public.conversation_participants cp WHERE cp.user_id = auth.uid());
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;

-- 12.3 Busca nas próprias conversas (texto das mensagens), com as regras de acesso de quem busca
CREATE OR REPLACE FUNCTION public.search_my_messages(p_query TEXT, p_limit INTEGER DEFAULT 30)
RETURNS TABLE (message_id UUID, conversation_id UUID, sender_id UUID, content TEXT, created_at TIMESTAMPTZ)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT m.id, m.conversation_id, m.sender_id, left(m.content, 200), m.created_at
    FROM public.messages m
   WHERE length(trim(p_query)) >= 2
     AND m.conversation_id IN (SELECT cp.conversation_id FROM public.conversation_participants cp WHERE cp.user_id = auth.uid() AND NOT cp.is_archived)
     AND m.content ILIKE '%' || replace(replace(replace(trim(p_query), '\', '\\'), '%', '\%'), '_', '\_') || '%'
   ORDER BY m.created_at DESC
   LIMIT least(greatest(p_limit, 1), 50);
$$;

REVOKE EXECUTE ON FUNCTION public.mark_messages_delivered(), public.search_my_messages(TEXT, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_messages_delivered(), public.search_my_messages(TEXT, INTEGER) TO authenticated;

-- ==============================================================================
-- 13. COMUNIDADES E EVENTOS (criação pelos usuários, pedidos, convites, moderação e convites para eventos)
-- Acesso: 'public' (entra quem quiser), 'approval' (pede e a moderação aprova),
--         'private' (secreta: só por convite e oculta para quem não é membro).
-- As comunidades marcadas como privadas nas versões anteriores passam a ser "com aprovação".
-- ==============================================================================

-- 13.1 Tipo de acesso
ALTER TABLE public.communities ADD COLUMN IF NOT EXISTS access VARCHAR(20) NOT NULL DEFAULT 'public';
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'communities_access_check') THEN
    ALTER TABLE public.communities ADD CONSTRAINT communities_access_check CHECK (access IN ('public', 'approval', 'private'));
  END IF;
END $$;
UPDATE public.communities SET access = 'approval' WHERE is_private AND access = 'public';

CREATE OR REPLACE FUNCTION public.communities_sync_private() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
  NEW.is_private := NEW.access <> 'public';
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS communities_sync_private ON public.communities;
CREATE TRIGGER communities_sync_private BEFORE INSERT OR UPDATE ON public.communities
  FOR EACH ROW EXECUTE FUNCTION public.communities_sync_private();

-- 13.2 Pedidos, convites e banimentos (gravados só pelas funções abaixo)
CREATE TABLE IF NOT EXISTS public.community_requests (
  community_id UUID NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  message VARCHAR(300) NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (community_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_community_requests_user ON public.community_requests(user_id);

CREATE TABLE IF NOT EXISTS public.community_invites (
  community_id UUID NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  invited_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (community_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_community_invites_user ON public.community_invites(user_id);
CREATE INDEX IF NOT EXISTS idx_community_invites_by ON public.community_invites(invited_by, created_at);

CREATE TABLE IF NOT EXISTS public.community_bans (
  community_id UUID NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  banned_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reason VARCHAR(300) NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (community_id, user_id)
);

ALTER TABLE public.community_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_bans ENABLE ROW LEVEL SECURITY;

-- 13.3 Papéis e visibilidade
CREATE OR REPLACE FUNCTION public.community_role(c UUID, u UUID DEFAULT auth.uid())
RETURNS TEXT LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM public.community_members WHERE community_id = c AND user_id = u;
$$;

-- Quem pode ver as publicações da comunidade: todos, se aberta; só membros, se fechada
CREATE OR REPLACE FUNCTION public.can_see_community(c UUID, u UUID DEFAULT auth.uid())
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT c IS NULL
      OR EXISTS (SELECT 1 FROM public.communities x WHERE x.id = c AND x.access = 'public')
      OR EXISTS (SELECT 1 FROM public.community_members m WHERE m.community_id = c AND m.user_id = u);
$$;

CREATE OR REPLACE FUNCTION public.community_is_moderator(c UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(public.community_role(c) IN ('admin', 'moderator'), false);
$$;

DROP POLICY IF EXISTS "communities_select" ON public.communities;
CREATE POLICY "communities_select" ON public.communities FOR SELECT TO authenticated
  USING (
    access <> 'private'
    OR public.is_staff()
    OR public.community_role(id) IS NOT NULL
    OR EXISTS (SELECT 1 FROM public.community_invites i WHERE i.community_id = communities.id AND i.user_id = auth.uid())
  );

-- membros se enxergam entre si (lista de membros); quem está fora não vê quem participa
DROP POLICY IF EXISTS "community_members_select" ON public.community_members;
CREATE POLICY "community_members_select" ON public.community_members FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_staff() OR public.community_role(community_id) IS NOT NULL);
DROP POLICY IF EXISTS "community_members_join" ON public.community_members;
CREATE POLICY "community_members_join" ON public.community_members FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid() AND role = 'member' AND public.can_interact()
    AND EXISTS (SELECT 1 FROM public.communities c WHERE c.id = community_id AND c.access = 'public')
    AND NOT EXISTS (SELECT 1 FROM public.community_bans b WHERE b.community_id = community_members.community_id AND b.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "community_requests_select" ON public.community_requests;
CREATE POLICY "community_requests_select" ON public.community_requests FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.community_is_moderator(community_id) OR public.is_staff());
DROP POLICY IF EXISTS "community_invites_select" ON public.community_invites;
CREATE POLICY "community_invites_select" ON public.community_invites FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR invited_by = auth.uid() OR public.community_is_moderator(community_id) OR public.is_staff());
DROP POLICY IF EXISTS "community_bans_select" ON public.community_bans;
CREATE POLICY "community_bans_select" ON public.community_bans FOR SELECT TO authenticated
  USING (public.community_is_moderator(community_id) OR public.is_staff());

-- Publicações de comunidade fechada: só membros veem; publicar exige ser membro;
-- administradores e moderadores da comunidade podem remover publicações dela
DROP POLICY IF EXISTS "posts_select" ON public.posts;
CREATE POLICY "posts_select" ON public.posts FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_staff()
    OR (
      moderation_status IN ('approved', 'pending_review')
      AND NOT public.is_blocked_between(user_id, auth.uid())
      AND (visibility = 'public' OR public.are_connected(user_id, auth.uid()))
      AND (community_id IS NULL OR public.can_see_community(community_id))
    )
  );
DROP POLICY IF EXISTS "posts_insert" ON public.posts;
CREATE POLICY "posts_insert" ON public.posts FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND public.can_interact()
    AND coalesce((SELECT (restrictions ->> 'cannotPost')::boolean FROM public.profiles WHERE id = auth.uid()), false) = false
    AND (community_id IS NULL OR public.community_role(community_id) IS NOT NULL)
  );
DROP POLICY IF EXISTS "posts_delete" ON public.posts;
CREATE POLICY "posts_delete" ON public.posts FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR (community_id IS NOT NULL AND public.community_is_moderator(community_id)));

-- Menções em comunidade fechada só avisam quem consegue ver a publicação
CREATE OR REPLACE FUNCTION public.notify_mentions(p_text TEXT, p_actor UUID, p_post UUID, p_comment UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  alvo RECORD;
  post public.posts;
  nome TEXT;
BEGIN
  IF p_text IS NULL OR position('@' IN p_text) = 0 THEN RETURN; END IF;
  SELECT * INTO post FROM public.posts WHERE id = p_post;
  SELECT display_name INTO nome FROM public.profiles WHERE id = p_actor;
  FOR alvo IN
    SELECT DISTINCT p.id FROM public.profiles p
     WHERE p.username IN (SELECT lower(m[1]) FROM regexp_matches(p_text, '@([A-Za-z0-9_]{3,50})', 'g') AS m LIMIT 10)
       AND p.id <> p_actor
       AND NOT public.is_blocked_between(p.id, p_actor)
       AND (post.visibility = 'public' OR p.id = post.user_id OR public.are_connected(p.id, post.user_id))
       AND (post.community_id IS NULL OR public.can_see_community(post.community_id, p.id))
  LOOP
    INSERT INTO public.notifications (user_id, actor_id, type, title, message, reference_id, dedupe_key)
    VALUES (alvo.id, p_actor, 'mention', 'Você foi mencionado',
            coalesce(nome, 'Alguém') || CASE WHEN p_comment IS NULL THEN ' mencionou você em uma publicação.' ELSE ' mencionou você em um comentário.' END,
            p_post::text || CASE WHEN p_comment IS NULL THEN '' ELSE '#' || p_comment END,
            'mention:' || coalesce(p_comment, p_post)::text || ':' || alvo.id)
    ON CONFLICT DO NOTHING;
  END LOOP;
END;
$$;

-- 13.4 Se o último administrador sair, a comunidade não fica sem dono:
-- o moderador (ou membro) mais antigo assume
CREATE OR REPLACE FUNCTION public.community_keep_admin() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE herdeiro UUID;
BEGIN
  IF OLD.role <> 'admin' THEN RETURN NULL; END IF;
  IF EXISTS (SELECT 1 FROM public.community_members WHERE community_id = OLD.community_id AND role = 'admin') THEN RETURN NULL; END IF;
  SELECT user_id INTO herdeiro FROM public.community_members
   WHERE community_id = OLD.community_id
   ORDER BY (role = 'moderator') DESC, joined_at
   LIMIT 1;
  IF herdeiro IS NOT NULL THEN
    UPDATE public.community_members SET role = 'admin' WHERE community_id = OLD.community_id AND user_id = herdeiro;
  END IF;
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS community_keep_admin ON public.community_members;
CREATE TRIGGER community_keep_admin AFTER DELETE ON public.community_members
  FOR EACH ROW EXECUTE FUNCTION public.community_keep_admin();

-- 13.5 Avisos de comunidade
CREATE OR REPLACE FUNCTION public.community_notify(p_user UUID, p_actor UUID, p_type TEXT, p_title TEXT, p_msg TEXT, p_community UUID, p_dedupe TEXT)
RETURNS VOID LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO public.notifications (user_id, actor_id, type, title, message, reference_id, dedupe_key)
  VALUES (p_user, p_actor, p_type, p_title, p_msg, p_community::text, p_dedupe)
  ON CONFLICT DO NOTHING;
$$;
REVOKE EXECUTE ON FUNCTION public.community_notify(UUID, UUID, TEXT, TEXT, TEXT, UUID, TEXT) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.community_check_fields(p_name TEXT, p_description TEXT, p_category TEXT, p_icon TEXT, p_cover TEXT, p_rules TEXT[], p_access TEXT)
RETURNS VOID LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
  IF length(trim(coalesce(p_name, ''))) NOT BETWEEN 3 AND 80 THEN RAISE EXCEPTION 'O nome precisa ter de 3 a 80 caracteres.'; END IF;
  IF length(trim(coalesce(p_description, ''))) NOT BETWEEN 10 AND 1000 THEN RAISE EXCEPTION 'A descrição precisa ter de 10 a 1000 caracteres.'; END IF;
  IF p_category NOT IN ('regional', 'lifestyle', 'beginners', 'events', 'discussions') THEN RAISE EXCEPTION 'Categoria inválida.'; END IF;
  IF p_access NOT IN ('public', 'approval', 'private') THEN RAISE EXCEPTION 'Tipo de acesso inválido.'; END IF;
  IF length(coalesce(p_icon, '')) NOT BETWEEN 1 AND 8 THEN RAISE EXCEPTION 'Ícone inválido.'; END IF;
  IF NOT public.is_app_media_url(p_cover) THEN RAISE EXCEPTION 'A capa precisa ser enviada pelo app.'; END IF;
  IF coalesce(array_length(p_rules, 1), 0) > 10 OR EXISTS (SELECT 1 FROM unnest(p_rules) r WHERE length(r) > 200) THEN
    RAISE EXCEPTION 'Use até 10 regras de até 200 caracteres.';
  END IF;
END;
$$;

-- 13.6 Criar, editar e excluir
CREATE OR REPLACE FUNCTION public.create_community(p_name TEXT, p_description TEXT, p_category TEXT, p_icon TEXT, p_cover TEXT, p_rules TEXT[], p_access TEXT)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE novo UUID; base TEXT;
BEGIN
  IF auth.uid() IS NULL OR NOT public.can_interact() THEN RAISE EXCEPTION 'Sua conta não pode criar comunidades agora.'; END IF;
  PERFORM public.community_check_fields(p_name, p_description, p_category, p_icon, p_cover, p_rules, p_access);
  IF (SELECT count(*) FROM public.communities WHERE created_by = auth.uid() AND created_at > now() - interval '1 day') >= 3 THEN
    RAISE EXCEPTION 'Você pode criar até 3 comunidades por dia.';
  END IF;
  IF (SELECT count(*) FROM public.community_members WHERE user_id = auth.uid() AND role = 'admin') >= 20 THEN
    RAISE EXCEPTION 'Você já administra o máximo de 20 comunidades.';
  END IF;
  base := trim(BOTH '-' FROM regexp_replace(lower(trim(p_name)), '[^a-z0-9]+', '-', 'g'));
  INSERT INTO public.communities (name, slug, description, cover_url, icon_url, category, rules, access, created_by)
  VALUES (trim(p_name), left(coalesce(nullif(base, ''), 'comunidade'), 120) || '-' || substr(md5(random()::text), 1, 6),
          trim(p_description), coalesce(p_cover, ''), p_icon, p_category,
          coalesce((SELECT array_agg(trim(r)) FROM unnest(p_rules) r WHERE trim(r) <> ''), '{}'), p_access, auth.uid())
  RETURNING id INTO novo;
  INSERT INTO public.community_members (community_id, user_id, role) VALUES (novo, auth.uid(), 'admin');
  RETURN novo;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_community(p_id UUID, p_name TEXT, p_description TEXT, p_category TEXT, p_icon TEXT, p_cover TEXT, p_rules TEXT[], p_access TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF coalesce(public.community_role(p_id), '') <> 'admin' AND NOT public.is_superadmin() THEN
    RAISE EXCEPTION 'Só a administração da comunidade pode editar.';
  END IF;
  PERFORM public.community_check_fields(p_name, p_description, p_category, p_icon, p_cover, p_rules, p_access);
  UPDATE public.communities
     SET name = trim(p_name), description = trim(p_description), category = p_category, icon_url = p_icon,
         cover_url = coalesce(p_cover, cover_url), access = p_access,
         rules = coalesce((SELECT array_agg(trim(r)) FROM unnest(p_rules) r WHERE trim(r) <> ''), '{}')
   WHERE id = p_id;
  -- ao abrir a comunidade, quem estava esperando aprovação entra
  IF p_access = 'public' THEN
    INSERT INTO public.community_members (community_id, user_id)
    SELECT community_id, user_id FROM public.community_requests WHERE community_id = p_id
    ON CONFLICT DO NOTHING;
    DELETE FROM public.community_requests WHERE community_id = p_id;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_community(p_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF coalesce(public.community_role(p_id), '') <> 'admin' AND NOT public.is_superadmin() THEN
    RAISE EXCEPTION 'Só a administração da comunidade pode excluir.';
  END IF;
  DELETE FROM public.communities WHERE id = p_id;
END;
$$;

-- 13.7 Entrar, pedir para entrar e convites
CREATE OR REPLACE FUNCTION public.community_join(p_id UUID, p_message TEXT DEFAULT '')
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE com public.communities; nome TEXT; mod RECORD;
BEGIN
  IF auth.uid() IS NULL OR NOT public.can_interact() THEN RAISE EXCEPTION 'Sua conta não pode entrar em comunidades agora.'; END IF;
  SELECT * INTO com FROM public.communities WHERE id = p_id;
  IF com.id IS NULL THEN RAISE EXCEPTION 'Comunidade não encontrada.'; END IF;
  IF EXISTS (SELECT 1 FROM public.community_bans WHERE community_id = p_id AND user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Você não pode entrar nesta comunidade.';
  END IF;
  IF public.community_role(p_id) IS NOT NULL THEN RETURN 'already'; END IF;

  IF com.access = 'public' OR EXISTS (SELECT 1 FROM public.community_invites WHERE community_id = p_id AND user_id = auth.uid()) THEN
    INSERT INTO public.community_members (community_id, user_id) VALUES (p_id, auth.uid()) ON CONFLICT DO NOTHING;
    DELETE FROM public.community_invites WHERE community_id = p_id AND user_id = auth.uid();
    DELETE FROM public.community_requests WHERE community_id = p_id AND user_id = auth.uid();
    RETURN 'joined';
  END IF;
  IF com.access = 'private' THEN RAISE EXCEPTION 'Esta comunidade é só para convidados.'; END IF;

  IF EXISTS (SELECT 1 FROM public.community_requests WHERE community_id = p_id AND user_id = auth.uid()) THEN RETURN 'requested'; END IF;
  IF (SELECT count(*) FROM public.community_requests WHERE user_id = auth.uid() AND created_at > now() - interval '1 day') >= 20 THEN
    RAISE EXCEPTION 'Muitos pedidos hoje. Tente amanhã.';
  END IF;
  INSERT INTO public.community_requests (community_id, user_id, message) VALUES (p_id, auth.uid(), left(coalesce(trim(p_message), ''), 300));
  SELECT display_name INTO nome FROM public.profiles WHERE id = auth.uid();
  FOR mod IN SELECT user_id FROM public.community_members WHERE community_id = p_id AND role IN ('admin', 'moderator') LOOP
    PERFORM public.community_notify(mod.user_id, auth.uid(), 'group_join_request', 'Pedido para entrar',
      coalesce(nome, 'Alguém') || ' pediu para entrar em ' || com.name || '.', p_id, 'group_join_request:' || p_id || ':' || auth.uid());
  END LOOP;
  RETURN 'requested';
END;
$$;

CREATE OR REPLACE FUNCTION public.community_cancel_request(p_id UUID)
RETURNS VOID LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  DELETE FROM public.community_requests WHERE community_id = p_id AND user_id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.community_review_request(p_id UUID, p_user UUID, p_approve BOOLEAN)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE nome_com TEXT;
BEGIN
  IF NOT public.community_is_moderator(p_id) THEN RAISE EXCEPTION 'Só a moderação da comunidade pode responder pedidos.'; END IF;
  DELETE FROM public.community_requests WHERE community_id = p_id AND user_id = p_user;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pedido não encontrado.'; END IF;
  IF p_approve THEN
    INSERT INTO public.community_members (community_id, user_id) VALUES (p_id, p_user) ON CONFLICT DO NOTHING;
    SELECT name INTO nome_com FROM public.communities WHERE id = p_id;
    PERFORM public.community_notify(p_user, auth.uid(), 'group_request_approved', 'Pedido aprovado',
      'Você agora participa de ' || nome_com || '.', p_id, 'group_request_approved:' || p_id || ':' || p_user);
  END IF;
  -- a recusa é silenciosa: quem pediu só deixa de ver o pedido pendente
END;
$$;

CREATE OR REPLACE FUNCTION public.community_invite(p_id UUID, p_user UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE com public.communities; nome TEXT;
BEGIN
  IF NOT public.can_interact() THEN RAISE EXCEPTION 'Sua conta não pode convidar agora.'; END IF;
  SELECT * INTO com FROM public.communities WHERE id = p_id;
  IF public.community_role(p_id) IS NULL OR (com.access <> 'public' AND NOT public.community_is_moderator(p_id)) THEN
    RAISE EXCEPTION 'Você não pode convidar para esta comunidade.';
  END IF;
  IF p_user = auth.uid() OR public.is_blocked_between(p_user, auth.uid()) OR NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_user) THEN
    RAISE EXCEPTION 'Não é possível convidar esta pessoa.';
  END IF;
  IF public.community_role(p_id, p_user) IS NOT NULL THEN RAISE EXCEPTION 'Esta pessoa já participa.'; END IF;
  IF EXISTS (SELECT 1 FROM public.community_bans WHERE community_id = p_id AND user_id = p_user) THEN RAISE EXCEPTION 'Não é possível convidar esta pessoa.'; END IF;
  IF (SELECT count(*) FROM public.community_invites WHERE invited_by = auth.uid() AND created_at > now() - interval '1 day') >= 30 THEN
    RAISE EXCEPTION 'Você já enviou muitos convites hoje.';
  END IF;
  INSERT INTO public.community_invites (community_id, user_id, invited_by) VALUES (p_id, p_user, auth.uid()) ON CONFLICT DO NOTHING;
  IF FOUND THEN
    SELECT display_name INTO nome FROM public.profiles WHERE id = auth.uid();
    PERFORM public.community_notify(p_user, auth.uid(), 'group_invite', 'Convite para comunidade',
      coalesce(nome, 'Alguém') || ' convidou você para ' || com.name || '.', p_id, 'group_invite:' || p_id || ':' || p_user);
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.community_decline_invite(p_id UUID)
RETURNS VOID LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  DELETE FROM public.community_invites WHERE community_id = p_id AND user_id = auth.uid();
$$;

-- 13.8 Gestão de membros
CREATE OR REPLACE FUNCTION public.community_set_role(p_id UUID, p_user UUID, p_role TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE atual TEXT; nome_com TEXT;
BEGIN
  IF coalesce(public.community_role(p_id), '') <> 'admin' AND NOT public.is_superadmin() THEN
    RAISE EXCEPTION 'Só a administração da comunidade muda funções.';
  END IF;
  IF p_role NOT IN ('admin', 'moderator', 'member') THEN RAISE EXCEPTION 'Função inválida.'; END IF;
  atual := public.community_role(p_id, p_user);
  IF atual IS NULL THEN RAISE EXCEPTION 'Esta pessoa não participa da comunidade.'; END IF;
  IF atual = 'admin' AND p_role <> 'admin'
     AND (SELECT count(*) FROM public.community_members WHERE community_id = p_id AND role = 'admin') <= 1 THEN
    RAISE EXCEPTION 'A comunidade precisa de pelo menos um administrador.';
  END IF;
  UPDATE public.community_members SET role = p_role WHERE community_id = p_id AND user_id = p_user;
  IF p_role IN ('admin', 'moderator') AND atual <> p_role THEN
    SELECT name INTO nome_com FROM public.communities WHERE id = p_id;
    PERFORM public.community_notify(p_user, auth.uid(), 'group_role', 'Nova função na comunidade',
      'Você agora é ' || CASE p_role WHEN 'admin' THEN 'administrador' ELSE 'moderador' END || ' de ' || nome_com || '.',
      p_id, 'group_role:' || p_id || ':' || p_user || ':' || p_role);
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.community_remove_member(p_id UUID, p_user UUID, p_ban BOOLEAN DEFAULT false, p_reason TEXT DEFAULT '')
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE eu TEXT; alvo TEXT;
BEGIN
  eu := public.community_role(p_id);
  alvo := public.community_role(p_id, p_user);
  IF p_user = auth.uid() THEN RAISE EXCEPTION 'Para sair, use a opção Sair da comunidade.'; END IF;
  IF NOT (eu = 'admin' AND coalesce(alvo, 'member') <> 'admin') AND NOT (eu = 'moderator' AND coalesce(alvo, 'member') = 'member') THEN
    RAISE EXCEPTION 'Você não pode remover esta pessoa.';
  END IF;
  DELETE FROM public.community_members WHERE community_id = p_id AND user_id = p_user;
  DELETE FROM public.community_requests WHERE community_id = p_id AND user_id = p_user;
  DELETE FROM public.community_invites WHERE community_id = p_id AND user_id = p_user;
  IF p_ban THEN
    INSERT INTO public.community_bans (community_id, user_id, banned_by, reason)
    VALUES (p_id, p_user, auth.uid(), left(coalesce(p_reason, ''), 300))
    ON CONFLICT (community_id, user_id) DO UPDATE SET banned_by = EXCLUDED.banned_by, reason = EXCLUDED.reason, created_at = now();
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.community_unban(p_id UUID, p_user UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.community_is_moderator(p_id) THEN RAISE EXCEPTION 'Só a moderação da comunidade pode desfazer o banimento.'; END IF;
  DELETE FROM public.community_bans WHERE community_id = p_id AND user_id = p_user;
END;
$$;

-- 13.9 Convites para eventos (só para conexões ou quem se segue mutuamente)
CREATE TABLE IF NOT EXISTS public.event_invites (
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  invited_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (event_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_event_invites_by ON public.event_invites(invited_by, created_at);
ALTER TABLE public.event_invites ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "event_invites_select" ON public.event_invites;
CREATE POLICY "event_invites_select" ON public.event_invites FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR invited_by = auth.uid());

CREATE OR REPLACE FUNCTION public.invite_to_event(p_event UUID, p_users UUID[])
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE ev public.events; nome TEXT; u UUID; n INTEGER := 0;
BEGIN
  IF auth.uid() IS NULL OR NOT public.can_interact() THEN RAISE EXCEPTION 'Sua conta não pode convidar agora.'; END IF;
  SELECT * INTO ev FROM public.events WHERE id = p_event;
  IF ev.id IS NULL OR ev.status <> 'approved' OR coalesce(ev.ends_at, ev.starts_at) < now() THEN
    RAISE EXCEPTION 'Este evento não está disponível para convites.';
  END IF;
  IF coalesce(array_length(p_users, 1), 0) > 50 THEN RAISE EXCEPTION 'Convide até 50 pessoas por vez.'; END IF;
  IF (SELECT count(*) FROM public.event_invites WHERE invited_by = auth.uid() AND created_at > now() - interval '1 day')
     + coalesce(array_length(p_users, 1), 0) > 100 THEN
    RAISE EXCEPTION 'Você já enviou muitos convites hoje.';
  END IF;
  SELECT display_name INTO nome FROM public.profiles WHERE id = auth.uid();
  FOREACH u IN ARRAY coalesce(p_users, '{}') LOOP
    CONTINUE WHEN u = auth.uid() OR public.is_blocked_between(u, auth.uid());
    CONTINUE WHEN NOT (public.are_connected(u, auth.uid())
      OR (EXISTS (SELECT 1 FROM public.follows WHERE follower_id = u AND following_id = auth.uid())
          AND EXISTS (SELECT 1 FROM public.follows WHERE follower_id = auth.uid() AND following_id = u)));
    INSERT INTO public.event_invites (event_id, user_id, invited_by) VALUES (p_event, u, auth.uid()) ON CONFLICT DO NOTHING;
    IF FOUND THEN
      n := n + 1;
      INSERT INTO public.notifications (user_id, actor_id, type, title, message, reference_id, dedupe_key)
      VALUES (u, auth.uid(), 'event_invite', 'Convite para evento',
              coalesce(nome, 'Alguém') || ' convidou você para ' || ev.title || '.', p_event::text, 'event_invite:' || p_event || ':' || u)
      ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;
  RETURN n;
END;
$$;

REVOKE EXECUTE ON FUNCTION
  public.create_community(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT[], TEXT),
  public.update_community(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT[], TEXT),
  public.delete_community(UUID),
  public.community_join(UUID, TEXT),
  public.community_cancel_request(UUID),
  public.community_review_request(UUID, UUID, BOOLEAN),
  public.community_invite(UUID, UUID),
  public.community_decline_invite(UUID),
  public.community_set_role(UUID, UUID, TEXT),
  public.community_remove_member(UUID, UUID, BOOLEAN, TEXT),
  public.community_unban(UUID, UUID),
  public.invite_to_event(UUID, UUID[])
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION
  public.create_community(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT[], TEXT),
  public.update_community(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT[], TEXT),
  public.delete_community(UUID),
  public.community_join(UUID, TEXT),
  public.community_cancel_request(UUID),
  public.community_review_request(UUID, UUID, BOOLEAN),
  public.community_invite(UUID, UUID),
  public.community_decline_invite(UUID),
  public.community_set_role(UUID, UUID, TEXT),
  public.community_remove_member(UUID, UUID, BOOLEAN, TEXT),
  public.community_unban(UUID, UUID),
  public.invite_to_event(UUID, UUID[])
TO authenticated;
GRANT SELECT ON public.community_requests, public.community_invites, public.community_bans, public.event_invites TO authenticated;

-- ==============================================================================
-- 14. PAINEL ADMINISTRATIVO: indicadores reais da plataforma (só contagens, sem dados pessoais)
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.admin_platform_stats()
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_staff() THEN RAISE EXCEPTION 'Acesso restrito à equipe.'; END IF;
  RETURN jsonb_build_object(
    'users', (SELECT count(*) FROM public.profiles),
    'new_1d', (SELECT count(*) FROM public.profiles WHERE created_at > now() - INTERVAL '1 day'),
    'new_7d', (SELECT count(*) FROM public.profiles WHERE created_at > now() - INTERVAL '7 days'),
    'new_30d', (SELECT count(*) FROM public.profiles WHERE created_at > now() - INTERVAL '30 days'),
    'active_1d', (SELECT count(*) FROM public.user_presence WHERE last_seen_at > now() - INTERVAL '1 day'),
    'active_7d', (SELECT count(*) FROM public.user_presence WHERE last_seen_at > now() - INTERVAL '7 days'),
    'active_30d', (SELECT count(*) FROM public.user_presence WHERE last_seen_at > now() - INTERVAL '30 days'),
    'posts', (SELECT count(*) FROM public.posts),
    'posts_7d', (SELECT count(*) FROM public.posts WHERE created_at > now() - INTERVAL '7 days'),
    'comments_7d', (SELECT count(*) FROM public.post_comments WHERE created_at > now() - INTERVAL '7 days'),
    'messages_7d', (SELECT count(*) FROM public.messages WHERE created_at > now() - INTERVAL '7 days'),
    'communities', (SELECT count(*) FROM public.communities),
    'communities_7d', (SELECT count(*) FROM public.communities WHERE created_at > now() - INTERVAL '7 days'),
    'events_upcoming', (SELECT count(*) FROM public.events WHERE status = 'approved' AND coalesce(ends_at, starts_at) >= now()),
    'events_pending', (SELECT count(*) FROM public.events WHERE status = 'pending'),
    'reports_open', (SELECT count(*) FROM public.moderation_reports WHERE status IN ('pending', 'under_review')),
    'reports_7d', (SELECT count(*) FROM public.moderation_reports WHERE created_at > now() - INTERVAL '7 days'),
    'signups_14d', (
      SELECT jsonb_agg(jsonb_build_object('day', d::date, 'n', (
        SELECT count(*) FROM public.profiles p
         WHERE p.created_at >= d AND p.created_at < d + INTERVAL '1 day')) ORDER BY d)
        FROM generate_series(date_trunc('day', now() AT TIME ZONE 'America/Sao_Paulo') - INTERVAL '13 days',
                             date_trunc('day', now() AT TIME ZONE 'America/Sao_Paulo'), INTERVAL '1 day') AS g(dl)
        CROSS JOIN LATERAL (SELECT (g.dl AT TIME ZONE 'America/Sao_Paulo') AS d) x
    )
  );
END;
$$;
REVOKE EXECUTE ON FUNCTION public.admin_platform_stats() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_platform_stats() TO authenticated;

-- ==============================================================================
-- 15. REVISÃO DE DESEMPENHO E SEGURANÇA (alertas do Supabase Advisor)
-- Blocos genéricos e idempotentes: valem também para tabelas e políticas criadas no futuro.
-- ==============================================================================

-- 15.1 Privacidade das comunidades: as funções auxiliares não revelam quem participa de
-- comunidades fechadas para quem está fora (antes dava para perguntar direto pela API)
CREATE OR REPLACE FUNCTION public.community_role(c UUID, u UUID DEFAULT auth.uid())
RETURNS TEXT LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT m.role FROM public.community_members m
   WHERE m.community_id = c AND m.user_id = u
     AND (u = auth.uid() OR auth.uid() IS NULL
          OR EXISTS (SELECT 1 FROM public.community_members eu WHERE eu.community_id = c AND eu.user_id = auth.uid()));
$$;

CREATE OR REPLACE FUNCTION public.can_see_community(c UUID, u UUID DEFAULT auth.uid())
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT c IS NULL
      OR EXISTS (SELECT 1 FROM public.communities x WHERE x.id = c AND x.access = 'public')
      OR ((u = auth.uid() OR auth.uid() IS NULL
           OR EXISTS (SELECT 1 FROM public.community_members eu WHERE eu.community_id = c AND eu.user_id = auth.uid()))
          AND EXISTS (SELECT 1 FROM public.community_members m WHERE m.community_id = c AND m.user_id = u));
$$;

REVOKE EXECUTE ON FUNCTION public.community_role(UUID, UUID), public.can_see_community(UUID, UUID), public.community_is_moderator(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.community_role(UUID, UUID), public.can_see_community(UUID, UUID), public.community_is_moderator(UUID) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.community_keep_admin(), public.communities_sync_private() FROM PUBLIC, anon, authenticated;

-- 15.2 search_path fixo em todas as funções do schema public que ainda não têm
-- (evita que um objeto com o mesmo nome em outro schema seja usado no lugar do certo)
DO $$
DECLARE f RECORD;
BEGIN
  FOR f IN
    SELECT p.oid::regprocedure AS sig
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND p.prokind = 'f'
       AND (p.proconfig IS NULL OR NOT EXISTS (SELECT 1 FROM unnest(p.proconfig) c WHERE c LIKE 'search_path=%'))
       AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid = p.oid AND d.deptype = 'e')
  LOOP
    EXECUTE format('ALTER FUNCTION %s SET search_path = public, extensions, pg_temp', f.sig);
  END LOOP;
END $$;

-- 15.3 Índice para toda chave estrangeira (de uma coluna) sem índice que a cubra
DO $$
DECLARE k RECORD; nome TEXT;
BEGIN
  FOR k IN
    SELECT c.conrelid::regclass AS tabela, cl.relname AS tab, a.attname AS coluna
      FROM pg_constraint c
      JOIN pg_class cl ON cl.oid = c.conrelid
      JOIN pg_namespace n ON n.oid = cl.relnamespace
      JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
     WHERE c.contype = 'f' AND n.nspname = 'public' AND array_length(c.conkey, 1) = 1
       AND NOT EXISTS (SELECT 1 FROM pg_index i WHERE i.indrelid = c.conrelid AND i.indkey[0] = c.conkey[1])
  LOOP
    nome := left('idx_fk_' || k.tab || '_' || k.coluna, 63);
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %s (%I)', nome, k.tabela, k.coluna);
  END LOOP;
END $$;

-- Publicações de uma comunidade, das mais novas para as mais antigas
CREATE INDEX IF NOT EXISTS idx_posts_community_recent ON public.posts (community_id, created_at DESC) WHERE community_id IS NOT NULL;

-- 15.4 Políticas RLS: auth.uid() calculado uma vez por consulta, não uma vez por linha
-- (troca auth.uid() por (SELECT auth.uid()); o sentido da regra não muda)
DO $$
DECLARE p RECORD; q TEXT; w TEXT; cmd TEXT;
BEGIN
  FOR p IN
    SELECT schemaname, tablename, policyname, qual, with_check
      FROM pg_policies
     WHERE schemaname = 'public'
       AND (qual ~ '(?<!SELECT )auth\.(uid|jwt|role)\(\)' OR with_check ~ '(?<!SELECT )auth\.(uid|jwt|role)\(\)')
  LOOP
    q := regexp_replace(p.qual, '(?<!SELECT )auth\.(uid|jwt|role)\(\)', '(SELECT auth.\1())', 'g');
    w := regexp_replace(p.with_check, '(?<!SELECT )auth\.(uid|jwt|role)\(\)', '(SELECT auth.\1())', 'g');
    cmd := format('ALTER POLICY %I ON %I.%I', p.policyname, p.schemaname, p.tablename);
    IF q IS NOT NULL THEN cmd := cmd || format(' USING (%s)', q); END IF;
    IF w IS NOT NULL THEN cmd := cmd || format(' WITH CHECK (%s)', w); END IF;
    EXECUTE cmd;
  END LOOP;
END $$;

-- ==============================================================================
-- 16. CRESCIMENTO: CONVIDE E GANHE, RECOMPENSAS, FUNDADORES, EMBAIXADORES E CAMPANHAS
-- Regras no banco. Uma indicação só conta quando a pessoa convidada é real e ficou:
--   e-mail confirmado + foto de perfil + conta ativa + voltou ao Vybelog 12 h ou mais depois do cadastro.
-- Antifraude: uma indicação por pessoa convidada (nunca duas), ninguém indica a si mesmo, no máximo
-- N validações por dia para quem indica (o resto espera o dia seguinte), recompensa uma única vez
-- por pessoa, e a administração pode recusar indicações suspeitas.
-- ==============================================================================

-- 16.1 Configurações (editáveis pela administração)
CREATE TABLE IF NOT EXISTS public.growth_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);
INSERT INTO public.growth_settings (key, value) VALUES
  ('founders', jsonb_build_object('status', 'active', 'limit', 500, 'benefits', jsonb_build_array(
     'Selo de Membro Fundador permanente no seu perfil',
     'Seu número de fundador exibido no perfil (ex.: Fundador nº 42)',
     'Reconhecimento como uma das primeiras pessoas a construir o Vybelog'))),
  ('share_message', jsonb_build_object('text',
     'Você já conhece o Vybelog? Uma rede social para adultos e casais que compartilham interesses semelhantes e buscam novas conexões com respeito e discrição. Venha fazer parte: {link}')),
  ('referral_rules', jsonb_build_object('daily_valid_cap', 10, 'return_hours', 12))
ON CONFLICT (key) DO NOTHING;

-- 16.2 Recompensas por indicações válidas (configuráveis)
CREATE TABLE IF NOT EXISTS public.growth_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  threshold INTEGER NOT NULL CHECK (threshold BETWEEN 1 AND 10000),
  kind VARCHAR(20) NOT NULL CHECK (kind IN ('badge', 'featured_days', 'vip_days')),
  amount INTEGER NOT NULL DEFAULT 0 CHECK (amount BETWEEN 0 AND 3650),
  badge VARCHAR(40),
  label VARCHAR(80) NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO public.growth_rewards (threshold, kind, amount, badge, label)
SELECT * FROM (VALUES
  (5, 'badge', 0, 'indicador', 'Selo de Indicador Vybelog'),
  (10, 'featured_days', 7, NULL, 'Perfil em destaque por 7 dias'),
  (20, 'vip_days', 30, NULL, '30 dias de VIP'),
  (50, 'vip_days', 90, NULL, '90 dias de VIP')) AS v(threshold, kind, amount, badge, label)
WHERE NOT EXISTS (SELECT 1 FROM public.growth_rewards);

-- 16.3 Selos e benefícios de cada perfil (públicos no perfil; gravados só pelas funções)
CREATE TABLE IF NOT EXISTS public.profile_growth (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  founder_number INTEGER UNIQUE,
  founder_at TIMESTAMPTZ,
  ambassador BOOLEAN NOT NULL DEFAULT false,
  ambassador_since TIMESTAMPTZ,
  vip_until TIMESTAMPTZ,
  featured_until TIMESTAMPTZ,
  badges TEXT[] NOT NULL DEFAULT '{}',
  show_in_ranking BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_profile_growth_featured ON public.profile_growth(featured_until) WHERE featured_until IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_profile_growth_vip ON public.profile_growth(vip_until) WHERE vip_until IS NOT NULL;

-- 16.4 Códigos de convite (um automático por pessoa; embaixadores podem ter um personalizado)
CREATE TABLE IF NOT EXISTS public.growth_codes (
  code VARCHAR(24) PRIMARY KEY CHECK (code ~ '^[a-z0-9-]{4,24}$'),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  custom BOOLEAN NOT NULL DEFAULT false,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_growth_codes_auto ON public.growth_codes(user_id) WHERE NOT custom;
CREATE INDEX IF NOT EXISTS idx_growth_codes_user ON public.growth_codes(user_id);

-- 16.5 Campanhas (criadas pela administração)
CREATE TABLE IF NOT EXISTS public.growth_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug VARCHAR(40) UNIQUE NOT NULL CHECK (slug ~ '^[a-z0-9-]{3,40}$'),
  title VARCHAR(100) NOT NULL CHECK (length(trim(title)) >= 3),
  description VARCHAR(600) NOT NULL DEFAULT '',
  starts_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ends_at TIMESTAMPTZ,
  active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (ends_at IS NULL OR ends_at > starts_at)
);
CREATE INDEX IF NOT EXISTS idx_growth_campaigns_created_by ON public.growth_campaigns(created_by);

-- 16.6 Visitas aos links de convite (agregadas por dia: sem IP nem dado pessoal)
CREATE TABLE IF NOT EXISTS public.growth_visits (
  code VARCHAR(24) NOT NULL REFERENCES public.growth_codes(code) ON DELETE CASCADE,
  day DATE NOT NULL DEFAULT current_date,
  visits INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (code, day)
);

-- 16.7 Indicações (uma por pessoa convidada)
CREATE TABLE IF NOT EXISTS public.growth_referrals (
  referred_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  referrer_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  code VARCHAR(24),
  campaign_id UUID REFERENCES public.growth_campaigns(id) ON DELETE SET NULL,
  status VARCHAR(10) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'valid', 'rejected')),
  reason VARCHAR(300),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  validated_at TIMESTAMPTZ,
  CHECK (referrer_id IS DISTINCT FROM referred_id)
);
CREATE INDEX IF NOT EXISTS idx_growth_referrals_referrer ON public.growth_referrals(referrer_id, status);
CREATE INDEX IF NOT EXISTS idx_growth_referrals_campaign ON public.growth_referrals(campaign_id);
CREATE INDEX IF NOT EXISTS idx_growth_referrals_pending ON public.growth_referrals(created_at) WHERE status = 'pending';

-- 16.8 Recompensas concedidas (histórico; cada recompensa uma única vez por pessoa)
CREATE TABLE IF NOT EXISTS public.growth_grants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reward_id UUID REFERENCES public.growth_rewards(id) ON DELETE SET NULL,
  kind VARCHAR(20) NOT NULL,
  amount INTEGER NOT NULL DEFAULT 0,
  label VARCHAR(120) NOT NULL,
  source VARCHAR(12) NOT NULL CHECK (source IN ('referral', 'admin', 'founder', 'ambassador')),
  granted_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reason VARCHAR(300),
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_growth_grants_reward ON public.growth_grants(user_id, reward_id) WHERE reward_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_growth_grants_user ON public.growth_grants(user_id, granted_at DESC);
CREATE INDEX IF NOT EXISTS idx_growth_grants_by ON public.growth_grants(granted_by);
CREATE INDEX IF NOT EXISTS idx_growth_grants_reward ON public.growth_grants(reward_id);
CREATE INDEX IF NOT EXISTS idx_growth_settings_by ON public.growth_settings(updated_by);

-- 16.9 Acesso: leitura do que é público; gravação só pelas funções abaixo
ALTER TABLE public.growth_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.growth_rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_growth ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.growth_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.growth_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.growth_visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.growth_referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.growth_grants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS growth_settings_read ON public.growth_settings;
CREATE POLICY growth_settings_read ON public.growth_settings FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS growth_rewards_read ON public.growth_rewards;
CREATE POLICY growth_rewards_read ON public.growth_rewards FOR SELECT TO authenticated USING (active OR public.is_staff());
DROP POLICY IF EXISTS profile_growth_read ON public.profile_growth;
CREATE POLICY profile_growth_read ON public.profile_growth FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS growth_codes_read ON public.growth_codes;
CREATE POLICY growth_codes_read ON public.growth_codes FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()) OR public.is_staff());
DROP POLICY IF EXISTS growth_campaigns_read ON public.growth_campaigns;
CREATE POLICY growth_campaigns_read ON public.growth_campaigns FOR SELECT TO authenticated USING (active OR public.is_staff());
DROP POLICY IF EXISTS growth_visits_read ON public.growth_visits;
CREATE POLICY growth_visits_read ON public.growth_visits FOR SELECT TO authenticated USING (public.is_staff());
DROP POLICY IF EXISTS growth_referrals_read ON public.growth_referrals;
CREATE POLICY growth_referrals_read ON public.growth_referrals FOR SELECT TO authenticated
  USING (referrer_id = (SELECT auth.uid()) OR referred_id = (SELECT auth.uid()) OR public.is_staff());
DROP POLICY IF EXISTS growth_grants_read ON public.growth_grants;
CREATE POLICY growth_grants_read ON public.growth_grants FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()) OR public.is_staff());

REVOKE ALL ON public.growth_settings, public.growth_rewards, public.profile_growth, public.growth_codes, public.growth_campaigns,
  public.growth_visits, public.growth_referrals, public.growth_grants FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.growth_settings, public.growth_rewards, public.profile_growth, public.growth_codes,
  public.growth_campaigns, public.growth_visits, public.growth_referrals, public.growth_grants FROM authenticated;
GRANT SELECT ON public.growth_settings, public.growth_rewards, public.profile_growth, public.growth_codes, public.growth_campaigns,
  public.growth_visits, public.growth_referrals, public.growth_grants TO authenticated;

-- 16.10 Avisos de crescimento: destino e texto do push (sem nomes de terceiros)
CREATE OR REPLACE FUNCTION public.notification_link(p_type TEXT, p_ref TEXT, p_actor UUID)
RETURNS TEXT LANGUAGE sql IMMUTABLE SET search_path = public, extensions, pg_temp AS $$
  SELECT CASE
    WHEN p_type LIKE 'growth\_%' THEN '/convide'
    WHEN p_ref IS NULL OR p_ref = '' THEN '/notificacoes'
    WHEN p_type IN ('like', 'comment', 'comment_reply', 'mention', 'comment_like') THEN '/publicacao/' || split_part(p_ref, '#', 1)
      || CASE WHEN position('#' IN p_ref) > 0 THEN '?comentario=' || split_part(p_ref, '#', 2) ELSE '' END
    WHEN p_type IN ('follow', 'connection_request', 'connection_accepted') THEN '/perfil/' || p_ref
    WHEN p_type IN ('message', 'message_request') THEN '/mensagens/' || p_ref
    WHEN p_type LIKE 'event\_%' THEN '/eventos/' || p_ref
    WHEN p_type LIKE 'group\_%' OR p_type LIKE 'community\_%' THEN '/comunidades/' || p_ref
    WHEN p_type = 'vault_access_request' THEN '/perfil'
    WHEN p_type = 'vault_access_granted' AND p_actor IS NOT NULL THEN '/perfil/' || p_actor
    WHEN p_type = 'profile_photo_reminder' THEN '/perfil'
    ELSE '/notificacoes'
  END;
$$;

CREATE OR REPLACE FUNCTION public.push_text(p_type TEXT, p_actor UUID, p_user UUID, p_title TEXT, p_message TEXT)
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  nomes BOOLEAN := coalesce((SELECT show_names FROM public.notification_preferences WHERE user_id = p_user), false);
  quem TEXT := CASE WHEN nomes AND p_actor IS NOT NULL THEN (SELECT display_name FROM public.profiles WHERE id = p_actor) END;
BEGIN
  RETURN CASE
    WHEN p_type = 'follow' THEN jsonb_build_object('t', 'Novo seguidor!', 'b', coalesce(quem || ' começou a seguir você no Vybelog.', 'Você tem um novo seguidor no Vybelog.'))
    WHEN p_type = 'like' THEN jsonb_build_object('t', 'Nova curtida!', 'b', coalesce(quem || ' curtiu sua publicação.', 'Alguém curtiu sua publicação.'))
    WHEN p_type IN ('comment', 'event_comment') THEN jsonb_build_object('t', 'Nova interação!', 'b', coalesce(quem || ' comentou na sua publicação.', 'Há um novo comentário para você.'))
    WHEN p_type = 'comment_reply' THEN jsonb_build_object('t', 'Nova resposta!', 'b', coalesce(quem || ' respondeu ao seu comentário.', 'Responderam ao seu comentário.'))
    WHEN p_type = 'mention' THEN jsonb_build_object('t', 'Você foi mencionado!', 'b', coalesce(quem || ' mencionou você.', 'Mencionaram você em uma publicação.'))
    WHEN p_type = 'message' THEN jsonb_build_object('t', 'Nova mensagem!', 'b', coalesce('Você recebeu uma nova mensagem de ' || quem || '.', 'Você recebeu uma nova mensagem.'))
    WHEN p_type = 'message_request' THEN jsonb_build_object('t', 'Novo pedido de mensagem', 'b', 'Alguém quer conversar com você.')
    WHEN p_type = 'connection_request' THEN jsonb_build_object('t', 'Pedido de conexão', 'b', coalesce(quem || ' quer se conectar com você.', 'Você recebeu um pedido de conexão.'))
    WHEN p_type = 'connection_accepted' THEN jsonb_build_object('t', 'Conexão aceita!', 'b', coalesce(quem || ' aceitou sua conexão.', 'Um pedido de conexão foi aceito.'))
    WHEN p_type LIKE 'vault\_%' THEN jsonb_build_object('t', 'Cofre privado', 'b', 'Há uma novidade no seu cofre privado.')
    WHEN p_type LIKE 'event\_%' THEN jsonb_build_object('t', 'Eventos', 'b', 'Há uma novidade em um evento.')
    WHEN p_type LIKE 'group\_%' OR p_type LIKE 'community\_%' THEN jsonb_build_object('t', 'Comunidades', 'b', 'Há uma novidade em uma comunidade.')
    WHEN p_type = 'admin_broadcast' THEN jsonb_build_object('t', left(p_title, 80), 'b', left(p_message, 160))
    WHEN p_type LIKE 'growth\_%' THEN jsonb_build_object('t', left(p_title, 80), 'b', left(p_message, 160))
    ELSE jsonb_build_object('t', 'Vybelog', 'b', 'Você tem uma nova notificação.')
  END;
END;
$$;

CREATE OR REPLACE FUNCTION public.growth_notify(p_user UUID, p_type TEXT, p_title TEXT, p_msg TEXT, p_dedupe TEXT)
RETURNS VOID LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO public.notifications (user_id, actor_id, type, title, message, reference_id, dedupe_key)
  VALUES (p_user, NULL, p_type, p_title, p_msg, NULL, p_dedupe)
  ON CONFLICT DO NOTHING;
$$;

-- 16.11 Código de convite de cada pessoa (criado na primeira vez que é pedido)
CREATE OR REPLACE FUNCTION public.growth_code_for(p_user UUID)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v TEXT;
BEGIN
  SELECT code INTO v FROM public.growth_codes WHERE user_id = p_user AND NOT custom AND active;
  IF v IS NOT NULL THEN RETURN v; END IF;
  LOOP
    v := substr(md5(random()::text || clock_timestamp()::text || p_user::text), 1, 8);
    BEGIN
      INSERT INTO public.growth_codes (code, user_id) VALUES (v, p_user);
      RETURN v;
    EXCEPTION WHEN unique_violation THEN
      SELECT code INTO v FROM public.growth_codes WHERE user_id = p_user AND NOT custom AND active;
      IF v IS NOT NULL THEN RETURN v; END IF;
    END;
  END LOOP;
END;
$$;

-- 16.12 Cadastro com convite: o código vem nos dados do cadastro (metadata) e fica registrado
CREATE OR REPLACE FUNCTION public.growth_capture_referral()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_code TEXT := lower(trim(coalesce(NEW.raw_user_meta_data ->> 'invite_code', '')));
  v_slug TEXT := lower(trim(coalesce(NEW.raw_user_meta_data ->> 'invite_campaign', '')));
  v_dono UUID;
  v_campanha UUID;
BEGIN
  IF v_code = '' OR NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = NEW.id) THEN RETURN NEW; END IF;
  SELECT c.user_id INTO v_dono FROM public.growth_codes c JOIN public.profiles p ON p.id = c.user_id
   WHERE c.code = v_code AND c.active AND p.status::text IN ('active', 'warned');
  IF v_dono IS NULL OR v_dono = NEW.id THEN RETURN NEW; END IF;
  IF v_slug <> '' THEN
    SELECT id INTO v_campanha FROM public.growth_campaigns
     WHERE slug = v_slug AND active AND starts_at <= now() AND (ends_at IS NULL OR ends_at > now());
  END IF;
  INSERT INTO public.growth_referrals (referred_id, referrer_id, code, campaign_id)
  VALUES (NEW.id, v_dono, v_code, v_campanha) ON CONFLICT (referred_id) DO NOTHING;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;   -- um convite com problema nunca impede o cadastro
END;
$$;
DROP TRIGGER IF EXISTS on_auth_user_invited ON auth.users;
-- nome escolhido para rodar depois de on_auth_user_created (o perfil já existe)
CREATE TRIGGER on_auth_user_invited AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.growth_capture_referral();

-- 16.13 Efeito das recompensas no perfil
CREATE OR REPLACE FUNCTION public.growth_apply_effect(p_user UUID, p_kind TEXT, p_amount INTEGER, p_badge TEXT)
RETURNS TIMESTAMPTZ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_fim TIMESTAMPTZ;
BEGIN
  INSERT INTO public.profile_growth (user_id) VALUES (p_user) ON CONFLICT (user_id) DO NOTHING;
  IF p_kind = 'vip_days' THEN
    UPDATE public.profile_growth SET vip_until = greatest(coalesce(vip_until, now()), now()) + make_interval(days => p_amount), updated_at = now()
     WHERE user_id = p_user RETURNING vip_until INTO v_fim;
  ELSIF p_kind = 'featured_days' THEN
    UPDATE public.profile_growth SET featured_until = greatest(coalesce(featured_until, now()), now()) + make_interval(days => p_amount), updated_at = now()
     WHERE user_id = p_user RETURNING featured_until INTO v_fim;
  ELSIF p_kind = 'badge' AND p_badge IS NOT NULL THEN
    UPDATE public.profile_growth SET badges = CASE WHEN p_badge = ANY (badges) THEN badges ELSE badges || p_badge END, updated_at = now()
     WHERE user_id = p_user;
  END IF;
  RETURN v_fim;
END;
$$;

-- Concede as recompensas alcançadas (cada uma uma única vez por pessoa)
CREATE OR REPLACE FUNCTION public.growth_apply_rewards(p_user UUID)
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r RECORD; v_validas INTEGER; v_fim TIMESTAMPTZ; n INTEGER := 0;
BEGIN
  SELECT count(*) INTO v_validas FROM public.growth_referrals WHERE referrer_id = p_user AND status = 'valid';
  FOR r IN SELECT * FROM public.growth_rewards g WHERE g.active AND g.threshold <= v_validas
             AND NOT EXISTS (SELECT 1 FROM public.growth_grants x WHERE x.user_id = p_user AND x.reward_id = g.id)
           ORDER BY g.threshold LOOP
    v_fim := public.growth_apply_effect(p_user, r.kind, r.amount, r.badge);
    INSERT INTO public.growth_grants (user_id, reward_id, kind, amount, label, source, expires_at)
    VALUES (p_user, r.id, r.kind, r.amount, r.label, 'referral', v_fim)
    ON CONFLICT DO NOTHING;
    PERFORM public.growth_notify(p_user, 'growth_reward', 'Nova conquista!',
      'Você conquistou: ' || r.label || '. Obrigado por fazer o Vybelog crescer!', 'growth_reward:' || r.id || ':' || p_user);
    n := n + 1;
  END LOOP;
  RETURN n;
END;
$$;

-- 16.14 Validação periódica (pg_cron): indicações reais, fundadores e recompensas
CREATE OR REPLACE FUNCTION public.growth_validate()
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  regras JSONB := coalesce((SELECT value FROM public.growth_settings WHERE key = 'referral_rules'), '{}');
  cap INTEGER := coalesce((regras ->> 'daily_valid_cap')::int, 10);
  horas INTEGER := coalesce((regras ->> 'return_hours')::int, 12);
  fund JSONB := coalesce((SELECT value FROM public.growth_settings WHERE key = 'founders'), '{}');
  r RECORD; n INTEGER := 0; v_hoje INTEGER; v_prox INTEGER; v_vagas INTEGER;
BEGIN
  -- conta suspensa ou bloqueada: a indicação não vale
  UPDATE public.growth_referrals g SET status = 'rejected', reason = 'Conta da pessoa convidada suspensa ou bloqueada', validated_at = now()
    FROM public.profiles p WHERE p.id = g.referred_id AND g.status = 'pending' AND p.status::text IN ('suspended', 'blocked');

  FOR r IN
    SELECT g.referred_id, g.referrer_id FROM public.growth_referrals g
      JOIN public.profiles p ON p.id = g.referred_id
      JOIN auth.users u ON u.id = g.referred_id
      LEFT JOIN public.user_presence up ON up.user_id = g.referred_id
     WHERE g.status = 'pending' AND g.referrer_id IS NOT NULL
       AND u.email_confirmed_at IS NOT NULL
       AND coalesce(p.avatar_url, '') <> ''
       AND p.status::text IN ('active', 'warned')
       AND greatest(coalesce(up.last_seen_at, '-infinity'::timestamptz), p.last_active_at) >= p.created_at + make_interval(hours => horas)
     ORDER BY g.created_at
  LOOP
    SELECT count(*) INTO v_hoje FROM public.growth_referrals
     WHERE referrer_id = r.referrer_id AND status = 'valid' AND validated_at >= date_trunc('day', now());
    CONTINUE WHEN v_hoje >= cap;   -- limite diário: o restante valida nos próximos dias
    UPDATE public.growth_referrals SET status = 'valid', validated_at = now() WHERE referred_id = r.referred_id AND status = 'pending';
    PERFORM public.growth_notify(r.referrer_id, 'growth_referral_valid', 'Indicação confirmada!',
      'Uma pessoa que você convidou completou o cadastro no Vybelog.', 'growth_valid:' || r.referred_id);
    PERFORM public.growth_apply_rewards(r.referrer_id);
    n := n + 1;
  END LOOP;

  -- Fundadores: contas confirmadas e ativas, por ordem de cadastro, até o limite da campanha
  IF fund ->> 'status' = 'active' THEN
    SELECT coalesce(max(founder_number), 0) INTO v_prox FROM public.profile_growth;
    v_vagas := greatest(coalesce((fund ->> 'limit')::int, 0) - (SELECT count(*) FROM public.profile_growth WHERE founder_number IS NOT NULL), 0);
    FOR r IN
      SELECT p.id FROM public.profiles p JOIN auth.users u ON u.id = p.id
        LEFT JOIN public.profile_growth pg ON pg.user_id = p.id
       WHERE pg.founder_number IS NULL AND u.email_confirmed_at IS NOT NULL AND p.status::text IN ('active', 'warned')
       ORDER BY p.created_at LIMIT v_vagas
    LOOP
      v_prox := v_prox + 1;
      INSERT INTO public.profile_growth (user_id) VALUES (r.id) ON CONFLICT (user_id) DO NOTHING;
      UPDATE public.profile_growth SET founder_number = v_prox, founder_at = now(),
             badges = CASE WHEN 'fundador' = ANY (badges) THEN badges ELSE badges || 'fundador'::text END, updated_at = now()
       WHERE user_id = r.id;
      INSERT INTO public.growth_grants (user_id, kind, amount, label, source) VALUES (r.id, 'badge', 0, 'Membro Fundador nº ' || v_prox, 'founder');
      IF coalesce((fund ->> 'notify')::boolean, true) THEN
        PERFORM public.growth_notify(r.id, 'growth_founder', 'Você é Membro Fundador!',
          'Você é o Membro Fundador nº ' || v_prox || ' do Vybelog. O selo já aparece no seu perfil.', 'growth_founder:' || r.id);
      END IF;
    END LOOP;
    -- vagas esgotadas: a campanha encerra sozinha
    IF (SELECT count(*) FROM public.profile_growth WHERE founder_number IS NOT NULL) >= coalesce((fund ->> 'limit')::int, 0) THEN
      UPDATE public.growth_settings SET value = jsonb_set(value, '{status}', '"ended"'), updated_at = now() WHERE key = 'founders';
    END IF;
  END IF;
  RETURN n;
END;
$$;

-- 16.15 Funções da pessoa
-- Visita a um link de convite (contador do dia; também sem login)
CREATE OR REPLACE FUNCTION public.growth_track_visit(p_code TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_code IS NULL OR lower(p_code) !~ '^[a-z0-9-]{4,24}$' THEN RETURN; END IF;
  INSERT INTO public.growth_visits (code, day, visits)
  SELECT c.code, current_date, 1 FROM public.growth_codes c WHERE c.code = lower(p_code) AND c.active
  ON CONFLICT (code, day) DO UPDATE SET visits = least(public.growth_visits.visits + 1, 100000);
END;
$$;

CREATE OR REPLACE FUNCTION public.growth_set_ranking_visibility(p_show BOOLEAN)
RETURNS VOID LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO public.profile_growth (user_id, show_in_ranking) VALUES (auth.uid(), p_show)
  ON CONFLICT (user_id) DO UPDATE SET show_in_ranking = EXCLUDED.show_in_ranking, updated_at = now();
$$;

-- Ranking de quem mais indica (só indicações válidas; quem preferiu ficar fora não aparece)
CREATE OR REPLACE FUNCTION public.growth_ranking(p_period TEXT DEFAULT '30d', p_ambassadors BOOLEAN DEFAULT false)
RETURNS TABLE (pos INTEGER, user_id UUID, display_name TEXT, username TEXT, avatar_url TEXT, valid_count INTEGER, ambassador BOOLEAN)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT (row_number() OVER (ORDER BY count(*) DESC, min(g.validated_at)))::int, p.id, p.display_name::text, p.username::text, p.avatar_url,
         count(*)::int, coalesce(pg.ambassador, false)
    FROM public.growth_referrals g
    JOIN public.profiles p ON p.id = g.referrer_id
    LEFT JOIN public.profile_growth pg ON pg.user_id = p.id
   WHERE auth.uid() IS NOT NULL
     AND g.status = 'valid'
     AND (p_period <> '30d' OR g.validated_at > now() - interval '30 days')
     AND coalesce(pg.show_in_ranking, true)
     AND p.status::text IN ('active', 'warned')
     AND (NOT p_ambassadors OR coalesce(pg.ambassador, false))
     AND NOT public.is_blocked_between(p.id, auth.uid())
   GROUP BY p.id, p.display_name, p.username, p.avatar_url, pg.ambassador
   ORDER BY count(*) DESC, min(g.validated_at)
   LIMIT 20;
$$;

-- Painel "Convide e Ganhe" da própria pessoa
CREATE OR REPLACE FUNCTION public.growth_my_panel()
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  me UUID := auth.uid();
  v_code TEXT; v_custom TEXT; v_validas INTEGER; v_pg public.profile_growth;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'Faça login.'; END IF;
  v_code := public.growth_code_for(me);
  SELECT code INTO v_custom FROM public.growth_codes WHERE user_id = me AND custom AND active ORDER BY created_at DESC LIMIT 1;
  SELECT * INTO v_pg FROM public.profile_growth WHERE user_id = me;
  SELECT count(*) INTO v_validas FROM public.growth_referrals WHERE referrer_id = me AND status = 'valid';
  RETURN jsonb_build_object(
    'code', coalesce(v_custom, v_code),
    'visits', coalesce((SELECT sum(v.visits) FROM public.growth_visits v JOIN public.growth_codes c ON c.code = v.code WHERE c.user_id = me), 0),
    'signups', (SELECT count(*) FROM public.growth_referrals WHERE referrer_id = me),
    'pending', (SELECT count(*) FROM public.growth_referrals WHERE referrer_id = me AND status = 'pending'),
    'valid', v_validas,
    'rejected', (SELECT count(*) FROM public.growth_referrals WHERE referrer_id = me AND status = 'rejected'),
    'active_referred', (SELECT count(*) FROM public.growth_referrals g JOIN public.user_presence up ON up.user_id = g.referred_id
                         WHERE g.referrer_id = me AND g.status = 'valid' AND up.last_seen_at > now() - interval '7 days'),
    'rewards', coalesce((SELECT jsonb_agg(jsonb_build_object('id', r.id, 'threshold', r.threshold, 'kind', r.kind, 'amount', r.amount, 'label', r.label,
                    'achieved', EXISTS (SELECT 1 FROM public.growth_grants x WHERE x.user_id = me AND x.reward_id = r.id)) ORDER BY r.threshold)
                  FROM public.growth_rewards r WHERE r.active), '[]'),
    'grants', coalesce((SELECT jsonb_agg(jsonb_build_object('label', x.label, 'kind', x.kind, 'source', x.source, 'granted_at', x.granted_at, 'expires_at', x.expires_at)
                    ORDER BY x.granted_at DESC) FROM (SELECT * FROM public.growth_grants WHERE user_id = me ORDER BY granted_at DESC LIMIT 50) x), '[]'),
    'referrals', coalesce((SELECT jsonb_agg(jsonb_build_object('display_name', p.display_name, 'username', p.username, 'avatar_url', p.avatar_url,
                    'status', g.status, 'created_at', g.created_at) ORDER BY g.created_at DESC)
                  FROM (SELECT * FROM public.growth_referrals WHERE referrer_id = me ORDER BY created_at DESC LIMIT 100) g
                  JOIN public.profiles p ON p.id = g.referred_id), '[]'),
    'founder_number', v_pg.founder_number,
    'ambassador', coalesce(v_pg.ambassador, false),
    'vip_until', v_pg.vip_until,
    'featured_until', v_pg.featured_until,
    'badges', coalesce(to_jsonb(v_pg.badges), '[]'),
    'show_in_ranking', coalesce(v_pg.show_in_ranking, true),
    'rank_30d', (SELECT x.pos FROM public.growth_ranking('30d', false) x WHERE x.user_id = me),
    'share_message', (SELECT value ->> 'text' FROM public.growth_settings WHERE key = 'share_message'),
    'rules', (SELECT value FROM public.growth_settings WHERE key = 'referral_rules')
  );
END;
$$;

-- Informações públicas (página inicial e campanha): vagas de fundador e campanhas ativas, sem dados pessoais
CREATE OR REPLACE FUNCTION public.growth_public_info()
RETURNS JSONB LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'founders', (SELECT jsonb_build_object('status', f.value ->> 'status', 'limit', (f.value ->> 'limit')::int,
                   'taken', (SELECT count(*) FROM public.profile_growth WHERE founder_number IS NOT NULL),
                   'remaining', greatest((f.value ->> 'limit')::int - (SELECT count(*) FROM public.profile_growth WHERE founder_number IS NOT NULL), 0),
                   'benefits', f.value -> 'benefits')
                 FROM public.growth_settings f WHERE f.key = 'founders'),
    'campaigns', coalesce((SELECT jsonb_agg(jsonb_build_object('slug', c.slug, 'title', c.title, 'description', c.description, 'ends_at', c.ends_at) ORDER BY c.starts_at DESC)
                  FROM public.growth_campaigns c WHERE c.active AND c.starts_at <= now() AND (c.ends_at IS NULL OR c.ends_at > now())), '[]'));
$$;

-- Destaques do Descobrir (só ids: os perfis são buscados depois com as regras de privacidade de quem vê)
CREATE OR REPLACE FUNCTION public.growth_highlights()
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE me UUID := auth.uid();
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'Faça login.'; END IF;
  RETURN jsonb_build_object(
    -- destaque conquistado (recompensa) ou VIP ativo
    'featured', coalesce((SELECT jsonb_agg(x.user_id) FROM (
        SELECT pg.user_id FROM public.profile_growth pg JOIN public.profiles p ON p.id = pg.user_id
         WHERE (pg.featured_until > now() OR pg.vip_until > now()) AND p.status::text IN ('active', 'warned') AND pg.user_id <> me
           AND NOT public.is_blocked_between(pg.user_id, me)
         ORDER BY pg.featured_until DESC NULLS LAST, pg.vip_until DESC NULLS LAST LIMIT 12) x), '[]'),
    -- destaques da semana: mais pessoas diferentes interagiram (curtidas, comentários e novos seguidores),
    -- contando só contas com mais de 7 dias (contas recém-criadas não inflam o placar)
    'couple_of_week', (SELECT s.alvo FROM public.growth_week_scores(me) s JOIN public.profiles p ON p.id = s.alvo
                        WHERE p.profile_type::text IN ('couple', 'joint_profile', 'polyamorous') ORDER BY s.pontos DESC LIMIT 1),
    'member_of_week', (SELECT s.alvo FROM public.growth_week_scores(me) s JOIN public.profiles p ON p.id = s.alvo
                        WHERE p.profile_type::text IN ('single_female', 'single_male') ORDER BY s.pontos DESC LIMIT 1),
    'new_members', coalesce((SELECT jsonb_agg(x.id) FROM (
        SELECT p.id FROM public.profiles p WHERE p.created_at > now() - interval '21 days' AND coalesce(p.avatar_url, '') <> ''
           AND p.status::text IN ('active', 'warned') AND p.id <> me AND NOT public.is_blocked_between(p.id, me)
         ORDER BY p.created_at DESC LIMIT 12) x), '[]'),
    'popular', coalesce((SELECT jsonb_agg(x.id) FROM (
        SELECT p.id FROM public.profiles p WHERE p.status::text IN ('active', 'warned') AND p.id <> me AND coalesce(p.avatar_url, '') <> ''
           AND NOT public.is_blocked_between(p.id, me)
         ORDER BY p.followers_count DESC, p.last_active_at DESC LIMIT 12) x), '[]'));
END;
$$;

CREATE OR REPLACE FUNCTION public.growth_week_scores(p_viewer UUID)
RETURNS TABLE (alvo UUID, pontos INTEGER) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH acoes AS (
    SELECT po.user_id AS alvo, l.user_id AS ator FROM public.post_likes l JOIN public.posts po ON po.id = l.post_id
     WHERE l.created_at > now() - interval '7 days' AND po.community_id IS NULL AND po.visibility = 'public'
    UNION
    SELECT po.user_id, c.user_id FROM public.post_comments c JOIN public.posts po ON po.id = c.post_id
     WHERE c.created_at > now() - interval '7 days' AND po.community_id IS NULL AND po.visibility = 'public'
    UNION
    SELECT f.following_id, f.follower_id FROM public.follows f WHERE f.created_at > now() - interval '7 days'
  )
  SELECT a.alvo, count(DISTINCT a.ator)::int
    FROM acoes a
    JOIN public.profiles ator ON ator.id = a.ator AND ator.created_at < now() - interval '7 days' AND ator.status::text IN ('active', 'warned')
    JOIN public.profiles alvo ON alvo.id = a.alvo AND alvo.status::text IN ('active', 'warned') AND coalesce(alvo.avatar_url, '') <> ''
   WHERE a.alvo <> a.ator AND a.alvo <> p_viewer AND NOT public.is_blocked_between(a.alvo, p_viewer)
   GROUP BY a.alvo
  HAVING count(DISTINCT a.ator) >= 2;
$$;

-- 16.16 Growth Center (administração)
CREATE OR REPLACE FUNCTION public.growth_admin_stats()
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_staff() THEN RAISE EXCEPTION 'Acesso restrito à equipe.'; END IF;
  RETURN jsonb_build_object(
    'users', (SELECT count(*) FROM public.profiles),
    'new_1d', (SELECT count(*) FROM public.profiles WHERE created_at > now() - interval '1 day'),
    'new_7d', (SELECT count(*) FROM public.profiles WHERE created_at > now() - interval '7 days'),
    'new_30d', (SELECT count(*) FROM public.profiles WHERE created_at > now() - interval '30 days'),
    'active_7d', (SELECT count(*) FROM public.user_presence WHERE last_seen_at > now() - interval '7 days'),
    'returned', (SELECT count(*) FROM public.profiles p JOIN public.user_presence up ON up.user_id = p.id
                  WHERE up.last_seen_at >= p.created_at + interval '1 day'),
    'referrals_total', (SELECT count(*) FROM public.growth_referrals),
    'referrals_valid', (SELECT count(*) FROM public.growth_referrals WHERE status = 'valid'),
    'referrals_pending', (SELECT count(*) FROM public.growth_referrals WHERE status = 'pending'),
    'referrals_rejected', (SELECT count(*) FROM public.growth_referrals WHERE status = 'rejected'),
    'visits_30d', coalesce((SELECT sum(visits) FROM public.growth_visits WHERE day > current_date - 30), 0),
    'signups_ref_30d', (SELECT count(*) FROM public.growth_referrals WHERE created_at > now() - interval '30 days'),
    'grants_by_kind', coalesce((SELECT jsonb_object_agg(kind, n) FROM (SELECT kind, count(*) n FROM public.growth_grants GROUP BY kind) x), '{}'),
    'founders', (SELECT count(*) FROM public.profile_growth WHERE founder_number IS NOT NULL),
    'ambassadors', (SELECT count(*) FROM public.profile_growth WHERE ambassador),
    'signups_series', (SELECT jsonb_agg(jsonb_build_object('day', d::date,
                         'n', (SELECT count(*) FROM public.profiles p WHERE p.created_at >= d AND p.created_at < d + interval '1 day'),
                         'ref', (SELECT count(*) FROM public.growth_referrals g WHERE g.created_at >= d AND g.created_at < d + interval '1 day')) ORDER BY d)
                       FROM generate_series(date_trunc('day', now()) - interval '29 days', date_trunc('day', now()), interval '1 day') d),
    'top_referrers', coalesce((SELECT jsonb_agg(x) FROM (
        SELECT p.id, p.display_name, p.username, coalesce(pg.ambassador, false) AS ambassador,
               count(*) FILTER (WHERE g.status = 'valid') AS valid, count(*) AS total
          FROM public.growth_referrals g JOIN public.profiles p ON p.id = g.referrer_id
          LEFT JOIN public.profile_growth pg ON pg.user_id = p.id
         GROUP BY p.id, p.display_name, p.username, pg.ambassador ORDER BY 5 DESC, 6 DESC LIMIT 15) x), '[]'),
    'ambassador_list', coalesce((SELECT jsonb_agg(x) FROM (
        SELECT p.id, p.display_name, p.username, pg.ambassador_since,
               (SELECT string_agg(code, ', ') FROM public.growth_codes c WHERE c.user_id = p.id AND c.custom AND c.active) AS custom_codes,
               (SELECT count(*) FROM public.growth_referrals g WHERE g.referrer_id = p.id) AS total,
               (SELECT count(*) FROM public.growth_referrals g WHERE g.referrer_id = p.id AND g.status = 'valid') AS valid,
               (SELECT count(*) FROM public.growth_referrals g JOIN public.user_presence up ON up.user_id = g.referred_id
                 WHERE g.referrer_id = p.id AND g.status = 'valid' AND up.last_seen_at > now() - interval '7 days') AS active
          FROM public.profile_growth pg JOIN public.profiles p ON p.id = pg.user_id WHERE pg.ambassador ORDER BY 7 DESC) x), '[]'),
    'campaigns', coalesce((SELECT jsonb_agg(x ORDER BY x.created_at DESC) FROM (
        SELECT c.id, c.slug, c.title, c.description, c.starts_at, c.ends_at, c.active, c.created_at,
               (SELECT count(*) FROM public.growth_referrals g WHERE g.campaign_id = c.id) AS signups,
               (SELECT count(*) FROM public.growth_referrals g WHERE g.campaign_id = c.id AND g.status = 'valid') AS valid
          FROM public.growth_campaigns c) x), '[]'),
    'recent_referrals', coalesce((SELECT jsonb_agg(x) FROM (
        SELECT g.referred_id, g.status, g.reason, g.created_at, g.validated_at,
               r.display_name AS referred_name, r.username AS referred_username,
               i.display_name AS referrer_name, i.username AS referrer_username
          FROM public.growth_referrals g JOIN public.profiles r ON r.id = g.referred_id
          LEFT JOIN public.profiles i ON i.id = g.referrer_id
         ORDER BY g.created_at DESC LIMIT 50) x), '[]'),
    'rewards', coalesce((SELECT jsonb_agg(to_jsonb(r) ORDER BY r.threshold) FROM public.growth_rewards r), '[]'),
    'settings', coalesce((SELECT jsonb_object_agg(key, value) FROM public.growth_settings), '{}')
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.growth_admin_audit(p_action TEXT, p_type TEXT, p_target TEXT, p_reason TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_superadmin() THEN RAISE EXCEPTION 'Somente o superadministrador (com MFA) altera o crescimento.'; END IF;
  IF coalesce(length(trim(p_reason)), 0) < 5 THEN RAISE EXCEPTION 'Informe a justificativa (mínimo de 5 caracteres).'; END IF;
  INSERT INTO public.admin_audit_logs (admin_id, admin_role, action, target_type, target_id, reason)
  VALUES (auth.uid(), public.admin_role_of(auth.uid()), p_action, p_type, p_target, trim(p_reason));
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_growth_save_settings(p_key TEXT, p_value JSONB, justification TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.growth_admin_audit('growth_settings', 'growth_settings', p_key, justification);
  IF p_key = 'founders' THEN
    IF coalesce(p_value ->> 'status', '') NOT IN ('active', 'paused', 'ended') THEN RAISE EXCEPTION 'Situação inválida.'; END IF;
    IF coalesce((p_value ->> 'limit')::int, -1) NOT BETWEEN 1 AND 100000 THEN RAISE EXCEPTION 'Limite de vagas inválido.'; END IF;
    IF jsonb_typeof(p_value -> 'benefits') <> 'array' OR jsonb_array_length(p_value -> 'benefits') > 10 THEN RAISE EXCEPTION 'Use até 10 benefícios.'; END IF;
  ELSIF p_key = 'share_message' THEN
    IF length(coalesce(p_value ->> 'text', '')) NOT BETWEEN 20 AND 600 OR position('{link}' IN p_value ->> 'text') = 0 THEN
      RAISE EXCEPTION 'A mensagem precisa ter de 20 a 600 caracteres e conter {link}.';
    END IF;
  ELSIF p_key = 'referral_rules' THEN
    IF coalesce((p_value ->> 'daily_valid_cap')::int, 0) NOT BETWEEN 1 AND 100 OR coalesce((p_value ->> 'return_hours')::int, -1) NOT BETWEEN 0 AND 168 THEN
      RAISE EXCEPTION 'Regras inválidas.';
    END IF;
  ELSE
    RAISE EXCEPTION 'Configuração desconhecida.';
  END IF;
  INSERT INTO public.growth_settings (key, value, updated_at, updated_by) VALUES (p_key, p_value, now(), auth.uid())
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now(), updated_by = auth.uid();
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_growth_save_reward(p_id UUID, p_threshold INTEGER, p_kind TEXT, p_amount INTEGER, p_badge TEXT, p_label TEXT, p_active BOOLEAN, justification TEXT)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v UUID;
BEGIN
  PERFORM public.growth_admin_audit('growth_reward', 'growth_reward', coalesce(p_id::text, 'nova'), justification);
  IF p_kind = 'badge' AND coalesce(p_badge, '') !~ '^[a-z0-9_]{3,40}$' THEN RAISE EXCEPTION 'Informe o código do selo (letras minúsculas e números).'; END IF;
  IF p_id IS NULL THEN
    INSERT INTO public.growth_rewards (threshold, kind, amount, badge, label, active)
    VALUES (p_threshold, p_kind, coalesce(p_amount, 0), nullif(p_badge, ''), trim(p_label), coalesce(p_active, true)) RETURNING id INTO v;
  ELSE
    UPDATE public.growth_rewards SET threshold = p_threshold, kind = p_kind, amount = coalesce(p_amount, 0), badge = nullif(p_badge, ''),
           label = trim(p_label), active = coalesce(p_active, true) WHERE id = p_id RETURNING id INTO v;
  END IF;
  RETURN v;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_growth_set_ambassador(p_user UUID, p_on BOOLEAN, p_custom_code TEXT, justification TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_code TEXT := nullif(lower(trim(coalesce(p_custom_code, ''))), '');
BEGIN
  PERFORM public.growth_admin_audit(CASE WHEN p_on THEN 'growth_ambassador_on' ELSE 'growth_ambassador_off' END, 'profile', p_user::text, justification);
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_user) THEN RAISE EXCEPTION 'Perfil não encontrado.'; END IF;
  INSERT INTO public.profile_growth (user_id) VALUES (p_user) ON CONFLICT (user_id) DO NOTHING;
  IF p_on THEN
    UPDATE public.profile_growth SET ambassador = true, ambassador_since = coalesce(ambassador_since, now()),
           badges = CASE WHEN 'embaixador' = ANY (badges) THEN badges ELSE badges || 'embaixador'::text END, updated_at = now()
     WHERE user_id = p_user;
    IF v_code IS NOT NULL THEN
      IF v_code !~ '^[a-z0-9-]{4,24}$' THEN RAISE EXCEPTION 'Código personalizado: 4 a 24 letras minúsculas, números ou hífen.'; END IF;
      IF EXISTS (SELECT 1 FROM public.growth_codes WHERE code = v_code AND user_id <> p_user) THEN RAISE EXCEPTION 'Este código já está em uso.'; END IF;
      UPDATE public.growth_codes SET active = false WHERE user_id = p_user AND custom AND code <> v_code;
      INSERT INTO public.growth_codes (code, user_id, custom) VALUES (v_code, p_user, true)
      ON CONFLICT (code) DO UPDATE SET active = true;
    END IF;
    INSERT INTO public.growth_grants (user_id, kind, amount, label, source, granted_by, reason)
    VALUES (p_user, 'badge', 0, 'Embaixador Vybelog', 'ambassador', auth.uid(), trim(justification));
    PERFORM public.growth_notify(p_user, 'growth_ambassador', 'Você é Embaixador Vybelog!',
      'Seu selo de Embaixador já aparece no perfil. Acompanhe seu desempenho em Convide e Ganhe.', 'growth_ambassador:' || p_user || ':' || extract(epoch from now())::bigint);
  ELSE
    UPDATE public.profile_growth SET ambassador = false, badges = array_remove(badges, 'embaixador'), updated_at = now() WHERE user_id = p_user;
    UPDATE public.growth_codes SET active = false WHERE user_id = p_user AND custom;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_growth_grant(p_user UUID, p_kind TEXT, p_amount INTEGER, p_label TEXT, justification TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_fim TIMESTAMPTZ;
BEGIN
  PERFORM public.growth_admin_audit('growth_grant', 'profile', p_user::text, justification);
  IF p_kind NOT IN ('featured_days', 'vip_days') OR coalesce(p_amount, 0) NOT BETWEEN 1 AND 3650 THEN RAISE EXCEPTION 'Benefício inválido.'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_user) THEN RAISE EXCEPTION 'Perfil não encontrado.'; END IF;
  v_fim := public.growth_apply_effect(p_user, p_kind, p_amount, NULL);
  INSERT INTO public.growth_grants (user_id, kind, amount, label, source, granted_by, reason, expires_at)
  VALUES (p_user, p_kind, p_amount, coalesce(nullif(trim(p_label), ''), CASE p_kind WHEN 'vip_days' THEN p_amount || ' dias de VIP' ELSE 'Destaque por ' || p_amount || ' dias' END),
          'admin', auth.uid(), trim(justification), v_fim);
  PERFORM public.growth_notify(p_user, 'growth_reward', 'Você recebeu um benefício!',
    'A equipe do Vybelog concedeu a você: ' || coalesce(nullif(trim(p_label), ''), 'um benefício especial') || '.', 'growth_admin:' || p_user || ':' || extract(epoch from now())::bigint);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_growth_reject_referral(p_referred UUID, justification TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.growth_admin_audit('growth_referral_reject', 'profile', p_referred::text, justification);
  UPDATE public.growth_referrals SET status = 'rejected', reason = left(trim(justification), 300), validated_at = now() WHERE referred_id = p_referred;
  IF NOT FOUND THEN RAISE EXCEPTION 'Indicação não encontrada.'; END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_growth_save_campaign(p_id UUID, p_slug TEXT, p_title TEXT, p_description TEXT, p_starts TIMESTAMPTZ, p_ends TIMESTAMPTZ, p_active BOOLEAN, justification TEXT)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v UUID;
BEGIN
  PERFORM public.growth_admin_audit('growth_campaign', 'growth_campaign', coalesce(p_id::text, lower(p_slug)), justification);
  IF p_id IS NULL THEN
    INSERT INTO public.growth_campaigns (slug, title, description, starts_at, ends_at, active, created_by)
    VALUES (lower(trim(p_slug)), trim(p_title), coalesce(trim(p_description), ''), coalesce(p_starts, now()), p_ends, coalesce(p_active, true), auth.uid())
    RETURNING id INTO v;
  ELSE
    UPDATE public.growth_campaigns SET slug = lower(trim(p_slug)), title = trim(p_title), description = coalesce(trim(p_description), ''),
           starts_at = coalesce(p_starts, starts_at), ends_at = p_ends, active = coalesce(p_active, active)
     WHERE id = p_id RETURNING id INTO v;
  END IF;
  RETURN v;
END;
$$;

-- 16.17 Permissões
REVOKE EXECUTE ON FUNCTION public.growth_notify(UUID, TEXT, TEXT, TEXT, TEXT), public.growth_code_for(UUID), public.growth_capture_referral(),
  public.growth_apply_effect(UUID, TEXT, INTEGER, TEXT), public.growth_apply_rewards(UUID), public.growth_validate(),
  public.growth_week_scores(UUID), public.growth_admin_audit(TEXT, TEXT, TEXT, TEXT)
  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.growth_set_ranking_visibility(BOOLEAN), public.growth_ranking(TEXT, BOOLEAN), public.growth_my_panel(),
  public.growth_highlights(), public.growth_admin_stats(),
  public.admin_growth_save_settings(TEXT, JSONB, TEXT), public.admin_growth_save_reward(UUID, INTEGER, TEXT, INTEGER, TEXT, TEXT, BOOLEAN, TEXT),
  public.admin_growth_set_ambassador(UUID, BOOLEAN, TEXT, TEXT), public.admin_growth_grant(UUID, TEXT, INTEGER, TEXT, TEXT),
  public.admin_growth_reject_referral(UUID, TEXT), public.admin_growth_save_campaign(UUID, TEXT, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, BOOLEAN, TEXT)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.growth_set_ranking_visibility(BOOLEAN), public.growth_ranking(TEXT, BOOLEAN), public.growth_my_panel(),
  public.growth_highlights(), public.growth_admin_stats(),
  public.admin_growth_save_settings(TEXT, JSONB, TEXT), public.admin_growth_save_reward(UUID, INTEGER, TEXT, INTEGER, TEXT, TEXT, BOOLEAN, TEXT),
  public.admin_growth_set_ambassador(UUID, BOOLEAN, TEXT, TEXT), public.admin_growth_grant(UUID, TEXT, INTEGER, TEXT, TEXT),
  public.admin_growth_reject_referral(UUID, TEXT), public.admin_growth_save_campaign(UUID, TEXT, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, BOOLEAN, TEXT)
  TO authenticated;
-- visitas ao link e informações da campanha também na página inicial (sem login)
REVOKE EXECUTE ON FUNCTION public.growth_track_visit(TEXT), public.growth_public_info() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.growth_track_visit(TEXT), public.growth_public_info() TO anon, authenticated;

-- 16.18 Rotina a cada 10 minutos (validações, fundadores e recompensas)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'vybelog-crescimento';
    PERFORM cron.schedule('vybelog-crescimento', '*/10 * * * *', 'SELECT public.growth_validate()');
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Agendamento do crescimento não criado: %', SQLERRM;
END $$;

-- 16.19 Fundadores: os membros atuais (os primeiros do Vybelog) recebem o número por ordem de cadastro,
-- sem aviso em massa (o aviso vale para quem entrar daqui em diante)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profile_growth WHERE founder_number IS NOT NULL) THEN
    UPDATE public.growth_settings SET value = value || '{"notify": false}' WHERE key = 'founders';
    PERFORM public.growth_validate();
    UPDATE public.growth_settings SET value = value - 'notify' WHERE key = 'founders';
  END IF;
END $$;

-- ==============================================================================
-- 17. INCLUSÃO DE GÊNERO E FUNDADOR COM FOTO
-- * Novo tipo de perfil "Pessoa solteira" (single_other): para identidades não binárias, fluidas e
--   outras que não se encaixam em "mulher" ou "homem" (mulheres e homens trans escolhem esses tipos
--   e informam o gênero exato). A lista de gêneros e orientações fica no app (texto livre no banco).
-- * Selo de Fundador exige foto de perfil: novos fundadores só recebem o número com foto; quem já
--   tem o número reservado e ainda não tem foto ativa o selo ao colocar a foto (o app só exibe o selo
--   para perfis com foto).
-- ==============================================================================
ALTER TYPE public.profile_type_enum ADD VALUE IF NOT EXISTS 'single_other';

CREATE OR REPLACE FUNCTION public.is_interested_in(looking TEXT[], target_type profile_type_enum)
RETURNS BOOLEAN LANGUAGE sql IMMUTABLE SET search_path = public, extensions, pg_temp AS $$
  SELECT CASE
    WHEN looking IS NULL THEN false
    WHEN 'all' = ANY(looking) THEN true
    WHEN target_type::text = 'couple'        AND 'couples'        = ANY(looking) THEN true
    WHEN target_type::text = 'single_female' AND 'singles_female' = ANY(looking) THEN true
    WHEN target_type::text = 'single_male'   AND 'singles_male'   = ANY(looking) THEN true
    WHEN target_type::text = 'single_other'  AND 'singles_other'  = ANY(looking) THEN true
    WHEN target_type::text = 'joint_profile' AND 'couples'        = ANY(looking) THEN true
    WHEN target_type::text = 'polyamorous' THEN true
    ELSE false
  END;
$$;

CREATE OR REPLACE FUNCTION public.growth_validate()
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  regras JSONB := coalesce((SELECT value FROM public.growth_settings WHERE key = 'referral_rules'), '{}');
  cap INTEGER := coalesce((regras ->> 'daily_valid_cap')::int, 10);
  horas INTEGER := coalesce((regras ->> 'return_hours')::int, 12);
  fund JSONB := coalesce((SELECT value FROM public.growth_settings WHERE key = 'founders'), '{}');
  r RECORD; n INTEGER := 0; v_hoje INTEGER; v_prox INTEGER; v_vagas INTEGER;
BEGIN
  UPDATE public.growth_referrals g SET status = 'rejected', reason = 'Conta da pessoa convidada suspensa ou bloqueada', validated_at = now()
    FROM public.profiles p WHERE p.id = g.referred_id AND g.status = 'pending' AND p.status::text IN ('suspended', 'blocked');

  FOR r IN
    SELECT g.referred_id, g.referrer_id FROM public.growth_referrals g
      JOIN public.profiles p ON p.id = g.referred_id
      JOIN auth.users u ON u.id = g.referred_id
      LEFT JOIN public.user_presence up ON up.user_id = g.referred_id
     WHERE g.status = 'pending' AND g.referrer_id IS NOT NULL
       AND u.email_confirmed_at IS NOT NULL
       AND coalesce(p.avatar_url, '') <> ''
       AND p.status::text IN ('active', 'warned')
       AND greatest(coalesce(up.last_seen_at, '-infinity'::timestamptz), p.last_active_at) >= p.created_at + make_interval(hours => horas)
     ORDER BY g.created_at
  LOOP
    SELECT count(*) INTO v_hoje FROM public.growth_referrals
     WHERE referrer_id = r.referrer_id AND status = 'valid' AND validated_at >= date_trunc('day', now());
    CONTINUE WHEN v_hoje >= cap;
    UPDATE public.growth_referrals SET status = 'valid', validated_at = now() WHERE referred_id = r.referred_id AND status = 'pending';
    PERFORM public.growth_notify(r.referrer_id, 'growth_referral_valid', 'Indicação confirmada!',
      'Uma pessoa que você convidou completou o cadastro no Vybelog.', 'growth_valid:' || r.referred_id);
    PERFORM public.growth_apply_rewards(r.referrer_id);
    n := n + 1;
  END LOOP;

  -- Fundadores: contas confirmadas, ativas e COM FOTO de perfil, por ordem de cadastro, até o limite
  IF fund ->> 'status' = 'active' THEN
    SELECT coalesce(max(founder_number), 0) INTO v_prox FROM public.profile_growth;
    v_vagas := greatest(coalesce((fund ->> 'limit')::int, 0) - (SELECT count(*) FROM public.profile_growth WHERE founder_number IS NOT NULL), 0);
    FOR r IN
      SELECT p.id FROM public.profiles p JOIN auth.users u ON u.id = p.id
        LEFT JOIN public.profile_growth pg ON pg.user_id = p.id
       WHERE pg.founder_number IS NULL AND u.email_confirmed_at IS NOT NULL AND p.status::text IN ('active', 'warned')
         AND coalesce(p.avatar_url, '') <> ''
       ORDER BY p.created_at LIMIT v_vagas
    LOOP
      v_prox := v_prox + 1;
      INSERT INTO public.profile_growth (user_id) VALUES (r.id) ON CONFLICT (user_id) DO NOTHING;
      UPDATE public.profile_growth SET founder_number = v_prox, founder_at = now(),
             badges = CASE WHEN 'fundador' = ANY (badges) THEN badges ELSE badges || 'fundador'::text END, updated_at = now()
       WHERE user_id = r.id;
      INSERT INTO public.growth_grants (user_id, kind, amount, label, source) VALUES (r.id, 'badge', 0, 'Membro Fundador nº ' || v_prox, 'founder');
      IF coalesce((fund ->> 'notify')::boolean, true) THEN
        PERFORM public.growth_notify(r.id, 'growth_founder', 'Você é Membro Fundador!',
          'Você é o Membro Fundador nº ' || v_prox || ' do Vybelog. O selo já aparece no seu perfil.', 'growth_founder:' || r.id);
      END IF;
    END LOOP;
    IF (SELECT count(*) FROM public.profile_growth WHERE founder_number IS NOT NULL) >= coalesce((fund ->> 'limit')::int, 0) THEN
      UPDATE public.growth_settings SET value = jsonb_set(value, '{status}', '"ended"'), updated_at = now() WHERE key = 'founders';
    END IF;
  END IF;
  RETURN n;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.growth_validate() FROM PUBLIC, anon, authenticated;

-- Destaques: o membro da semana inclui pessoas solteiras de qualquer gênero
CREATE OR REPLACE FUNCTION public.growth_highlights()
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE me UUID := auth.uid();
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'Faça login.'; END IF;
  RETURN jsonb_build_object(
    'featured', coalesce((SELECT jsonb_agg(x.user_id) FROM (
        SELECT pg.user_id FROM public.profile_growth pg JOIN public.profiles p ON p.id = pg.user_id
         WHERE (pg.featured_until > now() OR pg.vip_until > now()) AND p.status::text IN ('active', 'warned') AND pg.user_id <> me
           AND NOT public.is_blocked_between(pg.user_id, me)
         ORDER BY pg.featured_until DESC NULLS LAST, pg.vip_until DESC NULLS LAST LIMIT 12) x), '[]'),
    'couple_of_week', (SELECT s.alvo FROM public.growth_week_scores(me) s JOIN public.profiles p ON p.id = s.alvo
                        WHERE p.profile_type::text IN ('couple', 'joint_profile', 'polyamorous') ORDER BY s.pontos DESC LIMIT 1),
    'member_of_week', (SELECT s.alvo FROM public.growth_week_scores(me) s JOIN public.profiles p ON p.id = s.alvo
                        WHERE p.profile_type::text IN ('single_female', 'single_male', 'single_other') ORDER BY s.pontos DESC LIMIT 1),
    'new_members', coalesce((SELECT jsonb_agg(x.id) FROM (
        SELECT p.id FROM public.profiles p WHERE p.created_at > now() - interval '21 days' AND coalesce(p.avatar_url, '') <> ''
           AND p.status::text IN ('active', 'warned') AND p.id <> me AND NOT public.is_blocked_between(p.id, me)
         ORDER BY p.created_at DESC LIMIT 12) x), '[]'),
    'popular', coalesce((SELECT jsonb_agg(x.id) FROM (
        SELECT p.id FROM public.profiles p WHERE p.status::text IN ('active', 'warned') AND p.id <> me AND coalesce(p.avatar_url, '') <> ''
           AND NOT public.is_blocked_between(p.id, me)
         ORDER BY p.followers_count DESC, p.last_active_at DESC LIMIT 12) x), '[]'));
END;
$$;
REVOKE EXECUTE ON FUNCTION public.growth_highlights() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.growth_highlights() TO authenticated;

-- Requisito da campanha visível para todos (página da campanha e cadastro)
UPDATE public.growth_settings
   SET value = jsonb_set(value, '{requirements}', '"E-mail confirmado e foto de perfil. Sem foto, o número de fundador fica reservado e o selo aparece quando você colocar a foto."')
 WHERE key = 'founders' AND NOT (value ? 'requirements');

CREATE OR REPLACE FUNCTION public.growth_public_info()
RETURNS JSONB LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'founders', (SELECT jsonb_build_object('status', f.value ->> 'status', 'limit', (f.value ->> 'limit')::int,
                   'taken', (SELECT count(*) FROM public.profile_growth WHERE founder_number IS NOT NULL),
                   'remaining', greatest((f.value ->> 'limit')::int - (SELECT count(*) FROM public.profile_growth WHERE founder_number IS NOT NULL), 0),
                   'benefits', f.value -> 'benefits', 'requirements', f.value ->> 'requirements')
                 FROM public.growth_settings f WHERE f.key = 'founders'),
    'campaigns', coalesce((SELECT jsonb_agg(jsonb_build_object('slug', c.slug, 'title', c.title, 'description', c.description, 'ends_at', c.ends_at) ORDER BY c.starts_at DESC)
                  FROM public.growth_campaigns c WHERE c.active AND c.starts_at <= now() AND (c.ends_at IS NULL OR c.ends_at > now())), '[]'));
$$;
REVOKE EXECUTE ON FUNCTION public.growth_public_info() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.growth_public_info() TO anon, authenticated;

-- ==============================================================================
-- 18. PUBLICIDADE: a administração escolhe quais anúncios aparecem na janela de publicidade
-- (a janela abre uma vez por acesso, revezando entre os escolhidos). Anúncios novos começam fora;
-- os que já existiam quando a opção foi criada continuam na janela.
-- ==============================================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_schema = 'public' AND table_name = 'ads' AND column_name = 'show_in_popup') THEN
    ALTER TABLE public.ads ADD COLUMN show_in_popup BOOLEAN NOT NULL DEFAULT false;
    UPDATE public.ads SET show_in_popup = true;
  END IF;
END $$;

-- ==============================================================================
-- 19. PUBLICIDADE: frequência da janela de publicidade (ajustável pela administração)
-- interval_min: minutos entre uma janela e a próxima; max_per_session: limite por acesso.
-- ==============================================================================
-- leitura explícita (a política só mostra as chaves public.*)
GRANT SELECT ON public.app_settings TO authenticated;
INSERT INTO public.app_settings (key, value)
VALUES ('public.ads_popup', '{"interval_min": 3, "max_per_session": 6}')
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.admin_set_ads_popup(p_interval_min INTEGER, p_max_per_session INTEGER, justification TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_superadmin() THEN RAISE EXCEPTION 'Somente o superadministrador (com MFA) altera a publicidade.'; END IF;
  IF coalesce(length(trim(justification)), 0) < 5 THEN RAISE EXCEPTION 'Informe a justificativa (mínimo de 5 caracteres).'; END IF;
  IF coalesce(p_interval_min, 0) NOT BETWEEN 1 AND 120 THEN RAISE EXCEPTION 'O intervalo deve ser de 1 a 120 minutos.'; END IF;
  IF coalesce(p_max_per_session, -1) NOT BETWEEN 0 AND 30 THEN RAISE EXCEPTION 'O limite por acesso deve ser de 0 a 30 (0 desliga a janela).'; END IF;
  INSERT INTO public.app_settings (key, value, updated_at)
  VALUES ('public.ads_popup', jsonb_build_object('interval_min', p_interval_min, 'max_per_session', p_max_per_session)::text, now())
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();
  INSERT INTO public.admin_audit_logs (admin_id, admin_role, action, target_type, target_id, reason)
  VALUES (auth.uid(), public.admin_role_of(auth.uid()), 'ads_popup_frequency', 'app_settings', 'public.ads_popup', trim(justification));
END;
$$;
REVOKE EXECUTE ON FUNCTION public.admin_set_ads_popup(INTEGER, INTEGER, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_ads_popup(INTEGER, INTEGER, TEXT) TO authenticated;

-- ==============================================================================
-- 20. PUBLICIDADE MAIS PRESENTE: espaço "destaques" (Descobrir, entre os membros em destaque e os
-- populares) e janela de publicidade configurável: espera inicial, eventos na janela, frequência maior.
-- ==============================================================================
ALTER TABLE public.ads DROP CONSTRAINT IF EXISTS ads_placement_check;
ALTER TABLE public.ads ADD CONSTRAINT ads_placement_check
  CHECK (placement IN ('feed', 'sidebar', 'events', 'carousel', 'destaques'));

-- janela mais frequente (a cada 2 min, até 10 por acesso, primeira 10 s após entrar, eventos incluídos)
INSERT INTO public.app_settings (key, value)
VALUES ('public.ads_popup', '{"interval_min": 2, "max_per_session": 10, "initial_delay_s": 10, "include_events": true}')
ON CONFLICT (key) DO UPDATE
  SET value = (public.app_settings.value::jsonb
               || '{"interval_min": 2, "max_per_session": 10}'::jsonb
               || jsonb_build_object(
                    'initial_delay_s', coalesce(public.app_settings.value::jsonb -> 'initial_delay_s', '10'::jsonb),
                    'include_events', coalesce(public.app_settings.value::jsonb -> 'include_events', 'true'::jsonb)))::text,
      updated_at = now()
  WHERE NOT (public.app_settings.value::jsonb ? 'initial_delay_s');

CREATE OR REPLACE FUNCTION public.admin_set_ads_popup(p_interval_min INTEGER, p_max_per_session INTEGER, justification TEXT,
                                                     p_initial_delay_s INTEGER, p_include_events BOOLEAN)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_superadmin() THEN RAISE EXCEPTION 'Somente o superadministrador (com MFA) altera a publicidade.'; END IF;
  IF coalesce(length(trim(justification)), 0) < 5 THEN RAISE EXCEPTION 'Informe a justificativa (mínimo de 5 caracteres).'; END IF;
  IF coalesce(p_interval_min, 0) NOT BETWEEN 1 AND 120 THEN RAISE EXCEPTION 'O intervalo deve ser de 1 a 120 minutos.'; END IF;
  IF coalesce(p_max_per_session, -1) NOT BETWEEN 0 AND 30 THEN RAISE EXCEPTION 'O limite por acesso deve ser de 0 a 30 (0 desliga a janela).'; END IF;
  IF coalesce(p_initial_delay_s, -1) NOT BETWEEN 5 AND 600 THEN RAISE EXCEPTION 'A espera inicial deve ser de 5 a 600 segundos.'; END IF;
  INSERT INTO public.app_settings (key, value, updated_at)
  VALUES ('public.ads_popup', jsonb_build_object('interval_min', p_interval_min, 'max_per_session', p_max_per_session,
                                                 'initial_delay_s', p_initial_delay_s, 'include_events', coalesce(p_include_events, true))::text, now())
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();
  INSERT INTO public.admin_audit_logs (admin_id, admin_role, action, target_type, target_id, reason)
  VALUES (auth.uid(), public.admin_role_of(auth.uid()), 'ads_popup_frequency', 'app_settings', 'public.ads_popup', trim(justification));
END;
$$;
-- versão anterior (3 parâmetros, de telas antigas ainda abertas): mantém espera inicial e eventos
CREATE OR REPLACE FUNCTION public.admin_set_ads_popup(p_interval_min INTEGER, p_max_per_session INTEGER, justification TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE atual JSONB;
BEGIN
  SELECT value::jsonb INTO atual FROM public.app_settings WHERE key = 'public.ads_popup';
  PERFORM public.admin_set_ads_popup(p_interval_min, p_max_per_session, justification,
    coalesce((atual ->> 'initial_delay_s')::int, 10), coalesce((atual ->> 'include_events')::boolean, true));
END;
$$;
REVOKE EXECUTE ON FUNCTION public.admin_set_ads_popup(INTEGER, INTEGER, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_ads_popup(INTEGER, INTEGER, TEXT) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_set_ads_popup(INTEGER, INTEGER, TEXT, INTEGER, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_ads_popup(INTEGER, INTEGER, TEXT, INTEGER, BOOLEAN) TO authenticated;

-- ==============================================================================
-- 21. PADRINHO VIP: quem se cadastra pelo convite de um "padrinho" ganha dias de VIP.
-- A administração marca o padrinho (superadmin com MFA, justificativa na auditoria); quem ele já
-- convidou recebe na hora e os próximos convidados recebem no cadastro. Convites rejeitados ficam de fora.
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.growth_vip_padrinhos (
  referrer_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  vip_days INTEGER NOT NULL CHECK (vip_days BETWEEN 1 AND 3650),
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.growth_vip_padrinhos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS growth_vip_padrinhos_staff ON public.growth_vip_padrinhos;
CREATE POLICY growth_vip_padrinhos_staff ON public.growth_vip_padrinhos FOR SELECT TO authenticated USING (public.is_staff());
REVOKE ALL ON public.growth_vip_padrinhos FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.growth_vip_padrinhos FROM authenticated;
GRANT SELECT ON public.growth_vip_padrinhos TO authenticated;

-- concede o VIP de padrinho a um convidado (uma única vez por convidado e padrinho)
CREATE OR REPLACE FUNCTION public.growth_vip_padrinho_conceder(p_referred UUID, p_referrer UUID)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_dias INTEGER; v_user TEXT; v_fim TIMESTAMPTZ; v_motivo TEXT;
BEGIN
  SELECT vip_days INTO v_dias FROM public.growth_vip_padrinhos WHERE referrer_id = p_referrer;
  IF v_dias IS NULL THEN RETURN false; END IF;
  v_motivo := 'vip_padrinho:' || p_referrer;
  IF EXISTS (SELECT 1 FROM public.growth_grants WHERE user_id = p_referred AND reason = v_motivo) THEN RETURN false; END IF;
  SELECT username INTO v_user FROM public.profiles WHERE id = p_referrer;
  v_fim := public.growth_apply_effect(p_referred, 'vip_days', v_dias, NULL);
  INSERT INTO public.growth_grants (user_id, kind, amount, label, source, granted_by, reason, expires_at)
  VALUES (p_referred, 'vip_days', v_dias, left(v_dias || ' dias de VIP (convite de @' || coalesce(v_user, 'membro') || ')', 120), 'referral', NULL, v_motivo, v_fim);
  PERFORM public.growth_notify(p_referred, 'growth_reward', 'Você ganhou o selo VIP!',
    'Por ter entrado pelo convite de @' || coalesce(v_user, 'um membro') || ', você é VIP por ' || v_dias || ' dias.', 'vip_padrinho:' || p_referred);
  RETURN true;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.growth_vip_padrinho_conceder(UUID, UUID) FROM PUBLIC, anon, authenticated;

-- no cadastro pelo convite de um padrinho (nunca impede o cadastro)
CREATE OR REPLACE FUNCTION public.growth_vip_padrinho_no_convite()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.referrer_id IS NOT NULL AND NEW.status <> 'rejected' THEN
    PERFORM public.growth_vip_padrinho_conceder(NEW.referred_id, NEW.referrer_id);
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.growth_vip_padrinho_no_convite() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS on_growth_referral_vip_padrinho ON public.growth_referrals;
CREATE TRIGGER on_growth_referral_vip_padrinho AFTER INSERT ON public.growth_referrals
  FOR EACH ROW EXECUTE FUNCTION public.growth_vip_padrinho_no_convite();

-- aplica a quem o padrinho já convidou; devolve quantos receberam
CREATE OR REPLACE FUNCTION public.growth_vip_padrinho_retroativo(p_referrer UUID)
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r RECORD; n INTEGER := 0;
BEGIN
  FOR r IN SELECT referred_id FROM public.growth_referrals WHERE referrer_id = p_referrer AND status <> 'rejected' LOOP
    IF public.growth_vip_padrinho_conceder(r.referred_id, p_referrer) THEN n := n + 1; END IF;
  END LOOP;
  RETURN n;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.growth_vip_padrinho_retroativo(UUID) FROM PUBLIC, anon, authenticated;

-- painel: marcar/desmarcar padrinho (p_days NULL ou 0 desmarca; quem já ganhou mantém até vencer)
CREATE OR REPLACE FUNCTION public.admin_growth_set_vip_padrinho(p_user UUID, p_days INTEGER, justification TEXT)
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.growth_admin_audit('growth_vip_padrinho', 'profile', p_user::text, justification);
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_user) THEN RAISE EXCEPTION 'Perfil não encontrado.'; END IF;
  IF coalesce(p_days, 0) = 0 THEN
    DELETE FROM public.growth_vip_padrinhos WHERE referrer_id = p_user;
    RETURN 0;
  END IF;
  IF p_days NOT BETWEEN 1 AND 3650 THEN RAISE EXCEPTION 'Informe de 1 a 3650 dias de VIP.'; END IF;
  INSERT INTO public.growth_vip_padrinhos (referrer_id, vip_days, created_by) VALUES (p_user, p_days, auth.uid())
  ON CONFLICT (referrer_id) DO UPDATE SET vip_days = EXCLUDED.vip_days;
  RETURN public.growth_vip_padrinho_retroativo(p_user);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.admin_growth_set_vip_padrinho(UUID, INTEGER, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_growth_set_vip_padrinho(UUID, INTEGER, TEXT) TO authenticated;
