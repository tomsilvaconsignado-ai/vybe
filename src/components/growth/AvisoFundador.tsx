// Aviso do cadastro: o selo de Membro Fundador exige foto de perfil (regra garantida no banco, §17).
// Aparece em todas as etapas enquanto a campanha estiver ativa; na etapa da foto, em destaque.
import React, { useEffect, useState } from 'react';
import { Camera, Crown } from 'lucide-react';
import { infoPublica, type InfoPublica } from '../../lib/crescimento';

export const AvisoFundador: React.FC<{ destaque?: boolean }> = ({ destaque }) => {
  const [info, setInfo] = useState<InfoPublica | null>(null);
  useEffect(() => { infoPublica().then(setInfo); }, []);
  const f = info?.founders;
  if (!f || f.status !== 'active' || f.remaining <= 0) return null;
  return (
    <div role="note" className={`mb-5 p-3 rounded-2xl border flex items-start gap-2.5 ${destaque
      ? 'bg-gradient-to-r from-amber-500/20 to-orange-500/15 border-amber-400/60'
      : 'bg-amber-500/10 border-amber-500/30'}`}>
      <Crown className="w-5 h-5 text-amber-300 shrink-0 mt-0.5" />
      <p className="text-[11px] leading-relaxed text-amber-100">
        <strong className="text-amber-200">Campanha Fundadores: restam {f.remaining.toLocaleString('pt-BR')} vagas.</strong>{' '}
        Para ganhar o selo de <strong>Membro Fundador</strong> é obrigatório ter <strong className="inline-flex items-center gap-0.5"><Camera className="w-3 h-3" /> foto no perfil</strong> (além de confirmar o e-mail).
        {destaque && ' Assim que confirmar o e-mail, coloque sua foto em Meu Perfil → Editar.'}
      </p>
    </div>
  );
};
