// Avaliação do aplicativo: campanhas lançadas pela administração (§28 do setup.sql).
// O membro responde uma vez por campanha (estrelas de 1 a 5 e comentário opcional, ou "não quero avaliar");
// a equipe vê o resumo e os comentários no painel.
import { supabase } from './supabase';

export interface CampanhaAvaliacao { id: string; title: string; message: string }

export interface ResumoCampanha {
  id: string; title: string; message: string;
  starts_at: string; ends_at: string | null; closed_at: string | null;
  rated: number; declined: number; comments: number; average: number | null;
  /** quantidade por nota: [1★, 2★, 3★, 4★, 5★] */
  dist: [number, number, number, number, number];
}

export interface AvaliacaoRecebida {
  id: string; user_id: string; username: string; display_name: string; avatar_url: string;
  stars: number; comment: string | null; created_at: string;
}

export const ROTULO_ESTRELAS = ['', 'Ruim', 'Pode melhorar', 'Bom', 'Muito bom', 'Excelente!'] as const;
export const LIMITE_COMENTARIO = 500;

const erro = (e: { message: string } | null) => e?.message ?? null;

export async function campanhaAtual(): Promise<CampanhaAvaliacao | null> {
  const { data, error } = await supabase.rpc('rating_campaign_current');
  return error ? null : ((data as CampanhaAvaliacao | null) ?? null);
}

/** estrelas null = "não quero avaliar" */
export async function responderAvaliacao(campanha: string, estrelas: number | null, comentario?: string): Promise<string | null> {
  const { error } = await supabase.rpc('rating_respond', { p_campaign: campanha, p_stars: estrelas, p_comment: comentario?.trim() || null });
  return erro(error);
}

/** Campanha aberta = não encerrada e dentro do prazo */
export const campanhaAberta = (c: ResumoCampanha, agora = Date.now()) =>
  !c.closed_at && (!c.ends_at || new Date(c.ends_at).getTime() > agora);

export async function listarCampanhas(): Promise<ResumoCampanha[]> {
  const { data, error } = await supabase.rpc('admin_rating_campaigns');
  if (error || !data) return [];
  return (data as Record<string, unknown>[]).map(c => ({
    id: String(c.id), title: String(c.title), message: String(c.message ?? ''),
    starts_at: String(c.starts_at), ends_at: (c.ends_at as string) ?? null, closed_at: (c.closed_at as string) ?? null,
    rated: Number(c.rated), declined: Number(c.declined), comments: Number(c.comments),
    average: c.average === null ? null : Number(c.average),
    dist: [Number(c.s1), Number(c.s2), Number(c.s3), Number(c.s4), Number(c.s5)]
  }));
}

export async function listarAvaliacoes(campanha: string): Promise<AvaliacaoRecebida[]> {
  const { data, error } = await supabase.rpc('admin_rating_list', { p_campaign: campanha });
  return error ? [] : ((data as AvaliacaoRecebida[]) ?? []).map(a => ({ ...a, stars: Number(a.stars) }));
}

export async function lancarCampanha(titulo: string, mensagem: string, encerraEm: string | null, justificativa: string): Promise<string | null> {
  const { error } = await supabase.rpc('admin_rating_launch', {
    p_title: titulo.trim(), p_message: mensagem.trim(), p_ends_at: encerraEm ? new Date(encerraEm).toISOString() : null, justification: justificativa.trim()
  });
  return erro(error);
}

export async function encerrarCampanha(id: string, justificativa: string): Promise<string | null> {
  const { error } = await supabase.rpc('admin_rating_close', { p_id: id, justification: justificativa });
  return erro(error);
}
