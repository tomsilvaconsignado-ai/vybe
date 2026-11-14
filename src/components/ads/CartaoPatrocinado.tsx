// Cartão patrocinado do tamanho dos cartões de perfil, para as faixas do Descobrir ("Em destaque",
// "Populares"). Usa os anúncios do espaço "Descobrir"; sem anúncio nesse espaço, não aparece.
import React, { useEffect, useRef } from 'react';
import { ExternalLink, Megaphone } from 'lucide-react';
import type { Ad } from '../../types';
import { recordAdClick, recordAdImpression } from '../../lib/events';

export const CartaoPatrocinado: React.FC<{ anuncio: Ad }> = ({ anuncio }) => {
  const ref = useRef<HTMLDivElement>(null);

  // conta visualização quando pelo menos metade do cartão aparece
  useEffect(() => {
    if (!ref.current) return;
    const observer = new IntersectionObserver(entries => {
      if (entries.some(e => e.isIntersecting)) { recordAdImpression(anuncio.id); observer.disconnect(); }
    }, { threshold: 0.5 });
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [anuncio.id]);

  const conteudo = (
    <>
      <div className="relative w-full h-36 rounded-2xl overflow-hidden bg-zinc-900 border border-fuchsia-700/50">
        {anuncio.imageUrl
          ? <img src={anuncio.imageUrl} alt="" loading="lazy" className="w-full h-full object-cover" />
          : <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-fuchsia-900/60 to-orange-900/40"><Megaphone className="w-8 h-8 text-fuchsia-200" /></div>}
        <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded-full bg-black/70 text-[10px] font-bold uppercase tracking-wider text-zinc-200">Patrocinado</span>
        {anuncio.linkUrl && (
          <span className="absolute inset-x-1.5 bottom-1.5 py-1 rounded-xl bg-fuchsia-600/90 text-[10px] font-bold text-white flex items-center justify-center gap-1 truncate">
            {anuncio.ctaLabel || 'Saiba mais'} <ExternalLink className="w-3 h-3 shrink-0" />
          </span>
        )}
      </div>
      <p className="text-[12px] font-bold text-zinc-100 truncate mt-1">{anuncio.title}</p>
      <p className="text-[10px] text-zinc-500 truncate">{anuncio.advertiser}</p>
    </>
  );

  return (
    <div ref={ref} className="shrink-0 w-40 text-left">
      {anuncio.linkUrl
        ? <a href={anuncio.linkUrl} target="_blank" rel="noopener noreferrer sponsored" onClick={() => recordAdClick(anuncio.id)} className="block">{conteudo}</a>
        : conteudo}
    </div>
  );
};
