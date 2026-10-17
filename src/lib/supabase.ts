import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = (): boolean => {
  return Boolean(
    supabaseUrl && 
    supabaseAnonKey && 
    supabaseUrl !== 'https://your-project-id.supabase.co' &&
    supabaseAnonKey !== 'your-anon-key'
  );
};

// Client instance: initialized with env vars or dummy fallback for graceful offline development
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-anon-key'
);

// ----------------- AUTH HELPERS ----------------- //

export async function signUpWithEmail(email: string, password: string, userData: Record<string, any>) {
  if (!isSupabaseConfigured()) {
    console.warn('[VYBE Supabase] Supabase não configurado. Utilizando autenticação simulada local.');
    return { data: { user: { id: `usr_${Date.now()}`, email } }, error: null };
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: userData,
      emailRedirectTo: `${window.location.origin}/auth/callback`
    }
  });

  return { data, error };
}

export async function signInWithEmail(email: string, password: string) {
  if (!isSupabaseConfigured()) {
    return { data: { user: { id: `usr_${Date.now()}`, email } }, error: null };
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  return { data, error };
}

export async function signOut() {
  if (!isSupabaseConfigured()) return { error: null };
  return await supabase.auth.signOut();
}

export async function sendPasswordResetEmail(email: string) {
  if (!isSupabaseConfigured()) return { error: null };
  return await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/auth/reset-password`
  });
}

// ----------------- STORAGE HELPERS ----------------- //

export async function uploadPublicMedia(file: File, path: string) {
  if (!isSupabaseConfigured()) {
    return { publicUrl: URL.createObjectURL(file), error: null };
  }

  const { error } = await supabase.storage.from('public-media').upload(path, file, {
    cacheControl: '3600',
    upsert: true
  });

  if (error) return { publicUrl: null, error };

  const { data } = supabase.storage.from('public-media').getPublicUrl(path);
  return { publicUrl: data.publicUrl, error: null };
}

export async function uploadPrivateVaultMedia(file: File, path: string) {
  if (!isSupabaseConfigured()) {
    return { path, error: null };
  }

  const { data, error } = await supabase.storage.from('private-vaults').upload(path, file, {
    cacheControl: '3600',
    upsert: true
  });

  return { data, error };
}

export async function getPrivateVaultSignedUrl(path: string, expiresInSeconds: number = 300) {
  if (!isSupabaseConfigured()) {
    return { signedUrl: 'https://images.unsplash.com/photo-1518199266791-5375a83190b7?w=900', error: null };
  }

  const { data, error } = await supabase.storage
    .from('private-vaults')
    .createSignedUrl(path, expiresInSeconds);

  return { signedUrl: data?.signedUrl || null, error };
}
