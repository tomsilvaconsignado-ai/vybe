import React, { useMemo, useState } from 'react';
import { CalendarHeart, Plus, X, MapPin, CalendarDays, Ticket, Shirt, Users, ExternalLink, Trash2, Maximize2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { VybeEvent } from '../../types';
import { EventCard, EventRsvpButtons, RSVP_LABEL } from './EventCard';
import { EventComments } from './EventComments';
import { SubmitEventModal } from './SubmitEventModal';
import { AdSlot } from '../ads/AdSlot';
import { EVENT_CATEGORY_LABELS, deleteEvent, formatEventDate, recordEventView } from '../../lib/events';
import { notify, askConfirm } from '../common/Feedback';

type Filter = 'upcoming' | 'city' | 'going' | 'mine';

export const EventsView: React.FC = () => {
  const { events, currentUser, refreshEvents } = useApp();
  const [filter, setFilter] = useState<Filter>('upcoming');
  const [submitOpen, setSubmitOpen] = useState(false);
  const [openEvent, setOpenEvent] = useState<VybeEvent | null>(null);
  const [artFullscreen, setArtFullscreen] = useState(false);
  const [showHidden, setShowHidden] = useState(false);

  const myCity = currentUser.city.trim().toLowerCase();
  const { filtered, hiddenCount } = useMemo(() => {
    const approved = events.filter(e => e.status === 'approved').sort((a, b) =>
      Number(b.isFeatured) - Number(a.isFeatured) || a.startsAt.localeCompare(b.startsAt));
    // "Não tenho interesse" tira o evento das listas (dá para mostrar de novo)
    const withoutHidden = (list: VybeEvent[]) => (showHidden ? list : list.filter(e => e.myStatus !== 'not_interested'));
    let list: VybeEvent[];
    let base: VybeEvent[] = [];
    switch (filter) {
      case 'city':
        base = approved.filter(e => e.city.trim().toLowerCase() === myCity);
        list = withoutHidden(base);
        break;
      case 'going':
        list = approved.filter(e => e.myStatus === 'going' || e.myStatus === 'interested');
        break;
      case 'mine':
        list = events.filter(e => e.createdBy === currentUser.id).sort((a, b) => b.startsAt.localeCompare(a.startsAt));
        break;
      default:
        base = approved;
        list = withoutHidden(base);
    }
    return { filtered: list, hiddenCount: base.filter(e => e.myStatus === 'not_interested').length };
  }, [events, filter, myCity, currentUser.id, showHidden]);

  const filters: { id: Filter; label: string }[] = [
    { id: 'upcoming', label: 'Próximos' },
    { id: 'city', label: myCity ? `Em ${currentUser.city}` : 'Minha cidade' },
    { id: 'going', label: 'Minha agenda' },
    { id: 'mine', label: 'Enviados por mim' }
  ];

  // Abrir a arte conta para o alcance do evento (visto pela administração)
  const openDetail = (event: VybeEvent) => {
    setOpenEvent(event);
    setArtFullscreen(false);
    if (event.status === 'approved') recordEventView(event.id);
  };
  const closeDetail = () => {
    setOpenEvent(null);
    setArtFullscreen(false);
  };

  // Mantém o detalhe sincronizado após responder
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
          {filtered.map(ev => <EventCard key={ev.id} event={ev} onOpen={openDetail} />)}
        </div>
      ) : (
        <div className="p-10 text-center bg-[#120d20] border border-purple-900/30 rounded-3xl">
          <CalendarHeart className="w-12 h-12 text-purple-400 mx-auto mb-3 opacity-60" />
          <h3 className="text-base font-bold text-white mb-1">
            {filter === 'mine' ? 'Você ainda não divulgou eventos' : filter === 'going' ? 'Nada na sua agenda' : 'Nenhum evento por aqui ainda'}
          </h3>
          <p className="text-xs text-zinc-400 max-w-sm mx-auto">
            {filter === 'going' ? 'Abra um evento e toque em "Vou" para ele aparecer aqui.' : 'Conhece uma festa ou casa liberal? Divulgue para a comunidade.'}
          </p>
        </div>
      )}

      {hiddenCount > 0 && (
        <button type="button" onClick={() => setShowHidden(v => !v)} className="block mx-auto text-xs font-semibold text-zinc-400 hover:text-white cursor-pointer">
          {showHidden ? 'Ocultar eventos sem interesse' : `Mostrar ${hiddenCount} ${hiddenCount === 1 ? 'evento marcado' : 'eventos marcados'} como "não tenho interesse"`}
        </button>
      )}

      {submitOpen && <SubmitEventModal onClose={() => setSubmitOpen(false)} />}

      {detail && (
        <div className="modal-overlay fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto" onClick={closeDetail}>
          <div className="max-w-lg w-full bg-[#130d22] border border-purple-800/40 rounded-3xl overflow-hidden shadow-2xl relative my-auto" onClick={e => e.stopPropagation()}>
            <button type="button" onClick={closeDetail} className="absolute top-3 right-3 z-10 p-1.5 rounded-full bg-black/60 text-white cursor-pointer" aria-label="Fechar">
              <X className="w-5 h-5" />
            </button>

            {/* Arte completa, sem cortes; tocar amplia em tela cheia */}
            <button type="button" onClick={() => setArtFullscreen(true)} className="relative block w-full bg-black cursor-zoom-in" aria-label="Ampliar arte">
              <img src={detail.coverUrl} alt={`Arte do evento ${detail.title}`} className="w-full max-h-[75vh] object-contain mx-auto" />
              <span className="absolute bottom-3 right-3 px-2.5 py-1 rounded-full bg-black/70 text-white text-[11px] font-semibold flex items-center gap-1">
                <Maximize2 className="w-3 h-3" /> Tela cheia
              </span>
            </button>

            <div className="p-5 space-y-3">
              <span className="text-[11px] font-semibold text-fuchsia-300">{EVENT_CATEGORY_LABELS[detail.category]}</span>
              <h2 className="text-xl font-bold text-white">{detail.title}</h2>
              <div className="space-y-1.5 text-sm text-zinc-300">
                <p className="flex items-center gap-2"><CalendarDays className="w-4 h-4 text-fuchsia-400 shrink-0" />
                  {formatEventDate(detail.startsAt)}{detail.endsAt ? ` até ${formatEventDate(detail.endsAt)}` : ''}
                </p>
                <p className="flex items-center gap-2"><MapPin className="w-4 h-4 text-fuchsia-400 shrink-0" /> {detail.venueName} · {detail.city}{detail.state ? `/${detail.state}` : ''}</p>
                {detail.priceInfo && <p className="flex items-center gap-2"><Ticket className="w-4 h-4 text-fuchsia-400 shrink-0" /> {detail.priceInfo}</p>}
                {detail.audience && <p className="flex items-center gap-2"><Users className="w-4 h-4 text-fuchsia-400 shrink-0" /> {detail.audience}</p>}
                {detail.dressCode && <p className="flex items-center gap-2"><Shirt className="w-4 h-4 text-fuchsia-400 shrink-0" /> {detail.dressCode}</p>}
              </div>
              {detail.description && <p className="text-sm text-zinc-300 whitespace-pre-line leading-relaxed">{detail.description}</p>}
              {detail.ticketUrl && (
                <a href={detail.ticketUrl} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-1.5 text-xs font-semibold text-fuchsia-300">
                  Abrir link do organizador <ExternalLink className="w-3 h-3" />
                </a>
              )}
              <p className="text-[11px] text-zinc-400 text-center">
                {detail.goingCount} {detail.goingCount === 1 ? 'pessoa vai' : 'pessoas vão'}
                {detail.myStatus ? ` · ${RSVP_LABEL[detail.myStatus]}` : ''}
              </p>
              {detail.status === 'approved' ? (
                <EventRsvpButtons event={detail} onBack={closeDetail} />
              ) : (
                <button type="button" onClick={closeDetail} className="w-full py-2.5 rounded-xl text-xs font-bold text-zinc-300 bg-zinc-900/60 border border-zinc-800 cursor-pointer">
                  Voltar
                </button>
              )}
              {detail.createdBy === currentUser.id && (
                <button
                  type="button"
                  onClick={async () => {
                    if (!(await askConfirm({ title: 'Excluir evento?', message: 'O evento sai da agenda para todos.', confirmLabel: 'Excluir', danger: true }))) return;
                    const error = await deleteEvent(detail.id);
                    if (error) notify(`Não foi possível excluir: ${error}`);
                    closeDetail();
                    refreshEvents();
                  }}
                  className="w-full flex items-center justify-center gap-1.5 text-xs font-semibold text-rose-400 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Excluir evento
                </button>
              )}
              <EventComments event={detail} />
            </div>
          </div>
        </div>
      )}

      {detail && artFullscreen && (
        <div className="fixed inset-0 z-[80] bg-black flex items-center justify-center overflow-auto" onClick={() => setArtFullscreen(false)}>
          <img src={detail.coverUrl} alt={`Arte do evento ${detail.title}`} className="max-w-full max-h-full object-contain" />
          <button
            type="button"
            onClick={() => setArtFullscreen(false)}
            className="fixed top-4 right-4 p-2 rounded-full bg-white/10 text-white cursor-pointer"
            style={{ top: 'max(1rem, env(safe-area-inset-top))' }}
            aria-label="Fechar tela cheia"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      )}
    </div>
  );
};
