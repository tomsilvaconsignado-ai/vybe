// Janela de publicidade: uma vez a cada acesso, revezando entre os anúncios ativos (com imagem) do
// módulo Publicidade. Aparece só depois de um intervalo desde a janela da campanha de convite.
import React, { useEffect, useRef, useState } from 'react';
import { ExternalLink, X } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { recordAdClick, recordAdImpression } from '../../lib/events';
import { proximoDoRevezamento, publicidadeLiberada } from '../../lib/janelas';
import type { Ad } from '../../types';

const CHAVE_SESSAO = 'vybe.popup.anuncio';
const INTERVALO_DEPOIS_DO_CONVITE = 45_000;   // espaço de tempo depois de fechar a janela de convite
const ESPERA_INICIAL = 20_000;                // nunca logo ao entrar
const linkSeguro = (u?: string) => (u && /^https:\/\//i.test(u) ? u : undefined);

export const AnuncioPopup: React.FC = () => {
  const { ads, currentUser, openPostId, isAdminMode } = useApp();
  const [anuncio, setAnuncio] = useState<Ad | null>(null);
  const escolhido = useRef(false);

  useEffect(() => {
    if (!currentUser.id || escolhido.current) return;
    try { if (sessionStorage.getItem(CHAVE_SESSAO) === '1') return; } catch { /* sem armazenamento */ }
    const comImagem = ads.filter(a => a.imageUrl);
    if (!comImagem.length) return;
    const inicio = Date.now();
    const relogio = window.setInterval(() => {
      if (Date.now() - inicio < ESPERA_INICIAL || !publicidadeLiberada(INTERVALO_DEPOIS_DO_CONVITE)) return;
      if (document.querySelector('[aria-modal="true"]')) return;   // outra janela aberta: espera
      window.clearInterval(relogio);
      escolhido.current = true;
      const a = comImagem[proximoDoRevezamento(comImagem.length)] ?? null;
      if (a) { setAnuncio(a); recordAdImpression(a.id); }
      try { sessionStorage.setItem(CHAVE_SESSAO, '1'); } catch { /* sem armazenamento */ }
    }, 3000);
    return () => window.clearInterval(relogio);
  }, [ads, currentUser.id]);

  useEffect(() => {
    if (!anuncio) return;
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setAnuncio(null); };
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [anuncio]);

  if (!anuncio || openPostId || isAdminMode) return null;
  const fechar = () => setAnuncio(null);
  const link = linkSeguro(anuncio.linkUrl);

  return (
    <div className="modal-overlay fixed inset-0 z-[55] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4" onClick={fechar}
      role="dialog" aria-modal="true" aria-label={`Publicidade: ${anuncio.title}`}>
      <div className="relative w-full max-w-sm overflow-hidden rounded-3xl border border-purple-700/40 bg-[#120b1f] shadow-2xl" onClick={e => e.stopPropagation()}>
        <button type="button" onClick={fechar} aria-label="Fechar publicidade"
          className="absolute top-3 right-3 z-10 w-10 h-10 rounded-full bg-black/70 hover:bg-black text-white flex items-center justify-center border border-white/20 cursor-pointer">
          <X className="w-5 h-5" />
        </button>
        <span className="absolute top-3 left-3 z-10 px-2 py-0.5 rounded-full bg-black/60 text-[10px] font-bold uppercase tracking-wider text-zinc-200">Publicidade</span>
        <img src={anuncio.imageUrl} alt={anuncio.title} className="w-full max-h-[55vh] object-cover bg-black" />
        <div className="p-5 space-y-3">
          <div>
            <p className="text-[11px] font-semibold text-zinc-400">{anuncio.advertiser}</p>
            <h2 className="text-lg font-bold text-white leading-snug">{anuncio.title}</h2>
            {anuncio.body && <p className="text-sm text-zinc-300 mt-1 whitespace-pre-line line-clamp-4">{anuncio.body}</p>}
          </div>
          {link && (
            <a href={link} target="_blank" rel="noopener noreferrer sponsored" onClick={() => { recordAdClick(anuncio.id); fechar(); }}
              className="w-full py-3 rounded-2xl bg-gradient-to-r from-fuchsia-600 via-pink-600 to-orange-600 text-white text-sm font-bold flex items-center justify-center gap-2">
              {anuncio.ctaLabel || 'Saiba mais'} <ExternalLink className="w-4 h-4" />
            </a>
          )}
          <button type="button" onClick={fechar} className="w-full py-2.5 rounded-2xl bg-zinc-800 hover:bg-zinc-700 text-sm font-semibold text-zinc-200 cursor-pointer">Fechar</button>
        </div>
      </div>
    </div>
  );
};
