// Chamadas de convite em pontos estratégicos (feed, casais), discretas e dispensáveis por 7 dias.
import React, { useState } from 'react';
import { Gift, Heart, X } from 'lucide-react';
import { useApp } from '../../context/AppContext';

const CHAVE = 'vybe.convite.card';
const dispensadoAte = (variante: string) => { try { return Number(localStorage.getItem(`${CHAVE}.${variante}`) ?? 0); } catch { return 0; } };

export const ConviteCard: React.FC<{ variante?: 'amigos' | 'casal' }> = ({ variante = 'amigos' }) => {
  const { setActiveTab } = useApp();
  const [oculto, setOculto] = useState(() => dispensadoAte(variante) > Date.now());
  if (oculto) return null;
  const casal = variante === 'casal';
  const dispensar = () => {
    try { localStorage.setItem(`${CHAVE}.${variante}`, String(Date.now() + 7 * 24 * 60 * 60 * 1000)); } catch { /* sem armazenamento */ }
    setOculto(true);
  };
  return (
    <div className="relative p-4 rounded-3xl bg-gradient-to-r from-purple-900/50 via-fuchsia-900/30 to-rose-900/40 border border-purple-600/40 flex items-center gap-3">
      <span className="w-11 h-11 shrink-0 rounded-2xl bg-black/30 flex items-center justify-center">
        {casal ? <Heart className="w-6 h-6 text-rose-300" /> : <Gift className="w-6 h-6 text-fuchsia-300" />}
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-bold text-white">{casal ? 'Convide seu casal favorito' : 'Convide quem combina com o Vybelog'}</span>
        <span className="block text-xs text-zinc-300">{casal ? 'Quanto mais casais, mais conexões para todos. Ganhe recompensas por cada indicação.' : 'Ganhe selos, destaque e VIP a cada amigo que entrar pelo seu link.'}</span>
      </span>
      <button type="button" onClick={() => setActiveTab('invite')} className="shrink-0 px-3.5 py-2 rounded-xl bg-white text-black text-xs font-bold cursor-pointer">Convidar</button>
      <button type="button" onClick={dispensar} className="absolute top-1.5 right-1.5 p-1 rounded-full text-zinc-400 hover:text-white cursor-pointer" aria-label="Dispensar por 7 dias"><X className="w-3.5 h-3.5" /></button>
    </div>
  );
};
