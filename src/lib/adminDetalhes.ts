// Ficha detalhada do usuário, registros de acesso e painel de publicações (ver setup.sql, seção 24).
// Limites da LGPD: sem orientação, preferências ou limites íntimos; mensagens só em contagem.
// Toda consulta fica no livro de auditoria.
import { supabase } from './supabase';

export interface FichaPublicacao {
  id: string; criada_em: string; texto: string | null; midias: number; tipo_midia: string | null;
  visibilidade: string; moderacao: string; curtidas: number; comentarios: number;
  salvamentos: number; denuncias: number; comunidade: string | null; enquete: boolean;
}

export interface FichaUsuario {
  conta: {
    email: string | null; email_confirmado_em: string | null; cadastro_em: string; ultimo_login_em: string | null;
    provedores: string[]; mfa_ativo: boolean; nascimento: string | null; maioridade_declarada_em: string | null;
    termos_aceitos_em: string | null; cidade_privada: string | null; sessoes_ativas: number; aparelhos_push: number;
    descadastrado_email: boolean;
  };
  perfil: {
    genero: string | null; tipo: string; bio: string | null; status_texto: string | null; modo_discreto: boolean;
    mostra_online: boolean; privacidade_local: string; tem_foto: boolean; username_alterado_em: string | null;
    atualizado_em: string | null; ultimo_acesso: string | null; parceiros_conjuntos: number;
  };
  crescimento: {
    fundador_numero: number | null; embaixador: boolean; vip_ate: string | null; destaque_ate: string | null;
    selos: string[]; codigo_convite: string | null; convidou_validos: number; convidou_total: number;
    convidado_por: string | null; recompensas: number;
  };
  atividade: Record<string, number>;
  denuncias: {
    recebidas: number; recebidas_abertas: number; recebidas_procedentes: number; feitas: number; feitas_arquivadas: number;
    por_categoria: Record<string, number>;
    ultimas: { categoria: string; alvo: string; status: string; prioridade: string; descricao: string; criada_em: string; denunciante: string | null }[];
  };
  historico_moderacao: { acao: string; motivo: string; em: string; por: string | null; papel: string }[];
  consultas_da_ficha: number;
  publicacoes: FichaPublicacao[];
}

export interface RegistrosAcesso {
  sessoes: { inicio: string; ultima_atividade: string; ip: string | null; aparelho: string | null; nivel: string; ativa: boolean }[];
  ips_distintos: number;
}

export interface PublicacaoPainel extends FichaPublicacao {
  autor_id: string; autor: string; autor_status: string; editada_em: string | null; midia: string | null;
  tags: string[]; local: string | null; votos_enquete: number; engajamento: number;
}

export interface PainelPublicacoes {
  periodo_dias: number;
  resumo: Record<string, number>;
  por_dia: { dia: string; publicacoes: number; comentarios: number; curtidas: number }[];
  por_hora: Record<string, number>;
  tags: { tag: string; n: number }[];
  autores_top: { id: string; username: string; publicacoes: number; curtidas: number; comentarios: number }[];
  publicacoes: PublicacaoPainel[];
}

const semFuncao = (e: { code?: string; message: string }) =>
  e.code === 'PGRST202' ? 'Esta função ainda não foi instalada no banco. Rode o setup.sql atualizado.' : e.message;

export async function fetchFichaUsuario(id: string): Promise<{ ficha: FichaUsuario | null; error: string | null }> {
  const { data, error } = await supabase.rpc('admin_user_dossier', { target: id });
  return error ? { ficha: null, error: semFuncao(error) } : { ficha: data as FichaUsuario, error: null };
}

export async function fetchRegistrosAcesso(id: string, justificativa: string): Promise<{ registros: RegistrosAcesso | null; error: string | null }> {
  const { data, error } = await supabase.rpc('admin_user_access_logs', { target: id, justification: justificativa });
  return error ? { registros: null, error: semFuncao(error) } : { registros: data as RegistrosAcesso, error: null };
}

export async function fetchPainelPublicacoes(dias: number): Promise<{ painel: PainelPublicacoes | null; error: string | null }> {
  const { data, error } = await supabase.rpc('admin_posts_overview', { dias });
  return error ? { painel: null, error: semFuncao(error) } : { painel: data as PainelPublicacoes, error: null };
}

export const dataHora = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

export const dataCurta = (iso: string | null | undefined) =>
  iso ? new Date(iso.length === 10 ? iso + 'T12:00:00' : iso).toLocaleDateString('pt-BR') : '—';

/** "há 3 dias" a partir de uma data ISO */
export const haQuanto = (iso: string | null | undefined) => {
  if (!iso) return '—';
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return 'agora';
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.round(h / 24);
  if (d < 31) return `há ${d} ${d === 1 ? 'dia' : 'dias'}`;
  const m = Math.round(d / 30);
  return m < 12 ? `há ${m} ${m === 1 ? 'mês' : 'meses'}` : `há ${Math.round(m / 12)} ano(s)`;
};

/** Aparelho legível a partir do user agent */
export const aparelhoLegivel = (ua: string | null) => {
  if (!ua) return 'Desconhecido';
  const so = /iPhone|iPad/.test(ua) ? 'iPhone/iPad' : /Android/.test(ua) ? 'Android' : /Windows/.test(ua) ? 'Windows' : /Mac OS/.test(ua) ? 'Mac' : /Linux/.test(ua) ? 'Linux' : 'Outro';
  const nav = /Edg\//.test(ua) ? 'Edge' : /SamsungBrowser/.test(ua) ? 'Samsung Internet' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'Navegador';
  return `${nav} · ${so}`;
};

export const VISIBILIDADE: Record<string, string> = { public: 'Pública', connections_only: 'Só conexões', followers: 'Seguidores', private: 'Privada' };
