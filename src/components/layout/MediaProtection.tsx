import React, { useEffect, useMemo } from 'react';
import { useApp } from '../../context/AppContext';

// Proteção das fotos e vídeos dos membros. Navegador nenhum impede o print do sistema,
// então o objetivo é dificultar e desestimular:
// - sem "salvar imagem" (botão direito / toque longo), arrastar, Ctrl+S ou imprimir;
// - mídia borrada quando a página perde o foco ou a tecla Print Screen é usada;
// - marca d'água discreta com o @ de quem está vendo, que identifica a origem de um print vazado.
const SHIELD_CLASS = 'media-shield';

const isMedia = (target: EventTarget | null) =>
  target instanceof HTMLImageElement || target instanceof HTMLVideoElement;

export const MediaProtection: React.FC = () => {
  const { currentUser } = useApp();

  useEffect(() => {
    const root = document.documentElement;
    let shieldTimer: number | undefined;

    const shield = (ms?: number) => {
      root.classList.add(SHIELD_CLASS);
      window.clearTimeout(shieldTimer);
      if (ms) shieldTimer = window.setTimeout(() => root.classList.remove(SHIELD_CLASS), ms);
    };
    const unshield = () => {
      window.clearTimeout(shieldTimer);
      root.classList.remove(SHIELD_CLASS);
    };

    const blockOnMedia = (e: Event) => { if (isMedia(e.target)) e.preventDefault(); };

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'PrintScreen') {
        shield(2000);
        // Sobrescreve o print que o Windows acabou de copiar (quando o navegador permite)
        navigator.clipboard?.writeText('').catch(() => undefined);
        return;
      }
      const key = e.key.toLowerCase();
      if ((e.ctrlKey || e.metaKey) && (key === 's' || key === 'p')) e.preventDefault();
      // Atalhos de captura do Mac (Cmd+Shift+3/4/5) e do Windows (Win+Shift+S)
      if (e.shiftKey && (e.metaKey || e.key === 'Meta') && ['3', '4', '5', 's'].includes(key)) shield(3000);
    };

    const onVisibility = () => (document.hidden ? shield() : unshield());
    const onBlur = () => shield();

    document.addEventListener('contextmenu', blockOnMedia);
    document.addEventListener('dragstart', blockOnMedia);
    document.addEventListener('keydown', onKey);
    document.addEventListener('keyup', onKey);
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('blur', onBlur);
    window.addEventListener('focus', unshield);

    return () => {
      unshield();
      document.removeEventListener('contextmenu', blockOnMedia);
      document.removeEventListener('dragstart', blockOnMedia);
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('keyup', onKey);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('focus', unshield);
    };
  }, []);

  // Marca d'água em mosaico com o @ de quem está vendo (quase invisível no uso normal)
  const watermark = useMemo(() => {
    const label = `@${currentUser.username || 'vybelog'} · Vybelog`.replace(/[<>&"']/g, '');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="260" height="160"><text x="0" y="90" transform="rotate(-24 130 80)" fill="white" font-family="Arial, sans-serif" font-size="14">${label}</text></svg>`;
    return `url("data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}")`;
  }, [currentUser.username]);

  return (
    <div
      aria-hidden="true"
      className="media-watermark pointer-events-none fixed inset-0 z-[9999]"
      style={{ backgroundImage: watermark }}
    />
  );
};
