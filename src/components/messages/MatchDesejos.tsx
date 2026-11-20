// Match de Desejos: janela do jogo a dois (escolher o baralho, responder as cartas em segredo e ver
// só os desejos em comum). Enquanto espera a outra pessoa, confere o resultado a cada 15 segundos.
import React, { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, Lock, X } from 'lucide-react';
import { askConfirm, notify } from '../common/Feedback';
import { BARALHOS, abrirJogo, desafiar, recusar, responder, type Baralho, type JogoDesejos, type Resposta } from '../../lib/desejos';

const OPCOES: Array<{ valor: Resposta; rotulo: string; emoji: string; classe: string }> = [
  { valor: 0, rotulo: 'Não', emoji: '🙅', classe: 'bg-white/10 hover:bg-white/15 text-zinc-100' },
  { valor: 1, rotulo: 'Talvez', emoji: '🤔', classe: 'bg-amber-400/20 hover:bg-amber-400/30 text-amber-100 ring-1 ring-amber-300/40' },
  { valor: 2, rotulo: 'Quero', emoji: '🔥', classe: 'fundo-neon text-white shadow-[0_8px_24px_-8px_rgba(236,72,153,0.9)]' },
];

export const MatchDesejos: React.FC<{ outro: { id: string; nome: string }; jogoId: string | null; aoFechar: () => void }> = ({ outro, jogoId, aoFechar }) => {
  const [id, setId] = useState<string | null>(jogoId);
  const [jogo, setJogo] = useState<JogoDesejos | null>(null);
  const [indice, setIndice] = useState(0);
  const [ocupado, setOcupado] = useState(false);
  const [escolhendo, setEscolhendo] = useState(!jogoId);
  const [revisando, setRevisando] = useState(false);

  const carregar = useCallback(async (alvo: string, posicionar = false) => {
    const r = await abrirJogo(alvo);
    if ('erro' in r) { notify(r.erro, 'error'); aoFechar(); return; }
    setJogo(r);
    if (posicionar) {
      const pendente = r.cartas.findIndex((c) => c.minha === null);
      setIndice(pendente === -1 ? 0 : pendente);
    }
  }, [aoFechar]);

  useEffect(() => { if (id) void carregar(id, true); }, [id, carregar]);
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') aoFechar(); };
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [aoFechar]);
  // esperando a outra pessoa: confere de tempos em tempos
  const esperando = !!jogo && jogo.status === 'playing' && jogo.meus === jogo.total && jogo.dele < jogo.total;
  useEffect(() => {
    if (!esperando || !id) return;
    const t = setInterval(() => { if (document.visibilityState === 'visible') void carregar(id); }, 15000);
    return () => clearInterval(t);
  }, [esperando, id, carregar]);

  const comecar = async (b: Baralho) => {
    setOcupado(true);
    const r = await desafiar(outro.id, b);
    setOcupado(false);
    if ('erro' in r) { notify(r.erro, 'error'); return; }
    if (r.existente) notify(`Vocês já têm um jogo em andamento. Abrindo ele para você.`, 'info');
    else notify(`Desafio enviado para ${outro.nome}! 🔥`, 'success');
    setEscolhendo(false);
    setJogo(null);
    setId(r.id);
    if (r.id === id) void carregar(r.id, true);
  };

  const votar = async (valor: Resposta) => {
    if (!jogo || ocupado) return;
    const carta = jogo.cartas[indice];
    setOcupado(true);
    const r = await responder(jogo.id, carta.id, valor);
    setOcupado(false);
    if ('erro' in r) { notify(r.erro, 'error'); if (id) void carregar(id); return; }
    setJogo(r);
    // revisando: segue carta a carta e, na última, volta para a espera
    if (revisando) {
      if (indice + 1 < r.cartas.length) setIndice(indice + 1); else setRevisando(false);
      return;
    }
    const proxima = r.cartas.findIndex((c, i) => i > indice && c.minha === null);
    const qualquer = r.cartas.findIndex((c) => c.minha === null);
    setIndice(proxima !== -1 ? proxima : qualquer !== -1 ? qualquer : indice);
  };

  const encerrar = async () => {
    if (!jogo || !(await askConfirm({ title: 'Encerrar este jogo?', message: 'As respostas não serão reveladas. Vocês podem começar outro depois.', confirmLabel: 'Encerrar', danger: true }))) return;
    const erro = await recusar(jogo.id);
    if (erro) notify(erro, 'error'); else aoFechar();
  };

  const baralho = BARALHOS.find((b) => b.id === jogo?.deck);
  const carta = jogo?.cartas[indice];
  const terminouMinhaParte = !!jogo && jogo.meus === jogo.total;

  return createPortal(
    <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center" onClick={aoFechar}>
      <div role="dialog" aria-modal="true" aria-labelledby="titulo-match"
        className="relative w-full sm:max-w-md max-h-[100dvh] overflow-y-auto rounded-t-3xl sm:rounded-3xl border border-white/10 bg-gradient-to-b from-[#2a1638] to-[#120b18] p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] text-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center gap-2">
          <span className="text-2xl" aria-hidden>💞</span>
          <div className="min-w-0 flex-1">
            <h2 id="titulo-match" className="text-lg font-extrabold leading-tight">Match de Desejos</h2>
            <p className="truncate text-[12px] text-zinc-400">com {outro.nome}{baralho ? ` · ${baralho.emoji} ${baralho.nome}` : ''}</p>
          </div>
          <button type="button" onClick={aoFechar} aria-label="Fechar" className="w-10 h-10 rounded-full flex items-center justify-center text-zinc-300 hover:bg-white/10 cursor-pointer"><X className="w-5 h-5" /></button>
        </div>

        {escolhendo ? (
          <>
            <p className="mb-1 text-sm text-zinc-200">Vocês respondem em segredo às mesmas 10 cartas: <b>🔥 Quero</b>, <b>🤔 Talvez</b> ou <b>🙅 Não</b>.</p>
            <p className="mb-4 flex items-start gap-1.5 text-[12px] text-zinc-400"><Lock className="mt-0.5 w-3.5 h-3.5 shrink-0" />No final aparece só o que os dois querem. Ninguém vê o "não" do outro.</p>
            <p className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-zinc-400">Escolha o baralho</p>
            <div className="grid grid-cols-2 gap-2">
              {BARALHOS.map((b) => (
                <button key={b.id} type="button" disabled={ocupado} onClick={() => void comecar(b.id)}
                  className={`min-h-[96px] rounded-2xl border border-white/10 bg-gradient-to-br ${b.cor} p-3 text-left transition-transform hover:-translate-y-0.5 disabled:opacity-50 cursor-pointer ${b.id === 'mix' ? 'col-span-2' : ''}`}>
                  <span className="text-2xl" aria-hidden>{b.emoji}</span>
                  <span className="mt-1 block text-sm font-bold">{b.nome}</span>
                  <span className="block text-[11.5px] text-zinc-300">{b.descricao}</span>
                </button>
              ))}
            </div>
          </>
        ) : !jogo ? (
          <p className="py-10 text-center text-sm text-zinc-400">Abrindo o jogo…</p>
        ) : jogo.status === 'declined' ? (
          <div className="py-6 text-center">
            <p className="text-4xl" aria-hidden>🌙</p>
            <p className="mt-2 font-bold">Este jogo foi encerrado</p>
            <p className="mt-1 text-sm text-zinc-400">As respostas ficaram em segredo.</p>
            <button type="button" onClick={() => setEscolhendo(true)} className="mt-5 min-h-[44px] w-full rounded-2xl fundo-neon font-bold cursor-pointer">Começar outro jogo</button>
          </div>
        ) : jogo.status === 'done' ? (
          <Resultado jogo={jogo} aoNovo={() => setEscolhendo(true)} aoConversar={aoFechar} />
        ) : terminouMinhaParte && esperando && !revisando ? (
          <div className="py-4 text-center">
            <img src={jogo.outro.avatar} alt="" className="mx-auto w-20 h-20 rounded-full object-cover ring-2 ring-fuchsia-500/60 bg-zinc-800" />
            <p className="mt-3 text-lg font-bold">Pronto! Agora é a vez de {jogo.outro.nome}</p>
            <p className="mt-1 text-sm text-zinc-400">{jogo.outro.nome} respondeu {jogo.dele} de {jogo.total}. Avisamos você quando o resultado sair.</p>
            <div className="mx-auto mt-4 h-2 max-w-[220px] rounded-full bg-white/10">
              <div className="h-2 rounded-full bg-gradient-to-r from-fuchsia-500 to-amber-400 transition-[width] duration-500" style={{ width: `${(jogo.dele / jogo.total) * 100}%` }} />
            </div>
            <div className="mt-6 grid gap-2">
              <button type="button" onClick={aoFechar} className="min-h-[44px] rounded-2xl fundo-neon font-bold cursor-pointer">Voltar à conversa</button>
              <button type="button" onClick={() => { setIndice(0); setRevisando(true); }} className="min-h-[44px] rounded-2xl bg-white/10 hover:bg-white/15 text-sm font-semibold cursor-pointer">Revisar minhas respostas</button>
            </div>
          </div>
        ) : carta && (
          <>
            <div className="mb-3 flex items-center gap-2 text-[12px] text-zinc-400">
              <button type="button" disabled={indice === 0} onClick={() => setIndice((i) => Math.max(0, i - 1))} aria-label="Carta anterior"
                className="w-9 h-9 -ml-2 rounded-full flex items-center justify-center hover:bg-white/10 disabled:opacity-30 cursor-pointer"><ChevronLeft className="w-5 h-5" /></button>
              <span className="tabular-nums">Carta {indice + 1} de {jogo.total}</span>
              <span className="ml-auto">{jogo.outro.nome}: {jogo.dele}/{jogo.total}</span>
            </div>
            <div className="mb-4 flex gap-1" aria-hidden>
              {jogo.cartas.map((c, i) => (
                <span key={c.id} className={`h-1.5 flex-1 rounded-full ${i === indice ? 'bg-white' : c.minha === null ? 'bg-white/15' : c.minha === 2 ? 'bg-fuchsia-500' : c.minha === 1 ? 'bg-amber-400' : 'bg-zinc-500'}`} />
              ))}
            </div>
            <div key={carta.id} className="carta-desejo rounded-3xl border border-white/10 bg-gradient-to-br from-fuchsia-600/25 via-purple-800/20 to-rose-500/15 px-5 py-8 text-center">
              <p className="text-7xl leading-none" aria-hidden>{carta.emoji}</p>
              <h3 className="mt-4 text-xl font-extrabold">{carta.titulo}</h3>
              <p className="mt-1.5 text-sm text-zinc-200">{carta.descricao}</p>
              <p className="mt-3 text-sm" aria-label={`Intensidade ${carta.intensidade} de 3`}>{'🌶️'.repeat(carta.intensidade)}<span className="opacity-25">{'🌶️'.repeat(3 - carta.intensidade)}</span></p>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2" role="group" aria-label="Sua resposta (secreta)">
              {OPCOES.map((o) => (
                <button key={o.valor} type="button" disabled={ocupado} onClick={() => void votar(o.valor)} aria-pressed={carta.minha === o.valor}
                  className={`min-h-[64px] rounded-2xl font-bold flex flex-col items-center justify-center gap-0.5 transition-transform active:scale-95 disabled:opacity-60 cursor-pointer ${o.classe} ${carta.minha === o.valor ? 'outline outline-2 outline-white' : ''}`}>
                  <span className="text-2xl leading-none" aria-hidden>{o.emoji}</span>
                  <span className="text-[13px]">{o.rotulo}</span>
                </button>
              ))}
            </div>
            <p className="mt-3 flex items-center justify-center gap-1.5 text-[11.5px] text-zinc-500"><Lock className="w-3 h-3" />Sua resposta é secreta</p>
            <button type="button" onClick={() => void encerrar()} className="mt-2 w-full text-center text-[12px] text-zinc-500 hover:text-zinc-300 cursor-pointer">Encerrar jogo</button>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
};

const Resultado: React.FC<{ jogo: JogoDesejos; aoNovo: () => void; aoConversar: () => void }> = ({ jogo, aoNovo, aoConversar }) => {
  const s = jogo.sintonia ?? 0;
  const lista = jogo.combinacoes ?? [];
  return (
    <div>
      <div className="text-center">
        <div className="relative mx-auto w-28 h-28">
          <svg viewBox="0 0 120 120" className="w-28 h-28 -rotate-90" aria-hidden>
            <circle cx="60" cy="60" r="52" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="10" />
            <circle cx="60" cy="60" r="52" fill="none" stroke="url(#grad-sintonia)" strokeWidth="10" strokeLinecap="round" strokeDasharray={`${(s / 100) * 326.7} 326.7`} />
            <defs><linearGradient id="grad-sintonia" x1="0" x2="1"><stop offset="0%" stopColor="#d946ef" /><stop offset="100%" stopColor="#fbbf24" /></linearGradient></defs>
          </svg>
          <span className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-extrabold tabular-nums">{s}%</span>
            <span className="text-[10px] uppercase tracking-wide text-zinc-400">sintonia</span>
          </span>
        </div>
        <p className="mt-3 text-lg font-bold">
          {lista.length ? `Vocês combinaram em ${lista.length} ${lista.length === 1 ? 'desejo' : 'desejos'} 🔥` : 'Desta vez não deu match 😅'}
        </p>
        <p className="text-sm text-zinc-400">{lista.length ? `Agora é só combinar com ${jogo.outro.nome}…` : 'Que tal tentar outro baralho?'}</p>
      </div>
      {lista.length > 0 && (
        <ul className="mt-4 flex flex-col gap-2">
          {lista.map((c) => (
            <li key={c.id} className="flex items-center gap-3 rounded-2xl bg-white/[0.06] px-3 py-2.5">
              <span className="text-3xl" aria-hidden>{c.emoji}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold">{c.titulo}</span>
                <span className="block text-[12px] text-zinc-400">{c.descricao}</span>
              </span>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${c.nivel === 'os_dois_querem' ? 'bg-fuchsia-500/25 text-fuchsia-200' : 'bg-amber-400/20 text-amber-200'}`}>
                {c.nivel === 'os_dois_querem' ? '🔥 Os dois' : '😏 Quem sabe'}
              </span>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-5 grid gap-2">
        <button type="button" onClick={aoConversar} className="min-h-[44px] rounded-2xl fundo-neon font-bold cursor-pointer">Conversar sobre isso</button>
        <button type="button" onClick={aoNovo} className="min-h-[44px] rounded-2xl bg-white/10 hover:bg-white/15 text-sm font-semibold cursor-pointer">Jogar outro baralho</button>
      </div>
    </div>
  );
};
