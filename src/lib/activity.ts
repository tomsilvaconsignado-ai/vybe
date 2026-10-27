import { supabase } from './supabase';
import { formatRelativeTime } from './social';
import { avatarOrDefault } from './profiles';
import { ModerationReport, NotificationItem } from '../types';

// ----------------- NOTIFICAÇÕES ----------------- //

const SYSTEM_ACTOR = { id: 'sys', displayName: 'Vybelog', username: 'vybelog', avatarUrl: '' };

export function mapNotificationRow(row: any): NotificationItem {
  const actor = row.actor;
  return {
    id: row.id,
    userId: row.user_id,
    actor: actor
      ? { id: actor.id, displayName: actor.display_name, username: actor.username, avatarUrl: avatarOrDefault(actor.avatar_url, actor.display_name) }
      : SYSTEM_ACTOR,
    type: row.type,
    title: row.title,
    message: row.message,
    referenceId: row.reference_id ?? undefined,
    createdAt: formatRelativeTime(row.created_at),
    read: row.read
  };
}

export const NOTIFICATION_SELECT = '*, actor:profiles!notifications_actor_id_fkey(id, display_name, username, avatar_url)';

export async function fetchNotifications(me: string): Promise<NotificationItem[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select(NOTIFICATION_SELECT)
    .eq('user_id', me)
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) {
    console.error('[Vybelog] Falha ao carregar notificações:', error.message);
    return [];
  }
  return data.map(mapNotificationRow);
}

export async function fetchNotification(id: string): Promise<NotificationItem | null> {
  const { data } = await supabase.from('notifications').select(NOTIFICATION_SELECT).eq('id', id).maybeSingle();
  return data ? mapNotificationRow(data) : null;
}

export async function markNotificationsRead(me: string, ids?: string[]) {
  let query = supabase.from('notifications').update({ read: true }).eq('user_id', me).eq('read', false);
  if (ids) query = query.in('id', ids);
  const { error } = await query;
  return error?.message ?? null;
}

// ----------------- DENÚNCIAS ----------------- //

export async function insertReport(me: string, data: {
  reportedUserId: string;
  targetType: ModerationReport['targetType'];
  targetId: string;
  category: ModerationReport['category'];
  description: string;
}) {
  const urgent = data.category === 'underage_suspicion' || data.category === 'non_consensual';
  const { error } = await supabase.from('moderation_reports').insert({
    reporter_user_id: me,
    reported_user_id: data.reportedUserId,
    target_type: data.targetType,
    target_id: data.targetId,
    category: data.category,
    description: data.description,
    priority: urgent ? 'urgent' : 'high'
  });
  return error?.message ?? null;
}

// ----------------- CONTA ----------------- //

// Remove os arquivos do usuário no Storage e depois a conta (cascata no banco)
export async function deleteOwnAccount(me: string): Promise<string | null> {
  for (const bucket of ['public-media', 'private-vaults']) {
    const folders = [me];
    while (folders.length > 0) {
      const folder = folders.pop()!;
      const { data: entries } = await supabase.storage.from(bucket).list(folder, { limit: 1000 });
      const files: string[] = [];
      for (const entry of entries ?? []) {
        // Pastas aparecem sem id na listagem do Storage
        if (entry.id) files.push(`${folder}/${entry.name}`);
        else folders.push(`${folder}/${entry.name}`);
      }
      if (files.length > 0) await supabase.storage.from(bucket).remove(files);
    }
  }

  const { error } = await supabase.rpc('delete_own_account');
  return error?.message ?? null;
}

export async function touchLastActive(me: string) {
  await supabase.from('profiles').update({ last_active_at: new Date().toISOString() }).eq('id', me);
}
