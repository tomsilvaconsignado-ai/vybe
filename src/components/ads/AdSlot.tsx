import React, { useEffect, useRef } from 'react';
import { Megaphone, CalendarHeart, ExternalLink } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { AdPlacement } from '../../types';
import { pickAd, recordAdClick, recordAdImpression } from '../../lib/events';

interface AdSlotProps {
  placement: AdPlacement;
  // Variação entre anúncios do mesmo espaço (ex.: posição no feed)
  index?: number;
  variant?: 'feed' | 'compact';
}

// Contato comercial opcional (defina VITE_ADS_CONTACT no build para exibir)
const ADS_CONTACT = import.meta.env.VITE_ADS_CONTACT as string | undefined;

export const AdSlot: React.FC<AdSlotProps> = ({ placement, index = 0, variant = 'compact' }) => {
  const { ads, setActiveTab } = useApp();
  const ad = pickAd(ads, placement, index);
  const ref = useRef<HTMLDivElement>(null);

  // Conta visualização quando pelo menos metade do anúncio aparece na tela
  useEffect(() => {
    if (!ad || !ref.current) return;
    const observer = new IntersectionObserver(entries => {
      if (entries.some(e => e.isIntersecting)) {
        recordAdImpression(ad.id);
        observer.disconnect();
      }
    }, { threshold: 0.5 });
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [ad?.id]);

  if (!ad) {
    // Espaço livre: convite para divulgar (sem anúncio fictício)
    return (
      <div className={`rounded-3xl border border-dashed border-purple-800/50 bg-purple-950/20 p-4 ${variant === 'feed' ? 'mb-6' : ''}`}>
        <span className="text-[10px] uppercase tracking-wider font-bold text-zinc-500">Espaço para divulgação</span>
        <div className="flex items-start gap-3 mt-2">
          <div className="w-9 h-9 rounded-xl bg-fuchsia-600/20 text-fuchsia-400 flex items-center justify-center shrink-0">
            <CalendarHeart className="w-5 h-5" />
          </div>
          <div className="min-w-0 space-y-1">
            <p className="text-sm font-bold text-white">Organiza festas ou tem uma casa liberal?</p>
            <p className="text-xs text-zinc-400">Divulgue seu evento na agenda do VYBE. A moderação revisa e publica.</p>
            {ADS_CONTACT && <p className="text-[11px] text-zinc-500">Anúncios: {ADS_CONTACT}</p>}
          </div>
        </div>
        <button
          type="button"
          onClick={() => setActiveTab('events')}
          className="mt-3 w-full py-2 rounded-xl text-xs font-bold text-fuchsia-300 border border-fuchsia-800/50 hover:bg-fuchsia-950/40 cursor-pointer"
        >
          Divulgar evento
        </button>
      </div>
    );
  }

  const content = (
    <>
      {ad.imageUrl && (
        <img src={ad.imageUrl} alt="" loading="lazy" className={`w-full object-cover ${variant === 'feed' ? 'aspect-[16/9]' : 'aspect-[4/3] rounded-2xl'}`} />
      )}
      <div className={variant === 'feed' ? 'p-4 space-y-1.5' : 'pt-3 space-y-1'}>
        <p className="text-sm font-bold text-white">{ad.title}</p>
        {ad.body && <p className="text-xs text-zinc-400 leading-relaxed">{ad.body}</p>}
        {ad.linkUrl && (
          <span className="inline-flex items-center gap-1 mt-1 text-xs font-bold text-fuchsia-300">
            {ad.ctaLabel} <ExternalLink className="w-3 h-3" />
          </span>
        )}
      </div>
    </>
  );

  return (
    <div ref={ref} className={`rounded-3xl border border-purple-900/30 bg-[#120d20] overflow-hidden ${variant === 'feed' ? 'mb-6' : 'p-4'}`}>
      <div className={`flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-bold text-zinc-500 ${variant === 'feed' ? 'px-4 pt-3 pb-2' : 'pb-2'}`}>
        <Megaphone className="w-3 h-3" /> Patrocinado · {ad.advertiser}
      </div>
      {ad.linkUrl ? (
        <a href={ad.linkUrl} target="_blank" rel="noopener noreferrer sponsored" onClick={() => recordAdClick(ad.id)} className="block">
          {content}
        </a>
      ) : content}
    </div>
  );
};
