import { supabase } from './supabase';

// Status "online": o app manda um sinal por minuto enquanto está aberto e pergunta
// ao banco quem está online. A regra recíproca (quem esconde o próprio status não vê o
// dos outros) e os bloqueios são aplicados no banco, na RPC online_users.

export async function touchPresence() {
  const { error } = await supabase.rpc('touch_presence');
  if (error && error.code !== 'PGRST202') console.error('[Vybelog] Falha ao registrar presença:', error.message);
}

export async function fetchOnlineUsers(ids: string[]): Promise<Set<string>> {
  if (ids.length === 0) return new Set();
  const { data, error } = await supabase.rpc('online_users', { ids: ids.slice(0, 500) });
  if (error) return new Set();
  return new Set(((data ?? []) as any[]).map(row => (typeof row === 'string' ? row : row.online_users ?? row.id)));
}
