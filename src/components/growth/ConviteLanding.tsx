// Página inicial (sem login): aviso de convite recebido e vagas da campanha Fundadores (contador real).
import React, { useEffect, useState } from 'react';
import { Crown, Gift } from 'lucide-react';
import { conviteGuardado } from '../../lib/convite';
import { infoPublica, type InfoPublica } from '../../lib/crescimento';

export const ConviteLanding: React.FC<{ aoCadastrar: () => void }> = ({ aoCadastrar }) => {
  const [info, setInfo] = useState<InfoPublica | null>(null);
  const convidado = !!conviteGuardado();
  useEffect(() => { infoPublica().then(setInfo); }, []);
  const f = info?.founders;
  const vagas = f?.status === 'active' && f.remaining > 0;
  if (!convidado && !vagas) return null;
  return (
    <div className="max-w-xl mx-auto lg:mx-0 p-4 rounded-2xl bg-gradient-to-r from-amber-900/30 via-purple-900/40 to-rose-900/30 border border-amber-500/30 text-left flex items-center gap-3">
      {convidado ? <Gift className="w-8 h-8 text-fuchsia-300 shrink-0" /> : <Crown className="w-8 h-8 text-amber-300 shrink-0" />}
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-bold text-white">{convidado ? 'Você recebeu um convite para o Vybelog' : 'Campanha Vybelog Fundadores'}</span>
        <span className="block text-xs text-zinc-300">
          {vagas ? `Restam ${f!.remaining.toLocaleString('pt-BR')} vagas de Membro Fundador, com selo permanente no perfil.` : 'Crie sua conta gratuita e comece a se conectar.'}
        </span>
      </span>
      <button type="button" onClick={aoCadastrar} className="shrink-0 px-4 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-rose-600 text-white text-xs font-bold cursor-pointer">Criar conta</button>
    </div>
  );
};
