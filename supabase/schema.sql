-- ==============================================================================
-- PROJETO VYBE — REDE SOCIAL ADULTA LIBERAL (+18)
-- SCHEMA COMPLETO DO BANCO DE DADOS POSTGRESQL (SUPABASE)
-- Administrador Principal: tomsilvaconsignado@gmail.com
-- ==============================================================================

-- 1. EXTENSÕES
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. TIPOS CUSTOMIZADOS (ENUMS)
DO $$ BEGIN
    CREATE TYPE profile_type_enum AS ENUM ('couple', 'single_female', 'single_male', 'joint_profile', 'polyamorous');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE user_status_enum AS ENUM ('active', 'warned', 'restricted', 'suspended', 'blocked');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE location_privacy_enum AS ENUM ('city', 'approximate_region', 'hidden');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE album_visibility_enum AS ENUM ('public', 'connections_only', 'private_vault');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE admin_role_enum AS ENUM ('superadmin', 'moderator', 'support', 'auditor');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 3. TABELA DE PERFIS DE USUÁRIOS
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username VARCHAR(50) UNIQUE NOT NULL,
    display_name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    profile_type profile_type_enum NOT NULL DEFAULT 'couple',
    city VARCHAR(100) NOT NULL,
    state VARCHAR(50) NOT NULL,
    location_privacy location_privacy_enum NOT NULL DEFAULT 'approximate_region',
    age INTEGER NOT NULL CHECK (age >= 18),
    gender VARCHAR(50),
    orientation VARCHAR(50),
    bio TEXT,
    avatar_url TEXT,
    cover_url TEXT,
    is_verified BOOLEAN NOT NULL DEFAULT false,
    verified_badge_type VARCHAR(50),
    status user_status_enum NOT NULL DEFAULT 'active',
    followers_count INTEGER NOT NULL DEFAULT 0,
    following_count INTEGER NOT NULL DEFAULT 0,
    connections_count INTEGER NOT NULL DEFAULT 0,
    status_text VARCHAR(160),
    discreet_mode_enabled BOOLEAN NOT NULL DEFAULT false,
    birthdate_verified BOOLEAN NOT NULL DEFAULT true,
    consent_terms_accepted BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_profiles_username ON public.profiles(username);
CREATE INDEX IF NOT EXISTS idx_profiles_city_state ON public.profiles(city, state);
CREATE INDEX IF NOT EXISTS idx_profiles_status ON public.profiles(status);

-- 4. PARCEIROS DE CONTAS CONJUNTAS (CASAIS OU TRÍADES)
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
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 5. PREFERÊNCIAS DE COMPATIBILIDADE E LIMITES DECLARADOS
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
    personal_limits TEXT[] NOT NULL DEFAULT '{}',
    lifestyle_tags TEXT[] NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 6. PUBLICAÇÕES NO FEED SOCIAL
CREATE TABLE IF NOT EXISTS public.posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    media_urls TEXT[] DEFAULT '{}',
    media_type VARCHAR(20) DEFAULT 'image',
    tags TEXT[] DEFAULT '{}',
    location VARCHAR(120),
    visibility VARCHAR(30) NOT NULL DEFAULT 'public',
    likes_count INTEGER NOT NULL DEFAULT 0,
    comments_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_posts_user_id ON public.posts(user_id);
CREATE INDEX IF NOT EXISTS idx_posts_created_at ON public.posts(created_at DESC);

-- 7. ENQUETES SOCIAIS EM PUBLICAÇÕES
CREATE TABLE IF NOT EXISTS public.post_polls (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID UNIQUE NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
    question TEXT NOT NULL,
    options JSONB NOT NULL DEFAULT '[]', -- [{ id: "opt_1", text: "Opção", votes: 0 }]
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.post_poll_votes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    poll_id UUID NOT NULL REFERENCES public.post_polls(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    option_id VARCHAR(50) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    UNIQUE(poll_id, user_id)
);

-- 8. CURTIDAS E COMENTÁRIOS DE PUBLICAÇÕES
CREATE TABLE IF NOT EXISTS public.post_likes (
    post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    PRIMARY KEY(post_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.post_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    likes_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 9. COMUNIDADES E MEMBROS
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
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.community_members (
    community_id UUID NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    role VARCHAR(30) NOT NULL DEFAULT 'member', -- 'admin', 'moderator', 'member'
    joined_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    PRIMARY KEY(community_id, user_id)
);

-- 10. ÁLBUNS E COFRES PRIVADOS COM CHAVES DE ACESSO
CREATE TABLE IF NOT EXISTS public.albums (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    title VARCHAR(120) NOT NULL,
    description TEXT,
    cover_url TEXT NOT NULL,
    visibility album_visibility_enum NOT NULL DEFAULT 'public',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.album_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    album_id UUID NOT NULL REFERENCES public.albums(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    type VARCHAR(20) NOT NULL DEFAULT 'image',
    caption TEXT,
    blur_preview BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Permissões nominais concedidas a cofres privados
CREATE TABLE IF NOT EXISTS public.album_permissions (
    album_id UUID NOT NULL REFERENCES public.albums(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    status VARCHAR(30) NOT NULL DEFAULT 'pending', -- 'pending', 'granted', 'revoked'
    granted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    PRIMARY KEY(album_id, user_id)
);

-- 11. MENSAGENS PRIVADAS E CONVERSAS PROTEGIDAS
CREATE TABLE IF NOT EXISTS public.conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    is_pending_request BOOLEAN NOT NULL DEFAULT true, -- Protege contra spam
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.conversation_participants (
    conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    joined_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    PRIMARY KEY(conversation_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    media_url TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'sent', -- 'sent', 'delivered', 'read'
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON public.messages(conversation_id, created_at ASC);

-- 12. NOTIFICAÇÕES
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    actor_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    title VARCHAR(120) NOT NULL,
    message TEXT NOT NULL,
    reference_id VARCHAR(100),
    read BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON public.notifications(user_id, read);

-- 13. CANAL DE DENÚNCIAS E SEGURANÇA (+18 E CONSENTIMENTO)
CREATE TABLE IF NOT EXISTS public.moderation_reports (
    id VARCHAR(50) PRIMARY KEY,
    reporter_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    reported_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    target_type VARCHAR(30) NOT NULL, -- 'profile', 'post', 'media', 'message'
    target_id VARCHAR(100) NOT NULL,
    category VARCHAR(50) NOT NULL,
    description TEXT NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'pending', -- 'pending', 'under_review', 'resolved', 'dismissed'
    priority VARCHAR(20) NOT NULL DEFAULT 'medium', -- 'urgent', 'high', 'medium', 'low'
    reviewed_by VARCHAR(100),
    resolution_note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    resolved_at TIMESTAMPTZ
);

-- 14. ESTRUTURA ADMINISTRATIVA E AUDITORIA IMUTÁVEL
CREATE TABLE IF NOT EXISTS public.admin_users (
    user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    email VARCHAR(255) UNIQUE NOT NULL,
    role admin_role_enum NOT NULL DEFAULT 'moderator',
    mfa_enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Livro de Auditoria Imutável (Audit Trail)
CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id VARCHAR(100) NOT NULL,
    admin_name VARCHAR(150) NOT NULL,
    admin_role admin_role_enum NOT NULL,
    action VARCHAR(100) NOT NULL,
    target_id VARCHAR(100) NOT NULL,
    target_type VARCHAR(50) NOT NULL,
    reason TEXT NOT NULL,
    ip_address VARCHAR(50),
    timestamp TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_admin_logs_timestamp ON public.admin_audit_logs(timestamp DESC);

-- 15. PROVISIONAMENTO DO SUPERADMINISTRADOR PRINCIPAL
-- Vincula tomsilvaconsignado@gmail.com como Superadmin do sistema
DO $$
BEGIN
    INSERT INTO public.admin_users (user_id, email, role, mfa_enabled)
    SELECT id, email, 'superadmin'::admin_role_enum, true
    FROM public.profiles
    WHERE email = 'tomsilvaconsignado@gmail.com'
    ON CONFLICT (email) DO UPDATE 
    SET role = 'superadmin'::admin_role_enum, mfa_enabled = true;
END $$;
