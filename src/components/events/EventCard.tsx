import React from 'react';
import { CalendarDays, MapPin, Ticket, Star, Users, ExternalLink } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { VybeEvent } from '../../types';
import { EVENT_CATEGORY_LABELS, formatEventDate } from '../../lib/events';

interface EventCardProps {
  event: VybeEvent;
  compact?: boolean;
  onOpen?: (event: VybeEvent) => void;
}

const STATUS_LABEL: Record<VybeEvent['status'], string> = {
  pending: 'Em análise pela moderação',
  approved: 'Publicado',
  rejected: 'Não aprovado'
};

export const EventCard: React.FC<EventCardProps> = ({ event, compact, onOpen }) => {
  const { currentUser } = useApp();
  const isMine = event.createdBy === currentUser.id;
  const canRsvp = event.status === 'approved';

  if (compact) {
    return (
      <button type="button" onClick={() => onOpen?.(event)} className="w-full flex gap-3 text-left group cursor-pointer">
        <img src={event.coverUrl} alt="" className="w-14 h-14 rounded-xl object-cover shrink-0" />
        <div className="min-w-0">
          <p className="text-[11px] font-semibold text-fuchsia-300">{formatEventDate(event.startsAt)}</p>
          <p className="text-sm font-bold text-white truncate group-hover:text-purple-300">{event.title}</p>
          <p className="text-[11px] text-zinc-400 truncate">{event.venueName} · {event.city}</p>
        </div>
      </button>
    );
  }

  return (
    <article className={`bg-[#120d20] border rounded-3xl overflow-hidden shadow-xl ${event.isFeatured ? 'border-amber-500/50' : 'border-purple-900/30'}`}>
      <button type="button" onClick={() => onOpen?.(event)} className="relative block w-full aspect-[16/9] bg-zinc-950 cursor-pointer">
        <img src={event.coverUrl} alt="" loading="lazy" className="w-full h-full object-cover" />
        <span className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-black/70 text-white text-[11px] font-semibold">
          {EVENT_CATEGORY_LABELS[event.category]}
        </span>
        {event.isFeatured && (
          <span className="absolute top-3 right-3 px-2.5 py-1 rounded-full bg-amber-500 text-black text-[11px] font-bold flex items-center gap-1">
            <Star className="w-3 h-3" /> Destaque
          </span>
        )}
      </button>

      <div className="p-4 space-y-3">
        {isMine && event.status !== 'approved' && (
          <p className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg inline-block ${event.status === 'pending' ? 'bg-amber-950/60 text-amber-300' : 'bg-rose-950/60 text-rose-300'}`}>
            {STATUS_LABEL[event.status]}{event.status === 'rejected' && event.reviewNote ? `: ${event.reviewNote}` : ''}
          </p>
        )}

        <div>
          <p className="text-xs font-bold text-fuchsia-300 flex items-center gap-1.5">
            <CalendarDays className="w-3.5 h-3.5" /> {formatEventDate(event.startsAt)}
          </p>
          <h3 className="text-base font-bold text-white mt-1">{event.title}</h3>
          <p className="text-xs text-zinc-400 flex items-center gap-1 mt-0.5">
            <MapPin className="w-3 h-3 shrink-0" /> {event.venueName} · {event.city}{event.state ? `/${event.state}` : ''}
          </p>
          {event.priceInfo && (
            <p className="text-xs text-zinc-300 flex items-center gap-1 mt-0.5">
              <Ticket className="w-3 h-3 shrink-0" /> {event.priceInfo}
            </p>
          )}
        </div>

        <p className="text-[11px] text-zinc-400 flex items-center gap-1">
          <Users className="w-3 h-3" /> {event.goingCount} {event.goingCount === 1 ? 'vai' : 'vão'} · {event.interestedCount} com interesse
        </p>

        {canRsvp && <EventRsvpButtons event={event} />}

        {event.ticketUrl && canRsvp && (
          <a
            href={event.ticketUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-1.5 text-xs font-semibold text-fuchsia-300 hover:text-fuchsia-200"
          >
            Ingressos e informações <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </div>
    </article>
  );
};

export const EventRsvpButtons: React.FC<{ event: VybeEvent }> = ({ event }) => {
  const { rsvpEvent } = useApp();
  return (
    <div className="grid grid-cols-2 gap-2">
      <button
        type="button"
        onClick={() => rsvpEvent(event.id, event.myStatus === 'going' ? null : 'going')}
        aria-pressed={event.myStatus === 'going'}
        className={`py-2 rounded-xl text-xs font-bold cursor-pointer ${
          event.myStatus === 'going' ? 'bg-gradient-to-r from-purple-600 to-rose-600 text-white' : 'bg-zinc-900 border border-zinc-800 text-zinc-200 hover:border-purple-700'
        }`}
      >
        {event.myStatus === 'going' ? '✓ Vou' : 'Vou'}
      </button>
      <button
        type="button"
        onClick={() => rsvpEvent(event.id, event.myStatus === 'interested' ? null : 'interested')}
        aria-pressed={event.myStatus === 'interested'}
        className={`py-2 rounded-xl text-xs font-bold cursor-pointer ${
          event.myStatus === 'interested' ? 'bg-purple-950 border border-purple-500 text-white' : 'bg-zinc-900 border border-zinc-800 text-zinc-200 hover:border-purple-700'
        }`}
      >
        {event.myStatus === 'interested' ? '✓ Tenho interesse' : 'Tenho interesse'}
      </button>
    </div>
  );
};
