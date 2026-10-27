import { supabase, uploadPublicMedia } from './supabase';
import { avatarOrDefault } from './profiles';
import { formatRelativeTime } from './social';
import { Story, StoryGroup } from '../types';

export async function fetchStoryGroups(me: string): Promise<StoryGroup[]> {
  const { data, error } = await supabase
    .from('stories')
    .select('id, user_id, media_url, media_type, caption, audience, created_at, expires_at, author:profiles!stories_user_id_fkey(username, display_name, avatar_url), story_views(viewer_id)')
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: true });

  if (error) {
    console.error('[Vybelog] Falha ao carregar stories:', error.message);
    return [];
  }

  const groups = new Map<string, StoryGroup>();
  for (const row of data as any[]) {
    const story: Story = {
      id: row.id,
      userId: row.user_id,
      mediaUrl: row.media_url,
      mediaType: row.media_type,
      caption: row.caption ?? undefined,
      audience: row.audience,
      createdAt: formatRelativeTime(row.created_at),
      expiresAt: row.expires_at,
      // O RLS devolve ao autor todas as visualizações e aos demais só a própria
      viewedByMe: row.user_id === me || (row.story_views ?? []).some((v: any) => v.viewer_id === me)
    };
    const group: StoryGroup = groups.get(row.user_id) ?? {
      userId: row.user_id,
      username: row.author?.username ?? '',
      displayName: row.author?.display_name ?? '',
      avatarUrl: avatarOrDefault(row.author?.avatar_url, row.author?.display_name ?? 'U'),
      stories: [],
      hasUnseen: false
    };
    group.stories.push(story);
    group.hasUnseen = group.hasUnseen || !story.viewedByMe;
    groups.set(row.user_id, group);
  }

  // O próprio usuário primeiro; depois quem tem story não visto
  return [...groups.values()].sort((a, b) =>
    (a.userId === me ? -1 : b.userId === me ? 1 : 0) || Number(b.hasUnseen) - Number(a.hasUnseen)
  );
}

export async function publishStory(me: string, file: File, caption: string, audience: 'all' | 'connections') {
  const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  const { publicUrl, error: uploadError } = await uploadPublicMedia(file, `${me}/stories/${crypto.randomUUID()}.${extension}`);
  if (uploadError || !publicUrl) return uploadError?.message ?? 'Falha no envio da mídia.';
  const { error } = await supabase.from('stories').insert({
    user_id: me,
    media_url: publicUrl,
    media_type: file.type.startsWith('video/') ? 'video' : 'image',
    caption: caption.trim() || null,
    audience
  });
  if (error?.message.includes('row-level security')) return 'Sua conta está com publicações restritas.';
  return error?.message ?? null;
}

export async function markStoryViewed(me: string, storyId: string) {
  // upsert ignora visualizações repetidas
  await supabase.from('story_views').upsert({ story_id: storyId, viewer_id: me }, { onConflict: 'story_id,viewer_id', ignoreDuplicates: true });
}

export async function fetchStoryViewers(storyId: string) {
  const { data } = await supabase
    .from('story_views')
    .select('viewed_at, viewer:profiles!story_views_viewer_id_fkey(id, username, display_name, avatar_url)')
    .eq('story_id', storyId)
    .order('viewed_at', { ascending: false });
  return ((data ?? []) as any[]).map(v => ({
    id: v.viewer?.id as string,
    displayName: v.viewer?.display_name as string,
    username: v.viewer?.username as string,
    avatarUrl: avatarOrDefault(v.viewer?.avatar_url, v.viewer?.display_name ?? 'U'),
    viewedAt: formatRelativeTime(v.viewed_at)
  }));
}

export async function deleteStory(storyId: string) {
  const { error } = await supabase.from('stories').delete().eq('id', storyId);
  return error?.message ?? null;
}
