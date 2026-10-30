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

// Portabilidade (LGPD art. 18, V): tudo o que pertence ao titular, direto do banco
export async function exportOwnData(me: string): Promise<Record<string, unknown>> {
  const queries: Record<string, PromiseLike<{ data: unknown; error: { message: string } | null }>> = {
    perfil: supabase.from('profiles').select('*').eq('id', me).maybeSingle(),
    dados_privados: supabase.from('profile_private').select('*').eq('user_id', me).maybeSingle(),
    parceiros: supabase.from('joint_partners').select('*').eq('profile_id', me),
    preferencias: supabase.from('compatibility_preferences').select('*').eq('profile_id', me).maybeSingle(),
    publicacoes: supabase.from('posts').select('*, post_polls(*)').eq('user_id', me),
    comentarios: supabase.from('post_comments').select('*').eq('user_id', me),
    curtidas: supabase.from('post_likes').select('*').eq('user_id', me),
    salvos: supabase.from('post_saves').select('*').eq('user_id', me),
    votos_enquetes: supabase.from('post_poll_votes').select('*').eq('user_id', me),
    seguindo_e_seguidores: supabase.from('follows').select('*').or(`follower_id.eq.${me},following_id.eq.${me}`),
    conexoes: supabase.from('connections').select('*').or(`requester_id.eq.${me},addressee_id.eq.${me}`),
    bloqueios: supabase.from('user_blocks').select('*').eq('blocker_id', me),
    comunidades: supabase.from('community_members').select('*').eq('user_id', me),
    albuns: supabase.from('albums').select('*, album_items(*), album_permissions(*)').eq('user_id', me),
    pedidos_de_acesso_a_cofres: supabase.from('album_permissions').select('*').eq('user_id', me),
    conversas: supabase.from('conversation_participants').select('*').eq('user_id', me),
    mensagens_enviadas: supabase.from('messages').select('*').eq('sender_id', me),
    notificacoes: supabase.from('notifications').select('*').eq('user_id', me),
    denuncias_feitas: supabase.from('moderation_reports').select('id, target_type, target_id, category, description, status, created_at').eq('reporter_user_id', me),
    stories: supabase.from('stories').select('*').eq('user_id', me),
    eventos_criados: supabase.from('events').select('*').eq('created_by', me),
    presenca_em_eventos: supabase.from('event_attendees').select('*').eq('user_id', me),
    comentarios_em_eventos: supabase.from('event_comments').select('*').eq('user_id', me),
    localizacao_aproximada: supabase.from('user_geo').select('*').eq('user_id', me).maybeSingle()
  };

  const entries = await Promise.all(Object.entries(queries).map(async ([key, query]) => {
    const { data, error } = await query;
    return [key, error ? { erro: error.message } : data] as const;
  }));
  return { exportado_em: new Date().toISOString(), ...Object.fromEntries(entries) };
}

// Remove os arquivos do usuário no Storage e depois a conta (cascata no banco)
export async function deleteOwnAccount(me: string): Promise<string | null> {
  // Se algum arquivo não puder ser apagado, a conta é mantida para a pessoa tentar de novo:
  // apagar a conta primeiro deixaria fotos públicas órfãs no Storage, sem dono para removê-las.
  const PAGE = 1000;
  for (const bucket of ['public-media', 'private-vaults']) {
    const folders = [me];
    while (folders.length > 0) {
      const folder = folders.pop()!;
      const files: string[] = [];
      for (let offset = 0; ; offset += PAGE) {
        const { data: entries, error: listError } = await supabase.storage.from(bucket).list(folder, { limit: PAGE, offset });
        if (listError) return `Não foi possível listar seus arquivos (${listError.message}). Tente novamente.`;
        for (const entry of entries ?? []) {
          // Pastas aparecem sem id na listagem do Storage
          if (entry.id) files.push(`${folder}/${entry.name}`);
          else folders.push(`${folder}/${entry.name}`);
        }
        if (!entries || entries.length < PAGE) break;
      }
      for (let i = 0; i < files.length; i += PAGE) {
        const { error: removeError } = await supabase.storage.from(bucket).remove(files.slice(i, i + PAGE));
        if (removeError) return `Não foi possível apagar todos os seus arquivos (${removeError.message}). Tente novamente.`;
      }
    }
  }

  const { error } = await supabase.rpc('delete_own_account');
  return error?.message ?? null;
}

export async function touchLastActive(me: string) {
  await supabase.from('profiles').update({ last_active_at: new Date().toISOString() }).eq('id', me);
}
