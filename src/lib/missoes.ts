// Missões e sequência de dias (§25 do setup.sql). O banco calcula tudo a partir das ações reais
// e grava conclusões e prêmios; o app só mostra o progresso e avisa quando algo pode ter mudado.
import { supabase } from './supabase';

export interface ItemMissao { chave: string; feito: boolean; progresso: number; meta: number }
export interface Missoes {
  boas_vindas: { recompensa_recebida: boolean; itens: ItemMissao[] };
  hoje: { concluido: boolean; itens: ItemMissao[] };
  sequencia: { atual: number; melhor: number; hoje_contou: boolean; proxima_meta: number | null; premio_proxima: number | null };
  novidade: { tipo: 'boas_vindas' | 'dia'; sequencia?: number; dias_destaque: number } | null;
}

export async function minhasMissoes(): Promise<Missoes | null> {
  const { data, error } = await supabase.rpc('my_missions');
  if (error) {
    // banco ainda sem a seção 25: o cartão simplesmente não aparece
    if (!/my_missions|PGRST202/.test(error.message)) console.error('[Vybelog] Missões:', error.message);
    return null;
  }
  return data as Missoes;
}

const EVENTO = 'vybe:missao';
/** Avisa que uma ação (curtida, comentário, publicação, seguir, perfil) pode ter avançado as missões */
export const avisarAcaoMissao = () => { try { window.dispatchEvent(new Event(EVENTO)); } catch { /* fora do navegador */ } };
export const aoAcaoMissao = (fn: () => void) => {
  window.addEventListener(EVENTO, fn);
  return () => window.removeEventListener(EVENTO, fn);
};
