-- ==============================================================================
-- PROJETO VYBE — POLÍTICAS DE ROW LEVEL SECURITY (RLS)
-- PROTEÇÃO ESTRITA DE DADOS PESSOAIS, MENSAGENS E COFRES ÍNTIMOS
-- ==============================================================================

-- 1. FUNÇÕES AUXILIARES DE VERIFICAÇÃO DE PRIVILÉGIOS (SECURITY DEFINER)

CREATE OR REPLACE FUNCTION public.is_superadmin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE user_id = auth.uid()
      AND role = 'superadmin'
      AND email = 'tomsilvaconsignado@gmail.com'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_moderator()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE user_id = auth.uid()
      AND role IN ('superadmin', 'moderator')
  );
$$;

-- 2. HABILITAR RLS EM TODAS AS TABELAS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.joint_partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compatibility_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_poll_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.communities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.albums ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.album_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.album_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moderation_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;

-- 3. POLÍTICAS: PROFILES
CREATE POLICY "Perfis visíveis para usuários autenticados"
ON public.profiles FOR SELECT
TO authenticated
USING (status != 'blocked' OR auth.uid() = id OR public.is_moderator());

CREATE POLICY "Usuário pode criar o próprio perfil"
ON public.profiles FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

CREATE POLICY "Usuário pode atualizar o próprio perfil ou Superadmin"
ON public.profiles FOR UPDATE
TO authenticated
USING (auth.uid() = id OR public.is_superadmin())
WITH CHECK (auth.uid() = id OR public.is_superadmin());

-- 4. POLÍTICAS: COFRES PRIVADOS E ÁLBUNS
CREATE POLICY "Álbuns públicos e próprios visíveis"
ON public.albums FOR SELECT
TO authenticated
USING (
    visibility = 'public' 
    OR user_id = auth.uid()
    OR public.is_moderator()
    OR EXISTS (
        SELECT 1 FROM public.album_permissions
        WHERE album_id = public.albums.id 
          AND user_id = auth.uid() 
          AND status = 'granted'
    )
);

CREATE POLICY "Proprietário gerencia seus álbuns"
ON public.albums FOR ALL
TO authenticated
USING (user_id = auth.uid() OR public.is_superadmin())
WITH CHECK (user_id = auth.uid() OR public.is_superadmin());

-- Fotos do cofre privado protegidas por chave de acesso
CREATE POLICY "Itens do cofre visíveis apenas com chave aprovada"
ON public.album_items FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.albums a
        WHERE a.id = public.album_items.album_id
          AND (
              a.visibility = 'public'
              OR a.user_id = auth.uid()
              OR public.is_moderator()
              OR EXISTS (
                  SELECT 1 FROM public.album_permissions p
                  WHERE p.album_id = a.id
                    AND p.user_id = auth.uid()
                    AND p.status = 'granted'
              )
          )
    )
);

CREATE POLICY "Proprietário gerencia itens do álbum"
ON public.album_items FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.albums a
        WHERE a.id = public.album_items.album_id
          AND (a.user_id = auth.uid() OR public.is_superadmin())
    )
);

-- Permissões de cofre: visitante solicita, proprietário aprova/revoga
CREATE POLICY "Consulta de permissões de cofre"
ON public.album_permissions FOR SELECT
TO authenticated
USING (
    user_id = auth.uid() 
    OR EXISTS (
        SELECT 1 FROM public.albums a 
        WHERE a.id = public.album_permissions.album_id AND a.user_id = auth.uid()
    )
    OR public.is_moderator()
);

CREATE POLICY "Usuário solicita chave de acesso ao cofre"
ON public.album_permissions FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Proprietário do álbum atualiza aprovações de chaves"
ON public.album_permissions FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.albums a 
        WHERE a.id = public.album_permissions.album_id AND a.user_id = auth.uid()
    )
);

-- 5. POLÍTICAS: MENSAGENS PRIVADAS
CREATE POLICY "Apenas participantes visualizam conversas"
ON public.conversations FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.conversation_participants cp
        WHERE cp.conversation_id = public.conversations.id AND cp.user_id = auth.uid()
    )
    OR public.is_moderator()
);

CREATE POLICY "Participantes visualizam mensagens de suas conversas"
ON public.messages FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.conversation_participants cp
        WHERE cp.conversation_id = public.messages.conversation_id AND cp.user_id = auth.uid()
    )
    OR public.is_moderator()
);

CREATE POLICY "Participantes enviam mensagens para conversas ativas"
ON public.messages FOR INSERT
TO authenticated
WITH CHECK (
    sender_id = auth.uid() AND
    EXISTS (
        SELECT 1 FROM public.conversation_participants cp
        WHERE cp.conversation_id = public.messages.conversation_id AND cp.user_id = auth.uid()
    )
);

-- 6. POLÍTICAS: POSTAGENS E INTERAÇÕES SOCIAIS
CREATE POLICY "Publicações visíveis conforme visibilidade"
ON public.posts FOR SELECT
TO authenticated
USING (visibility = 'public' OR user_id = auth.uid() OR public.is_moderator());

CREATE POLICY "Usuários criam suas próprias postagens"
ON public.posts FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Usuário edita ou remove sua postagem ou Moderador"
ON public.posts FOR UPDATE
TO authenticated
USING (user_id = auth.uid() OR public.is_moderator());

CREATE POLICY "Usuário remove sua postagem ou Moderador"
ON public.posts FOR DELETE
TO authenticated
USING (user_id = auth.uid() OR public.is_moderator());

-- 7. POLÍTICAS: DENÚNCIAS E MODERAÇÃO
CREATE POLICY "Usuário pode criar denúncia confidencial"
ON public.moderation_reports FOR INSERT
TO authenticated
WITH CHECK (reporter_user_id = auth.uid());

CREATE POLICY "Apenas moderadores e superadmin consultam e gerenciam denúncias"
ON public.moderation_reports FOR ALL
TO authenticated
USING (public.is_moderator())
WITH CHECK (public.is_moderator());

-- 8. POLÍTICAS: LIVRO DE AUDITORIA IMUTÁVEL
CREATE POLICY "Auditoria acessível apenas por administradores autorizados"
ON public.admin_audit_logs FOR SELECT
TO authenticated
USING (public.is_moderator() OR public.is_superadmin());

CREATE POLICY "Auditoria inserível apenas por administradores em ação"
ON public.admin_audit_logs FOR INSERT
TO authenticated
WITH CHECK (public.is_moderator() OR public.is_superadmin());

-- 9. TABELA DE ADMINISTRADORES
CREATE POLICY "Consulta restrita de administradores"
ON public.admin_users FOR SELECT
TO authenticated
USING (user_id = auth.uid() OR public.is_superadmin());

CREATE POLICY "Gestão de papéis restrita exclusivamente ao Superadmin Principal"
ON public.admin_users FOR ALL
TO authenticated
USING (public.is_superadmin())
WITH CHECK (public.is_superadmin());
