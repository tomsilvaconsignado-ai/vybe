import React, { useMemo } from 'react';
import { CalendarHeart, ChevronRight } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { EventCard } from '../events/EventCard';
import { AdSlot } from '../ads/AdSlot';
import { calculateCompatibility } from '../../utils/compatibility';

// Coluna lateral (telas largas): agenda, publicidade e sugestões
export const RightRail: React.FC = () => {
  const { events, profiles, following, currentUser, toggleFollow, setSelectedProfileId, setActiveTab, setPrivacyTermsModalOpen } = useApp();

  const upcoming = useMemo(() =>
    events
      .filter(e => e.status === 'approved' && new Date(e.startsAt).getTime() > Date.now() - 6 * 3600_000)
      .sort((a, b) => Number(b.isFeatured) - Number(a.isFeatured) || a.startsAt.localeCompare(b.startsAt))
      .slice(0, 3),
  [events]);

  const suggestions = useMemo(() =>
    profiles
      .filter(p => !following.includes(p.id))
      .map(p => ({ p, score: calculateCompatibility(currentUser, p).score }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 4),
  [profiles, following, currentUser]);

  return (
    <aside className="hidden xl:flex w-80 shrink-0 flex-col gap-5 py-6 pr-4 sticky top-16 self-start max-h-[calc(100vh-4rem)] overflow-y-auto no-scrollbar" aria-label="Destaques">

      <section className="bg-[#120d20] border border-purple-900/30 rounded-3xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-white flex items-center gap-1.5">
            <CalendarHeart className="w-4 h-4 text-fuchsia-400" /> Próximos eventos
          </h2>
          <button type="button" onClick={() => setActiveTab('events')} className="text-[11px] font-semibold text-fuchsia-300 flex items-center cursor-pointer">
            Agenda <ChevronRight className="w-3 h-3" />
          </button>
        </div>
        {upcoming.length > 0 ? (
          <div className="space-y-3">
            {upcoming.map(ev => <EventCard key={ev.id} event={ev} compact onOpen={() => setActiveTab('events')} />)}
          </div>
        ) : (
          <p className="text-xs text-zinc-400">Nenhum evento publicado ainda.</p>
        )}
      </section>

      <AdSlot placement="sidebar" />

      {suggestions.length > 0 && (
        <section className="bg-[#120d20] border border-purple-900/30 rounded-3xl p-4 space-y-3">
          <h2 className="text-sm font-bold text-white">Sugestões para você</h2>
          {suggestions.map(({ p, score }) => (
            <div key={p.id} className="flex items-center gap-2.5">
              <button type="button" onClick={() => setSelectedProfileId(p.id)} className="flex items-center gap-2.5 flex-1 min-w-0 text-left cursor-pointer">
                <img src={p.avatarUrl} alt="" className="w-9 h-9 rounded-full object-cover shrink-0" />
                <span className="min-w-0">
                  <span className="block text-xs font-bold text-white truncate">{p.username}</span>
                  <span className="block text-[11px] text-zinc-400 truncate">{score}% de sintonia · {p.city}</span>
                </span>
              </button>
              <button type="button" onClick={() => toggleFollow(p.id)} className="text-xs font-bold text-fuchsia-300 hover:text-fuchsia-200 cursor-pointer">
                Seguir
              </button>
            </div>
          ))}
        </section>
      )}

      <p className="text-[10px] text-zinc-600 px-2 leading-relaxed">
        Vybelog · Exclusivo para maiores de 18 anos ·{' '}
        <button type="button" onClick={() => setPrivacyTermsModalOpen(true)} className="underline cursor-pointer">Termos e privacidade</button>
      </p>
    </aside>
  );
};
