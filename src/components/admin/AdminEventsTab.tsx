import React, { useEffect, useState } from 'react';
import { CalendarHeart, Check, X, Star, Eye, MousePointerClick, Pencil, Trash2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { VybeEvent } from '../../types';
import { EVENT_CATEGORY_LABELS, EventStats, adminDeleteEvent, fetchEventStats, fetchEventsForReview, formatEventDate, reviewEvent } from '../../lib/events';
import { SubmitEventModal } from '../events/SubmitEventModal';
import { notify, askText } from '../common/Feedback';
import { AdminThumb } from './AdminImageViewer';

// Alcance da arte: quantas pessoas abriram e o que responderam
const EventReach: React.FC<{ stats?: EventStats }> = ({ stats }) => {
  if (!stats) return <p className="text-zinc-500">Alcance ainda não disponível.</p>;
  const rate = stats.viewers > 0 ? Math.round((stats.interacted / stats.viewers) * 100) : 0;
  const cells = [
    { label: 'Vão', value: stats.going },
    { label: 'Não vão', value: stats.notGoing },
    { label: 'Sem interesse', value: stats.notInterested },
    { label: 'Comentários', value: stats.comments },
    ...(stats.interested > 0 ? [{ label: 'Interesse (antigo)', value: stats.interested }] : [])
  ];
  return (
    <div className="p-3 rounded-2xl bg-zinc-950/70 border border-purple-900/30 space-y-2">
      <div className="flex flex-wrap gap-x-5 gap-y-1">
        <span className="flex items-center gap-1.5 text-white font-bold">
          <Eye className="w-3.5 h-3.5 text-fuchsia-400" /> {stats.viewers} {stats.viewers === 1 ? 'pessoa abriu' : 'pessoas abriram'}
          <span className="font-normal text-zinc-500">({stats.opens} aberturas)</span>
        </span>
        <span className="flex items-center gap-1.5 text-white font-bold">
          <MousePointerClick className="w-3.5 h-3.5 text-fuchsia-400" /> {stats.interacted} interagiram (responderam ou comentaram)
          <span className="font-normal text-zinc-500">({rate}% de quem abriu)</span>
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        {cells.map(c => (
          <span key={c.label} className="px-2 py-1 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300">
            {c.label}: <strong className="text-white">{c.value}</strong>
          </span>
        ))}
      </div>
    </div>
  );
};

const STATUS_STYLES: Record<VybeEvent['status'], string> = {
  pending: 'bg-amber-950 text-amber-300 border-amber-800',
  approved: 'bg-emerald-950 text-emerald-300 border-emerald-800',
  rejected: 'bg-rose-950 text-rose-300 border-rose-800'
};
const STATUS_LABEL: Record<VybeEvent['status'], string> = { pending: 'Pendente', approved: 'Publicado', rejected: 'Recusado' };

export const AdminEventsTab: React.FC = () => {
  const { refreshAdminData, refreshEvents, adminRole } = useApp();
  const podeEditar = adminRole === 'superadmin' || adminRole === 'moderator';
  const [editando, setEditando] = useState<VybeEvent | null>(null);
  const excluir = async (ev: VybeEvent) => {
    const j = (await askText({ title: `Excluir "${ev.title}"?`, message: 'Justificativa (fica na auditoria e o organizador é avisado):', confirmLabel: 'Excluir', danger: true, multiline: true }))?.trim();
    if (j === undefined) return;
    if (j.length < 5) { notify('Informe a justificativa (mínimo 5 caracteres).'); return; }
    const error = await adminDeleteEvent(ev.id, j);
    if (error) { notify(`Não foi possível excluir: ${error}`); return; }
    notify('Evento excluído.');
    await Promise.all([load(), refreshAdminData(), refreshEvents()]);
  };
  const [list, setList] = useState<VybeEvent[]>([]);
  const [filter, setFilter] = useState<'pending' | 'approved' | 'rejected'>('pending');
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Map<string, EventStats>>(new Map());

  const load = async () => {
    const [events, reach] = await Promise.all([fetchEventsForReview(), fetchEventStats()]);
    setList(events);
    setStats(reach);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const act = async (ev: VybeEvent, status: 'approved' | 'rejected', featured = false) => {
    const note = status === 'approved'
      ? (featured ? 'Evento aprovado com destaque.' : 'Evento aprovado pela moderação.')
      : (await askText({ title: 'Recusar evento', message: 'Motivo da recusa (o organizador verá esta mensagem):', confirmLabel: 'Recusar', danger: true, multiline: true }))?.trim();
    if (!note || note.length < 5) {
      if (status === 'rejected') notify('Informe o motivo (mínimo 5 caracteres).');
      return;
    }
    const error = await reviewEvent(ev.id, status, featured, note);
    if (error) {
      notify(`Ação não realizada: ${error}`);
      return;
    }
    await Promise.all([load(), refreshAdminData(), refreshEvents()]);
  };

  const visible = list.filter(e => e.status === filter);
  const counts = { pending: 0, approved: 0, rejected: 0 };
  list.forEach(e => { counts[e.status]++; });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        {(['pending', 'approved', 'rejected'] as const).map(s => (
          <button
            key={s}
            type="button"
            onClick={() => setFilter(s)}
            className={`px-4 py-2 rounded-xl text-xs font-bold cursor-pointer ${filter === s ? 'bg-amber-500 text-black' : 'bg-zinc-900 text-zinc-400 border border-zinc-800'}`}
          >
            {STATUS_LABEL[s]} ({counts[s]})
          </button>
        ))}
      </div>

      {loading && <p className="text-xs text-zinc-400">Carregando eventos...</p>}
      {!loading && visible.length === 0 && (
        <div className="p-10 text-center bg-painel border border-purple-900/30 rounded-3xl text-xs text-zinc-400">
          <CalendarHeart className="w-10 h-10 mx-auto mb-2 text-purple-400 opacity-60" />
          Nenhum evento {STATUS_LABEL[filter].toLowerCase()}.
        </div>
      )}

      {editando && <SubmitEventModal evento={editando} modo="equipe" onClose={() => setEditando(null)} onSaved={() => { load(); }} />}

      <div className="space-y-4">
        {visible.map(ev => (
          <article key={ev.id} className="bg-painel border border-purple-900/30 rounded-3xl p-4 flex flex-col md:flex-row gap-4">
            <AdminThumb src={ev.coverUrl} label={`Arte do evento ${ev.title}`} className="w-full md:w-48 aspect-[16/9] md:aspect-square object-cover rounded-2xl shrink-0" />
            <div className="flex-1 min-w-0 space-y-2 text-xs">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`px-2 py-0.5 rounded border font-bold ${STATUS_STYLES[ev.status]}`}>{STATUS_LABEL[ev.status]}</span>
                {ev.isFeatured && <span className="px-2 py-0.5 rounded bg-amber-500 text-black font-bold">Destaque</span>}
                {ev.editedAt && (
                  <span className="px-2 py-0.5 rounded border border-sky-800 bg-sky-950 text-sky-300 font-bold" title={new Date(ev.editedAt).toLocaleString('pt-BR')}>
                    {ev.editedBy && ev.editedBy === ev.createdBy
                      ? (ev.status === 'approved' ? 'Editado pelo organizador após aprovação' : 'Editado pelo organizador')
                      : 'Editado pela equipe'} · {new Date(ev.editedAt).toLocaleDateString('pt-BR')}
                  </span>
                )}
                <span className="text-zinc-400">{EVENT_CATEGORY_LABELS[ev.category]}</span>
              </div>
              <h3 className="text-base font-bold text-white">{ev.title}</h3>
              <p className="text-zinc-300">{formatEventDate(ev.startsAt)} · {ev.venueName} · {ev.city}{ev.state ? `/${ev.state}` : ''}</p>
              {ev.priceInfo && <p className="text-zinc-400">Valor: {ev.priceInfo}</p>}
              {ev.ticketUrl && <p className="text-zinc-400 break-all">Link: {ev.ticketUrl}</p>}
              {ev.description && <p className="text-zinc-300 whitespace-pre-line">{ev.description}</p>}
              {ev.reviewNote && <p className="text-zinc-500">Nota da moderação: {ev.reviewNote}</p>}
              {ev.status === 'approved' ? <EventReach stats={stats.get(ev.id)} /> : <p className="text-zinc-500">O alcance começa a contar quando o evento é publicado.</p>}
            </div>
            <div className="flex md:flex-col gap-2 shrink-0">
              {ev.status !== 'approved' && (
                <>
                  <button type="button" onClick={() => act(ev, 'approved')} className="flex-1 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center justify-center gap-1 cursor-pointer">
                    <Check className="w-3.5 h-3.5" /> Aprovar
                  </button>
                  <button type="button" onClick={() => act(ev, 'approved', true)} className="flex-1 px-3 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold flex items-center justify-center gap-1 cursor-pointer">
                    <Star className="w-3.5 h-3.5" /> Aprovar com destaque
                  </button>
                </>
              )}
              {ev.status === 'approved' && (
                <button type="button" onClick={() => act(ev, 'approved', !ev.isFeatured)} className="flex-1 px-3 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold flex items-center justify-center gap-1 cursor-pointer">
                  <Star className="w-3.5 h-3.5" /> {ev.isFeatured ? 'Tirar destaque' : 'Destacar'}
                </button>
              )}
              {podeEditar && (
                <button type="button" onClick={() => setEditando(ev)} className="flex-1 px-3 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-100 text-xs font-bold flex items-center justify-center gap-1 cursor-pointer">
                  <Pencil className="w-3.5 h-3.5" /> Editar
                </button>
              )}
              {ev.status !== 'rejected' && (
                <button type="button" onClick={() => act(ev, 'rejected')} className="flex-1 px-3 py-2 rounded-xl bg-rose-950/60 hover:bg-rose-900/60 text-rose-300 text-xs font-bold flex items-center justify-center gap-1 cursor-pointer">
                  <X className="w-3.5 h-3.5" /> {ev.status === 'approved' ? 'Despublicar' : 'Recusar'}
                </button>
              )}
              {podeEditar && (
                <button type="button" onClick={() => excluir(ev)} className="flex-1 px-3 py-2 rounded-xl text-rose-300 hover:bg-rose-950/50 border border-rose-900/50 text-xs font-bold flex items-center justify-center gap-1 cursor-pointer">
                  <Trash2 className="w-3.5 h-3.5" /> Excluir
                </button>
              )}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
};
