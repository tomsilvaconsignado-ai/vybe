// Selos do programa de crescimento: Fundador nº X, Embaixador, VIP, Destaque e Indicador.
import React from 'react';
import { Crown, Gem, Gift, Megaphone, Sparkles } from 'lucide-react';
import type { ProfileGrowth } from '../../types';

interface Selo { chave: string; rotulo: string; curto: string; icone: React.ReactNode; cor: string; dica: string }

export function selosDoPerfil(g: ProfileGrowth | undefined): Selo[] {
  if (!g) return [];
  const selos: Selo[] = [];
  if (g.founderNumber && g.hasPhoto) selos.push({ chave: 'fundador', rotulo: `Fundador nº ${g.founderNumber}`, curto: 'Fundador', icone: <Crown className="w-3 h-3" />,
    cor: 'bg-amber-500/15 text-amber-200 border-amber-400/40', dica: 'Uma das primeiras pessoas a construir o Vybelog' });
  if (g.ambassador) selos.push({ chave: 'embaixador', rotulo: 'Embaixador', curto: 'Embaixador', icone: <Megaphone className="w-3 h-3" />,
    cor: 'bg-fuchsia-500/15 text-fuchsia-200 border-fuchsia-400/40', dica: 'Embaixador oficial do Vybelog' });
  if (g.vip) selos.push({ chave: 'vip', rotulo: 'VIP', curto: 'VIP', icone: <Gem className="w-3 h-3" />,
    cor: 'bg-gradient-to-r from-amber-400/20 to-rose-500/20 text-amber-100 border-amber-300/40', dica: 'Membro VIP' });
  if (g.featured) selos.push({ chave: 'destaque', rotulo: 'Em destaque', curto: 'Destaque', icone: <Sparkles className="w-3 h-3" />,
    cor: 'bg-purple-500/15 text-purple-200 border-purple-400/40', dica: 'Perfil em destaque no Descobrir' });
  if (g.badges.includes('indicador')) selos.push({ chave: 'indicador', rotulo: 'Indicador', curto: 'Indicador', icone: <Gift className="w-3 h-3" />,
    cor: 'bg-emerald-500/15 text-emerald-200 border-emerald-400/40', dica: 'Trouxe 5 ou mais pessoas para o Vybelog' });
  return selos;
}

export const GrowthBadges: React.FC<{ growth?: ProfileGrowth; compacto?: boolean; max?: number; className?: string }> = ({ growth, compacto, max, className = '' }) => {
  const selos = selosDoPerfil(growth).slice(0, max ?? 10);
  if (!selos.length) return null;
  return (
    <div className={`flex flex-wrap items-center gap-1 ${className}`}>
      {selos.map(s => (
        <span key={s.chave} title={s.dica}
          className={`inline-flex items-center gap-1 rounded-full border font-bold ${compacto ? 'px-1.5 py-0.5 text-[9px]' : 'px-2 py-0.5 text-[10px]'} ${s.cor}`}>
          {s.icone}{compacto ? s.curto : s.rotulo}
        </span>
      ))}
    </div>
  );
};
