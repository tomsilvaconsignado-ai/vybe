// Janela de publicidade: durante o uso, revezando entre os anúncios ativos que a administração marcou
// como "Exibir na janela de publicidade" (com imagem) e, se ligado no painel, os eventos da agenda
// (os em destaque; sem destaque, os próximos). Frequência, limite por acesso e espera inicial ajustáveis
// no painel. Nunca junto com a janela da campanha de convite, nunca enquanto a pessoa digita, com o app
// em segundo plano ou com outra janela aberta.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarHeart, ExternalLink, MapPin, X } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { FREQUENCIA_PADRAO, formatEventDate, lerFrequenciaAnuncios, recordAdClick, recordAdImpression } from '../../lib/events';
import { proximoDoRevezamento, publicidadeLiberada } from '../../lib/janelas';
import type { Ad, VybeEvent } from '../../types';

type Item = { tipo: 'anuncio'; anuncio: Ad } | { tipo: 'evento'; evento: VybeEvent };

const CHAVE_QTD = 'vybe.popup.anuncio.qtd';
const INTERVALO_DEPOIS_DO_CONVITE = 30_000;   // espaço de tempo depois de fechar a janela de convite
const EVENTOS_SEM_DESTAQUE = 3;               // sem evento em destaque, entram os próximos da agenda
const linkSeguro = (u?: string) => (u && /^https:\/\//i.test(u) ? u : undefined);
const exibidasNestaSessao = () => { try { return Number(sessionStorage.getItem(CHAVE_QTD) ?? 0) || 0; } catch { return 0; } };
const digitando = () => {
  const el = document.activeElement as HTMLElement | null;
  return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
};

/** Eventos que entram na janela: aprovados e ainda por acontecer; os em destaque, ou os próximos */
export function eventosDaJanela(eventos: VybeEvent[], agora = Date.now()): VybeEvent[] {
  const futuros = eventos
    .filter(e => e.status === 'approved' && new Date(e.endsAt ?? e.startsAt).getTime() > agora)
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
  const destaque = futuros.filter(e => e.isFeatured);
  return destaque.length ? destaque : futuros.slice(0, EVENTOS_SEM_DESTAQUE);
}

export const AnuncioPopup: React.FC = () => {
  const { ads, events, currentUser, openPostId, isAdminMode, setActiveTab, setSelectedEventId } = useApp();
  const [item, setItem] = useState<Item | null>(null);
  const [freq, setFreq] = useState(FREQUENCIA_PADRAO);
  const ultimaFechada = useRef(0);
  const inicio = useRef(Date.now());
  const aberto = useRef(false);

  useEffect(() => { if (currentUser.id) lerFrequenciaAnuncios().then(setFreq); }, [currentUser.id]);

  // anúncios escolhidos para a janela (com imagem) e, se ligado, os eventos da agenda
  const elegiveis = useMemo<Item[]>(() => [
    ...ads.filter(a => a.showInPopup && a.imageUrl).map(anuncio => ({ tipo: 'anuncio' as const, anuncio })),
    ...(freq.incluirEventos ? eventosDaJanela(events).map(evento => ({ tipo: 'evento' as const, evento })) : [])
  ], [ads, events, freq.incluirEventos]);

  useEffect(() => {
    if (!currentUser.id) return;
    const relogio = window.setInterval(() => {
      if (aberto.current || isAdminMode || openPostId) return;
      if (!elegiveis.length || exibidasNestaSessao() >= freq.maxPorAcesso) return;
      const agora = Date.now();
      if (agora - inicio.current < freq.esperaInicialS * 1000) return;
      if (ultimaFechada.current && agora - ultimaFechada.current < freq.intervalMin * 60_000) return;
      if (!publicidadeLiberada(INTERVALO_DEPOIS_DO_CONVITE, agora)) return;
      if (document.visibilityState !== 'visible' || digitando() || document.querySelector('[aria-modal="true"]')) return;
      const proximo = elegiveis[proximoDoRevezamento(elegiveis.length)];
      if (!proximo) return;
      aberto.current = true;
      setItem(proximo);
      if (proximo.tipo === 'anuncio') recordAdImpression(proximo.anuncio.id);
      try { sessionStorage.setItem(CHAVE_QTD, String(exibidasNestaSessao() + 1)); } catch { /* sem armazenamento */ }
    }, 3000);
    return () => window.clearInterval(relogio);
  }, [elegiveis, currentUser.id, freq, isAdminMode, openPostId]);

  const fechar = () => { aberto.current = false; ultimaFechada.current = Date.now(); setItem(null); };

  useEffect(() => {
    if (!item) return;
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') fechar(); };
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [item]);

  if (!item) return null;

  const botaoPrincipal = 'w-full py-3 rounded-2xl bg-gradient-to-r from-fuchsia-600 via-pink-600 to-orange-600 text-white text-sm font-bold flex items-center justify-center gap-2 cursor-pointer';
  const etiqueta = (texto: string) => (
    <span className="absolute top-3 left-3 z-10 px-2 py-0.5 rounded-full bg-black/60 text-[10px] font-bold uppercase tracking-wider text-zinc-200">{texto}</span>
  );

  let titulo: string;
  let corpo: React.ReactNode;
  if (item.tipo === 'anuncio') {
    const anuncio = item.anuncio;
    const link = linkSeguro(anuncio.linkUrl);
    titulo = `Publicidade: ${anuncio.title}`;
    corpo = (
      <>
        {etiqueta('Publicidade')}
        <img src={anuncio.imageUrl} alt={anuncio.title} className="w-full max-h-[55vh] object-cover bg-black" />
        <div className="p-5 space-y-3">
          <div>
            <p className="text-[12px] font-semibold text-zinc-400">{anuncio.advertiser}</p>
            <h2 className="text-lg font-bold text-white leading-snug">{anuncio.title}</h2>
            {anuncio.body && <p className="text-sm text-zinc-300 mt-1 whitespace-pre-line line-clamp-4">{anuncio.body}</p>}
          </div>
          {link && (
            <a href={link} target="_blank" rel="noopener noreferrer sponsored" onClick={() => { recordAdClick(anuncio.id); fechar(); }} className={botaoPrincipal}>
              {anuncio.ctaLabel || 'Saiba mais'} <ExternalLink className="w-4 h-4" />
            </a>
          )}
          <button type="button" onClick={fechar} className="w-full py-2.5 rounded-2xl bg-zinc-800 hover:bg-zinc-700 text-sm font-semibold text-zinc-200 cursor-pointer">Fechar</button>
        </div>
      </>
    );
  } else {
    const evento = item.evento;
    titulo = `Evento: ${evento.title}`;
    const verEvento = () => { fechar(); setActiveTab('events'); setSelectedEventId(evento.id); };
    corpo = (
      <>
        {etiqueta(evento.isFeatured ? 'Evento em destaque' : 'Próximo evento')}
        <img src={evento.coverUrl} alt={evento.title} className="w-full max-h-[50vh] object-cover bg-black" />
        <div className="p-5 space-y-3">
          <div>
            <p className="text-[12px] font-semibold text-fuchsia-300 flex items-center gap-1.5"><CalendarHeart className="w-3.5 h-3.5" />{formatEventDate(evento.startsAt)}</p>
            <h2 className="text-lg font-bold text-white leading-snug mt-0.5">{evento.title}</h2>
            <p className="text-sm text-zinc-300 mt-1 flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 shrink-0 text-zinc-400" /><span className="truncate">{evento.venueName} · {evento.city}/{evento.state}</span></p>
            {evento.goingCount > 0 && <p className="text-[12px] text-zinc-400 mt-1">{evento.goingCount} {evento.goingCount === 1 ? 'pessoa vai' : 'pessoas vão'}</p>}
          </div>
          <button type="button" onClick={verEvento} className={botaoPrincipal}>Ver evento</button>
          <button type="button" onClick={fechar} className="w-full py-2.5 rounded-2xl bg-zinc-800 hover:bg-zinc-700 text-sm font-semibold text-zinc-200 cursor-pointer">Agora não</button>
        </div>
      </>
    );
  }

  return (
    <div className="modal-overlay fixed inset-0 z-[55] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4" onClick={fechar}
      role="dialog" aria-modal="true" aria-label={titulo}>
      <div className="relative w-full max-w-sm overflow-hidden rounded-3xl border border-purple-700/40 bg-painel shadow-2xl" onClick={e => e.stopPropagation()}>
        <button type="button" onClick={fechar} aria-label="Fechar"
          className="absolute top-3 right-3 z-10 w-10 h-10 rounded-full bg-black/70 hover:bg-black text-white flex items-center justify-center border border-white/20 cursor-pointer">
          <X className="w-5 h-5" />
        </button>
        {corpo}
      </div>
    </div>
  );
};
