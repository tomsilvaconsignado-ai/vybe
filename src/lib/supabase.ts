import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = (): boolean => {
  return Boolean(
    supabaseUrl &&
    supabaseAnonKey &&
    supabaseUrl !== 'https://your-project-id.supabase.co' &&
    supabaseAnonKey !== 'your-anon-public-key'
  );
};

if (!isSupabaseConfigured()) {
  console.error('[VYBE] Supabase não configurado: defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no arquivo .env');
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-anon-key'
);

// URL para onde os links de e-mail (confirmação / redefinição de senha) retornam.
// Usa o caminho atual para funcionar também em subpastas (ex.: GitHub Pages).
export const authRedirectUrl = (): string => `${window.location.origin}${window.location.pathname}`;

// Traduz as mensagens de erro mais comuns do Supabase Auth
export function translateAuthError(message: string | undefined | null): string {
  if (!message) return 'Ocorreu um erro inesperado. Tente novamente.';
  const m = message.toLowerCase();
  if (m.includes('invalid login credentials')) return 'E-mail ou senha incorretos.';
  if (m.includes('email not confirmed')) return 'Confirme seu e-mail pelo link que enviamos antes de entrar.';
  if (m.includes('user already registered')) return 'Já existe uma conta com este e-mail.';
  if (m.includes('password should be at least')) return 'A senha deve ter pelo menos 8 caracteres.';
  if (m.includes('weak') && m.includes('password')) return 'Senha fraca. Use letras, números e símbolos.';
  if (m.includes('rate limit') || m.includes('too many')) return 'Muitas tentativas. Aguarde alguns minutos e tente novamente.';
  if (m.includes('maiores de 18')) return 'Cadastro permitido apenas para maiores de 18 anos.';
  if (m.includes('database error saving new user')) return 'Não foi possível criar o perfil. Verifique os dados (idade mínima 18 anos) e tente novamente.';
  if (m.includes('invalid totp') || m.includes('invalid code')) return 'Código inválido ou expirado.';
  if (m.includes('failed to fetch') || m.includes('network')) return 'Sem conexão com o servidor. Verifique sua internet.';
  return message;
}

// ----------------- STORAGE HELPERS ----------------- //

// Caminho deve começar com o UID do usuário: "<uid>/arquivo.jpg"
export async function uploadPublicMedia(file: File, path: string) {
  const { error } = await supabase.storage.from('public-media').upload(path, file, {
    cacheControl: '3600',
    upsert: true
  });

  if (error) return { publicUrl: null, error };

  const { data } = supabase.storage.from('public-media').getPublicUrl(path);
  return { publicUrl: data.publicUrl, error: null };
}

// Caminho deve seguir "<uid>/<album_id>/arquivo.jpg"
export async function uploadPrivateVaultMedia(file: File, path: string) {
  const { data, error } = await supabase.storage.from('private-vaults').upload(path, file, {
    cacheControl: '3600',
    upsert: true
  });

  return { data, error };
}

export async function getPrivateVaultSignedUrl(path: string, expiresInSeconds: number = 300) {
  const { data, error } = await supabase.storage
    .from('private-vaults')
    .createSignedUrl(path, expiresInSeconds);

  return { signedUrl: data?.signedUrl || null, error };
}
