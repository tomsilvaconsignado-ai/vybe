import { supabase } from './supabase';
import { mapProfileRow, avatarOrDefault } from './profiles';
import { Community, Post, PostComment, UserProfile } from '../types';

// ----------------- FORMATAÇÃO ----------------- //

export function formatRelativeTime(iso: string): string {
  const seconds = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return 'Agora mesmo';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `há ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `há ${days} d`;
  return new Date(iso).toLocaleDateString('pt-BR');
}

// Respeita a escolha de privacidade de localização do autor
export function formatLocation(city: string, state: string, privacy: UserProfile['locationPrivacy']): string {
  if (privacy === 'hidden') return 'Localização oculta';
  if (privacy === 'approximate_region') return state ? `Região de ${state}` : 'Região aproximada';
  return [city, state].filter(Boolean).join(', ');
}

// ----------------- PERFIS ----------------- //

const PROFILE_SELECT = '*, joint_partners(*), compatibility_preferences(*), albums!albums_user_id_fkey(id, visibility)';

export async function fetchProfiles(excludeUserId: string): Promise<UserProfile[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select(PROFILE_SELECT)
    .neq('id', excludeUserId)
    .neq('status', 'blocked')
    .order('last_active_at', { ascending: false })
    .limit(200);

  if (error) {
    console.error('[VYBE] Falha ao carregar perfis:', error.message);
    return [];
  }
  return data.map(row => {
    const profile = mapProfileRow(row);
    // Perfis de terceiros exibem a localização conforme a privacidade escolhida
    if (row.location_privacy !== 'city') {
      profile.city = formatLocation(row.city, row.state, row.location_privacy);
      profile.state = '';
    }
    profile.lastActive = formatRelativeTime(row.last_active_at);
    // Só o tipo de cada álbum (para o selo de cofre); o conteúdo é carregado no perfil
    profile.albums = (row.albums ?? []).map((a: { id: string; visibility: UserProfile['albums'][number]['visibility'] }) => ({
      id: a.id, userId: row.id, title: '', description: '', coverUrl: '', visibility: a.visibility,
      mediaCount: 0, allowedUserIds: [], pendingRequestUserIds: [], items: [], createdAt: ''
    }));
    return profile;
  });
}

// ----------------- SEGUIR E CONEXÕES ----------------- //

export interface SocialGraph {
  following: string[];
  connections: string[];
  incomingRequests: string[];
  outgoingRequests: string[];
}

export async function fetchSocialGraph(me: string): Promise<SocialGraph> {
  const [followsRes, connectionsRes] = await Promise.all([
    supabase.from('follows').select('following_id').eq('follower_id', me),
    supabase.from('connections').select('requester_id, addressee_id, status').or(`requester_id.eq.${me},addressee_id.eq.${me}`)
  ]);

  const graph: SocialGraph = { following: [], connections: [], incomingRequests: [], outgoingRequests: [] };
  graph.following = (followsRes.data ?? []).map(f => f.following_id);

  for (const c of connectionsRes.data ?? []) {
    const other = c.requester_id === me ? c.addressee_id : c.requester_id;
    if (c.status === 'accepted') graph.connections.push(other);
    else if (c.addressee_id === me) graph.incomingRequests.push(other);
    else graph.outgoingRequests.push(other);
  }
  return graph;
}

export async function setFollow(me: string, target: string, follow: boolean) {
  const { error } = follow
    ? await supabase.from('follows').insert({ follower_id: me, following_id: target })
    : await supabase.from('follows').delete().eq('follower_id', me).eq('following_id', target);
  return error?.message ?? null;
}

export async function sendConnectionRequest(me: string, target: string) {
  const { error } = await supabase.from('connections').insert({ requester_id: me, addressee_id: target });
  if (error?.code === '23505') return 'Já existe uma solicitação de conexão entre vocês.';
  return error?.message ?? null;
}

export async function acceptConnectionRequest(me: string, requester: string) {
  const { error } = await supabase
    .from('connections')
    .update({ status: 'accepted', responded_at: new Date().toISOString() })
    .eq('requester_id', requester)
    .eq('addressee_id', me);
  return error?.message ?? null;
}

// ----------------- FEED ----------------- //

const AUTHOR_COLUMNS = 'id, username, display_name, avatar_url, profile_type, is_verified, city, state, location_privacy';

const POST_SELECT = `
  *,
  author:profiles!posts_user_id_fkey(${AUTHOR_COLUMNS}),
  post_polls(id, question, options, post_poll_votes(user_id, option_id)),
  post_comments(id, user_id, content, likes_count, created_at, author:profiles!post_comments_user_id_fkey(id, username, display_name, avatar_url, is_verified)),
  my_like:post_likes(user_id),
  my_save:post_saves(user_id)
`;

function mapPostRow(row: any, me: string): Post {
  const author = row.author;
  const poll = Array.isArray(row.post_polls) ? row.post_polls[0] : row.post_polls;
  const votes: { user_id: string; option_id: string }[] = poll?.post_poll_votes ?? [];

  const comments: PostComment[] = (row.post_comments ?? [])
    .sort((a: any, b: any) => a.created_at.localeCompare(b.created_at))
    .map((c: any) => ({
      id: c.id,
      postId: row.id,
      userId: c.user_id,
      username: c.author?.username ?? '',
      userDisplayName: c.author?.display_name ?? 'Usuário',
      userAvatar: avatarOrDefault(c.author?.avatar_url, c.author?.display_name ?? 'U'),
      isVerified: c.author?.is_verified ?? false,
      content: c.content,
      createdAt: formatRelativeTime(c.created_at),
      likesCount: c.likes_count
    }));

  return {
    id: row.id,
    userId: row.user_id,
    user: {
      id: author?.id ?? row.user_id,
      username: author?.username ?? '',
      displayName: author?.display_name ?? 'Usuário',
      avatarUrl: avatarOrDefault(author?.avatar_url, author?.display_name ?? 'U'),
      profileType: author?.profile_type ?? 'couple',
      isVerified: author?.is_verified ?? false,
      city: author ? formatLocation(author.city, author.state, author.location_privacy) : ''
    },
    content: row.content,
    mediaUrls: row.media_urls ?? [],
    mediaType: row.media_type,
    tags: row.tags ?? [],
    location: row.location ?? undefined,
    poll: poll ? {
      question: poll.question,
      options: (poll.options ?? []).map((o: { id: string; text: string }) => ({
        id: o.id,
        text: o.text,
        votes: votes.filter(v => v.option_id === o.id).length
      })),
      voterIds: Object.fromEntries(votes.map(v => [v.user_id, v.option_id]))
    } : undefined,
    likesCount: row.likes_count,
    likedByCurrentUser: (row.my_like ?? []).some((l: any) => l.user_id === me),
    commentsCount: row.comments_count,
    savedByCurrentUser: (row.my_save ?? []).length > 0,
    comments,
    createdAt: formatRelativeTime(row.created_at),
    visibility: row.visibility,
    communityId: row.community_id ?? undefined
  };
}

export async function fetchFeed(me: string): Promise<Post[]> {
  const { data, error } = await supabase
    .from('posts')
    .select(POST_SELECT)
    .is('community_id', null)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    console.error('[VYBE] Falha ao carregar feed:', error.message);
    return [];
  }
  return data.map(row => mapPostRow(row, me));
}

export async function fetchPost(postId: string, me: string): Promise<Post | null> {
  const { data, error } = await supabase
    .from('posts')
    .select(POST_SELECT)
    .eq('id', postId)
    .maybeSingle();
  if (error || !data) return null;
  return mapPostRow(data, me);
}

export async function insertPost(
  me: string,
  content: string,
  mediaUrls: string[],
  tags: string[],
  poll?: { question: string; options: string[] }
): Promise<{ postId: string | null; error: string | null }> {
  const { data, error } = await supabase
    .from('posts')
    .insert({ user_id: me, content, media_urls: mediaUrls, tags })
    .select('id')
    .single();
  if (error) return { postId: null, error: error.message };

  if (poll && poll.question && poll.options.length >= 2) {
    const { error: pollError } = await supabase.from('post_polls').insert({
      post_id: data.id,
      question: poll.question,
      options: poll.options.map((text, i) => ({ id: `opt_${i}`, text }))
    });
    if (pollError) return { postId: data.id, error: pollError.message };
  }
  return { postId: data.id, error: null };
}

export async function removePost(postId: string) {
  const { error } = await supabase.from('posts').delete().eq('id', postId);
  return error?.message ?? null;
}

export async function setLike(me: string, postId: string, like: boolean) {
  const { error } = like
    ? await supabase.from('post_likes').insert({ post_id: postId, user_id: me })
    : await supabase.from('post_likes').delete().eq('post_id', postId).eq('user_id', me);
  return error?.message ?? null;
}

export async function setSave(me: string, postId: string, save: boolean) {
  const { error } = save
    ? await supabase.from('post_saves').insert({ post_id: postId, user_id: me })
    : await supabase.from('post_saves').delete().eq('post_id', postId).eq('user_id', me);
  return error?.message ?? null;
}

export async function insertComment(me: string, postId: string, content: string) {
  const { error } = await supabase.from('post_comments').insert({ post_id: postId, user_id: me, content });
  return error?.message ?? null;
}

export async function insertPollVote(me: string, postId: string, optionId: string) {
  const { data: poll } = await supabase.from('post_polls').select('id').eq('post_id', postId).maybeSingle();
  if (!poll) return 'Enquete não encontrada.';
  const { error } = await supabase.from('post_poll_votes').insert({ poll_id: poll.id, user_id: me, option_id: optionId });
  return error?.message ?? null;
}

// ----------------- COMUNIDADES ----------------- //

export async function fetchCommunities(me: string): Promise<Community[]> {
  const [{ data, error }, { data: memberships }] = await Promise.all([
    supabase.from('communities').select('*').order('members_count', { ascending: false }),
    supabase.from('community_members').select('community_id').eq('user_id', me)
  ]);
  const joined = new Set((memberships ?? []).map(m => m.community_id));

  if (error) {
    console.error('[VYBE] Falha ao carregar comunidades:', error.message);
    return [];
  }

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
    isJoined: joined.has(c.id),
    isPrivate: c.is_private,
    postsCount: c.posts_count,
    moderators: []
  }));
}

export async function setCommunityMembership(me: string, communityId: string, join: boolean) {
  const { error } = join
    ? await supabase.from('community_members').insert({ community_id: communityId, user_id: me })
    : await supabase.from('community_members').delete().eq('community_id', communityId).eq('user_id', me);
  if (error?.message.includes('row-level security')) return 'Esta comunidade é privada e exige convite da moderação.';
  return error?.message ?? null;
}
