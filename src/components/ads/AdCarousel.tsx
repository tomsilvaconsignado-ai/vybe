import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Megaphone, ExternalLink, ChevronLeft, ChevronRight } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { recordAdClick, recordAdImpression } from '../../lib/events';

// Tempo de cada slide antes de passar para o próximo
const SLIDE_MS = 6000;

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// Carrossel de anúncios da coluna lateral (espaço "carousel"). Sem anúncio, não ocupa espaço.
export const AdCarousel: React.FC = () => {
  const { ads } = useApp();
  const slides = useMemo(() => ads.filter(a => a.placement === 'carousel'), [ads]);
  const [current, setCurrent] = useState(0);
  const [paused, setPaused] = useState(false);
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLElement>(null);

  // Se a lista diminuir (anúncio pausado ou vencido), volta para um slide que existe
  const active = slides.length ? current % slides.length : 0;
  const ad = slides[active];

  // Só passa sozinho quando aparece na tela, sem o mouse ou o foco em cima e sem "reduzir movimento"
  useEffect(() => {
    if (slides.length < 2 || paused || !visible || prefersReducedMotion()) return;
    const timer = window.setTimeout(() => setCurrent(c => (c + 1) % slides.length), SLIDE_MS);
    return () => window.clearTimeout(timer);
  }, [active, slides.length, paused, visible]);

  useEffect(() => {
    if (!ref.current) return;
    const observer = new IntersectionObserver(entries => setVisible(entries.some(e => e.isIntersecting)), { threshold: 0.5 });
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [slides.length > 0]);

  // Conta visualização do slide que realmente apareceu (uma por sessão, como nos outros espaços)
  useEffect(() => {
    if (ad && visible) recordAdImpression(ad.id);
  }, [ad?.id, visible]);

  if (!slides.length) return null;

  const go = (step: number) => setCurrent((active + step + slides.length) % slides.length);

  return (
    <section
      ref={ref}
      aria-roledescription="carrossel"
      aria-label="Publicidade"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setPaused(false); }}
      className="rounded-3xl border border-purple-900/30 bg-[#120d20] overflow-hidden"
    >
      <div className="flex items-center justify-between px-4 pt-3 pb-2">
        <span className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-bold text-zinc-500 min-w-0">
          <Megaphone className="w-3 h-3 shrink-0" /> <span className="truncate">Patrocinado · {ad.advertiser}</span>
        </span>
        {slides.length > 1 && (
          <span className="flex items-center gap-0.5 shrink-0">
            <button type="button" onClick={() => go(-1)} className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 cursor-pointer" aria-label="Anúncio anterior">
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <button type="button" onClick={() => go(1)} className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 cursor-pointer" aria-label="Próximo anúncio">
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </span>
        )}
      </div>

      <div className="overflow-hidden">
        <div className="flex transition-transform duration-500 ease-out motion-reduce:transition-none" style={{ transform: `translateX(-${active * 100}%)` }}>
          {slides.map((slide, i) => {
            const hidden = i !== active;
            const content = (
              <>
                {slide.imageUrl && <img src={slide.imageUrl} alt="" loading="lazy" className="w-full aspect-[4/3] object-cover" />}
                <div className="p-4 pt-3 space-y-1">
                  <p className="text-sm font-bold text-white">{slide.title}</p>
                  {slide.body && <p className="text-xs text-zinc-400 leading-relaxed line-clamp-3">{slide.body}</p>}
                  {slide.linkUrl && (
                    <span className="inline-flex items-center gap-1 mt-1 text-xs font-bold text-fuchsia-300">
                      {slide.ctaLabel} <ExternalLink className="w-3 h-3" />
                    </span>
                  )}
                </div>
              </>
            );
            return (
              <div
                key={slide.id}
                role="group"
                aria-roledescription="slide"
                aria-label={`${i + 1} de ${slides.length}`}
                aria-hidden={hidden}
                className="w-full shrink-0"
              >
                {slide.linkUrl ? (
                  <a href={slide.linkUrl} target="_blank" rel="noopener noreferrer sponsored" tabIndex={hidden ? -1 : 0} onClick={() => recordAdClick(slide.id)} className="block">
                    {content}
                  </a>
                ) : content}
              </div>
            );
          })}
        </div>
      </div>

      {slides.length > 1 && (
        <div className="flex justify-center gap-1.5 pb-3">
          {slides.map((slide, i) => (
            <button
              key={slide.id}
              type="button"
              onClick={() => setCurrent(i)}
              aria-label={`Mostrar anúncio ${i + 1}`}
              aria-current={i === active}
              className={`h-1.5 rounded-full transition-all cursor-pointer ${i === active ? 'w-5 bg-fuchsia-400' : 'w-1.5 bg-zinc-600 hover:bg-zinc-400'}`}
            />
          ))}
        </div>
      )}
    </section>
  );
};
