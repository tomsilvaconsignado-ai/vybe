import { createClient } from '@supabase/supabase-js';
import { stripImageMetadata } from './media';

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
  console.error('[Vybelog] Supabase não configurado: defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no arquivo .env');
}

// Link de e-mail vencido ou já usado: o Supabase volta com o erro no endereço.
// Lido antes de criar o cliente, que limpa o endereço ao iniciar.
export const authLinkError: string | null = (() => {
  const params = new URLSearchParams(window.location.hash.slice(1) || window.location.search.slice(1));
  const code = params.get('error_code') ?? params.get('error');
  if (!code) return null;
  window.history.replaceState(null, '', window.location.pathname);
  if (code === 'otp_expired') return 'Este link expirou ou já foi usado. Peça um novo e-mail e use o link mais recente.';
  return 'Não foi possível validar o link do e-mail. Peça um novo e tente novamente.';
})();

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
  if (m.includes('different from the old')) return 'A nova senha precisa ser diferente da atual.';
  if (m.includes('invalid format') || m.includes('email address') && m.includes('invalid')) return 'E-mail inválido.';
  if (m.includes('expired') || m.includes('otp')) return 'O link ou código expirou. Peça um novo.';
  if (m.includes('captcha')) return 'Confirme que você não é um robô e tente novamente.';
  if (m.includes('pwned') || m.includes('leaked')) return 'Esta senha apareceu em vazamentos de dados conhecidos. Escolha outra.';
  // Mensagens internas do servidor não são exibidas (podem expor detalhes técnicos)
  console.error('[Vybelog] Erro de autenticação:', message);
  return 'Não foi possível concluir. Tente novamente em instantes.';
}

// ----------------- STORAGE HELPERS ----------------- //

// Todo envio passa por aqui: remove GPS/EXIF das fotos antes de sair do aparelho.
// Os caminhos já são únicos (UUID ou data), então não é preciso sobrescrever arquivos.
export async function uploadToBucket(bucket: 'public-media' | 'private-vaults', path: string, file: File): Promise<Error | null> {
  let clean: File;
  try {
    clean = await stripImageMetadata(file);
  } catch (err) {
    return err instanceof Error ? err : new Error('Não foi possível processar a imagem.');
  }
  const { error } = await supabase.storage.from(bucket).upload(path, clean, {
    cacheControl: '3600',
    contentType: clean.type || undefined
  });
  return error;
}

// Caminho deve começar com o UID do usuário: "<uid>/arquivo.jpg"
export async function uploadPublicMedia(file: File, path: string): Promise<{ publicUrl: string | null; error: Error | null }> {
  const error = await uploadToBucket('public-media', path, file);
  if (error) return { publicUrl: null, error };

  const { data } = supabase.storage.from('public-media').getPublicUrl(path);
  return { publicUrl: data.publicUrl, error: null };
}

export async function getPrivateVaultSignedUrl(path: string, expiresInSeconds: number = 300) {
  const { data, error } = await supabase.storage
    .from('private-vaults')
    .createSignedUrl(path, expiresInSeconds);

  return { signedUrl: data?.signedUrl || null, error };
}
