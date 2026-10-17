-- ==============================================================================
-- PROJETO VYBE — CONFIGURAÇÃO DO SUPABASE STORAGE
-- BUCKETS PÚBLICOS E PRIVADOS (COFRES ÍNTIMOS COM CHAVE)
-- ==============================================================================

-- 1. CRIAR OS BUCKETS NO STORAGE
-- Bucket público: fotos de perfil, capas, mídias de postagens e ícones
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'public-media',
    'public-media',
    true,
    20971520, -- 20MB
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/quicktime']
)
ON CONFLICT (id) DO UPDATE 
SET public = true, file_size_limit = 20971520;

-- Bucket privado: Cofre Íntimo com acesso por signed URL e validação de permissões nominais
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'private-vaults',
    'private-vaults',
    false,
    52428800, -- 50MB
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'video/mp4']
)
ON CONFLICT (id) DO UPDATE 
SET public = false, file_size_limit = 52428800;

-- 2. POLÍTICAS DE ACESSO AO BUCKET PÚBLICO (public-media)
CREATE POLICY "Leitura pública de mídias sociais"
ON storage.objects FOR SELECT
USING (bucket_id = 'public-media');

CREATE POLICY "Usuário autenticado pode carregar mídias públicas em sua pasta"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'public-media' AND
    (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Usuário autenticado pode atualizar e remover suas mídias públicas"
ON storage.objects FOR DELETE
TO authenticated
USING (
    bucket_id = 'public-media' AND
    (storage.foldername(name))[1] = auth.uid()::text
);

-- 3. POLÍTICAS DE ACESSO AO BUCKET PRIVADO (private-vaults)
CREATE POLICY "Apenas o proprietário ou chave aprovada lê mídias do cofre"
ON storage.objects FOR SELECT
TO authenticated
USING (
    bucket_id = 'private-vaults' AND
    (
        -- Dono da mídia (pasta com seu UID)
        (storage.foldername(name))[1] = auth.uid()::text
        -- Ou moderador autorizado
        OR public.is_moderator()
    )
);

CREATE POLICY "Proprietário carrega imagens no seu cofre íntimo"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'private-vaults' AND
    (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Proprietário remove arquivos do seu cofre íntimo"
ON storage.objects FOR DELETE
TO authenticated
USING (
    bucket_id = 'private-vaults' AND
    (storage.foldername(name))[1] = auth.uid()::text
);
