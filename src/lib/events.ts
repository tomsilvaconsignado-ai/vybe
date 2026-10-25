import { supabase } from './supabase';
import { DEFAULT_COVER } from './profiles';
import { Ad, AdPlacement, EventCategory, VybeEvent } from '../types';

export const EVENT_CATEGORY_LABELS: Record<EventCategory, string> = {
  festa: 'Festa',
  encontro: 'Encontro',
  clube: 'Clube / Casa',
  viagem: 'Viagem',
  workshop: 'Workshop / Roda de conversa',
  outro: 'Outro'
};

export function formatEventDate(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function mapEvent(row: any, myStatus?: 'going' | 'interested'): VybeEvent {
  return {
    id: row.id,
    createdBy: row.created_by ?? undefined,
    title: row.title,
    description: row.description,
    category: row.category,
    startsAt: row.starts_at,
    endsAt: row.ends_at ?? undefined,
    venueName: row.venue_name,
    city: row.city,
    state: row.state,
    coverUrl: row.cover_url || DEFAULT_COVER,
    priceInfo: row.price_info ?? undefined,
    ticketUrl: row.ticket_url ?? undefined,
    dressCode: row.dress_code ?? undefined,
    audience: row.audience ?? undefined,
    status: row.status,
    isFeatured: row.is_featured,
    reviewNote: row.review_note ?? undefined,
    goingCount: row.going_count,
    interestedCount: row.interested_count,
    myStatus
  };
}

// Próximos eventos aprovados + os enviados pelo próprio usuário (qualquer status)
export async function fetchEvents(me: string): Promise<VybeEvent[]> {
  const since = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
  const [eventsRes, mineRes, rsvpRes] = await Promise.all([
    supabase.from('events').select('*').eq('status', 'approved').gte('starts_at', since).order('is_featured', { ascending: false }).order('starts_at').limit(100),
    supabase.from('events').select('*').eq('created_by', me).order('starts_at', { ascending: false }).limit(50),
    supabase.from('event_attendees').select('event_id, status').eq('user_id', me)
  ]);
  if (eventsRes.error) console.error('[VYBE] Falha ao carregar eventos:', eventsRes.error.message);

  const rsvp = new Map(((rsvpRes.data ?? []) as any[]).map(r => [r.event_id, r.status]));
  const byId = new Map<string, VybeEvent>();
  for (const row of [...(eventsRes.data ?? []), ...(mineRes.data ?? [])] as any[]) {
    byId.set(row.id, mapEvent(row, rsvp.get(row.id)));
  }
  return [...byId.values()];
}

export async function setEventRsvp(me: string, eventId: string, status: 'going' | 'interested' | null) {
  const { error } = status
    ? await supabase.from('event_attendees').upsert({ event_id: eventId, user_id: me, status }, { onConflict: 'event_id,user_id' })
    : await supabase.from('event_attendees').delete().eq('event_id', eventId).eq('user_id', me);
  return error?.message ?? null;
}

export interface EventDraft {
  title: string;
  description: string;
  category: EventCategory;
  startsAt: string;
  endsAt?: string;
  venueName: string;
  city: string;
  state: string;
  coverUrl: string;
  priceInfo?: string;
  ticketUrl?: string;
  dressCode?: string;
  audience?: string;
}

export async function submitEvent(me: string, draft: EventDraft) {
  const { error } = await supabase.from('events').insert({
    created_by: me,
    title: draft.title,
    description: draft.description,
    category: draft.category,
    starts_at: new Date(draft.startsAt).toISOString(),
    ends_at: draft.endsAt ? new Date(draft.endsAt).toISOString() : null,
    venue_name: draft.venueName,
    city: draft.city,
    state: draft.state,
    cover_url: draft.coverUrl,
    price_info: draft.priceInfo || null,
    ticket_url: draft.ticketUrl || null,
    dress_code: draft.dressCode || null,
    audience: draft.audience || null
  });
  return error?.message ?? null;
}

export async function deleteEvent(eventId: string) {
  const { error } = await supabase.from('events').delete().eq('id', eventId);
  return error?.message ?? null;
}

// ----------------- ADMIN: moderação de eventos ----------------- //

export async function fetchEventsForReview(): Promise<VybeEvent[]> {
  const { data, error } = await supabase.from('events').select('*').order('created_at', { ascending: false }).limit(200);
  if (error) return [];
  return (data as any[]).map(row => mapEvent(row));
}

export async function reviewEvent(eventId: string, status: 'approved' | 'rejected', featured: boolean, note: string) {
  const { error } = await supabase.rpc('admin_review_event', { event: eventId, new_status: status, featured, note });
  return error?.message ?? null;
}

// ----------------- PUBLICIDADE ----------------- //

function mapAd(row: any): Ad {
  return {
    id: row.id,
    advertiser: row.advertiser,
    title: row.title,
    body: row.body,
    imageUrl: row.image_url,
    linkUrl: row.link_url ?? undefined,
    ctaLabel: row.cta_label,
    placement: row.placement,
    startsAt: row.starts_at,
    endsAt: row.ends_at ?? undefined,
    isActive: row.is_active,
    impressions: row.impressions,
    clicks: row.clicks
  };
}

// Anúncios ativos (o RLS já filtra período e status para membros comuns)
export async function fetchActiveAds(): Promise<Ad[]> {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('ads')
    .select('*')
    .eq('is_active', true)
    .lte('starts_at', now)
    .or(`ends_at.is.null,ends_at.gt.${now}`);
  if (error) return [];
  return (data as any[]).map(mapAd);
}

export async function fetchAllAds(): Promise<Ad[]> {
  const { data, error } = await supabase.from('ads').select('*').order('created_at', { ascending: false });
  if (error) return [];
  return (data as any[]).map(mapAd);
}

export async function saveAd(me: string, ad: Partial<Ad> & { id?: string }) {
  const row = {
    advertiser: ad.advertiser,
    title: ad.title,
    body: ad.body ?? '',
    image_url: ad.imageUrl ?? '',
    link_url: ad.linkUrl || null,
    cta_label: ad.ctaLabel || 'Saiba mais',
    placement: ad.placement,
    starts_at: ad.startsAt ? new Date(ad.startsAt).toISOString() : new Date().toISOString(),
    ends_at: ad.endsAt ? new Date(ad.endsAt).toISOString() : null,
    is_active: ad.isActive ?? true
  };
  const { error } = ad.id
    ? await supabase.from('ads').update(row).eq('id', ad.id)
    : await supabase.from('ads').insert({ ...row, created_by: me });
  return error?.message ?? null;
}

export async function deleteAd(adId: string) {
  const { error } = await supabase.from('ads').delete().eq('id', adId);
  return error?.message ?? null;
}

// Cada anúncio conta uma visualização por sessão do navegador
const seenThisSession = new Set<string>();
export function recordAdImpression(adId: string) {
  if (seenThisSession.has(adId)) return;
  seenThisSession.add(adId);
  supabase.rpc('record_ad_event', { ad: adId, kind: 'impression' }).then(() => undefined);
}

export function recordAdClick(adId: string) {
  supabase.rpc('record_ad_event', { ad: adId, kind: 'click' }).then(() => undefined);
}

export const pickAd = (ads: Ad[], placement: AdPlacement, index = 0): Ad | undefined => {
  const pool = ads.filter(a => a.placement === placement);
  return pool.length ? pool[index % pool.length] : undefined;
};
