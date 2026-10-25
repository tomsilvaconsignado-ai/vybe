import React, { useMemo, useState } from 'react';
import { CalendarHeart, Plus, X, MapPin, CalendarDays, Ticket, Shirt, Users, ExternalLink, Trash2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { VybeEvent } from '../../types';
import { EventCard, EventRsvpButtons } from './EventCard';
import { SubmitEventModal } from './SubmitEventModal';
import { AdSlot } from '../ads/AdSlot';
import { EVENT_CATEGORY_LABELS, deleteEvent, formatEventDate } from '../../lib/events';

type Filter = 'upcoming' | 'city' | 'going' | 'mine';

export const EventsView: React.FC = () => {
  const { events, currentUser, refreshEvents } = useApp();
  const [filter, setFilter] = useState<Filter>('upcoming');
  const [submitOpen, setSubmitOpen] = useState(false);
  const [openEvent, setOpenEvent] = useState<VybeEvent | null>(null);

  const myCity = currentUser.city.trim().toLowerCase();
  const filtered = useMemo(() => {
    const approved = events.filter(e => e.status === 'approved').sort((a, b) =>
      Number(b.isFeatured) - Number(a.isFeatured) || a.startsAt.localeCompare(b.startsAt));
    switch (filter) {
      case 'city': return approved.filter(e => e.city.trim().toLowerCase() === myCity);
      case 'going': return approved.filter(e => e.myStatus);
      case 'mine': return events.filter(e => e.createdBy === currentUser.id).sort((a, b) => b.startsAt.localeCompare(a.startsAt));
      default: return approved;
    }
  }, [events, filter, myCity, currentUser.id]);

  const filters: { id: Filter; label: string }[] = [
    { id: 'upcoming', label: 'Próximos' },
    { id: 'city', label: myCity ? `Em ${currentUser.city}` : 'Minha cidade' },
    { id: 'going', label: 'Minha agenda' },
    { id: 'mine', label: 'Enviados por mim' }
  ];

  // Mantém o detalhe sincronizado após confirmar presença
  const detail = openEvent ? events.find(e => e.id === openEvent.id) ?? openEvent : null;

  return (
    <div className="max-w-5xl mx-auto py-6 px-4 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white flex items-center gap-2">
            <CalendarHeart className="w-6 h-6 text-fuchsia-400" /> Agenda Liberal
          </h1>
          <p className="text-xs text-zinc-400 mt-0.5">Festas, encontros e casas parceiras. Todos os eventos passam pela moderação.</p>
        </div>
        <button
          type="button"
          onClick={() => setSubmitOpen(true)}
          className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-rose-600 text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
        >
          <Plus className="w-4 h-4" /> Divulgar evento
        </button>
      </div>

      <div className="flex gap-2 overflow-x-auto no-scrollbar">
        {filters.map(f => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap cursor-pointer ${
              filter === f.id ? 'bg-purple-600 text-white' : 'bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <AdSlot placement="events" variant="feed" />

      {filtered.length > 0 ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map(ev => <EventCard key={ev.id} event={ev} onOpen={setOpenEvent} />)}
        </div>
      ) : (
        <div className="p-10 text-center bg-[#120d20] border border-purple-900/30 rounded-3xl">
          <CalendarHeart className="w-12 h-12 text-purple-400 mx-auto mb-3 opacity-60" />
          <h3 className="text-base font-bold text-white mb-1">
            {filter === 'mine' ? 'Você ainda não divulgou eventos' : filter === 'going' ? 'Nada na sua agenda' : 'Nenhum evento por aqui ainda'}
          </h3>
          <p className="text-xs text-zinc-400 max-w-sm mx-auto">
            {filter === 'going' ? 'Marque "Vou" ou "Tenho interesse" em um evento para ele aparecer aqui.' : 'Conhece uma festa ou casa liberal? Divulgue para a comunidade.'}
          </p>
        </div>
      )}

      {submitOpen && <SubmitEventModal onClose={() => setSubmitOpen(false)} />}

      {detail && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto" onClick={() => setOpenEvent(null)}>
          <div className="max-w-lg w-full bg-[#130d22] border border-purple-800/40 rounded-3xl overflow-hidden shadow-2xl relative my-auto" onClick={e => e.stopPropagation()}>
            <button type="button" onClick={() => setOpenEvent(null)} className="absolute top-3 right-3 z-10 p-1.5 rounded-full bg-black/60 text-white cursor-pointer" aria-label="Fechar">
              <X className="w-5 h-5" />
            </button>
            <img src={detail.coverUrl} alt="" className="w-full aspect-[16/9] object-cover" />
            <div className="p-5 space-y-3">
              <span className="text-[11px] font-semibold text-fuchsia-300">{EVENT_CATEGORY_LABELS[detail.category]}</span>
              <h2 className="text-xl font-bold text-white">{detail.title}</h2>
              <div className="space-y-1.5 text-sm text-zinc-300">
                <p className="flex items-center gap-2"><CalendarDays className="w-4 h-4 text-fuchsia-400" />
                  {formatEventDate(detail.startsAt)}{detail.endsAt ? ` até ${formatEventDate(detail.endsAt)}` : ''}
                </p>
                <p className="flex items-center gap-2"><MapPin className="w-4 h-4 text-fuchsia-400" /> {detail.venueName} · {detail.city}{detail.state ? `/${detail.state}` : ''}</p>
                {detail.priceInfo && <p className="flex items-center gap-2"><Ticket className="w-4 h-4 text-fuchsia-400" /> {detail.priceInfo}</p>}
                {detail.audience && <p className="flex items-center gap-2"><Users className="w-4 h-4 text-fuchsia-400" /> {detail.audience}</p>}
                {detail.dressCode && <p className="flex items-center gap-2"><Shirt className="w-4 h-4 text-fuchsia-400" /> {detail.dressCode}</p>}
              </div>
              {detail.description && <p className="text-sm text-zinc-300 whitespace-pre-line leading-relaxed">{detail.description}</p>}
              {detail.status === 'approved' && <EventRsvpButtons event={detail} />}
              <p className="text-[11px] text-zinc-400 text-center">{detail.goingCount} {detail.goingCount === 1 ? 'vai' : 'vão'} · {detail.interestedCount} com interesse</p>
              {detail.ticketUrl && (
                <a href={detail.ticketUrl} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-1.5 text-xs font-semibold text-fuchsia-300">
                  Abrir link do organizador <ExternalLink className="w-3 h-3" />
                </a>
              )}
              {detail.createdBy === currentUser.id && (
                <button
                  type="button"
                  onClick={async () => {
                    if (!confirm('Excluir este evento?')) return;
                    const error = await deleteEvent(detail.id);
                    if (error) alert(`Não foi possível excluir: ${error}`);
                    setOpenEvent(null);
                    refreshEvents();
                  }}
                  className="w-full flex items-center justify-center gap-1.5 text-xs font-semibold text-rose-400 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Excluir evento
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
