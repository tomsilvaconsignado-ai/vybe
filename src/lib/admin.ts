import { supabase, getPrivateVaultSignedUrl } from './supabase';
import { avatarOrDefault, DEFAULT_COVER, AdminRole } from './profiles';
import { formatRelativeTime } from './social';
import { resolveChatMedia } from './messaging';
import { AdminAuditLog, AdminMediaRecord, AdminUserRecord, ModerationReport, UserAccountStatus } from '../types';

// Todas as funções abaixo dependem de sessão administrativa com MFA (aal2); o banco recusa as demais.

const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

export async function fetchAdminUsers(): Promise<AdminUserRecord[]> {
  const [usersRes, notesRes] = await Promise.all([
    supabase.rpc('admin_list_users'),
    supabase
      .from('admin_user_notes')
      .select('id, user_id, note, created_at, admin:profiles!admin_user_notes_admin_id_fkey(display_name)')
      .order('created_at', { ascending: false })
  ]);

  if (usersRes.error) {
    console.error('[Vybelog] Falha ao carregar usuários (admin):', usersRes.error.message);
    return [];
  }

  const notesByUser = new Map<string, AdminUserRecord['moderationNotes']>();
  for (const n of (notesRes.data ?? []) as any[]) {
    const list = notesByUser.get(n.user_id) ?? [];
    list.push({ id: n.id, adminId: '', adminName: n.admin?.display_name ?? 'Equipe', note: n.note, createdAt: formatDateTime(n.created_at) });
    notesByUser.set(n.user_id, list);
  }

  return (usersRes.data as any[]).map(u => ({
    id: u.id,
    username: u.username,
    displayName: u.display_name,
    email: u.email ?? '',
    profileType: u.profile_type,
    city: u.city,
    state: u.state,
    age: u.age,
    status: u.status,
    isVerified: u.is_verified,
    verifiedBadgeType: u.verified_badge_type ?? undefined,
    avatarUrl: avatarOrDefault(u.avatar_url, u.display_name),
    coverUrl: u.cover_url || DEFAULT_COVER,
    createdAt: formatDateTime(u.created_at),
    lastActive: formatRelativeTime(u.last_active_at),
    reportsReceivedCount: Number(u.reports_received),
    moderationNotes: notesByUser.get(u.id) ?? [],
    restrictions: u.restrictions ?? {},
    adminRole: u.admin_role ?? undefined,
    verificationRequested: u.verification_requested,
    birthdate: u.birthdate ?? undefined,
    birthdateVerified: Boolean(u.birthdate),
    consentConfirmed: true,
    albumsCount: Number(u.albums_count),
    postsCount: u.posts_count
  }));
}

export async function fetchAdminReports(): Promise<ModerationReport[]> {
  const { data, error } = await supabase
    .from('moderation_reports')
    .select(`*,
      reporter:profiles!moderation_reports_reporter_user_id_fkey(username, display_name),
      reported:profiles!moderation_reports_reported_user_id_fkey(username, display_name),
      reviewer:profiles!moderation_reports_reviewed_by_fkey(display_name)`)
    .order('created_at', { ascending: false })
    .limit(300);

  if (error) {
    console.error('[Vybelog] Falha ao carregar denúncias:', error.message);
    return [];
  }

  return (data as any[]).map(r => ({
    id: r.id,
    reporterUserId: r.reporter_user_id,
    reporterName: r.reporter?.display_name ?? 'Usuário removido',
    reportedUserId: r.reported_user_id,
    reportedUserName: r.reported?.username ?? 'removido',
    targetType: r.target_type,
    targetId: r.target_id,
    category: r.category,
    description: r.description,
    status: r.status,
    priority: r.priority,
    createdAt: formatDateTime(r.created_at),
    reviewedBy: r.reviewer?.display_name ?? undefined,
    resolutionNote: r.resolution_note ?? undefined
  }));
}

export async function fetchAdminLogs(): Promise<AdminAuditLog[]> {
  const { data, error } = await supabase
    .from('admin_audit_logs')
    .select('*, admin:profiles!admin_audit_logs_admin_id_fkey(display_name)')
    .order('created_at', { ascending: false })
    .limit(500);

  if (error) {
    console.error('[Vybelog] Falha ao carregar auditoria:', error.message);
    return [];
  }

  return (data as any[]).map(l => ({
    id: l.id,
    adminId: l.admin_id,
    adminName: l.admin?.display_name ?? 'Equipe',
    adminRole: l.admin_role,
    action: l.action,
    targetId: l.target_id,
    targetType: l.target_type,
    reason: l.reason,
    timestamp: formatDateTime(l.created_at)
  }));
}

// Mídias publicadas no feed (uma linha por publicação com imagem)
export async function fetchAdminMedia(): Promise<AdminMediaRecord[]> {
  const { data, error } = await supabase
    .from('posts')
    .select('id, user_id, content, media_urls, media_type, visibility, moderation_status, created_at, author:profiles!posts_user_id_fkey(username, display_name, avatar_url)')
    .neq('media_urls', '{}')
    .order('created_at', { ascending: false })
    .limit(300);

  if (error) {
    console.error('[Vybelog] Falha ao carregar mídias:', error.message);
    return [];
  }

  return (data as any[]).map(p => ({
    id: p.id,
    userId: p.user_id,
    userName: p.author?.username ?? '',
    userAvatar: avatarOrDefault(p.author?.avatar_url, p.author?.display_name ?? 'U'),
    url: p.media_urls[0],
    urls: p.media_urls,
    type: p.media_type === 'video' ? 'video' : 'image',
    visibility: p.visibility === 'public' ? 'public' : 'connections_only',
    caption: p.content?.slice(0, 80),
    status: p.moderation_status,
    createdAt: formatDateTime(p.created_at)
  }));
}

const rpcError = (error: { message: string } | null) => error?.message ?? null;

export async function adminSetUserStatus(target: string, status: UserAccountStatus, reason: string) {
  const { error } = await supabase.rpc('admin_set_user_status', { target, new_status: status, reason });
  return rpcError(error);
}

export async function adminSetRestrictions(target: string, restrictions: AdminUserRecord['restrictions'], reason: string) {
  const { error } = await supabase.rpc('admin_set_restrictions', { target, new_restrictions: restrictions ?? {}, reason });
  return rpcError(error);
}

export async function adminSetVerified(target: string, verified: boolean, reason: string) {
  const { error } = await supabase.rpc('admin_set_verified', { target, verified, badge: 'identity', reason });
  return rpcError(error);
}

export async function adminAddNote(target: string, note: string) {
  const { error } = await supabase.rpc('admin_add_note', { target, note });
  return rpcError(error);
}

export async function adminResolveReport(report: string, resolution: 'under_review' | 'resolved' | 'dismissed', note: string) {
  const { error } = await supabase.rpc('admin_resolve_report', { report, resolution, note });
  return rpcError(error);
}

export async function adminModeratePost(post: string, status: AdminMediaRecord['status'], reason: string) {
  const { error } = await supabase.rpc('admin_moderate_post', { post, new_status: status, reason });
  return rpcError(error);
}

export async function adminSetRole(target: string, role: AdminRole | null, reason: string) {
  const { error } = await supabase.rpc('admin_set_role', { target, new_role: role, reason });
  return rpcError(error);
}

export interface EvidenceMessage {
  id: string;
  senderId: string;
  senderName: string;
  content: string;
  mediaUrl?: string;
  createdAt: string;
}

export async function adminReportEvidence(report: string, justification: string): Promise<{ messages: EvidenceMessage[]; error: string | null }> {
  const { data, error } = await supabase.rpc('admin_report_evidence', { report, justification });
  if (error) return { messages: [], error: error.message };
  const messages: EvidenceMessage[] = ((data ?? []) as any[]).reverse().map(m => ({
    id: m.message_id,
    senderId: m.sender_id,
    senderName: m.sender_name,
    content: m.content,
    mediaUrl: m.media_url ?? undefined,
    createdAt: formatDateTime(m.created_at)
  }));
  return {
    messages: await resolveChatMedia(messages),
    error: null
  };
}

// ----------------- ACESSO INTEGRAL DO SUPERADMIN (auditado) ----------------- //
// Cada chamada exige justificativa e fica no livro de auditoria (ver setup.sql).

const missingRpc = (error: { code?: string; message: string }) =>
  error.code === 'PGRST202' ? 'Esta função ainda não foi instalada no banco. Rode o setup.sql atualizado.' : error.message;

export interface AdminConversationSummary {
  id: string;
  participants: { id: string; username: string; displayName: string; avatarUrl: string }[];
  messageCount: number;
  lastMessageAt: string;
  isPending: boolean;
}

export async function adminListConversations(justification: string): Promise<{ conversations: AdminConversationSummary[]; error: string | null }> {
  const { data, error } = await supabase.rpc('admin_list_conversations', { justification });
  if (error) return { conversations: [], error: missingRpc(error) };
  return {
    conversations: ((data ?? []) as any[]).map(c => ({
      id: c.conversation_id,
      participants: (c.participants ?? []).map((p: any) => ({
        id: p.id,
        username: p.username,
        displayName: p.display_name,
        avatarUrl: avatarOrDefault(p.avatar_url, p.display_name ?? 'U')
      })),
      messageCount: Number(c.message_count),
      lastMessageAt: c.last_message_at ? formatDateTime(c.last_message_at) : 'Sem mensagens',
      isPending: c.is_pending
    })),
    error: null
  };
}

export async function adminReadConversation(conversation: string, justification: string): Promise<{ messages: EvidenceMessage[]; error: string | null }> {
  const { data, error } = await supabase.rpc('admin_read_conversation', { conv: conversation, justification });
  if (error) return { messages: [], error: missingRpc(error) };
  const messages: EvidenceMessage[] = ((data ?? []) as any[]).map(m => ({
    id: m.message_id,
    senderId: m.sender_id,
    senderName: m.sender_name,
    content: m.content,
    mediaUrl: m.media_url ?? undefined,
    createdAt: formatDateTime(m.created_at)
  }));
  return {
    messages: await resolveChatMedia(messages),
    error: null
  };
}

export interface AdminAlbumItem {
  id: string;
  albumTitle: string;
  isVault: boolean;
  url: string | null;   // pública ou assinada (cofre, válida por 10 min)
  isVideo: boolean;
  caption: string;
  createdAt: string;
}

export async function adminUserAlbumItems(target: string, justification: string): Promise<{ items: AdminAlbumItem[]; error: string | null }> {
  const { data, error } = await supabase.rpc('admin_vault_items', { target, justification });
  if (error) return { items: [], error: missingRpc(error) };
  const items = await Promise.all(((data ?? []) as any[]).map(async i => {
    const signed = i.storage_path ? (await getPrivateVaultSignedUrl(i.storage_path, 600)).signedUrl : null;
    return {
      id: i.item_id,
      albumTitle: i.album_title,
      isVault: i.album_visibility === 'private_vault',
      url: signed ?? i.url ?? null,
      isVideo: i.media_type === 'video',
      caption: i.caption ?? '',
      createdAt: formatDateTime(i.created_at)
    };
  }));
  return { items, error: null };
}
