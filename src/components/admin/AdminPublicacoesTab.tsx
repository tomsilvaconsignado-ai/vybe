// Painel de publicações: resumo, evolução diária, horários, assuntos, autores e lista detalhada.
import React, { useEffect, useMemo, useState } from 'react';
import { RefreshCw, Search, Heart, MessageCircle, Bookmark, Flag, BarChart3, Film, Image as ImageIcon } from 'lucide-react';
import { fetchPainelPublicacoes, PainelPublicacoes, PublicacaoPainel, dataHora, VISIBILIDADE } from '../../lib/adminDetalhes';
import { SITUACAO_MIDIA, TOM } from '../../lib/adminRotulos';
import { AdminThumb, viewAdminMedia } from './AdminImageViewer';
import { Seletor } from '../common/Seletor';
import { VideoThumb } from '../../lib/videoPoster';

const fmt = (n: number | null | undefined) => Number(n ?? 0).toLocaleString('pt-BR');

const Tile: React.FC<{ titulo: string; valor: number; detalhe?: string; alerta?: boolean }> = ({ titulo, valor, detalhe, alerta }) => (
  <div className="p-4 rounded-2xl bg-painel border border-purple-900/30">
    <span className="block text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1">{titulo}</span>
    <span className={`block text-2xl font-black tabular-nums ${alerta && valor > 0 ? 'text-rose-400' : 'text-white'}`}>{fmt(valor)}</span>
    {detalhe && <span className="block text-[12px] text-zinc-500 mt-0.5">{detalhe}</span>}
  </div>
);

type Serie = 'publicacoes' | 'comentarios' | 'curtidas';
const NOME_SERIE: Record<Serie, string> = { publicacoes: 'Publicações', comentarios: 'Comentários', curtidas: 'Curtidas' };

const PorDia: React.FC<{ dados: PainelPublicacoes['por_dia'] }> = ({ dados }) => {
  const [serie, setSerie] = useState<Serie>('publicacoes');
  const [foco, setFoco] = useState<number | null>(null);
  const valores = dados.map(d => Number(d[serie]));
  const max = Math.max(1, ...valores);
  const total = valores.reduce((a, b) => a + b, 0);
  const dia = (iso: string) => new Date(iso + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  const atual = foco !== null ? dados[foco] : null;
  return (
    <div className="p-4 rounded-2xl bg-painel border border-purple-900/30">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="flex gap-1" role="tablist" aria-label="Série do gráfico">
          {(Object.keys(NOME_SERIE) as Serie[]).map(s => (
            <button key={s} type="button" role="tab" aria-selected={serie === s} onClick={() => setSerie(s)}
              className={`px-2.5 py-1 rounded-lg text-[12px] font-bold cursor-pointer ${serie === s ? 'bg-purple-600 text-white' : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200'}`}>
              {NOME_SERIE[s]}
            </button>
          ))}
        </div>
        <span className="text-[12px] text-zinc-400 tabular-nums" aria-live="polite">
          {atual ? `${dia(atual.dia)}: ${fmt(Number(atual[serie]))}` : `${fmt(total)} no período`}
        </span>
      </div>
      <div className="flex items-end gap-[2px] h-32 border-b border-zinc-800" role="img" aria-label={`${NOME_SERIE[serie]} por dia`}>
        {dados.map((d, i) => (
          <div key={d.dia} className="flex-1 h-full flex items-end" onMouseEnter={() => setFoco(i)} onMouseLeave={() => setFoco(null)} onClick={() => setFoco(f => (f === i ? null : i))}>
            <div className={`w-full rounded-t-[3px] transition-colors ${foco === i ? 'bg-fuchsia-300' : 'bg-fuchsia-500/80'}`}
              style={{ height: `${(valores[i] / max) * 100}%`, minHeight: valores[i] ? 3 : 0 }} />
          </div>
        ))}
      </div>
      <div className="flex justify-between mt-1.5 text-[10px] text-zinc-500 tabular-nums">
        <span>{dados[0] && dia(dados[0].dia)}</span>
        <span>{dados.length > 0 && dia(dados[dados.length - 1].dia)}</span>
      </div>
    </div>
  );
};

const PorHora: React.FC<{ dados: Record<string, number> }> = ({ dados }) => {
  const horas = Array.from({ length: 24 }, (_, h) => Number(dados[String(h)] ?? 0));
  const max = Math.max(1, ...horas);
  const pico = horas.indexOf(Math.max(...horas));
  return (
    <div className="p-4 rounded-2xl bg-painel border border-purple-900/30">
      <div className="flex items-baseline justify-between mb-3">
        <h3 className="text-xs font-bold text-zinc-200">Horário das publicações</h3>
        {horas.some(Boolean) && <span className="text-[12px] text-zinc-400">Pico às {pico}h</span>}
      </div>
      <div className="flex items-end gap-[2px] h-20 border-b border-zinc-800" role="img" aria-label="Publicações por hora do dia">
        {horas.map((n, h) => (
          <div key={h} className="flex-1 h-full flex items-end" title={`${h}h: ${n}`}>
            <div className="w-full rounded-t-[3px] bg-violet-500/80" style={{ height: `${(n / max) * 100}%`, minHeight: n ? 3 : 0 }} />
          </div>
        ))}
      </div>
      <div className="flex justify-between mt-1.5 text-[10px] text-zinc-500"><span>0h</span><span>6h</span><span>12h</span><span>18h</span><span>23h</span></div>
    </div>
  );
};

type Ordem = 'recentes' | 'engajamento' | 'curtidas' | 'comentarios' | 'denuncias';

export const AdminPublicacoesTab: React.FC<{ onAbrirUsuario?: (id: string) => void }> = ({ onAbrirUsuario }) => {
  const [dias, setDias] = useState(30);
  const [painel, setPainel] = useState<PainelPublicacoes | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState('');
  const [ordem, setOrdem] = useState<Ordem>('recentes');
  const [filtro, setFiltro] = useState<'todas' | 'midia' | 'denunciadas' | 'sinalizadas'>('todas');

  const carregar = async (d = dias) => {
    setCarregando(true);
    const { painel: p, error } = await fetchPainelPublicacoes(d);
    setPainel(p); setErro(error); setCarregando(false);
  };
  useEffect(() => { carregar(dias); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [dias]);

  const lista = useMemo(() => {
    if (!painel) return [] as PublicacaoPainel[];
    const q = busca.trim().toLowerCase().replace(/^@/, '');
    const l = painel.publicacoes.filter(p => {
      if (filtro === 'midia' && !p.midias) return false;
      if (filtro === 'denunciadas' && !p.denuncias) return false;
      if (filtro === 'sinalizadas' && p.moderacao === 'approved') return false;
      if (!q) return true;
      return p.autor.toLowerCase().includes(q) || (p.texto ?? '').toLowerCase().includes(q) || p.tags.some(t => t.toLowerCase().includes(q));
    });
    const chave: Record<Ordem, (p: PublicacaoPainel) => number> = {
      recentes: p => new Date(p.criada_em).getTime(), engajamento: p => p.engajamento, curtidas: p => p.curtidas,
      comentarios: p => p.comentarios, denuncias: p => p.denuncias
    };
    return [...l].sort((a, b) => chave[ordem](b) - chave[ordem](a));
  }, [painel, busca, ordem, filtro]);

  if (erro) return <p className="p-4 rounded-2xl bg-rose-950/30 border border-rose-900/40 text-xs text-rose-300">Painel de publicações indisponível: {erro}</p>;
  if (!painel) return <div className="h-60 rounded-2xl bg-painel border border-purple-900/30 animate-pulse" aria-label="Carregando publicações" />;

  const r = painel.resumo;
  const mediaInteracoes = r.no_periodo ? (lista.reduce((a, p) => a + p.curtidas + p.comentarios, 0) / Math.max(1, lista.length)) : 0;

  return (
    <section className="space-y-4" aria-label="Painel de publicações">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-bold text-white flex items-center gap-2"><BarChart3 className="w-4 h-4 text-fuchsia-400" /> Publicações</h2>
        <div className="flex items-center gap-2">
          <Seletor value={String(dias)} onChange={e => setDias(Number(e.target.value))} className="px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-white" aria-label="Período">
            <option value="7">Últimos 7 dias</option>
            <option value="30">Últimos 30 dias</option>
            <option value="90">Últimos 90 dias</option>
            <option value="365">Últimos 12 meses</option>
          </Seletor>
          <button type="button" onClick={() => carregar()} disabled={carregando} className="text-[12px] font-semibold text-zinc-400 hover:text-white flex items-center gap-1 cursor-pointer disabled:opacity-50">
            <RefreshCw className={`w-3.5 h-3.5 ${carregando ? 'animate-spin' : ''}`} /> Atualizar
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        <Tile titulo="Publicações no período" valor={r.no_periodo} detalhe={`${fmt(r.total)} no total`} />
        <Tile titulo="Autores no período" valor={r.autores_no_periodo} detalhe={`${fmt(r.autores)} já publicaram`} />
        <Tile titulo="Com foto ou vídeo" valor={r.com_midia} detalhe={`${fmt(r.videos)} vídeos`} />
        <Tile titulo="Curtidas" valor={r.curtidas} detalhe={`${fmt(r.comentarios)} comentários · ${fmt(r.salvamentos)} salvamentos`} />
        <Tile titulo="Públicas" valor={r.publicas} detalhe={`${fmt(r.so_conexoes)} só para conexões · ${fmt(r.em_comunidades)} em comunidades`} />
        <Tile titulo="Stories" valor={r.stories_no_periodo} detalhe={`${fmt(r.stories_ativos)} no ar agora`} />
        <Tile titulo="Em análise / sinalizadas" valor={r.em_analise + r.sinalizadas} detalhe={`${fmt(r.removidas)} removidas`} alerta />
        <Tile titulo="Interações por publicação" valor={Math.round(mediaInteracoes)} detalhe="média de curtidas + comentários" />
      </div>

      <div className="grid lg:grid-cols-2 gap-3">
        <PorDia dados={painel.por_dia} />
        <PorHora dados={painel.por_hora} />
      </div>

      <div className="grid lg:grid-cols-2 gap-3">
        <div className="p-4 rounded-2xl bg-painel border border-purple-900/30">
          <h3 className="text-xs font-bold text-zinc-200 mb-3">Quem mais publicou</h3>
          {painel.autores_top.length === 0 ? <p className="text-[12px] text-zinc-500">Ninguém publicou no período.</p> : (
            <ol className="space-y-1.5">
              {painel.autores_top.map((a, i) => (
                <li key={a.id} className="flex items-center justify-between text-[12px] gap-2">
                  <button type="button" onClick={() => onAbrirUsuario?.(a.id)} className="text-zinc-200 hover:text-fuchsia-300 truncate cursor-pointer text-left">
                    <span className="text-zinc-500 tabular-nums mr-1.5">{i + 1}.</span>@{a.username}
                  </button>
                  <span className="text-zinc-400 tabular-nums shrink-0">{fmt(a.publicacoes)} pub. · {fmt(a.curtidas)} curt. · {fmt(a.comentarios)} com.</span>
                </li>
              ))}
            </ol>
          )}
        </div>
        <div className="p-4 rounded-2xl bg-painel border border-purple-900/30">
          <h3 className="text-xs font-bold text-zinc-200 mb-3">Assuntos mais usados</h3>
          {painel.tags.length === 0 ? <p className="text-[12px] text-zinc-500">Nenhuma hashtag no período.</p> : (
            <div className="flex flex-wrap gap-1.5">
              {painel.tags.map(t => (
                <button key={t.tag} type="button" onClick={() => setBusca(t.tag)} className="px-2.5 py-1 rounded-full bg-purple-950/60 border border-purple-800/50 text-[12px] text-purple-200 hover:bg-purple-900/60 cursor-pointer">
                  #{t.tag} <span className="text-zinc-400 tabular-nums">{fmt(t.n)}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="p-4 rounded-2xl bg-painel border border-purple-900/30 space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar por @autor, texto ou hashtag"
              className="w-full pl-8 pr-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-white focus:outline-none focus:border-purple-500" />
          </div>
          <Seletor value={filtro} onChange={e => setFiltro(e.target.value as typeof filtro)} className="px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-white" aria-label="Filtro">
            <option value="todas">Todas</option>
            <option value="midia">Com foto ou vídeo</option>
            <option value="denunciadas">Com denúncia</option>
            <option value="sinalizadas">Fora do ar ou em análise</option>
          </Seletor>
          <Seletor value={ordem} onChange={e => setOrdem(e.target.value as Ordem)} className="px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-white" aria-label="Ordenar">
            <option value="recentes">Mais recentes</option>
            <option value="engajamento">Maior engajamento</option>
            <option value="curtidas">Mais curtidas</option>
            <option value="comentarios">Mais comentadas</option>
            <option value="denuncias">Mais denunciadas</option>
          </Seletor>
        </div>
        <p className="text-[12px] text-zinc-500">{fmt(lista.length)} publicação(ões){painel.publicacoes.length >= 300 ? ' (mostrando as 300 mais recentes do período)' : ''}.</p>

        {lista.length === 0 ? <p className="text-[12px] text-zinc-500 text-center py-6">Nenhuma publicação com esses filtros.</p> : (
          <ul className="space-y-2">
            {lista.map(p => (
              <li key={p.id} className="p-3 rounded-2xl bg-zinc-950/60 border border-zinc-800 flex gap-3">
                {p.midia && p.tipo_midia === 'video' ? (
                  <button type="button" onClick={() => viewAdminMedia(p.midia!, `Vídeo de @${p.autor}`, true)} aria-label={`Ver vídeo de @${p.autor}`}
                    className="relative w-16 h-16 rounded-xl overflow-hidden bg-black border border-purple-900/40 shrink-0 flex items-center justify-center text-zinc-300 cursor-zoom-in">
                    <VideoThumb url={p.midia} className="absolute inset-0 w-full h-full object-cover" />
                    <Film className="relative w-5 h-5 drop-shadow" />
                  </button>
                ) : p.midia ? (
                  <AdminThumb src={p.midia} label={`Publicação de @${p.autor}`} alt="" className="w-16 h-16 rounded-xl object-cover border border-purple-900/40 shrink-0" />
                ) : (
                  <div className="w-16 h-16 rounded-xl bg-zinc-900 border border-zinc-800 shrink-0 flex items-center justify-center text-[10px] text-zinc-500">texto</div>
                )}
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px]">
                    <button type="button" onClick={() => onAbrirUsuario?.(p.autor_id)} className="font-bold text-zinc-100 hover:text-fuchsia-300 cursor-pointer">@{p.autor}</button>
                    <span className="text-zinc-500 tabular-nums">{dataHora(p.criada_em)}</span>
                    {p.editada_em && <span className="text-zinc-500">· editada</span>}
                    {p.autor_status !== 'active' && <span className={`px-2 py-0.5 rounded-full text-[11px] ${TOM.alerta}`}>conta {p.autor_status}</span>}
                  </div>
                  {p.texto && <p className="text-[13px] text-zinc-300 line-clamp-2 break-words">{p.texto}</p>}
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-zinc-400 tabular-nums">
                    <span className="inline-flex items-center gap-1"><Heart className="w-3.5 h-3.5" />{fmt(p.curtidas)}</span>
                    <span className="inline-flex items-center gap-1"><MessageCircle className="w-3.5 h-3.5" />{fmt(p.comentarios)}</span>
                    <span className="inline-flex items-center gap-1"><Bookmark className="w-3.5 h-3.5" />{fmt(p.salvamentos)}</span>
                    {p.votos_enquete > 0 && <span>{fmt(p.votos_enquete)} votos na enquete</span>}
                    {p.midias > 0 && <span className="inline-flex items-center gap-1">{p.tipo_midia === 'video' ? <Film className="w-3.5 h-3.5" /> : <ImageIcon className="w-3.5 h-3.5" />}{p.midias}</span>}
                    {p.denuncias > 0 && <span className="inline-flex items-center gap-1 text-rose-400"><Flag className="w-3.5 h-3.5" />{fmt(p.denuncias)} denúncia(s)</span>}
                  </div>
                  <div className="flex flex-wrap gap-1.5 text-[11px]">
                    <span className={`px-2 py-0.5 rounded-full ${p.moderacao === 'approved' ? TOM.ok : p.moderacao === 'flagged' ? TOM.perigo : p.moderacao === 'pending_review' ? TOM.alerta : TOM.neutro}`}>
                      {SITUACAO_MIDIA[p.moderacao as keyof typeof SITUACAO_MIDIA] ?? p.moderacao}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full ${TOM.neutro}`}>{VISIBILIDADE[p.visibilidade] ?? p.visibilidade}</span>
                    {p.comunidade && <span className={`px-2 py-0.5 rounded-full ${TOM.neutro}`}>{p.comunidade}</span>}
                    {p.local && <span className={`px-2 py-0.5 rounded-full ${TOM.neutro}`}>{p.local}</span>}
                    {p.tags.slice(0, 4).map(t => <span key={t} className="px-2 py-0.5 rounded-full text-purple-300 bg-purple-950/50">#{t}</span>)}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
};
