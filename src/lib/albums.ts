import { supabase, uploadToBucket } from './supabase';
import { DEFAULT_COVER } from './profiles';
import { AlbumVisibility, MediaAlbum, MediaItem } from '../types';

// Fotos de cofre ficam no bucket privado e só são exibidas por link temporário
const SIGNED_URL_SECONDS = 300;

export async function fetchAlbums(ownerId: string): Promise<MediaAlbum[]> {
  const [albumsRes, countsRes] = await Promise.all([
    supabase
      .from('albums')
      .select('id, user_id, title, description, cover_url, visibility, created_at, album_items(id, url, storage_path, type, caption, blur_preview, created_at), album_permissions(user_id, status)')
      .eq('user_id', ownerId)
      .order('created_at', { ascending: true }),
    supabase.rpc('album_item_counts', { owner: ownerId })
  ]);

  if (albumsRes.error) {
    console.error('[Vybelog] Falha ao carregar álbuns:', albumsRes.error.message);
    return [];
  }

  const counts = new Map(((countsRes.data ?? []) as { album_id: string; item_count: number }[]).map(c => [c.album_id, Number(c.item_count)]));

  // Gera links temporários para as fotos privadas que o usuário pode ver (o RLS já filtrou)
  const privatePaths = (albumsRes.data as any[]).flatMap(a => (a.album_items ?? []).map((i: any) => i.storage_path).filter(Boolean));
  const signed = new Map<string, string>();
  if (privatePaths.length > 0) {
    const { data } = await supabase.storage.from('private-vaults').createSignedUrls(privatePaths, SIGNED_URL_SECONDS);
    for (const s of data ?? []) if (s.signedUrl && s.path) signed.set(s.path, s.signedUrl);
  }

  return (albumsRes.data as any[]).map(a => {
    const items: MediaItem[] = (a.album_items ?? [])
      .sort((x: any, y: any) => x.created_at.localeCompare(y.created_at))
      .map((i: any) => ({
        id: i.id,
        url: i.storage_path ? signed.get(i.storage_path) ?? '' : i.url,
        type: i.type === 'video' ? 'video' : 'image',
        albumId: a.id,
        visibility: a.visibility,
        caption: i.caption ?? undefined,
        blurPreview: i.blur_preview,
        createdAt: new Date(i.created_at).toLocaleDateString('pt-BR')
      }))
      .filter((i: MediaItem) => i.url);
    const permissions: { user_id: string; status: string }[] = a.album_permissions ?? [];

    return {
      id: a.id,
      userId: a.user_id,
      title: a.title,
      description: a.description,
      coverUrl: a.cover_url || (a.visibility === 'private_vault' ? DEFAULT_COVER : items[0]?.url || DEFAULT_COVER),
      visibility: a.visibility,
      mediaCount: counts.get(a.id) ?? items.length,
      allowedUserIds: permissions.filter(p => p.status === 'granted').map(p => p.user_id),
      pendingRequestUserIds: permissions.filter(p => p.status === 'pending').map(p => p.user_id),
      items,
      createdAt: new Date(a.created_at).toLocaleDateString('pt-BR')
    };
  });
}

export async function createAlbum(me: string, title: string, description: string, visibility: AlbumVisibility) {
  const { error } = await supabase.from('albums').insert({ user_id: me, title, description, visibility });
  return error?.message ?? null;
}

export async function deleteAlbum(me: string, album: MediaAlbum) {
  const privatePaths = album.visibility === 'private_vault'
    ? (await supabase.storage.from('private-vaults').list(`${me}/${album.id}`)).data?.map(f => `${me}/${album.id}/${f.name}`) ?? []
    : [];
  if (privatePaths.length > 0) await supabase.storage.from('private-vaults').remove(privatePaths);
  const { error } = await supabase.from('albums').delete().eq('id', album.id).eq('user_id', me);
  return error?.message ?? null;
}

export async function uploadAlbumItem(me: string, album: MediaAlbum, file: File, caption?: string) {
  const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  const fileName = `${crypto.randomUUID()}.${extension}`;
  const type = file.type.startsWith('video/') ? 'video' : 'image';

  if (album.visibility === 'private_vault') {
    // Caminho exigido pelas políticas do bucket: <dono>/<álbum>/<arquivo>
    const path = `${me}/${album.id}/${fileName}`;
    const uploadError = await uploadToBucket('private-vaults', path, file);
    if (uploadError) return uploadError.message;
    const { error } = await supabase.from('album_items').insert({ album_id: album.id, storage_path: path, type, caption: caption ?? null });
    return error?.message ?? null;
  }

  const path = `${me}/albums/${album.id}/${fileName}`;
  const uploadError = await uploadToBucket('public-media', path, file);
  if (uploadError) return uploadError.message;
  const { data } = supabase.storage.from('public-media').getPublicUrl(path);
  const { error } = await supabase.from('album_items').insert({ album_id: album.id, url: data.publicUrl, type, caption: caption ?? null, blur_preview: false });
  return error?.message ?? null;
}

export async function deleteAlbumItem(item: MediaItem) {
  const { data } = await supabase.from('album_items').select('storage_path, url').eq('id', item.id).maybeSingle();
  if (data?.storage_path) await supabase.storage.from('private-vaults').remove([data.storage_path]);
  else if (data?.url) {
    const marker = '/public-media/';
    const index = data.url.indexOf(marker);
    if (index >= 0) await supabase.storage.from('public-media').remove([decodeURIComponent(data.url.slice(index + marker.length))]);
  }
  const { error } = await supabase.from('album_items').delete().eq('id', item.id);
  return error?.message ?? null;
}

export async function requestVaultAccess(me: string, albumId: string) {
  const { error } = await supabase.from('album_permissions').insert({ album_id: albumId, user_id: me });
  if (error?.code === '23505') return 'Você já pediu acesso a este cofre. A decisão é de quem é dono dele.';
  if (error?.message.includes('row-level security')) return 'Não foi possível pedir acesso: sua conta está com essa função restrita.';
  return error?.message ?? null;
}

export async function grantVaultAccess(albumId: string, userId: string) {
  const { error } = await supabase
    .from('album_permissions')
    .update({ status: 'granted', granted_at: new Date().toISOString() })
    .eq('album_id', albumId)
    .eq('user_id', userId);
  return error?.message ?? null;
}

// Revogar ou recusar fica registrado como 'revoked': a pessoa não consegue insistir com
// novos pedidos. O dono pode liberar de novo quando quiser (grantVaultAccess).
export async function removeVaultAccess(albumId: string, userId: string) {
  const { error } = await supabase
    .from('album_permissions')
    .update({ status: 'revoked', granted_at: null })
    .eq('album_id', albumId)
    .eq('user_id', userId);
  return error?.message ?? null;
}
