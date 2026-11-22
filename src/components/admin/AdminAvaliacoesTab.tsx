// Avaliações do aplicativo: lançar campanha (superadministrador), encerrar a aberta e ver o resultado de
// cada campanha (média, distribuição das notas, recusas e comentários de quem avaliou).
import React, { useEffect, useMemo, useState } from 'react';
import { CalendarClock, MessageSquareText, Rocket, Star, StopCircle } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import {
  campanhaAberta, encerrarCampanha, lancarCampanha, listarAvaliacoes, listarCampanhas, ROTULO_ESTRELAS,
  type AvaliacaoRecebida, type ResumoCampanha
} from '../../lib/avaliacoes';
import { askConfirm, askText, notify } from '../common/Feedback';

const VAZIO = { titulo: 'Curtindo o Vybelog?', mensagem: 'Toque em uma estrela para dar sua nota. Sua opinião ajuda a deixar o Vybelog ainda melhor.', fim: '', justificativa: '' };
const data = (iso: string) => new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });

const Estrelas: React.FC<{ n: number; tamanho?: string }> = ({ n, tamanho = 'w-3.5 h-3.5' }) => (
  <span className="inline-flex gap-0.5" aria-label={`${n} de 5 estrelas`}>
    {[1, 2, 3, 4, 5].map(i => <Star key={i} className={`${tamanho} ${i <= n ? 'fill-amber-400 text-amber-400' : 'text-zinc-700'}`} aria-hidden />)}
  </span>
);

export const AdminAvaliacoesTab: React.FC = () => {
  const { adminRole } = useApp();
  const podeLancar = adminRole === 'superadmin';
  const [f, setF] = useState(VAZIO);
  const [campanhas, setCampanhas] = useState<ResumoCampanha[]>([]);
  const [selecionada, setSelecionada] = useState<string | null>(null);
  const [avaliacoes, setAvaliacoes] = useState<AvaliacaoRecebida[]>([]);
  const [filtro, setFiltro] = useState<number | 'comentarios' | null>(null);
  const [salvando, setSalvando] = useState(false);
  const muda = (p: Partial<typeof VAZIO>) => setF(prev => ({ ...prev, ...p }));

  const carregar = async () => {
    const lista = await listarCampanhas();
    setCampanhas(lista);
    setSelecionada(atual => (atual && lista.some(c => c.id === atual) ? atual : lista[0]?.id ?? null));
  };
  useEffect(() => { carregar(); }, []);
  useEffect(() => { setFiltro(null); if (selecionada) listarAvaliacoes(selecionada).then(setAvaliacoes); else setAvaliacoes([]); }, [selecionada]);

  const aberta = campanhas.find(c => campanhaAberta(c));
  const c = campanhas.find(x => x.id === selecionada) ?? null;
  const maior = c ? Math.max(1, ...c.dist) : 1;
  const visiveis = useMemo(() => avaliacoes.filter(a =>
    filtro === null ? true : filtro === 'comentarios' ? !!a.comment : a.stars === filtro), [avaliacoes, filtro]);

  const lancar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!(await askConfirm({
      title: 'Lançar campanha de avaliação?',
      message: aberta ? `A campanha "${aberta.title}" será encerrada, e todos os membros verão a nova janela de avaliação.` : 'Todos os membros verão a janela de avaliação no próximo acesso.',
      confirmLabel: 'Lançar'
    }))) return;
    setSalvando(true);
    const erro = await lancarCampanha(f.titulo, f.mensagem, f.fim || null, f.justificativa);
    setSalvando(false);
    if (erro) { notify(erro, 'error'); return; }
    notify('Campanha de avaliação lançada.', 'success');
    setF(VAZIO);
    setSelecionada(null);
    carregar();
  };

  const encerrar = async (camp: ResumoCampanha) => {
    const motivo = await askText({ title: 'Encerrar campanha?', message: `"${camp.title}" deixa de aparecer para os membros. As respostas continuam guardadas.`, placeholder: 'Justificativa', confirmLabel: 'Encerrar' });
    if (motivo === null) return;
    const erro = await encerrarCampanha(camp.id, motivo);
    if (erro) notify(erro, 'error'); else { notify('Campanha encerrada.', 'success'); carregar(); }
  };

  const campo = 'w-full px-3 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-amber-500/60';
  const minimo = new Date(Date.now() + 3600_000 - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);

  return (
    <div className="grid lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.4fr)] gap-6">
      <div className="space-y-6">
        {/* gatilho: lançar campanha */}
        <section className="p-5 rounded-3xl bg-painel border border-amber-900/30 h-fit">
          <h2 className="text-sm font-bold text-white flex items-center gap-2 mb-1"><Rocket className="w-4 h-4 text-amber-300" /> Lançar campanha de avaliação</h2>
          <p className="text-[12px] text-zinc-400 mb-4">Abre a janela com estrelas e comentário para todos os membros, uma vez por pessoa. Lançar uma nova encerra a anterior.</p>
          {aberta && (
            <div className="mb-4 p-3 rounded-2xl bg-emerald-950/40 border border-emerald-800/60 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[12px] font-bold text-emerald-300 flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400" aria-hidden /> No ar agora</p>
                <p className="text-sm font-semibold text-zinc-100 truncate">{aberta.title}</p>
                <p className="text-[12px] text-zinc-400 tabular-nums">{aberta.rated} avaliações · {aberta.declined} recusas{aberta.ends_at ? ` · até ${data(aberta.ends_at)}` : ''}</p>
              </div>
              {podeLancar && (
                <button type="button" onClick={() => encerrar(aberta)} className="shrink-0 px-2.5 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-[12px] font-semibold text-rose-300 flex items-center gap-1 cursor-pointer">
                  <StopCircle className="w-3.5 h-3.5" /> Encerrar
                </button>
              )}
            </div>
          )}
          {!podeLancar ? (
            <p className="text-xs text-zinc-400 p-3 rounded-xl bg-zinc-950 border border-zinc-800">Somente o superadministrador lança campanhas. Você pode acompanhar os resultados ao lado.</p>
          ) : (
            <form onSubmit={lancar} className="space-y-3">
              <label className="block">
                <span className="block text-[12px] font-bold text-zinc-400 mb-1">Título da janela ({f.titulo.length}/80)</span>
                <input required minLength={3} maxLength={80} value={f.titulo} onChange={e => muda({ titulo: e.target.value })} className={campo} />
              </label>
              <label className="block">
                <span className="block text-[12px] font-bold text-zinc-400 mb-1">Mensagem ({f.mensagem.length}/240)</span>
                <textarea maxLength={240} rows={3} value={f.mensagem} onChange={e => muda({ mensagem: e.target.value })} className={campo} />
              </label>
              <label className="block">
                <span className="block text-[12px] font-bold text-zinc-400 mb-1">Encerrar automaticamente em (opcional)</span>
                <input type="datetime-local" min={minimo} value={f.fim} onChange={e => muda({ fim: e.target.value })} className={campo} />
              </label>
              <label className="block">
                <span className="block text-[12px] font-bold text-zinc-400 mb-1">Justificativa (auditoria)</span>
                <input required minLength={5} value={f.justificativa} onChange={e => muda({ justificativa: e.target.value })} className={campo} placeholder="Ex.: avaliação depois da nova versão" />
              </label>
              <button type="submit" disabled={salvando} className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer">
                <Rocket className="w-4 h-4" /> {salvando ? 'Lançando…' : aberta ? 'Lançar nova campanha' : 'Lançar campanha'}
              </button>
            </form>
          )}
        </section>

        {/* histórico de campanhas */}
        <section className="p-5 rounded-3xl bg-painel border border-purple-900/30">
          <h2 className="text-sm font-bold text-white mb-3">Campanhas</h2>
          {campanhas.length === 0 ? <p className="text-xs text-zinc-500 py-6 text-center">Nenhuma campanha lançada ainda.</p> : (
            <ul className="space-y-2">
              {campanhas.map(camp => {
                const noAr = campanhaAberta(camp);
                const ativa = camp.id === selecionada;
                return (
                  <li key={camp.id}>
                    <button type="button" onClick={() => setSelecionada(camp.id)} aria-pressed={ativa}
                      className={`w-full text-left p-3 rounded-2xl border transition-colors cursor-pointer ${ativa ? 'bg-amber-500/10 border-amber-500/50' : 'bg-zinc-950/60 border-zinc-800 hover:border-zinc-700'}`}>
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-bold text-zinc-100 truncate">{camp.title}</p>
                        <span className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full ${noAr ? 'bg-emerald-950 text-emerald-300' : 'bg-zinc-800 text-zinc-400'}`}>{noAr ? 'No ar' : 'Encerrada'}</span>
                      </div>
                      <p className="mt-1 text-[12px] text-zinc-400 flex items-center gap-2 tabular-nums">
                        {camp.average !== null && <span className="inline-flex items-center gap-1 text-amber-300 font-semibold"><Star className="w-3 h-3 fill-amber-400 text-amber-400" />{camp.average.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</span>}
                        <span>{camp.rated} avaliações</span>
                        <span className="text-zinc-600">desde {data(camp.starts_at)}</span>
                      </p>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      {/* resultado da campanha escolhida */}
      <section className="p-5 rounded-3xl bg-painel border border-purple-900/30 min-w-0">
        {!c ? <p className="text-xs text-zinc-500 py-16 text-center">Lance a primeira campanha para começar a receber avaliações.</p> : (
          <>
            <h2 className="text-sm font-bold text-white">{c.title}</h2>
            <p className="text-[12px] text-zinc-500 tabular-nums">
              {data(c.starts_at)} {c.closed_at ? `até ${data(c.closed_at)}` : c.ends_at ? `· encerra ${data(c.ends_at)}` : '· sem data para encerrar'}
            </p>

            <div className="mt-5 grid sm:grid-cols-[auto_minmax(0,1fr)] gap-6 items-center">
              <div className="text-center sm:pr-6 sm:border-r border-zinc-800">
                <p className="text-5xl font-black text-white tabular-nums leading-none">
                  {c.average !== null ? c.average.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : '–'}
                </p>
                <div className="mt-2"><Estrelas n={Math.round(c.average ?? 0)} tamanho="w-4 h-4" /></div>
                <p className="mt-1.5 text-[12px] text-zinc-400 tabular-nums">{c.rated} {c.rated === 1 ? 'avaliação' : 'avaliações'}</p>
              </div>
              {/* distribuição das notas */}
              <ul className="space-y-1.5" aria-label="Distribuição das notas">
                {[5, 4, 3, 2, 1].map(n => {
                  const qtd = c.dist[n - 1];
                  const ativo = filtro === n;
                  return (
                    <li key={n}>
                      <button type="button" onClick={() => setFiltro(ativo ? null : n)} aria-pressed={ativo} title={ROTULO_ESTRELAS[n]}
                        className={`w-full grid grid-cols-[2.25rem_minmax(0,1fr)_2.5rem] items-center gap-2 px-1.5 py-1 rounded-lg cursor-pointer ${ativo ? 'bg-amber-500/10' : 'hover:bg-zinc-900'}`}>
                        <span className="text-[12px] font-semibold text-zinc-300 flex items-center gap-0.5 tabular-nums">{n}<Star className="w-3 h-3 fill-zinc-400 text-zinc-400" aria-hidden /></span>
                        <span className="h-2 rounded-full bg-zinc-800 overflow-hidden">
                          <span className="block h-full rounded-full bg-amber-400" style={{ width: `${(qtd / maior) * 100}%` }} />
                        </span>
                        <span className="text-[12px] text-zinc-300 text-right tabular-nums">{qtd}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>

            <div className="mt-5 grid grid-cols-3 gap-2 text-center">
              {[
                { rotulo: 'Avaliaram', valor: c.rated },
                { rotulo: 'Com comentário', valor: c.comments },
                { rotulo: 'Preferiram não avaliar', valor: c.declined },
              ].map(k => (
                <div key={k.rotulo} className="p-2.5 rounded-2xl bg-zinc-950/60 border border-zinc-800">
                  <p className="text-lg font-black text-white tabular-nums">{k.valor}</p>
                  <p className="text-[11px] text-zinc-400 leading-tight">{k.rotulo}</p>
                </div>
              ))}
            </div>

            <div className="mt-6 flex items-center justify-between gap-2 flex-wrap">
              <h3 className="text-sm font-bold text-white flex items-center gap-2"><MessageSquareText className="w-4 h-4 text-amber-300" /> Avaliações recebidas</h3>
              <div className="flex gap-1.5">
                <button type="button" onClick={() => setFiltro(null)} className={`px-2.5 py-1 rounded-lg text-[12px] font-semibold cursor-pointer ${filtro === null ? 'bg-amber-400 text-black' : 'bg-zinc-900 text-zinc-300'}`}>Todas</button>
                <button type="button" onClick={() => setFiltro('comentarios')} className={`px-2.5 py-1 rounded-lg text-[12px] font-semibold cursor-pointer ${filtro === 'comentarios' ? 'bg-amber-400 text-black' : 'bg-zinc-900 text-zinc-300'}`}>Com comentário</button>
              </div>
            </div>
            {visiveis.length === 0 ? (
              <p className="text-xs text-zinc-500 py-8 text-center">{avaliacoes.length ? 'Nenhuma avaliação com esse filtro.' : 'Ainda não chegaram avaliações nesta campanha.'}</p>
            ) : (
              <ul className="mt-3 space-y-2.5">
                {visiveis.map(a => (
                  <li key={a.id} className="p-3.5 rounded-2xl bg-zinc-950/60 border border-zinc-800 flex gap-3">
                    {a.avatar_url
                      ? <img src={a.avatar_url} alt="" className="w-9 h-9 rounded-full object-cover shrink-0" loading="lazy" />
                      : <span className="w-9 h-9 rounded-full bg-zinc-800 text-zinc-300 text-xs font-bold flex items-center justify-center shrink-0">{a.display_name.slice(0, 1).toUpperCase()}</span>}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <p className="text-xs font-bold text-zinc-100 truncate">{a.display_name} <span className="font-normal text-zinc-500">@{a.username}</span></p>
                        <span className="text-[11px] text-zinc-500 tabular-nums flex items-center gap-1"><CalendarClock className="w-3 h-3" aria-hidden />{data(a.created_at)}</span>
                      </div>
                      <p className="mt-0.5 flex items-center gap-2"><Estrelas n={a.stars} /><span className="text-[12px] text-zinc-400">{ROTULO_ESTRELAS[a.stars]}</span></p>
                      {a.comment && <p className="mt-1.5 text-sm text-zinc-200 whitespace-pre-line break-words">{a.comment}</p>}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </section>
    </div>
  );
};
