// Painel administrativo: indicadores reais da plataforma e comunicados por push.
// O banco só responde à equipe com MFA (aal2); enviar comunicados é exclusivo do superadministrador.
import { supabase } from './supabase';

export interface PlatformStats {
  users: number; new_1d: number; new_7d: number; new_30d: number;
  active_1d: number; active_7d: number; active_30d: number;
  posts: number; posts_7d: number; comments_7d: number; messages_7d: number;
  communities: number; communities_7d: number;
  events_upcoming: number; events_pending: number;
  reports_open: number; reports_7d: number;
  signups_14d: { day: string; n: number }[];
}

export interface PushStats {
  devices: number; users_with_push: number; sent_7d: number; failed_7d: number; pending: number;
  last_errors: { created_at: string; http_status: number | null; error: string | null }[];
}

export type BroadcastAudience = 'all' | 'active_30d' | 'verified' | 'event' | 'community';
export const AUDIENCE_LABEL: Record<BroadcastAudience, string> = {
  all: 'Todos os usuários',
  active_30d: 'Ativos nos últimos 30 dias',
  verified: 'Perfis verificados',
  event: 'Quem vai / tem interesse em um evento',
  community: 'Membros de uma comunidade'
};

export interface BroadcastRecord {
  id: string; title: string; body: string; audience: BroadcastAudience;
  scheduled_at: string; sent_at: string | null; cancelled_at: string | null;
  recipients: number | null; read_count: number; push_sent: number; push_failed: number; push_pending: number;
}

const erro = (e: { message: string } | null) => e?.message ?? null;

export async function fetchPlatformStats(): Promise<{ stats: PlatformStats | null; error: string | null }> {
  const { data, error } = await supabase.rpc('admin_platform_stats');
  return { stats: (data as PlatformStats) ?? null, error: erro(error) };
}

export async function fetchPushStats(): Promise<PushStats | null> {
  const { data, error } = await supabase.rpc('admin_push_stats');
  return error ? null : (data as PushStats);
}

export async function fetchBroadcastHistory(): Promise<BroadcastRecord[]> {
  const { data, error } = await supabase.rpc('admin_broadcast_history');
  return error ? [] : ((data as BroadcastRecord[]) ?? []).map(b => ({
    ...b, read_count: Number(b.read_count), push_sent: Number(b.push_sent), push_failed: Number(b.push_failed), push_pending: Number(b.push_pending)
  }));
}

export interface BroadcastDraft {
  title: string; body: string; audience: BroadcastAudience; ref: string | null; link: string | null;
  /** null = enviar agora */
  when: string | null;
  justification: string;
}

export async function createBroadcast(d: BroadcastDraft): Promise<string | null> {
  const { error } = await supabase.rpc('admin_create_broadcast', {
    p_title: d.title.trim(), p_body: d.body.trim(), p_audience: d.audience, p_ref: d.ref,
    p_link: d.link || null, p_when: d.when ? new Date(d.when).toISOString() : null, justification: d.justification.trim()
  });
  return erro(error);
}

export async function cancelBroadcast(id: string, justification: string): Promise<string | null> {
  const { error } = await supabase.rpc('admin_cancel_broadcast', { p_id: id, justification });
  return erro(error);
}
