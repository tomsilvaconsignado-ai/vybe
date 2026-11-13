// Janela de publicidade: durante o uso, revezando entre os anúncios ativos que a administração marcou
// como "Exibir na janela de publicidade" (com imagem). Frequência ajustável no painel (intervalo em
// minutos e limite por acesso). Nunca junto com a janela da campanha de convite, nunca enquanto a
// pessoa digita, com o app em segundo plano ou com outra janela aberta.
import React, { useEffect, useRef, useState } from 'react';
import { ExternalLink, X } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { lerFrequenciaAnuncios, recordAdClick, recordAdImpression } from '../../lib/events';
import { proximoDoRevezamento, publicidadeLiberada } from '../../lib/janelas';
import type { Ad } from '../../types';

const CHAVE_QTD = 'vybe.popup.anuncio.qtd';
const INTERVALO_DEPOIS_DO_CONVITE = 45_000;   // espaço de tempo depois de fechar a janela de convite
const ESPERA_INICIAL = 20_000;                // nunca logo ao entrar
const linkSeguro = (u?: string) => (u && /^https:\/\//i.test(u) ? u : undefined);
const exibidasNestaSessao = () => { try { return Number(sessionStorage.getItem(CHAVE_QTD) ?? 0) || 0; } catch { return 0; } };
const digitando = () => {
  const el = document.activeElement as HTMLElement | null;
  return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
};

export const AnuncioPopup: React.FC = () => {
  const { ads, currentUser, openPostId, isAdminMode } = useApp();
  const [anuncio, setAnuncio] = useState<Ad | null>(null);
  const [freq, setFreq] = useState({ intervalMin: 3, maxPorAcesso: 6 });
  const ultimaFechada = useRef(0);
  const inicio = useRef(Date.now());
  const aberto = useRef(false);

  useEffect(() => { if (currentUser.id) lerFrequenciaAnuncios().then(setFreq); }, [currentUser.id]);

  useEffect(() => {
    if (!currentUser.id) return;
    const relogio = window.setInterval(() => {
      if (aberto.current || isAdminMode || openPostId) return;
      // só os anúncios que a administração escolheu para a janela (e que têm imagem)
      const elegiveis = ads.filter(a => a.showInPopup && a.imageUrl);
      if (!elegiveis.length || exibidasNestaSessao() >= freq.maxPorAcesso) return;
      const agora = Date.now();
      if (agora - inicio.current < ESPERA_INICIAL) return;
      if (ultimaFechada.current && agora - ultimaFechada.current < freq.intervalMin * 60_000) return;
      if (!publicidadeLiberada(INTERVALO_DEPOIS_DO_CONVITE, agora)) return;
      if (document.visibilityState !== 'visible' || digitando() || document.querySelector('[aria-modal="true"]')) return;
      const a = elegiveis[proximoDoRevezamento(elegiveis.length)];
      if (!a) return;
      aberto.current = true;
      setAnuncio(a);
      recordAdImpression(a.id);
      try { sessionStorage.setItem(CHAVE_QTD, String(exibidasNestaSessao() + 1)); } catch { /* sem armazenamento */ }
    }, 3000);
    return () => window.clearInterval(relogio);
  }, [ads, currentUser.id, freq, isAdminMode, openPostId]);

  const fechar = () => { aberto.current = false; ultimaFechada.current = Date.now(); setAnuncio(null); };

  useEffect(() => {
    if (!anuncio) return;
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') fechar(); };
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [anuncio]);

  if (!anuncio) return null;
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
