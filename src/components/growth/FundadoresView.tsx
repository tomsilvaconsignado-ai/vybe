// Campanha Vybelog Fundadores: explicação, vagas restantes (contador real) e benefícios configurados.
import React, { useEffect, useState } from 'react';
import { CheckCircle2, Crown, Gift } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { infoPublica, type InfoPublica } from '../../lib/crescimento';

export const FundadoresView: React.FC = () => {
  const { currentUser, setActiveTab } = useApp();
  const [info, setInfo] = useState<InfoPublica | null>(null);
  useEffect(() => { infoPublica().then(setInfo); }, []);
  const f = info?.founders;
  const meu = currentUser.growth?.founderNumber;
  const pct = f ? Math.min(100, (f.taken / Math.max(1, f.limit)) * 100) : 0;

  return (
    <div className="max-w-2xl mx-auto py-6 px-4 space-y-6">
      <section className="relative overflow-hidden p-6 rounded-3xl bg-gradient-to-br from-amber-900/40 via-purple-950 to-rose-950/60 border border-amber-500/30 text-center">
        <Crown className="w-14 h-14 mx-auto text-amber-300 drop-shadow-[0_0_18px_rgba(251,191,36,0.4)]" />
        <h1 className="text-2xl font-extrabold text-white mt-3">Vybelog Fundadores</h1>
        <p className="text-sm text-zinc-300 mt-2 max-w-md mx-auto">As primeiras pessoas que constroem o Vybelog recebem o reconhecimento permanente de Membro Fundador.</p>
        {meu && <p className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-400/15 border border-amber-400/40 text-amber-200 text-sm font-bold"><Crown className="w-4 h-4" /> Você é o Fundador nº {meu}</p>}
      </section>

      {f && (
        <section className="p-5 rounded-3xl bg-[#120d20] border border-purple-900/30">
          {f.status === 'active' ? (
            <>
              <div className="flex justify-between items-baseline">
                <span className="text-sm font-bold text-white">Vagas restantes</span>
                <span className="text-3xl font-black text-amber-300 tabular-nums">{f.remaining.toLocaleString('pt-BR')}</span>
              </div>
              <div className="h-2.5 rounded-full bg-zinc-800 overflow-hidden mt-3"><div className="h-full bg-gradient-to-r from-amber-400 to-rose-500" style={{ width: `${pct}%` }} /></div>
              <p className="text-[11px] text-zinc-500 mt-1.5 tabular-nums">{f.taken.toLocaleString('pt-BR')} de {f.limit.toLocaleString('pt-BR')} fundadores</p>
            </>
          ) : (
            <p className="text-sm text-zinc-300">{f.status === 'paused' ? 'A campanha está pausada no momento.' : 'As vagas de fundador foram preenchidas. Obrigado a cada pessoa que ajudou a construir o Vybelog!'}</p>
          )}
        </section>
      )}

      {f && f.benefits.length > 0 && (
        <section className="p-5 rounded-3xl bg-[#120d20] border border-purple-900/30">
          <h2 className="text-sm font-bold text-white mb-3">O que o Membro Fundador recebe</h2>
          <ul className="space-y-2">
            {f.benefits.map((b, i) => <li key={i} className="flex items-start gap-2 text-sm text-zinc-300"><CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />{b}</li>)}
          </ul>
          <p className="text-[11px] text-zinc-500 mt-3">O selo é concedido automaticamente às contas com e-mail confirmado, por ordem de cadastro, até o limite de vagas.</p>
        </section>
      )}

      {f?.status === 'active' && (
        <button type="button" onClick={() => setActiveTab('invite')} className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-purple-600 to-rose-600 text-white font-bold flex items-center justify-center gap-2 cursor-pointer">
          <Gift className="w-5 h-5" /> Convidar amigos enquanto há vagas
        </button>
      )}
    </div>
  );
};
