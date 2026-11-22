// Janela "Avalie o Vybelog": aparece quando a administração lança uma campanha de avaliação (§28 do
// setup.sql). Estrelas de 1 a 5, comentário opcional; a pessoa pode avaliar, deixar para depois
// ("Agora não" volta em alguns dias) ou recusar ("Não quero avaliar", gravado). Segue as mesmas regras
// das outras janelas: nunca junto com outra, nunca enquanto a pessoa digita ou com o app em segundo plano.
import React, { useEffect, useRef, useState } from 'react';
import { Check, Heart, Send, Star, X } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { campanhaAtual, LIMITE_COMENTARIO, responderAvaliacao, ROTULO_ESTRELAS, type CampanhaAvaliacao } from '../../lib/avaliacoes';
import { publicidadeLiberada } from '../../lib/janelas';
import { notify } from '../common/Feedback';
import logoUrl from '../../assets/logo.png';

const ESPERA_INICIAL = 25_000;                 // depois de abrir o app (a janela de convite vem antes)
const DEPOIS_DO_CONVITE = 20_000;
const ADIAR_POR = 2 * 24 * 60 * 60 * 1000;     // "Agora não": volta em 2 dias
const CHAVE_SESSAO = 'vybe.popup.avaliacao';
const chaveAdiada = (id: string) => `vybe.avaliacao.adiada.${id}`;

const ler = (fn: () => string | null) => { try { return fn(); } catch { return null; } };
const gravar = (fn: () => void) => { try { fn(); } catch { /* sem armazenamento */ } };
const digitando = () => {
  const el = document.activeElement as HTMLElement | null;
  return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
};

export const AvaliacaoPopup: React.FC = () => {
  const { currentUser, isAdminMode, openPostId } = useApp();
  const [campanha, setCampanha] = useState<CampanhaAvaliacao | null>(null);
  const [aberto, setAberto] = useState(false);
  const [estrelas, setEstrelas] = useState(0);
  const [destaque, setDestaque] = useState(0);   // estrela sob o mouse (prévia)
  const [comentario, setComentario] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const inicio = useRef(Date.now());

  // busca a campanha aberta que a pessoa ainda não respondeu
  useEffect(() => {
    if (!currentUser.id || ler(() => sessionStorage.getItem(CHAVE_SESSAO)) === '1') return;
    let ativo = true;
    campanhaAtual().then(c => {
      if (!ativo || !c) return;
      const adiada = Number(ler(() => localStorage.getItem(chaveAdiada(c.id))) ?? 0);
      if (adiada && Date.now() - adiada < ADIAR_POR) return;
      setCampanha(c);
    });
    return () => { ativo = false; };
  }, [currentUser.id]);

  // abre no momento certo: sem outra janela aberta, sem a pessoa digitando
  useEffect(() => {
    if (!campanha || aberto || enviado) return;
    const relogio = window.setInterval(() => {
      if (isAdminMode || openPostId) return;
      if (Date.now() - inicio.current < ESPERA_INICIAL) return;
      if (!publicidadeLiberada(DEPOIS_DO_CONVITE)) return;
      if (document.visibilityState !== 'visible' || digitando() || document.querySelector('[aria-modal="true"]')) return;
      gravar(() => sessionStorage.setItem(CHAVE_SESSAO, '1'));
      setAberto(true);
    }, 3000);
    return () => window.clearInterval(relogio);
  }, [campanha, aberto, enviado, isAdminMode, openPostId]);

  const fechar = () => { setAberto(false); setCampanha(null); };
  const agoraNao = () => {
    if (campanha) gravar(() => localStorage.setItem(chaveAdiada(campanha.id), String(Date.now())));
    fechar();
  };
  const naoQuero = async () => {
    if (!campanha) return;
    fechar();
    await responderAvaliacao(campanha.id, null);
  };
  const enviar = async () => {
    if (!campanha || !estrelas || enviando) return;
    setEnviando(true);
    const erro = await responderAvaliacao(campanha.id, estrelas, comentario);
    setEnviando(false);
    if (erro) { notify(erro, 'error'); if (/encerrada|já respondeu/i.test(erro)) fechar(); return; }
    setEnviado(true);
    window.setTimeout(fechar, 2600);
  };

  useEffect(() => {
    if (!aberto) return;
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') agoraNao(); };
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  });

  if (!aberto || !campanha) return null;
  const vistas = destaque || estrelas;

  return (
    <div className="modal-overlay fixed inset-0 z-[55] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4" onClick={agoraNao}
      role="dialog" aria-modal="true" aria-labelledby="titulo-avaliacao">
      <div className="relative w-full max-w-sm overflow-hidden rounded-3xl border border-fuchsia-500/30 bg-painel shadow-2xl shadow-fuchsia-950/50" onClick={e => e.stopPropagation()}>
        {/* faixa com o degradê da marca */}
        <div className="relative px-6 pt-7 pb-6 text-center bg-gradient-to-br from-fuchsia-700/40 via-pink-600/25 to-orange-500/30">
          <div className="absolute -top-16 -right-16 w-44 h-44 rounded-full bg-orange-500/25 blur-3xl pointer-events-none" />
          <div className="absolute -bottom-20 -left-16 w-44 h-44 rounded-full bg-fuchsia-600/30 blur-3xl pointer-events-none" />
          <button type="button" onClick={agoraNao} className="absolute top-3 right-3 p-1.5 rounded-full bg-black/30 text-white/80 hover:text-white cursor-pointer" aria-label="Fechar">
            <X className="w-4 h-4" />
          </button>
          <img src={logoUrl} alt="" className="relative w-16 h-16 mx-auto object-contain drop-shadow-[0_0_24px_rgba(208,23,189,0.45)]" />
          <h2 id="titulo-avaliacao" className="relative mt-3 text-2xl font-black text-white leading-tight">{enviado ? 'Obrigado!' : campanha.title}</h2>
          <p className="relative mt-1.5 text-sm text-zinc-200">
            {enviado ? 'Sua avaliação chegou à equipe do Vybelog.' : campanha.message || 'Conte pra gente como está sendo a sua experiência.'}
          </p>
        </div>

        {enviado ? (
          <div className="px-6 py-8 flex flex-col items-center gap-3 text-center">
            <span className="curtida-pulo w-14 h-14 rounded-full bg-gradient-to-br from-fuchsia-600 to-orange-500 flex items-center justify-center shadow-lg shadow-fuchsia-950/50">
              <Check className="w-7 h-7 text-white" strokeWidth={3} />
            </span>
            <p className="flex items-center gap-1.5 text-sm text-zinc-300">
              {Array.from({ length: estrelas }, (_, i) => <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />)}
            </p>
            <p className="text-xs text-zinc-400 flex items-center gap-1">Feito com <Heart className="w-3.5 h-3.5 fill-pink-500 text-pink-500" /> a cada opinião</p>
          </div>
        ) : (
          <div className="px-6 py-5 space-y-4">
            {/* estrelas */}
            <div role="radiogroup" aria-label="Nota de 1 a 5 estrelas" className="flex justify-center gap-1.5" onMouseLeave={() => setDestaque(0)}>
              {[1, 2, 3, 4, 5].map(n => {
                const acesa = n <= vistas;
                return (
                  <button key={n} type="button" role="radio" aria-checked={estrelas === n} aria-label={`${n} ${n === 1 ? 'estrela' : 'estrelas'}: ${ROTULO_ESTRELAS[n]}`}
                    onClick={() => setEstrelas(n)} onMouseEnter={() => setDestaque(n)}
                    className="p-1 rounded-xl cursor-pointer transition-transform hover:scale-110 focus-visible:outline-2 focus-visible:outline-amber-400">
                    <Star key={acesa && n === estrelas ? 'on' : 'off'}
                      className={`w-10 h-10 transition-colors ${acesa ? 'fill-amber-400 text-amber-400 drop-shadow-[0_0_10px_rgba(251,191,36,0.55)]' : 'text-zinc-600'} ${acesa && n === estrelas ? 'curtida-pulo' : ''}`} />
                  </button>
                );
              })}
            </div>
            <p className={`text-center text-sm font-bold h-5 ${vistas ? 'text-amber-200' : 'text-zinc-500'}`} aria-live="polite">
              {vistas ? ROTULO_ESTRELAS[vistas] : 'Toque nas estrelas para dar sua nota'}
            </p>

            {/* comentário opcional */}
            <label className="block">
              <span className="flex justify-between text-[12px] font-semibold text-zinc-400 mb-1">
                <span>Quer contar mais? <span className="font-normal text-zinc-500">(opcional)</span></span>
                {comentario.length > 0 && <span className="tabular-nums">{comentario.length}/{LIMITE_COMENTARIO}</span>}
              </span>
              <textarea value={comentario} onChange={e => setComentario(e.target.value)} maxLength={LIMITE_COMENTARIO} rows={3}
                placeholder="O que você mais gosta, o que podemos melhorar…"
                className="w-full px-3.5 py-2.5 rounded-2xl bg-zinc-950/70 border border-zinc-800 text-sm text-zinc-100 placeholder-zinc-600 resize-none focus:outline-none focus:border-fuchsia-500/60" />
            </label>

            <button type="button" onClick={enviar} disabled={!estrelas || enviando}
              className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-fuchsia-600 via-pink-600 to-orange-600 text-white font-bold flex items-center justify-center gap-2 shadow-lg shadow-fuchsia-950/50 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed">
              <Send className="w-4 h-4" /> {enviando ? 'Enviando…' : 'Enviar avaliação'}
            </button>
            <div className="flex items-center justify-between">
              <button type="button" onClick={agoraNao} className="py-1 text-xs font-semibold text-zinc-300 hover:text-white cursor-pointer">Agora não</button>
              <button type="button" onClick={naoQuero} className="py-1 text-xs text-zinc-500 hover:text-zinc-300 cursor-pointer">Não quero avaliar</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
