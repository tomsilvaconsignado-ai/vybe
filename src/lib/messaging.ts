import { supabase } from './supabase';
import { formatRelativeTime } from './social';
import { avatarOrDefault } from './profiles';
import { stripImageMetadata } from './media';
import { ChatMessage, Conversation } from '../types';

// ----------------- FOTOS E GIFS DO DIRECT ----------------- //
// Ficam no bucket privado chat-media (<conversa>/<remetente>/<arquivo>); a mensagem guarda
// 'chat-media/<caminho>' e cada participante abre por um link assinado de curta duração.

const CHAT_MEDIA_PREFIX = 'chat-media/';
const CHAT_MEDIA_TYPES: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' };
export const CHAT_MEDIA_ACCEPT = Object.keys(CHAT_MEDIA_TYPES).join(',');
const CHAT_MEDIA_MAX_BYTES = 10 * 1024 * 1024;

export async function uploadChatMedia(conversationId: string, me: string, file: File): Promise<{ path: string | null; error: string | null }> {
  const ext = CHAT_MEDIA_TYPES[file.type];
  if (!ext) return { path: null, error: 'Envie uma imagem JPG, PNG, WebP ou GIF.' };
  if (file.size > CHAT_MEDIA_MAX_BYTES) return { path: null, error: 'A imagem pode ter no máximo 10 MB.' };
  let clean: File;
  try {
    clean = await stripImageMetadata(file);   // GIF fica como está (mantém a animação)
  } catch (e) {
    return { path: null, error: (e as Error).message };
  }
  const path = `${conversationId}/${me}/${crypto.randomUUID().replace(/-/g, '')}.${ext}`;
  const { error } = await supabase.storage.from('chat-media').upload(path, clean, { contentType: file.type, upsert: false });
  if (error) {
    return { path: null, error: error.message.includes('row-level security')
      ? 'Fotos e GIFs são liberados depois que a conversa for aceita.'
      : 'Não foi possível enviar a imagem. Tente de novo.' };
  }
  return { path: CHAT_MEDIA_PREFIX + path, error: null };
}

// Troca os caminhos do bucket privado por links assinados (válidos por 1 h)
export async function resolveChatMedia<T extends { mediaUrl?: string }>(items: T[]): Promise<T[]> {
  const paths = [...new Set(items.map(i => i.mediaUrl).filter((u): u is string => !!u?.startsWith(CHAT_MEDIA_PREFIX)))];
  if (paths.length === 0) return items;
  const { data } = await supabase.storage.from('chat-media').createSignedUrls(paths.map(u => u.slice(CHAT_MEDIA_PREFIX.length)), 3600);
  const signed = new Map((data ?? []).filter(d => d.signedUrl).map(d => [CHAT_MEDIA_PREFIX + d.path, d.signedUrl]));
  return items.map(i => (i.mediaUrl && signed.has(i.mediaUrl) ? { ...i, mediaUrl: signed.get(i.mediaUrl) } : i));
}

const PARTICIPANT_PROFILE = 'id, username, display_name, avatar_url, profile_type, is_verified, last_active_at, discreet_mode_enabled, show_online_status';

export function formatMessageTime(iso: string): string {
  const date = new Date(iso);
  const isToday = date.toDateString() === new Date().toDateString();
  return isToday
    ? date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    : date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

function mapMessage(row: any, senders: Map<string, { name: string; avatar: string }>): ChatMessage {
  const sender = senders.get(row.sender_id);
  return {
    id: row.id,
    conversationId: row.conversation_id,
    senderId: row.sender_id,
    senderName: sender?.name ?? '',
    senderAvatar: sender?.avatar ?? '',
    content: row.content,
    mediaUrl: row.media_url ?? undefined,
    createdAt: formatMessageTime(row.created_at),
    status: row.status
  };
}

export async function fetchConversations(me: string): Promise<Conversation[]> {
  const { data, error } = await supabase
    .from('conversations')
    .select(`
      id, created_by, is_pending_request, updated_at,
      conversation_participants(user_id, last_read_at, is_muted, is_archived, profile:profiles(${PARTICIPANT_PROFILE})),
      messages(id, conversation_id, sender_id, content, media_url, status, created_at)
    `)
    .order('updated_at', { ascending: false })
    .order('created_at', { referencedTable: 'messages', ascending: false })
    .limit(1, { referencedTable: 'messages' });

  if (error) {
    console.error('[Vybelog] Falha ao carregar conversas:', error.message);
    return [];
  }

  return data.flatMap((row: any) => {
    const parts: any[] = row.conversation_participants ?? [];
    const mine = parts.find(p => p.user_id === me);
    // Conversas que o usuário saiu não têm mais a linha dele; recusadas e com quem ele
    // bloqueou ficam arquivadas (voltam ao abrir a conversa pelo perfil)
    if (!mine || mine.is_archived) return [];

    // Sem o perfil do outro lado (ex.: a pessoa bloqueou o usuário), a conversa some
    const others = parts.filter(p => p.user_id !== me && p.profile);
    if (others.length === 0) return [];
    const senders = new Map(parts.filter(p => p.profile).map(p => [p.user_id, { name: p.profile.display_name, avatar: avatarOrDefault(p.profile.avatar_url, p.profile.display_name) }]));
    const last = row.messages?.[0];
    const unread = last && last.sender_id !== me && (!mine.last_read_at || last.created_at > mine.last_read_at) ? 1 : 0;

    return [{
      id: row.id,
      createdBy: row.created_by ?? undefined,
      participantIds: parts.map(p => p.user_id),
      participants: others.map(p => ({
        id: p.profile.id,
        username: p.profile.username,
        displayName: p.profile.display_name,
        avatarUrl: avatarOrDefault(p.profile.avatar_url, p.profile.display_name),
        profileType: p.profile.profile_type,
        isVerified: p.profile.is_verified,
        lastActive: p.profile.discreet_mode_enabled ? 'Modo discreto' : p.profile.show_online_status === false ? '' : formatRelativeTime(p.profile.last_active_at)
      })),
      lastMessage: last ? mapMessage(last, senders) : undefined,
      unreadCount: unread,
      isPendingRequest: row.is_pending_request,
      isMuted: mine.is_muted,
      isArchived: mine.is_archived
    }];
  });
}

export async function fetchMessages(conversation: Conversation, me: { id: string; displayName: string; avatarUrl: string }): Promise<ChatMessage[]> {
  const { data, error } = await supabase
    .from('messages')
    .select('id, conversation_id, sender_id, content, media_url, status, created_at')
    .eq('conversation_id', conversation.id)
    .order('created_at', { ascending: true })
    .limit(500);

  if (error) {
    console.error('[Vybelog] Falha ao carregar mensagens:', error.message);
    return [];
  }

  const senders = new Map(conversation.participants.map(p => [p.id, { name: p.displayName, avatar: p.avatarUrl }]));
  senders.set(me.id, { name: me.displayName, avatar: me.avatarUrl });
  return resolveChatMedia(data.map(row => mapMessage(row, senders)));
}

export async function insertMessage(me: string, conversationId: string, content: string, mediaUrl?: string) {
  const { error } = await supabase
    .from('messages')
    .insert({ conversation_id: conversationId, sender_id: me, content, media_url: mediaUrl ?? null });
  if (error?.message.includes('row-level security')) {
    return 'Mensagem não enviada. Enquanto o pedido de conversa não for aceito, só é possível enviar uma única mensagem de texto de apresentação. Se a outra pessoa bloqueou a conversa, ela não recebe novas mensagens.';
  }
  if (error?.message.includes('links externos') || error?.message.includes('Mídia inválida')) {
    return 'Envie a imagem pelo app; links externos não são aceitos.';
  }
  if (error?.message.includes('row-level security') && mediaUrl) {
    return 'Fotos e GIFs são liberados depois que a conversa for aceita.';
  }
  return error?.message ?? null;
}

export async function startConversation(target: string): Promise<{ conversationId: string | null; error: string | null }> {
  const { data, error } = await supabase.rpc('start_conversation', { target });
  return { conversationId: (data as string) ?? null, error: error?.message ?? null };
}

export async function acceptConversation(conversationId: string) {
  const { error } = await supabase.rpc('accept_message_request', { conv: conversationId });
  return error?.message ?? null;
}

// Recusar arquiva a conversa para quem recusou. Ela continua existindo para que quem
// enviou não possa abrir outra e insistir (o pedido pendente aceita só uma mensagem).
export async function declineConversation(conversationId: string) {
  const { error } = await supabase.rpc('decline_message_request', { conv: conversationId });
  return error?.message ?? null;
}

export async function markConversationRead(conversationId: string) {
  await supabase.rpc('mark_conversation_read', { conv: conversationId });
}
