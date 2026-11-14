// Rótulos em português para os códigos que o painel administrativo recebe do banco
import type { AdminMediaRecord, ModerationReport, ProfileType, UserAccountStatus } from '../types';

export const PRIORIDADE: Record<ModerationReport['priority'], string> = { urgent: 'Urgente', high: 'Alta', medium: 'Média', low: 'Baixa' };
export const PESO_PRIORIDADE: Record<ModerationReport['priority'], number> = { urgent: 0, high: 1, medium: 2, low: 3 };

export const ALVO_DENUNCIA: Record<ModerationReport['targetType'], string> = { profile: 'Perfil', post: 'Publicação', media: 'Mídia', message: 'Mensagem' };

export const CATEGORIA_DENUNCIA: Record<ModerationReport['category'], string> = {
  unsolicited_explicit: 'Conteúdo íntimo sem consentimento',
  underage_suspicion: 'Suspeita de menor de 18 anos',
  fake_profile: 'Perfil falso ou fotos de terceiros',
  harassment: 'Assédio ou insistência',
  non_consensual: 'Coerção ou violação de consentimento',
  scam: 'Spam ou golpe'
};

export const SITUACAO_DENUNCIA: Record<ModerationReport['status'], string> = { pending: 'Pendente', under_review: 'Em análise', resolved: 'Resolvida', dismissed: 'Arquivada' };

export const SITUACAO_CONTA: Record<UserAccountStatus, string> = { active: 'Ativa', warned: 'Advertida', restricted: 'Restrita', suspended: 'Suspensa', blocked: 'Bloqueada' };

export const SITUACAO_MIDIA: Record<AdminMediaRecord['status'], string> = { approved: 'Aprovada', pending_review: 'Em análise', flagged: 'Sinalizada', removed: 'Removida' };

export const TIPO_PERFIL: Record<ProfileType, string> = {
  couple: 'Casal', single_female: 'Mulher', single_male: 'Homem', single_other: 'Pessoa solteira',
  joint_profile: 'Perfil conjunto', polyamorous: 'Poliamor'
};

export const PAPEL_ADMIN: Record<'superadmin' | 'moderator' | 'support' | 'auditor', string> = {
  superadmin: 'Superadministrador', moderator: 'Moderador', support: 'Suporte (leitura)', auditor: 'Auditor (leitura)'
};

/** Código de ação da auditoria ("ads_popup_frequency") em texto legível ("Ads popup frequency") */
export const acaoLegivel = (acao: string) => {
  const t = acao.replace(/[_.:-]+/g, ' ').trim();
  return t ? t[0].toUpperCase() + t.slice(1) : acao;
};

/** Cores do selo por situação (texto + fundo + borda), sempre com o texto escrito ao lado */
export const TOM = {
  ok: 'bg-emerald-950 text-emerald-300 border border-emerald-800',
  alerta: 'bg-amber-950 text-amber-300 border border-amber-800',
  perigo: 'bg-rose-950 text-rose-300 border border-rose-800',
  neutro: 'bg-zinc-800 text-zinc-300 border border-zinc-700'
} as const;
