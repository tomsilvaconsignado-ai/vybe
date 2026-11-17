// Interações nas mensagens do direct, como no WhatsApp:
//  - reagir com um emoji (um por pessoa; tocar no mesmo tira);
//  - responder a uma mensagem (inclusive bem lá atrás na conversa);
//  - responder só a um trecho selecionado do texto.
// No celular: segurar a mensagem abre o menu; arrastar para a direita responde.
// No computador: botões ao passar o mouse; selecionar um texto mostra "Responder trecho".
import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Copy, CornerUpLeft, Plus, TextSelect, X } from 'lucide-react';
import type { ChatMessage } from '../../types';
import { EmojiPicker } from '../common/EmojiPicker';
import { notify } from '../common/Feedback';
import { tipoDaMidia } from './ChatExtras';

export const REACOES_RAPIDAS = ['❤️', '😂', '😮', '😢', '🔥', '👍'];
export const LIMITE_TRECHO = 500;

export interface Resposta { msg: ChatMessage; trecho?: string }

/** Resumo de uma mensagem numa linha (texto ou o tipo da mídia) */
export function resumoDaMensagem(m?: ChatMessage) {
  if (!m) return 'Mensagem anterior';
  if (m.content?.trim()) return m.content.trim();
  if (!m.mediaUrl) return 'Mensagem';
  const t = tipoDaMidia(m.mediaUrl);
  return t === 'audio' ? '🎤 Áudio' : t === 'video' ? '🎬 Vídeo' : '📷 Foto';
}

// ---------------------------------------------------------------- citação dentro da bolha
export const CitacaoNaBolha: React.FC<{
  original?: ChatMessage; trecho?: string; autor: string; minha: boolean; aoAbrir: () => void;
}> = ({ original, trecho, autor, minha, aoAbrir }) => (
  <button
    type="button"
    onClick={e => { e.stopPropagation(); aoAbrir(); }}
    className={`mb-1.5 w-full min-w-[9rem] text-left rounded-xl border-l-4 px-2.5 py-1.5 cursor-pointer transition-colors ${
      minha ? 'bg-black/20 border-white/70 hover:bg-black/30' : 'bg-black/25 border-fuchsia-400 hover:bg-black/35'
    }`}
    aria-label={`Ver a mensagem respondida de ${autor}`}
  >
    <span className={`block text-[11px] font-bold ${minha ? 'text-white' : 'text-fuchsia-300'}`}>{autor}</span>
    <span className={`block text-xs line-clamp-3 whitespace-pre-wrap break-words ${minha ? 'text-white/85' : 'text-zinc-300'}`}>
      {trecho ? <>“{trecho}”</> : resumoDaMensagem(original)}
    </span>
  </button>
);

// ---------------------------------------------------------------- reações embaixo da bolha
export const ReacoesDaBolha: React.FC<{
  reacoes: Array<{ userId: string; emoji: string }>; eu: string; nomeDoOutro: string; minha: boolean; aoTocar: (emoji: string) => void;
}> = ({ reacoes, eu, nomeDoOutro, minha, aoTocar }) => {
  if (!reacoes.length) return null;
  const grupos = new Map<string, string[]>();
  for (const r of reacoes) grupos.set(r.emoji, [...(grupos.get(r.emoji) ?? []), r.userId]);
  return (
    <div className={`-mt-2 z-[1] flex gap-1 ${minha ? 'mr-2 justify-end' : 'ml-2'}`}>
      {[...grupos.entries()].map(([emoji, quem]) => {
        const minhaReacao = quem.includes(eu);
        const nomes = quem.map(u => (u === eu ? 'Você' : nomeDoOutro)).join(' e ');
        return (
          <button
            key={emoji}
            type="button"
            onClick={() => aoTocar(emoji)}
            title={`${nomes} ${quem.length > 1 ? 'reagiram' : 'reagiu'} ${emoji}${minhaReacao ? ' (toque para tirar a sua)' : ''}`}
            aria-label={`${nomes} ${quem.length > 1 ? 'reagiram' : 'reagiu'} ${emoji}`}
            className={`h-6 px-1.5 rounded-full border text-[13px] leading-none flex items-center gap-0.5 shadow cursor-pointer transition-transform active:scale-90 ${
              minhaReacao ? 'bg-purple-900 border-fuchsia-500/70' : 'bg-zinc-900 border-zinc-700'
            }`}
          >
            <span>{emoji}</span>
            {quem.length > 1 && <span className="text-[10px] font-bold text-zinc-200">{quem.length}</span>}
          </button>
        );
      })}
    </div>
  );
};

// ---------------------------------------------------------------- barra "Respondendo a..." acima do campo
export const BarraDeResposta: React.FC<{ resposta: Resposta; autor: string; aoCancelar: () => void }> = ({ resposta, autor, aoCancelar }) => (
  <div className="shrink-0 px-3 pt-2 bg-painel-alto border-t border-purple-900/30">
    <div className="flex items-stretch gap-2 rounded-2xl bg-zinc-900/90 border-l-4 border-fuchsia-500 pl-3 pr-1 py-1.5">
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-bold text-fuchsia-300 flex items-center gap-1">
          <CornerUpLeft className="w-3.5 h-3.5" />
          {resposta.trecho ? `Respondendo a um trecho de ${autor}` : `Respondendo a ${autor}`}
        </p>
        <p className="text-xs text-zinc-300 line-clamp-2 whitespace-pre-wrap break-words">
          {resposta.trecho ? <>“{resposta.trecho}”</> : resumoDaMensagem(resposta.msg)}
        </p>
      </div>
      <button type="button" onClick={aoCancelar} className="w-8 h-8 self-center shrink-0 rounded-full text-zinc-400 hover:text-white hover:bg-zinc-800 flex items-center justify-center cursor-pointer" aria-label="Cancelar resposta">
        <X className="w-4 h-4" />
      </button>
    </div>
  </div>
);

// ---------------------------------------------------------------- menu da mensagem (segurar / clique direito / botão)
export const MenuDaMensagem: React.FC<{
  msg: ChatMessage; minhaReacao?: string; podeInteragir: boolean;
  aoReagir: (emoji: string) => void; aoResponder: () => void; aoResponderTrecho: () => void; aoFechar: () => void;
}> = ({ msg, minhaReacao, podeInteragir, aoReagir, aoResponder, aoResponderTrecho, aoFechar }) => {
  const [maisEmojis, setMaisEmojis] = useState(false);
  // ao soltar o dedo depois de segurar, o navegador ainda gera um "clique": ele não pode fechar o menu recém-aberto
  const abertoEm = useRef(Date.now());
  const fecharPeloFundo = () => { if (Date.now() - abertoEm.current > 450) aoFechar(); };
  useEffect(() => {
    const f = (e: KeyboardEvent) => e.key === 'Escape' && aoFechar();
    window.addEventListener('keydown', f);
    return () => window.removeEventListener('keydown', f);
  }, [aoFechar]);
  const temTexto = Boolean(msg.content?.trim());
  const copiar = async () => {
    try { await navigator.clipboard.writeText(msg.content); notify('Mensagem copiada.'); } catch { notify('Não foi possível copiar.'); }
    aoFechar();
  };
  return createPortal(
    <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-[2px] flex items-end sm:items-center justify-center p-3" onClick={fecharPeloFundo} role="dialog" aria-label="Ações da mensagem">
      <div className="w-full max-w-sm space-y-2 animate-[menuSobe_.18s_ease-out]" onClick={e => e.stopPropagation()}>
        {/* prévia da mensagem */}
        <div className="rounded-2xl bg-zinc-900/95 border border-purple-900/40 px-3.5 py-2.5 text-sm text-zinc-100 max-h-36 overflow-y-auto whitespace-pre-wrap break-words">
          {resumoDaMensagem(msg)}
        </div>
        {podeInteragir && (
          <div className="relative">
            {maisEmojis && <EmojiPicker onPick={e => { aoReagir(e); aoFechar(); }} onClose={() => setMaisEmojis(false)} />}
            <div className="flex items-center justify-between gap-1 rounded-full bg-zinc-900 border border-purple-900/40 px-2 py-1.5 shadow-xl">
              {REACOES_RAPIDAS.map(e => (
                <button
                  key={e}
                  type="button"
                  onClick={() => { aoReagir(e); aoFechar(); }}
                  className={`w-10 h-10 rounded-full text-2xl flex items-center justify-center cursor-pointer transition-transform hover:scale-125 active:scale-95 ${minhaReacao === e ? 'bg-purple-800/80' : ''}`}
                  aria-label={minhaReacao === e ? `Tirar a reação ${e}` : `Reagir com ${e}`}
                >
                  {e}
                </button>
              ))}
              <button type="button" onClick={() => setMaisEmojis(v => !v)} className="w-10 h-10 rounded-full bg-zinc-800 text-zinc-300 hover:text-white flex items-center justify-center cursor-pointer" aria-label="Mais emojis">
                <Plus className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}
        <div className="rounded-2xl bg-zinc-900 border border-purple-900/40 overflow-hidden divide-y divide-purple-950/60 shadow-xl">
          {podeInteragir && (
            <button type="button" onClick={() => { aoResponder(); aoFechar(); }} className="w-full flex items-center gap-3 px-4 py-3 text-sm text-zinc-100 hover:bg-zinc-800 cursor-pointer">
              <CornerUpLeft className="w-5 h-5 text-fuchsia-300" />Responder
            </button>
          )}
          {podeInteragir && temTexto && (
            <button type="button" onClick={() => { aoResponderTrecho(); aoFechar(); }} className="w-full flex items-center gap-3 px-4 py-3 text-sm text-zinc-100 hover:bg-zinc-800 cursor-pointer">
              <TextSelect className="w-5 h-5 text-fuchsia-300" />Responder um trecho
            </button>
          )}
          {temTexto && (
            <button type="button" onClick={copiar} className="w-full flex items-center gap-3 px-4 py-3 text-sm text-zinc-100 hover:bg-zinc-800 cursor-pointer">
              <Copy className="w-5 h-5 text-zinc-400" />Copiar texto
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
};

// ---------------------------------------------------------------- escolher o trecho (celular e quem preferir)
export const EscolherTrecho: React.FC<{ msg: ChatMessage; autor: string; aoEscolher: (trecho?: string) => void; aoFechar: () => void }> = ({ msg, autor, aoEscolher, aoFechar }) => {
  const textoRef = useRef<HTMLParagraphElement>(null);
  const [trecho, setTrecho] = useState('');
  useEffect(() => {
    const mudou = () => {
      const sel = window.getSelection();
      const el = textoRef.current;
      if (!sel || !el || sel.isCollapsed || !el.contains(sel.anchorNode) || !el.contains(sel.focusNode)) { setTrecho(''); return; }
      setTrecho(sel.toString().trim().slice(0, LIMITE_TRECHO));
    };
    document.addEventListener('selectionchange', mudou);
    return () => document.removeEventListener('selectionchange', mudou);
  }, []);
  return createPortal(
    <div className="fixed inset-0 z-[60] bg-black/70 flex items-end sm:items-center justify-center p-3" onClick={aoFechar} role="dialog" aria-label="Escolher o trecho">
      <div className="w-full max-w-md rounded-3xl bg-painel-alto border border-purple-800/50 shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="px-4 pt-4 pb-2 flex items-start gap-2">
          <div className="flex-1">
            <p className="text-sm font-bold text-white">Responder um trecho</p>
            <p className="text-xs text-zinc-400">Selecione, na mensagem de {autor}, a parte que você quer responder.</p>
          </div>
          <button type="button" onClick={aoFechar} className="w-8 h-8 rounded-full text-zinc-400 hover:text-white hover:bg-zinc-800 flex items-center justify-center cursor-pointer" aria-label="Fechar"><X className="w-4 h-4" /></button>
        </div>
        <p ref={textoRef} className="mx-4 my-2 max-h-[45vh] overflow-y-auto rounded-2xl bg-zinc-800/90 px-3.5 py-3 text-[15px] leading-relaxed text-zinc-100 whitespace-pre-wrap break-words select-text [-webkit-user-select:text]">
          {msg.content}
        </p>
        <div className="px-4 pb-4 pt-1 space-y-2">
          <p className="text-xs min-h-4 text-fuchsia-300 line-clamp-2">{trecho ? <>Trecho: “{trecho}”</> : <span className="text-zinc-500">Dica: segure uma palavra e arraste as marcações.</span>}</p>
          <div className="flex gap-2">
            <button type="button" onClick={() => aoEscolher(undefined)} className="flex-1 py-2.5 rounded-full text-xs font-semibold text-zinc-200 bg-zinc-800 hover:bg-zinc-700 cursor-pointer">
              Mensagem inteira
            </button>
            <button type="button" disabled={!trecho} onClick={() => aoEscolher(trecho)} className="flex-1 py-2.5 rounded-full text-xs font-bold text-white bg-purple-600 hover:bg-purple-500 disabled:opacity-40 cursor-pointer">
              Responder trecho
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
};

// ---------------------------------------------------------------- computador: selecionar texto numa bolha
export interface SelecaoDeTrecho { msgId: string; texto: string; x: number; y: number }

/** Acompanha a seleção de texto dentro das bolhas (elementos com data-texto-msg="<id>") */
export function useSelecaoNasBolhas(container: React.RefObject<HTMLElement | null>, ativo: boolean) {
  const [selecao, setSelecao] = useState<SelecaoDeTrecho | null>(null);
  useEffect(() => {
    if (!ativo) { setSelecao(null); return; }
    const ler = () => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || !sel.rangeCount) { setSelecao(null); return; }
      const bolha = (n: Node | null) => (n instanceof Element ? n : n?.parentElement)?.closest<HTMLElement>('[data-texto-msg]');
      const a = bolha(sel.anchorNode), b = bolha(sel.focusNode);
      if (!a || a !== b || !container.current?.contains(a)) { setSelecao(null); return; }
      const texto = sel.toString().trim().slice(0, LIMITE_TRECHO);
      if (!texto) { setSelecao(null); return; }
      const r = sel.getRangeAt(0).getBoundingClientRect();
      setSelecao({ msgId: a.dataset.textoMsg!, texto, x: r.left + r.width / 2, y: r.top });
    };
    let t = 0;
    const agendar = () => { window.clearTimeout(t); t = window.setTimeout(ler, 120); };
    const sumir = () => setSelecao(null);
    document.addEventListener('selectionchange', agendar);
    const el = container.current;
    el?.addEventListener('scroll', sumir, { passive: true });
    return () => { document.removeEventListener('selectionchange', agendar); el?.removeEventListener('scroll', sumir); window.clearTimeout(t); };
  }, [container, ativo]);
  return [selecao, setSelecao] as const;
}

export const BotaoResponderTrecho: React.FC<{ selecao: SelecaoDeTrecho; aoResponder: () => void }> = ({ selecao, aoResponder }) =>
  createPortal(
    <button
      type="button"
      onMouseDown={e => e.preventDefault()}
      onClick={aoResponder}
      style={{ left: selecao.x, top: Math.max(8, selecao.y - 44) }}
      className="fixed z-[60] -translate-x-1/2 inline-flex items-center gap-1.5 rounded-full bg-purple-600 hover:bg-purple-500 px-3.5 py-2 text-xs font-bold text-white shadow-xl cursor-pointer"
    >
      <CornerUpLeft className="w-3.5 h-3.5" />Responder trecho
    </button>,
    document.body,
  );

// ---------------------------------------------------------------- gestos: segurar (menu) e arrastar para a direita (responder)
export function useGestosDaBolha(opcoes: { aoSegurar: () => void; aoArrastar: () => void; ativo: boolean }) {
  const inicio = useRef<{ x: number; y: number; t: number } | null>(null);
  const timer = useRef(0);
  const [desloc, setDesloc] = useState(0);
  const horizontal = useRef<boolean | null>(null);
  const segurou = useRef(false);
  const LIMITE = 60;
  const cancelarTimer = () => window.clearTimeout(timer.current);
  return {
    desloc,
    handlers: {
      onTouchStart: (e: React.TouchEvent) => {
        const t = e.touches[0]; if (!t) return;
        inicio.current = { x: t.clientX, y: t.clientY, t: Date.now() };
        horizontal.current = null;
        segurou.current = false;
        cancelarTimer();
        timer.current = window.setTimeout(() => { navigator.vibrate?.(15); inicio.current = null; segurou.current = true; opcoes.aoSegurar(); }, 450);
      },
      onTouchMove: (e: React.TouchEvent) => {
        const t = e.touches[0]; const i = inicio.current; if (!t || !i) return;
        const dx = t.clientX - i.x, dy = t.clientY - i.y;
        if (Math.abs(dx) > 8 || Math.abs(dy) > 8) cancelarTimer();
        if (horizontal.current === null && (Math.abs(dx) > 10 || Math.abs(dy) > 10)) horizontal.current = Math.abs(dx) > Math.abs(dy);
        if (opcoes.ativo && horizontal.current && dx > 0) setDesloc(Math.min(dx, LIMITE + 20));
      },
      onTouchEnd: (e: React.TouchEvent) => {
        cancelarTimer();
        if (segurou.current && e.cancelable) e.preventDefault();  // sem o "clique" que viria depois de segurar
        segurou.current = false;
        if (desloc >= LIMITE) { navigator.vibrate?.(10); opcoes.aoArrastar(); }
        setDesloc(0); inicio.current = null;
      },
      onTouchCancel: () => { cancelarTimer(); setDesloc(0); inicio.current = null; },
    },
  };
}
