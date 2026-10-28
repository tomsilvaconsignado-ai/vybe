import React, { useEffect, useState } from 'react';
import logoFullUrl from '../../assets/logo-full.jpg';

// Abertura com a marca: aparece uma vez por sessão e some sozinha (ou com um toque).
const SEEN_KEY = 'vybe_intro_seen';
const DURATION_MS = 1300;

const alreadySeen = () => {
  try {
    return sessionStorage.getItem(SEEN_KEY) === '1' || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
};

export const IntroSplash: React.FC = () => {
  const [visible, setVisible] = useState(() => !alreadySeen());
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    try { sessionStorage.setItem(SEEN_KEY, '1'); } catch { /* navegação privada */ }
    const leave = window.setTimeout(() => setLeaving(true), DURATION_MS - 300);
    const hide = window.setTimeout(() => setVisible(false), DURATION_MS);
    return () => { window.clearTimeout(leave); window.clearTimeout(hide); };
  }, [visible]);

  if (!visible) return null;

  return (
    <div
      role="presentation"
      onClick={() => setVisible(false)}
      className={`fixed inset-0 z-[10000] bg-[#0b031b] flex items-center justify-center transition-opacity duration-300 ${leaving ? 'opacity-0' : 'opacity-100'}`}
    >
      <img src={logoFullUrl} alt="Vybelog" className="intro-logo w-64 sm:w-80 select-none" draggable={false} />
    </div>
  );
};
