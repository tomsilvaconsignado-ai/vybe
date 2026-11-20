// Missões no topo do feed: boas-vindas (uma vez) e missões do dia com sequência de dias.
// O banco calcula o progresso a partir das ações reais e concede os prêmios (destaque no Descobrir);
// aqui só mostramos, com um atalho para cada missão. Recarrega a cada ação da pessoa e ao voltar à aba.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, Check, ChevronDown, Flame, Heart, MessageCircle, PenLine, Send, Sparkles, Trophy, UserPlus, ImagePlus } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { aoAcaoMissao, minhasMissoes, type ItemMissao, type Missoes } from '../../lib/missoes';
import { notify } from '../common/Feedback';
import { PEDIDO_EDITAR_PERFIL } from './AvisoSeloFoto';

const CHAVE_RECOLHIDO = 'vybe.missoes.recolhido';
const hojeLocal = () => new Date().toLocaleDateString('sv', { timeZone: 'America/Sao_Paulo' });

type Acao = 'perfil' | 'publicar' | 'descobrir' | 'convidar' | 'feed';
const TEXTOS: Record<string, { titulo: (i: ItemMissao) => string; icone: React.ReactNode; acao: Acao; botao: string }> = {
  'b:foto': { titulo: () => 'Coloque uma foto no perfil', icone: <Camera className="w-4 h-4" />, acao: 'perfil', botao: 'Colocar foto' },
  'b:bio': { titulo: () => 'Conte um pouco sobre você na bio', icone: <PenLine className="w-4 h-4" />, acao: 'perfil', botao: 'Escrever' },
  'b:publicar': { titulo: () => 'Faça sua primeira publicação com foto', icone: <ImagePlus className="w-4 h-4" />, acao: 'publicar', botao: 'Publicar' },
  'b:seguir': { titulo: (i) => `Siga ${i.meta} perfis que combinam com você`, icone: <UserPlus className="w-4 h-4" />, acao: 'descobrir', botao: 'Descobrir' },
  'b:comentar': { titulo: (i) => `Comente em ${i.meta} publicações de outras pessoas`, icone: <MessageCircle className="w-4 h-4" />, acao: 'feed', botao: 'Ver feed' },
  'b:convidar': { titulo: () => 'Envie seu convite para alguém', icone: <Send className="w-4 h-4" />, acao: 'convidar', botao: 'Convidar' },
  'h:curtir': { titulo: (i) => `Curta ${i.meta} publicações`, icone: <Heart className="w-4 h-4" />, acao: 'feed', botao: 'Ver feed' },
  'h:comentar': { titulo: (i) => `Comente em ${i.meta} publicações`, icone: <MessageCircle className="w-4 h-4" />, acao: 'feed', botao: 'Ver feed' },
  'h:publicar': { titulo: () => 'Publique uma foto ou story', icone: <ImagePlus className="w-4 h-4" />, acao: 'publicar', botao: 'Publicar' },
};

const dias = (n: number) => `${n} ${n === 1 ? 'dia' : 'dias'}`;

export const MissoesCard: React.FC<{ onPublicar: () => void; onVerFeed: () => void; className?: string }> = ({ onPublicar, onVerFeed, className = '' }) => {
  const { currentUser, setActiveTab } = useApp();
  const [m, setM] = useState<Missoes | null>(null);
  const [aba, setAba] = useState<'boas' | 'hoje' | null>(null);
  const [recolhido, setRecolhido] = useState(() => { try { return localStorage.getItem(CHAVE_RECOLHIDO) === hojeLocal(); } catch { return false; } });
  const carregando = useRef(false);

  const carregar = useCallback(async () => {
    if (!currentUser.id || carregando.current) return;
    carregando.current = true;
    try {
      const dados = await minhasMissoes();
      if (!dados) return;
      setM(dados);
      const n = dados.novidade;
      if (n?.tipo === 'boas_vindas') notify(`Missões de boas-vindas concluídas! Seu perfil ganhou ${dias(n.dias_destaque)} de destaque no Descobrir.`, 'success');
      else if (n?.tipo === 'dia') notify(n.dias_destaque
        ? `${dias(n.sequencia ?? 0)} seguidos! Você ganhou ${dias(n.dias_destaque)} de destaque no Descobrir.`
        : `Missões de hoje concluídas! Sequência de ${dias(n.sequencia ?? 1)}.`, 'success');
    } finally { carregando.current = false; }
  }, [currentUser.id]);

  // ao abrir, a cada ação (com uma pequena espera para juntar várias) e ao voltar para a aba
  useEffect(() => {
    void carregar();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const desligar = aoAcaoMissao(() => { clearTimeout(timer); timer = setTimeout(() => void carregar(), 800); });
    const aoVoltar = () => { if (document.visibilityState === 'visible') void carregar(); };
    document.addEventListener('visibilitychange', aoVoltar);
    return () => { desligar(); clearTimeout(timer); document.removeEventListener('visibilitychange', aoVoltar); };
  }, [carregar]);

  if (!m) return null;
  const boasPendente = !m.boas_vindas.recompensa_recebida;
  const abaAtual = aba ?? (boasPendente ? 'boas' : 'hoje');
  const itens = abaAtual === 'boas' ? m.boas_vindas.itens : m.hoje.itens;
  const feitos = itens.filter((i) => i.feito).length;
  const seq = m.sequencia;
  const hojeFeitos = m.hoje.itens.filter((i) => i.feito).length;

  const executar = (acao: Acao) => {
    if (acao === 'publicar') onPublicar();
    else if (acao === 'feed') onVerFeed();
    else if (acao === 'descobrir') setActiveTab('discover');
    else if (acao === 'convidar') setActiveTab('invite');
    else {
      try { sessionStorage.setItem(PEDIDO_EDITAR_PERFIL, '1'); } catch { /* sem armazenamento */ }
      setActiveTab('profile');
    }
  };
  const alternarRecolhido = () => {
    const novo = !recolhido;
    setRecolhido(novo);
    try { if (novo) localStorage.setItem(CHAVE_RECOLHIDO, hojeLocal()); else localStorage.removeItem(CHAVE_RECOLHIDO); } catch { /* sem armazenamento */ }
  };

  return (
    <section aria-label="Missões" className={`rounded-2xl border border-fuchsia-500/30 bg-gradient-to-br from-fuchsia-600/15 via-purple-700/10 to-amber-500/10 ${className}`}>
      <div className="flex items-center gap-3 p-3.5">
        <span className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${seq.atual > 0 ? 'bg-orange-500/25 text-orange-300' : 'bg-white/10 text-zinc-300'}`} aria-hidden>
          <Flame className={`w-5 h-5 ${seq.hoje_contou ? 'fill-orange-400 text-orange-300' : ''}`} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-white">
            {seq.atual > 0 ? `Sequência de ${dias(seq.atual)}` : 'Comece sua sequência hoje'}
            {seq.hoje_contou && <span className="ml-1.5 text-[11px] font-semibold text-emerald-300">· hoje garantido</span>}
          </p>
          <p className="text-[12px] text-zinc-300">
            {m.hoje.concluido ? 'Missões de hoje concluídas. Volte amanhã para manter a sequência.'
              : `Missões de hoje: ${hojeFeitos}/${m.hoje.itens.length}`}
            {seq.proxima_meta && seq.premio_proxima ? ` · ${dias(seq.proxima_meta)} seguidos = ${dias(seq.premio_proxima)} de destaque` : ''}
          </p>
        </div>
        <button type="button" onClick={alternarRecolhido} aria-expanded={!recolhido} aria-label={recolhido ? 'Mostrar missões' : 'Recolher missões'}
          className="w-11 h-11 -mr-1.5 rounded-xl flex items-center justify-center text-zinc-300 hover:bg-white/10 hover:text-white cursor-pointer shrink-0">
          <ChevronDown className={`w-5 h-5 transition-transform ${recolhido ? '' : 'rotate-180'}`} />
        </button>
      </div>

      {!recolhido && (
        <div className="px-3.5 pb-3.5">
          {boasPendente && (
            <div className="mb-3 grid grid-cols-2 gap-1 rounded-xl bg-black/25 p-1" role="tablist" aria-label="Tipo de missão">
              {([['boas', 'Boas-vindas'], ['hoje', 'Missões de hoje']] as const).map(([id, rotulo]) => (
                <button key={id} type="button" role="tab" aria-selected={abaAtual === id} onClick={() => setAba(id)}
                  className={`min-h-[36px] rounded-lg text-xs font-semibold cursor-pointer transition-colors ${abaAtual === id ? 'bg-white text-black' : 'text-zinc-300 hover:text-white'}`}>
                  {rotulo}
                </button>
              ))}
            </div>
          )}

          <div className="mb-2 flex items-center justify-between gap-2 text-[12px]">
            <span className="text-zinc-300">
              {abaAtual === 'boas'
                ? <><Trophy className="inline w-3.5 h-3.5 mr-1 text-amber-300" />Complete tudo e ganhe 3 dias de destaque no Descobrir</>
                : <><Sparkles className="inline w-3.5 h-3.5 mr-1 text-fuchsia-300" />Complete as 3 para somar um dia na sequência</>}
            </span>
            <span className="font-bold text-white tabular-nums">{feitos}/{itens.length}</span>
          </div>
          <div className="h-1.5 rounded-full bg-white/10 mb-3" role="progressbar" aria-valuemin={0} aria-valuemax={itens.length} aria-valuenow={feitos} aria-label="Progresso das missões">
            <div className="h-1.5 rounded-full bg-gradient-to-r from-fuchsia-500 to-amber-400 transition-[width] duration-500" style={{ width: `${(feitos / itens.length) * 100}%` }} />
          </div>

          <ul className="flex flex-col gap-1.5">
            {itens.map((i) => {
              const t = TEXTOS[`${abaAtual === 'boas' ? 'b' : 'h'}:${i.chave}`];
              if (!t) return null;
              return (
                <li key={i.chave} className={`flex items-center gap-3 rounded-xl px-2.5 py-2 ${i.feito ? 'bg-emerald-500/10' : 'bg-black/20'}`}>
                  <span className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${i.feito ? 'bg-emerald-500 text-black' : 'bg-white/10 text-zinc-200'}`} aria-hidden>
                    {i.feito ? <Check className="w-4 h-4" strokeWidth={3} /> : t.icone}
                  </span>
                  <span className={`min-w-0 flex-1 text-[13px] ${i.feito ? 'text-zinc-400 line-through decoration-zinc-500' : 'text-white'}`}>
                    {t.titulo(i)}
                    {i.meta > 1 && !i.feito && <span className="ml-1.5 text-[11px] font-semibold text-fuchsia-300 tabular-nums">{i.progresso}/{i.meta}</span>}
                    <span className="sr-only">{i.feito ? ' (concluída)' : ' (pendente)'}</span>
                  </span>
                  {!i.feito && (
                    <button type="button" onClick={() => executar(t.acao)}
                      className="min-h-[36px] px-3 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-semibold text-white cursor-pointer shrink-0">
                      {t.botao}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
          {seq.melhor > seq.atual && seq.melhor >= 2 && <p className="mt-2.5 text-[11px] text-zinc-400">Seu recorde: {dias(seq.melhor)} seguidos.</p>}
        </div>
      )}
    </section>
  );
};
