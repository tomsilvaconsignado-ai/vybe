// Indicadores reais da plataforma (contagens do banco), com a série de cadastros dos últimos 14 dias
import React, { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { fetchPlatformStats, fetchPushStats, type PlatformStats, type PushStats } from '../../lib/adminPainel';

const fmt = (n: number) => n.toLocaleString('pt-BR');

const Tile: React.FC<{ titulo: string; valor: number; detalhe?: string }> = ({ titulo, valor, detalhe }) => (
  <div className="p-4 rounded-2xl bg-[#120d20] border border-purple-900/30">
    <span className="block text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1">{titulo}</span>
    <span className="block text-2xl font-black text-white tabular-nums">{fmt(valor)}</span>
    {detalhe && <span className="block text-[11px] text-zinc-500 mt-0.5">{detalhe}</span>}
  </div>
);

/** Barras simples (uma série): altura proporcional, valor no toque/hover e rótulos de dia esparsos */
const Cadastros: React.FC<{ serie: { day: string; n: number }[] }> = ({ serie }) => {
  const [foco, setFoco] = useState<number | null>(null);
  const max = Math.max(1, ...serie.map(s => s.n));
  const dia = (iso: string) => new Date(iso + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  const total = serie.reduce((a, s) => a + s.n, 0);
  const atual = foco !== null ? serie[foco] : null;
  return (
    <div className="p-4 rounded-2xl bg-[#120d20] border border-purple-900/30">
      <div className="flex items-baseline justify-between mb-3">
        <h3 className="text-xs font-bold text-zinc-200">Novos cadastros por dia (14 dias)</h3>
        <span className="text-[11px] text-zinc-400 tabular-nums" aria-live="polite">
          {atual ? `${dia(atual.day)}: ${fmt(atual.n)} ${atual.n === 1 ? 'cadastro' : 'cadastros'}` : `${fmt(total)} no período`}
        </span>
      </div>
      <div className="flex items-end gap-[2px] h-28 border-b border-zinc-800" role="img" aria-label={`Cadastros por dia: ${serie.map(s => `${dia(s.day)} ${s.n}`).join(', ')}`}>
        {serie.map((s, i) => (
          <div key={s.day} className="flex-1 h-full flex items-end cursor-default" onMouseEnter={() => setFoco(i)} onMouseLeave={() => setFoco(null)} onClick={() => setFoco(f => (f === i ? null : i))}>
            <div className={`w-full rounded-t-[4px] transition-colors ${foco === i ? 'bg-fuchsia-300' : 'bg-fuchsia-500/80'}`}
              style={{ height: `${Math.max(s.n ? 4 : 0, (s.n / max) * 100)}%`, minHeight: s.n ? 3 : 0 }} />
          </div>
        ))}
      </div>
      <div className="flex justify-between mt-1.5 text-[10px] text-zinc-500 tabular-nums">
        <span>{serie[0] && dia(serie[0].day)}</span>
        <span>{serie[7] && dia(serie[7].day)}</span>
        <span>{serie.length > 0 && dia(serie[serie.length - 1]!.day)}</span>
      </div>
    </div>
  );
};

export const AdminIndicadores: React.FC = () => {
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [push, setPush] = useState<PushStats | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);

  const carregar = async () => {
    setCarregando(true);
    const [{ stats: s, error }, p] = await Promise.all([fetchPlatformStats(), fetchPushStats()]);
    setStats(s); setErro(error); setPush(p); setCarregando(false);
  };
  useEffect(() => { carregar(); }, []);

  if (erro) return <p className="p-4 rounded-2xl bg-rose-950/30 border border-rose-900/40 text-xs text-rose-300">Indicadores indisponíveis: {erro}</p>;
  if (!stats) return <div className="h-40 rounded-2xl bg-[#120d20] border border-purple-900/30 animate-pulse" aria-label="Carregando indicadores" />;

  return (
    <section className="space-y-4" aria-label="Indicadores da plataforma">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-white">Indicadores da plataforma</h2>
        <button type="button" onClick={carregar} disabled={carregando} className="text-[11px] font-semibold text-zinc-400 hover:text-white flex items-center gap-1 cursor-pointer disabled:opacity-50">
          <RefreshCw className={`w-3.5 h-3.5 ${carregando ? 'animate-spin' : ''}`} /> Atualizar
        </button>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        <Tile titulo="Usuários" valor={stats.users} detalhe={`+${fmt(stats.new_7d)} em 7 dias · +${fmt(stats.new_30d)} em 30`} />
        <Tile titulo="Ativos hoje" valor={stats.active_1d} detalhe={`${fmt(stats.active_7d)} na semana · ${fmt(stats.active_30d)} no mês`} />
        <Tile titulo="Novos hoje" valor={stats.new_1d} />
        <Tile titulo="Publicações" valor={stats.posts} detalhe={`${fmt(stats.posts_7d)} nos últimos 7 dias`} />
        <Tile titulo="Comentários (7 dias)" valor={stats.comments_7d} />
        <Tile titulo="Mensagens (7 dias)" valor={stats.messages_7d} />
        <Tile titulo="Comunidades" valor={stats.communities} detalhe={`+${fmt(stats.communities_7d)} em 7 dias`} />
        <Tile titulo="Eventos futuros" valor={stats.events_upcoming} detalhe={`${fmt(stats.events_pending)} aguardando aprovação`} />
        <Tile titulo="Denúncias abertas" valor={stats.reports_open} detalhe={`${fmt(stats.reports_7d)} recebidas em 7 dias`} />
        {push && <Tile titulo="Aparelhos com push" valor={push.devices} detalhe={`${fmt(push.users_with_push)} pessoas`} />}
        {push && <Tile titulo="Push enviados (7 dias)" valor={push.sent_7d} detalhe={`${fmt(push.failed_7d)} falhas · ${fmt(push.pending)} na fila`} />}
      </div>
      {stats.signups_14d?.length > 0 && <Cadastros serie={stats.signups_14d.map(s => ({ day: s.day, n: Number(s.n) }))} />}
    </section>
  );
};
