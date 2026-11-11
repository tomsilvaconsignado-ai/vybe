// Notificações push no navegador: service worker, autorização e inscrição do aparelho.
// Abrir o Vybelog NÃO pede permissão: a pessoa vê a explicação e decide (PushInvite / Preferências).
import { supabase } from './supabase';

export type SituacaoPush =
  | 'sem_suporte'      // navegador sem Service Worker / Push
  | 'ios_instalar'     // iPhone/iPad: precisa adicionar à Tela de Início (iOS 16.4+)
  | 'inseguro'         // fora de HTTPS
  | 'bloqueado'        // a pessoa negou nas configurações do navegador
  | 'desativado'       // pode ativar
  | 'ativo';           // este aparelho recebe

export const ehIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
export const instalado = () => window.matchMedia?.('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true;

export function descreverAparelho() {
  const ua = navigator.userAgent;
  const so = /Android/.test(ua) ? 'Android' : ehIOS() ? 'iPhone/iPad' : /Windows/.test(ua) ? 'Windows' : /Mac OS X/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : 'Outro';
  const nav = /Edg\//.test(ua) ? 'Edge' : /OPR\//.test(ua) ? 'Opera' : /Firefox\//.test(ua) ? 'Firefox' : /SamsungBrowser/.test(ua) ? 'Samsung Internet'
    : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'Navegador';
  return `${so} · ${nav}${instalado() ? ' (app)' : ''}`;
}

export async function registrarServiceWorker() {
  if (!('serviceWorker' in navigator)) return null;
  try { return await navigator.serviceWorker.register('/sw.js', { scope: '/' }); } catch { return null; }
}

export async function situacaoPush(): Promise<SituacaoPush> {
  if (!window.isSecureContext) return 'inseguro';
  if (ehIOS() && !instalado()) return 'ios_instalar';
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return 'sem_suporte';
  if (Notification.permission === 'denied') return 'bloqueado';
  const reg = await navigator.serviceWorker.getRegistration('/');
  const inscricao = await reg?.pushManager.getSubscription();
  return inscricao && Notification.permission === 'granted' ? 'ativo' : 'desativado';
}

const bytes = (b64url: string) => {
  const b64 = (b64url + '='.repeat((4 - (b64url.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
};
const igual = (a: ArrayBuffer | null | undefined, b: Uint8Array) => !!a && a.byteLength === b.byteLength && new Uint8Array(a).every((x, i) => x === b[i]);

async function chavePublica() {
  const { data, error } = await supabase.from('app_settings').select('value').eq('key', 'public.vapid_key').maybeSingle();
  if (error) throw error;
  if (!data?.value) throw new Error('As notificações ainda não foram configuradas no servidor.');
  return data.value as string;
}

async function gravarInscricao(inscricao: PushSubscription) {
  const j = inscricao.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
  const { error } = await supabase.rpc('push_subscribe', { p_endpoint: j.endpoint, p_p256dh: j.keys.p256dh, p_auth: j.keys.auth, p_device: descreverAparelho() });
  if (error) throw error;
}

/** Pede a autorização (precisa vir de um toque/clique) e cadastra este aparelho */
export async function ativarPush() {
  const s = await situacaoPush();
  if (s === 'ios_instalar') throw new Error('No iPhone/iPad, primeiro adicione o Vybelog à Tela de Início e abra por lá.');
  if (s === 'sem_suporte' || s === 'inseguro') throw new Error('Este navegador não recebe notificações push.');
  const permissao = await Notification.requestPermission();
  if (permissao !== 'granted') throw new Error('As notificações não foram autorizadas. Você pode liberar depois nas configurações do navegador.');
  const reg = (await registrarServiceWorker()) ?? (await navigator.serviceWorker.ready);
  await navigator.serviceWorker.ready;
  const chave = bytes(await chavePublica());
  let inscricao = await reg.pushManager.getSubscription();
  if (inscricao && !igual(inscricao.options.applicationServerKey, chave)) { await inscricao.unsubscribe(); inscricao = null; }
  inscricao ??= await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: chave });
  await gravarInscricao(inscricao);
}

/** Mantém a inscrição deste aparelho atualizada no servidor (ex.: depois de trocar de conta no mesmo aparelho) */
export async function sincronizarInscricao() {
  if (!('serviceWorker' in navigator) || Notification?.permission !== 'granted') return;
  const reg = await navigator.serviceWorker.getRegistration('/');
  const inscricao = await reg?.pushManager.getSubscription();
  if (inscricao) await gravarInscricao(inscricao).catch(() => undefined);
}

/** Para de receber neste aparelho (cancela no navegador e no servidor) */
export async function desativarPushNesteAparelho() {
  const reg = await navigator.serviceWorker?.getRegistration('/');
  const inscricao = await reg?.pushManager.getSubscription();
  if (!inscricao) return;
  await supabase.rpc('push_unsubscribe', { p_id: null, p_endpoint: inscricao.endpoint });
  await inscricao.unsubscribe();
}

export async function endpointDesteAparelho() {
  const reg = await navigator.serviceWorker?.getRegistration('/');
  return (await reg?.pushManager.getSubscription())?.endpoint ?? null;
}

// ---------------------------------------------------------------- preferências e aparelhos
export interface PreferenciasNotificacao {
  categories: Record<string, boolean>;
  muted_until: string | null;
  quiet_start: string | null;
  quiet_end: string | null;
  timezone: string;
  show_names: boolean;
}
export const PREFERENCIAS_PADRAO: PreferenciasNotificacao = { categories: {}, muted_until: null, quiet_start: null, quiet_end: null, timezone: 'America/Sao_Paulo', show_names: false };

export async function lerPreferencias(me: string): Promise<PreferenciasNotificacao> {
  const { data } = await supabase.from('notification_preferences').select('categories, muted_until, quiet_start, quiet_end, timezone, show_names').eq('user_id', me).maybeSingle();
  if (!data) return { ...PREFERENCIAS_PADRAO, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Sao_Paulo' };
  return { ...PREFERENCIAS_PADRAO, ...data, quiet_start: data.quiet_start?.slice(0, 5) ?? null, quiet_end: data.quiet_end?.slice(0, 5) ?? null } as PreferenciasNotificacao;
}

export async function salvarPreferencias(p: PreferenciasNotificacao) {
  const { error } = await supabase.rpc('save_notification_preferences', { p });
  if (error) throw error;
}

export interface Aparelho { id: string; device_label: string | null; created_at: string; updated_at: string; last_success_at: string | null; active: boolean; endpoint_tail: string }
export async function meusAparelhos(): Promise<Aparelho[]> {
  const { data, error } = await supabase.rpc('my_push_devices');
  if (error) throw error;
  return (data ?? []) as Aparelho[];
}
export async function removerAparelho(id: string) {
  const { error } = await supabase.rpc('push_unsubscribe', { p_id: id, p_endpoint: null });
  if (error) throw error;
}
