import React from 'react';
import { CalendarDays, MapPin, Ticket, Star, Users, Check, X, EyeOff, Maximize2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { EventRsvpStatus, VybeEvent } from '../../types';
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

export const RSVP_LABEL: Record<EventRsvpStatus, string> = {
  going: 'Você vai',
  interested: 'Você tem interesse',
  not_going: 'Você não vai',
  not_interested: 'Sem interesse'
};

export const EventCard: React.FC<EventCardProps> = ({ event, compact, onOpen }) => {
  const { currentUser } = useApp();
  const isMine = event.createdBy === currentUser.id;

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

  // O cartão inteiro abre a arte completa, onde a pessoa responde
  return (
    <article
      role="button"
      tabIndex={0}
      onClick={() => onOpen?.(event)}
      onKeyDown={e => { if (e.key === 'Enter') onOpen?.(event); }}
      className={`bg-[#120d20] border rounded-3xl overflow-hidden shadow-xl cursor-pointer transition-transform active:scale-[0.99] ${event.isFeatured ? 'border-amber-500/50' : 'border-purple-900/30 hover:border-purple-700/50'}`}
    >
      <div className="relative w-full aspect-[16/9] bg-zinc-950">
        <img src={event.coverUrl} alt="" loading="lazy" className="w-full h-full object-cover" />
        <span className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-black/70 text-white text-[11px] font-semibold">
          {EVENT_CATEGORY_LABELS[event.category]}
        </span>
        {event.isFeatured && (
          <span className="absolute top-3 right-3 px-2.5 py-1 rounded-full bg-amber-500 text-black text-[11px] font-bold flex items-center gap-1">
            <Star className="w-3 h-3" /> Destaque
          </span>
        )}
        <span className="absolute bottom-3 right-3 px-2.5 py-1 rounded-full bg-black/70 text-white text-[11px] font-semibold flex items-center gap-1">
          <Maximize2 className="w-3 h-3" /> Ver arte completa
        </span>
      </div>

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

        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] text-zinc-400 flex items-center gap-1">
            <Users className="w-3 h-3" /> {event.goingCount} {event.goingCount === 1 ? 'vai' : 'vão'}
          </p>
          {event.myStatus && (
            <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${
              event.myStatus === 'going' ? 'bg-gradient-to-r from-purple-600 to-rose-600 text-white' : 'bg-zinc-800 text-zinc-300'
            }`}>
              {RSVP_LABEL[event.myStatus]}
            </span>
          )}
        </div>
      </div>
    </article>
  );
};

// Respostas na arte: Vou · Não vou · Não tenho interesse · Voltar. Tocar de novo na escolhida desfaz.
export const EventRsvpButtons: React.FC<{ event: VybeEvent; onBack: () => void }> = ({ event, onBack }) => {
  const { rsvpEvent } = useApp();
  const choose = (status: EventRsvpStatus) => rsvpEvent(event.id, event.myStatus === status ? null : status);
  const options: { id: EventRsvpStatus; label: string; icon: typeof Check; active: string }[] = [
    { id: 'going', label: 'Vou', icon: Check, active: 'bg-gradient-to-r from-purple-600 to-rose-600 text-white border-transparent' },
    { id: 'not_going', label: 'Não vou', icon: X, active: 'bg-zinc-700 text-white border-zinc-500' },
    { id: 'not_interested', label: 'Não tenho interesse', icon: EyeOff, active: 'bg-zinc-700 text-white border-zinc-500' }
  ];

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-3 gap-2">
        {options.map(opt => {
          const selected = event.myStatus === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => choose(opt.id)}
              aria-pressed={selected}
              className={`py-2.5 px-1 rounded-xl border text-xs font-bold flex flex-col items-center gap-1 cursor-pointer transition-colors ${
                selected ? opt.active : 'bg-zinc-900 border-zinc-800 text-zinc-200 hover:border-purple-700'
              }`}
            >
              <opt.icon className="w-4 h-4" />
              <span className="leading-tight text-center">{opt.label}</span>
            </button>
          );
        })}
      </div>
      <button
        type="button"
        onClick={onBack}
        className="w-full py-2.5 rounded-xl text-xs font-bold text-zinc-300 bg-zinc-900/60 border border-zinc-800 hover:text-white cursor-pointer"
      >
        Voltar
      </button>
    </div>
  );
};
