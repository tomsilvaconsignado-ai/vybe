// Aviso para quem está sem foto de perfil: qualquer selo (VIP, Fundador, Embaixador, Destaque,
// Indicador) só aparece com foto. Se a pessoa já tem selo reservado, o aviso diz qual.
import React from 'react';
import { Camera, Gem } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { temFotoPropria } from '../../lib/profiles';

export const PEDIDO_EDITAR_PERFIL = 'vybe.abrirEdicaoPerfil';

export const AvisoSeloFoto: React.FC<{ className?: string; onColocarFoto?: () => void }> = ({ className = '', onColocarFoto }) => {
  const { currentUser, setActiveTab } = useApp();
  if (!currentUser.id || temFotoPropria(currentUser.avatarUrl)) return null;

  const g = currentUser.growth;
  const reservados = [
    g?.vip && 'VIP',
    g?.founderNumber && `Fundador nº ${g.founderNumber}`,
    g?.ambassador && 'Embaixador',
    g?.featured && 'Destaque',
    g?.badges?.includes('indicador') && 'Indicador'
  ].filter(Boolean) as string[];

  const colocarFoto = () => {
    if (onColocarFoto) { onColocarFoto(); return; }
    try { sessionStorage.setItem(PEDIDO_EDITAR_PERFIL, '1'); } catch { /* sem armazenamento */ }
    setActiveTab('profile');
  };

  return (
    <div role="note" className={`p-3.5 rounded-2xl border bg-gradient-to-r from-amber-500/15 via-fuchsia-600/10 to-purple-700/15 border-amber-400/50 flex items-start gap-3 ${className}`}>
      <span className="w-10 h-10 rounded-xl bg-amber-400/20 text-amber-200 flex items-center justify-center shrink-0">
        {reservados.length ? <Gem className="w-5 h-5" /> : <Camera className="w-5 h-5" />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-white">
          {reservados.length
            ? `Seu selo ${reservados.join(', ')} está esperando a sua foto!`
            : 'Coloque foto no perfil e receba selo VIP ou qualquer outro selo'}
        </p>
        <p className="text-[12px] text-zinc-300 mt-0.5">
          {reservados.length
            ? 'Perfis sem foto não exibem selos. Coloque sua foto de perfil e o selo aparece na hora.'
            : 'Selos de VIP, Fundador, Destaque, Embaixador e Indicador só aparecem em perfis com foto.'}
        </p>
        <button type="button" onClick={colocarFoto}
          className="mt-2 px-3.5 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-black text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer">
          <Camera className="w-3.5 h-3.5" /> Colocar foto agora
        </button>
      </div>
    </div>
  );
};
