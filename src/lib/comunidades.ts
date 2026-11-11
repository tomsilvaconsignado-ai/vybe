// Comunidades: criação pelos usuários, pedidos para entrar, convites, funções e moderação.
// Tudo que muda papéis ou acesso passa por funções do banco (§13 do setup.sql), que conferem as permissões.
import { supabase } from './supabase';
import { POST_SELECT, mapPostRow } from './social';
import type { Community, CommunityAccess, CommunityRole, Post } from '../types';

export const COMMUNITY_CATEGORIES: { id: Community['category']; label: string }[] = [
  { id: 'regional', label: 'Regionais / Cidades' },
  { id: 'beginners', label: 'Iniciantes no Meio' },
  { id: 'lifestyle', label: 'Estilo de Vida & Poliamor' },
  { id: 'events', label: 'Festas & Lounges' },
  { id: 'discussions', label: 'Debates' }
];

export const ACCESS_INFO: Record<CommunityAccess, { label: string; help: string }> = {
  public: { label: 'Aberta', help: 'Qualquer pessoa entra e vê as publicações.' },
  approval: { label: 'Com aprovação', help: 'Aparece na lista; a moderação aprova quem pede para entrar. Só membros veem as publicações.' },
  private: { label: 'Secreta', help: 'Só entra quem for convidado e ela não aparece para quem está fora.' }
};

/** Mensagem do banco (RAISE EXCEPTION) já vem em português; erros técnicos viram uma frase genérica */
const msg = (e: { message: string } | null) =>
  !e ? null : /violates|permission|policy|function|column|relation/i.test(e.message) ? 'Não foi possível concluir. Tente novamente.' : e.message;

export async function fetchCommunities(me: string): Promise<Community[]> {
  const [{ data, error }, { data: membros }, { data: pedidos }, { data: convites }] = await Promise.all([
    supabase.from('communities').select('*').order('members_count', { ascending: false }),
    supabase.from('community_members').select('community_id, role').eq('user_id', me),
    supabase.from('community_requests').select('community_id').eq('user_id', me),
    supabase.from('community_invites').select('community_id').eq('user_id', me)
  ]);
  if (error) {
    console.error('[Vybelog] Falha ao carregar comunidades:', error.message);
    return [];
  }
  const papel = new Map((membros ?? []).map(m => [m.community_id as string, m.role as CommunityRole]));
  const pedi = new Set((pedidos ?? []).map(p => p.community_id as string));
  const convidado = new Set((convites ?? []).map(p => p.community_id as string));
  return (data as any[]).map(c => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
    description: c.description,
    coverUrl: c.cover_url,
    iconUrl: c.icon_url,
    category: c.category,
    rules: c.rules ?? [],
    membersCount: c.members_count,
    isJoined: papel.has(c.id),
    isPrivate: c.is_private,
    access: (c.access ?? (c.is_private ? 'approval' : 'public')) as CommunityAccess,
    myRole: papel.get(c.id) ?? null,
    requested: pedi.has(c.id),
    invited: convidado.has(c.id),
    createdBy: c.created_by ?? undefined,
    postsCount: c.posts_count,
    moderators: []
  }));
}

export interface CommunityDraft {
  name: string;
  description: string;
  category: Community['category'];
  icon: string;
  /** null = manter a capa atual (edição) */
  cover: string | null;
  rules: string[];
  access: CommunityAccess;
}

const params = (d: CommunityDraft) => ({
  p_name: d.name, p_description: d.description, p_category: d.category, p_icon: d.icon,
  p_cover: d.cover, p_rules: d.rules.map(r => r.trim()).filter(Boolean), p_access: d.access
});

export async function createCommunity(d: CommunityDraft): Promise<{ id: string | null; error: string | null }> {
  const { data, error } = await supabase.rpc('create_community', params(d));
  return { id: (data as string) ?? null, error: msg(error) };
}

export async function updateCommunity(id: string, d: CommunityDraft) {
  const { error } = await supabase.rpc('update_community', { p_id: id, ...params(d) });
  return msg(error);
}

export async function deleteCommunity(id: string) {
  const { error } = await supabase.rpc('delete_community', { p_id: id });
  return msg(error);
}

/** Entra (aberta ou com convite) ou pede para entrar (com aprovação) */
export async function joinCommunity(id: string, message = ''): Promise<{ status: 'joined' | 'requested' | 'already' | null; error: string | null }> {
  const { data, error } = await supabase.rpc('community_join', { p_id: id, p_message: message });
  return { status: (data as 'joined' | 'requested' | 'already') ?? null, error: msg(error) };
}

export async function leaveCommunity(me: string, id: string) {
  const { error } = await supabase.from('community_members').delete().eq('community_id', id).eq('user_id', me);
  return msg(error);
}

export async function cancelCommunityRequest(id: string) {
  const { error } = await supabase.rpc('community_cancel_request', { p_id: id });
  return msg(error);
}

export async function declineCommunityInvite(id: string) {
  const { error } = await supabase.rpc('community_decline_invite', { p_id: id });
  return msg(error);
}

export async function inviteToCommunity(id: string, user: string) {
  const { error } = await supabase.rpc('community_invite', { p_id: id, p_user: user });
  return msg(error);
}

export async function reviewCommunityRequest(id: string, user: string, approve: boolean) {
  const { error } = await supabase.rpc('community_review_request', { p_id: id, p_user: user, p_approve: approve });
  return msg(error);
}

export async function setCommunityRole(id: string, user: string, role: CommunityRole) {
  const { error } = await supabase.rpc('community_set_role', { p_id: id, p_user: user, p_role: role });
  return msg(error);
}

export async function removeCommunityMember(id: string, user: string, ban: boolean, reason = '') {
  const { error } = await supabase.rpc('community_remove_member', { p_id: id, p_user: user, p_ban: ban, p_reason: reason });
  return msg(error);
}

export async function unbanCommunityMember(id: string, user: string) {
  const { error } = await supabase.rpc('community_unban', { p_id: id, p_user: user });
  return msg(error);
}

export interface PessoaDaComunidade {
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string;
  isVerified: boolean;
  role?: CommunityRole;
  date: string;
  note?: string;
}

const PESSOA = 'profile:profiles!{fk}(id, username, display_name, avatar_url, is_verified)';
const pessoa = (row: any, data: string, extra: Partial<PessoaDaComunidade> = {}): PessoaDaComunidade => ({
  userId: row.user_id,
  username: row.profile?.username ?? '',
  displayName: row.profile?.display_name ?? 'Perfil',
  avatarUrl: row.profile?.avatar_url ?? '',
  isVerified: !!row.profile?.is_verified,
  date: data,
  ...extra
});

export async function fetchCommunityMembers(id: string): Promise<PessoaDaComunidade[]> {
  const { data, error } = await supabase
    .from('community_members')
    .select(`user_id, role, joined_at, ${PESSOA.replace('{fk}', 'community_members_user_id_fkey')}`)
    .eq('community_id', id)
    .order('joined_at')
    .limit(500);
  if (error) return [];
  const ordem = { admin: 0, moderator: 1, member: 2 } as const;
  return (data as any[]).map(r => pessoa(r, r.joined_at, { role: r.role }))
    .sort((a, b) => ordem[a.role ?? 'member'] - ordem[b.role ?? 'member']);
}

export async function fetchCommunityRequests(id: string): Promise<PessoaDaComunidade[]> {
  const { data, error } = await supabase
    .from('community_requests')
    .select(`user_id, message, created_at, ${PESSOA.replace('{fk}', 'community_requests_user_id_fkey')}`)
    .eq('community_id', id)
    .order('created_at');
  return error ? [] : (data as any[]).map(r => pessoa(r, r.created_at, { note: r.message }));
}

export async function fetchCommunityBans(id: string): Promise<PessoaDaComunidade[]> {
  const { data, error } = await supabase
    .from('community_bans')
    .select(`user_id, reason, created_at, ${PESSOA.replace('{fk}', 'community_bans_user_id_fkey')}`)
    .eq('community_id', id)
    .order('created_at', { ascending: false });
  return error ? [] : (data as any[]).map(r => pessoa(r, r.created_at, { note: r.reason }));
}

export async function fetchCommunityPosts(id: string, me: string, before?: string): Promise<Post[]> {
  let q = supabase.from('posts').select(POST_SELECT).eq('community_id', id).order('created_at', { ascending: false }).limit(20);
  if (before) q = q.lt('created_at', before);
  const { data, error } = await q;
  if (error) {
    console.error('[Vybelog] Falha ao carregar publicações da comunidade:', error.message);
    return [];
  }
  return data.map(row => mapPostRow(row, me));
}

export async function insertCommunityPost(me: string, communityId: string, content: string, mediaUrls: string[]): Promise<{ postId: string | null; error: string | null }> {
  const { data, error } = await supabase
    .from('posts')
    .insert({ user_id: me, community_id: communityId, content, media_urls: mediaUrls, tags: [], media_type: 'image' })
    .select('id')
    .single();
  if (error) return { postId: null, error: error.message.includes('row-level security') ? 'Só membros podem publicar aqui.' : error.message };
  return { postId: data.id, error: null };
}

/** Convites para eventos: só conexões ou quem se segue mutuamente recebem (o banco confere) */
export async function inviteToEvent(eventId: string, users: string[]): Promise<{ sent: number; error: string | null }> {
  const { data, error } = await supabase.rpc('invite_to_event', { p_event: eventId, p_users: users });
  return { sent: (data as number) ?? 0, error: msg(error) };
}
