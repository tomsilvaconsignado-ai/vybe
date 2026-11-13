// Crescimento (Convide e Ganhe, recompensas, fundadores, embaixadores, campanhas e Growth Center).
// Todas as regras (validação antifraude, recompensas, limites) ficam no banco (§16 do setup.sql).
import { supabase } from './supabase';

export type RewardKind = 'badge' | 'featured_days' | 'vip_days';

export interface Recompensa { id: string; threshold: number; kind: RewardKind; amount: number; label: string; achieved: boolean; badge?: string | null; active?: boolean }
export interface Concessao { label: string; kind: string; source: 'referral' | 'admin' | 'founder' | 'ambassador'; granted_at: string; expires_at: string | null }
export interface Convidado { display_name: string; username: string; avatar_url: string; status: 'pending' | 'valid' | 'rejected'; created_at: string }

export interface PainelConvite {
  code: string;
  visits: number; signups: number; pending: number; valid: number; rejected: number; active_referred: number;
  rewards: Recompensa[]; grants: Concessao[]; referrals: Convidado[];
  founder_number: number | null; ambassador: boolean; vip_until: string | null; featured_until: string | null;
  badges: string[]; show_in_ranking: boolean; rank_30d: number | null;
  share_message: string | null; rules: { daily_valid_cap?: number; return_hours?: number } | null;
}

export interface PosicaoRanking { pos: number; user_id: string; display_name: string; username: string; avatar_url: string; valid_count: number; ambassador: boolean }

export interface InfoPublica {
  founders: { status: 'active' | 'paused' | 'ended'; limit: number; taken: number; remaining: number; benefits: string[] } | null;
  campaigns: { slug: string; title: string; description: string; ends_at: string | null }[];
}

export interface Destaques {
  featured: string[]; couple_of_week: string | null; member_of_week: string | null; new_members: string[]; popular: string[];
}

const erro = (e: { message: string } | null) => (e ? e.message : null);

export async function meuPainel(): Promise<PainelConvite | null> {
  const { data, error } = await supabase.rpc('growth_my_panel');
  if (error) { console.error('[Vybelog] Convide e Ganhe:', error.message); return null; }
  return data as PainelConvite;
}

let codigoEmCache: string | null = null;
/** Código de convite da pessoa logada (para acrescentar aos links compartilhados) */
export async function meuCodigo(me: string): Promise<string | null> {
  if (codigoEmCache) return codigoEmCache;
  const { data } = await supabase.from('growth_codes').select('code, custom').eq('user_id', me).eq('active', true);
  const lista = (data ?? []) as { code: string; custom: boolean }[];
  const escolhido = lista.find(c => c.custom)?.code ?? lista[0]?.code;
  if (escolhido) return (codigoEmCache = escolhido);
  const painel = await meuPainel();
  return (codigoEmCache = painel?.code ?? null);
}
export const esquecerCodigo = () => { codigoEmCache = null; };

export async function ranking(periodo: '30d' | 'all', soEmbaixadores = false): Promise<PosicaoRanking[]> {
  const { data, error } = await supabase.rpc('growth_ranking', { p_period: periodo, p_ambassadors: soEmbaixadores });
  return error ? [] : (data as PosicaoRanking[]);
}

export async function definirVisibilidadeRanking(mostrar: boolean) {
  const { error } = await supabase.rpc('growth_set_ranking_visibility', { p_show: mostrar });
  return erro(error);
}

export async function infoPublica(): Promise<InfoPublica | null> {
  const { data, error } = await supabase.rpc('growth_public_info');
  return error ? null : (data as InfoPublica);
}

export async function registrarVisita(codigo: string) {
  await supabase.rpc('growth_track_visit', { p_code: codigo });
}

export async function destaques(): Promise<Destaques | null> {
  const { data, error } = await supabase.rpc('growth_highlights');
  return error ? null : (data as Destaques);
}

// ---------- Growth Center (administração) ----------
export interface EstatisticasCrescimento {
  users: number; new_1d: number; new_7d: number; new_30d: number; active_7d: number; returned: number;
  referrals_total: number; referrals_valid: number; referrals_pending: number; referrals_rejected: number;
  visits_30d: number; signups_ref_30d: number; grants_by_kind: Record<string, number>; founders: number; ambassadors: number;
  signups_series: { day: string; n: number; ref: number }[];
  top_referrers: { id: string; display_name: string; username: string; ambassador: boolean; valid: number; total: number }[];
  ambassador_list: { id: string; display_name: string; username: string; ambassador_since: string; custom_codes: string | null; total: number; valid: number; active: number }[];
  campaigns: { id: string; slug: string; title: string; description: string; starts_at: string; ends_at: string | null; active: boolean; signups: number; valid: number }[];
  recent_referrals: { referred_id: string; status: string; reason: string | null; created_at: string; referred_name: string; referred_username: string; referrer_name: string | null; referrer_username: string | null }[];
  rewards: (Recompensa & { badge: string | null; active: boolean })[];
  settings: {
    founders?: { status: 'active' | 'paused' | 'ended'; limit: number; benefits: string[] };
    share_message?: { text: string };
    referral_rules?: { daily_valid_cap: number; return_hours: number };
  };
}

export async function estatisticasCrescimento(): Promise<{ dados: EstatisticasCrescimento | null; erro: string | null }> {
  const { data, error } = await supabase.rpc('growth_admin_stats');
  return { dados: (data as EstatisticasCrescimento) ?? null, erro: erro(error) };
}

export async function salvarConfiguracao(chave: 'founders' | 'share_message' | 'referral_rules', valor: unknown, justificativa: string) {
  const { error } = await supabase.rpc('admin_growth_save_settings', { p_key: chave, p_value: valor, justification: justificativa });
  return erro(error);
}

export async function salvarRecompensa(r: { id?: string | null; threshold: number; kind: RewardKind; amount: number; badge?: string | null; label: string; active: boolean }, justificativa: string) {
  const { error } = await supabase.rpc('admin_growth_save_reward', {
    p_id: r.id ?? null, p_threshold: r.threshold, p_kind: r.kind, p_amount: r.amount, p_badge: r.badge ?? null, p_label: r.label, p_active: r.active, justification: justificativa
  });
  return erro(error);
}

export async function definirEmbaixador(userId: string, ativo: boolean, codigo: string, justificativa: string) {
  const { error } = await supabase.rpc('admin_growth_set_ambassador', { p_user: userId, p_on: ativo, p_custom_code: codigo || null, justification: justificativa });
  return erro(error);
}

export async function concederBeneficio(userId: string, tipo: 'vip_days' | 'featured_days', dias: number, rotulo: string, justificativa: string) {
  const { error } = await supabase.rpc('admin_growth_grant', { p_user: userId, p_kind: tipo, p_amount: dias, p_label: rotulo, justification: justificativa });
  return erro(error);
}

export async function recusarIndicacao(convidadoId: string, justificativa: string) {
  const { error } = await supabase.rpc('admin_growth_reject_referral', { p_referred: convidadoId, justification: justificativa });
  return erro(error);
}

export async function salvarCampanha(c: { id?: string | null; slug: string; title: string; description: string; starts_at?: string | null; ends_at?: string | null; active: boolean }, justificativa: string) {
  const { error } = await supabase.rpc('admin_growth_save_campaign', {
    p_id: c.id ?? null, p_slug: c.slug, p_title: c.title, p_description: c.description,
    p_starts: c.starts_at || null, p_ends: c.ends_at || null, p_active: c.active, justification: justificativa
  });
  return erro(error);
}

export const ROTULO_RECOMPENSA: Record<RewardKind, string> = { badge: 'Selo', featured_days: 'Destaque (dias)', vip_days: 'VIP (dias)' };
