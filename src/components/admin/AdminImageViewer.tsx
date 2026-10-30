import React, { useEffect, useState } from 'react';
import { X, Maximize2, Minimize2, ExternalLink } from 'lucide-react';

// Visualizador do painel administrativo: abre qualquer foto (ou vídeo) em tamanho real.
// Qualquer tela do admin chama viewAdminMedia(url); o <AdminImageViewerHost /> fica montado no portal.

interface ViewedMedia { url: string; label?: string; isVideo?: boolean }

let current: ViewedMedia | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach(l => l());

export function viewAdminMedia(url: string, label?: string, isVideo?: boolean) {
  if (!url) return;
  current = { url, label, isVideo: isVideo ?? /\.(mp4|webm|mov)(\?|$)/i.test(url) };
  emit();
}

const close = () => {
  current = null;
  emit();
};

// Miniatura clicável padrão do admin (cursor de lupa e dica)
export const AdminThumb: React.FC<{ src: string; label?: string; className?: string; alt?: string }> = ({ src, label, className = '', alt = '' }) => (
  <img
    src={src}
    alt={alt}
    title="Abrir em tamanho real"
    onClick={e => { e.stopPropagation(); viewAdminMedia(src, label); }}
    className={`cursor-zoom-in ${className}`}
  />
);

export const AdminImageViewerHost: React.FC = () => {
  const [media, setMedia] = useState<ViewedMedia | null>(current);
  const [actualSize, setActualSize] = useState(false);
  const [dimensions, setDimensions] = useState<string>('');

  useEffect(() => {
    const listener = () => {
      setMedia(current);
      setActualSize(false);
      setDimensions('');
    };
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  }, []);

  useEffect(() => {
    if (!media) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [media]);

  if (!media) return null;

  return (
    <div className="fixed inset-0 z-[90] bg-black/95 flex flex-col" role="dialog" aria-label="Mídia em tamanho real">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10 text-white">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate">{media.label || 'Mídia'}</p>
          {dimensions && <p className="text-[11px] text-zinc-400">{dimensions}</p>}
        </div>
        {!media.isVideo && (
          <button
            type="button"
            onClick={() => setActualSize(v => !v)}
            className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
          >
            {actualSize ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            {actualSize ? 'Ajustar à tela' : 'Tamanho real'}
          </button>
        )}
        <a
          href={media.url}
          target="_blank"
          rel="noopener noreferrer"
          className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-semibold flex items-center gap-1.5"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Abrir original</span>
        </a>
        <button type="button" onClick={close} className="p-1.5 rounded-lg hover:bg-white/10 cursor-pointer" aria-label="Fechar">
          <X className="w-5 h-5" />
        </button>
      </div>

      <div
        className={`flex-1 overflow-auto ${actualSize ? '' : 'flex items-center justify-center p-4'}`}
        onClick={e => { if (e.target === e.currentTarget) close(); }}
      >
        {media.isVideo ? (
          <video src={media.url} controls autoPlay className="max-w-full max-h-full" />
        ) : (
          <img
            src={media.url}
            alt={media.label || ''}
            onLoad={e => setDimensions(`${e.currentTarget.naturalWidth} × ${e.currentTarget.naturalHeight} px`)}
            onClick={() => setActualSize(v => !v)}
            className={actualSize ? 'max-w-none cursor-zoom-out' : 'max-w-full max-h-full object-contain cursor-zoom-in'}
          />
        )}
      </div>
    </div>
  );
};
