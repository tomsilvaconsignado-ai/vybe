// Arte do Quiz do Kama Sutra (tudo desenho próprio, em SVG/CSS — nenhuma imagem de fora):
// moldura dourada no estilo das miniaturas indianas (com a pedra na cor do nível), capa ilustrada,
// confete de acerto, medalha do placar, ampulheta da espera e sons curtos opcionais.
import React, { useEffect, useMemo, useState } from 'react';

export type Nivel = 1 | 2 | 3;
export const NIVEIS: Record<Nivel, { rotulo: string; pedra: string; brilho: string; texto: string }> = {
  1: { rotulo: 'Fácil', pedra: '#34d399', brilho: 'rgba(52,211,153,0.45)', texto: 'text-emerald-200' },
  2: { rotulo: 'Intermediário', pedra: '#fbbf24', brilho: 'rgba(251,191,36,0.45)', texto: 'text-amber-200' },
  3: { rotulo: 'Difícil', pedra: '#fb3a6b', brilho: 'rgba(251,58,107,0.5)', texto: 'text-rose-200' },
};

const OURO = '#e9b949';

/** roseta de 8 pétalas com a pedra no meio (cantos da moldura) */
const Roseta: React.FC<{ pedra: string; className?: string }> = ({ pedra, className = '' }) => (
  <svg viewBox="-10 -10 20 20" className={className} aria-hidden>
    {Array.from({ length: 8 }, (_, i) => (
      <ellipse key={i} cx="0" cy="-5" rx="2.1" ry="4" fill={OURO} stroke="#7a4f12" strokeWidth="0.5" transform={`rotate(${i * 45})`} />
    ))}
    <circle r="3.4" fill={pedra} stroke="#fff7d6" strokeWidth="0.9" />
    <circle cx="-1" cy="-1.1" r="0.9" fill="#fff" opacity="0.75" />
  </svg>
);

/** Moldura dourada com rosetas nos cantos e o selo do nível no topo. */
export const MolduraNivel: React.FC<{ nivel: Nivel; children: React.ReactNode; selo?: React.ReactNode; className?: string; pequena?: boolean }> = ({ nivel, children, selo, className = '', pequena }) => {
  const n = NIVEIS[nivel];
  const roseta = pequena ? 'w-4 h-4' : 'w-7 h-7';
  const recuo = pequena ? '-top-1.5 -left-1.5' : '-top-3 -left-3';
  return (
    <div className={`relative ${className}`}>
      <div className={`rounded-[18px] ${pequena ? 'p-[2px]' : 'p-[3px]'}`}
        style={{ background: `linear-gradient(135deg, #fbe7a1, #b9852c 30%, #f6d77a 55%, #9c6a1f 80%, #f3d27a)`, boxShadow: `0 0 0 1px rgba(0,0,0,.35), 0 10px 30px -10px ${n.brilho}` }}>
        <div className={`rounded-[15px] bg-[#1c0d26] ${pequena ? 'p-[2px]' : 'p-1'}`}>
          <div className="overflow-hidden rounded-[12px] ring-1 ring-amber-200/30">{children}</div>
        </div>
      </div>
      <Roseta pedra={n.pedra} className={`absolute ${recuo} ${roseta}`} />
      <Roseta pedra={n.pedra} className={`absolute ${roseta} ${pequena ? '-top-1.5 -right-1.5' : '-top-3 -right-3'}`} />
      <Roseta pedra={n.pedra} className={`absolute ${roseta} ${pequena ? '-bottom-1.5 -left-1.5' : '-bottom-3 -left-3'}`} />
      <Roseta pedra={n.pedra} className={`absolute ${roseta} ${pequena ? '-bottom-1.5 -right-1.5' : '-bottom-3 -right-3'}`} />
      {selo && (
        <span className="absolute left-1/2 -top-3 -translate-x-1/2 whitespace-nowrap rounded-full border border-amber-200/70 bg-[#2a1438] px-3 py-0.5 text-[11px] font-extrabold shadow-lg shadow-black/40">
          {selo}
        </span>
      )}
    </div>
  );
};

/** Capa do quiz: arco recortado sob a lua, lótus na água e lanternas acesas. */
export const CapaQuiz: React.FC<{ className?: string }> = ({ className = '' }) => {
  const uid = React.useId().replace(/:/g, '');
  // arco polilobado: cúspides ao longo de um arco ogival
  const arco = useMemo(() => {
    const pts: string[] = [];
    const cx = 160, base = 178, larg = 92, topo = 26;
    const lobos = 7;
    // pontos de controle ao longo do arco ogival (esq → topo → dir)
    const curva = (t: number): [number, number] => {
      // t de 0 a 1; metade esquerda e metade direita se encontram no topo, em ponta
      const lado = t < 0.5 ? -1 : 1;
      const u = t < 0.5 ? 1 - t * 2 : (t - 0.5) * 2; // 1 na base, 0 no topo
      const ang = (u * Math.PI) / 2;
      const x = cx + lado * larg * Math.sin(ang) * (0.55 + 0.45 * u);
      const y = topo + (100 - topo) * (1 - Math.cos(ang)) + 0;
      return [x, y];
    };
    const [x0, y0] = curva(0);
    pts.push(`M${x0 - 0},${base} L${x0},${y0}`);
    for (let i = 0; i < lobos; i++) {
      const [ax, ay] = curva(i / lobos);
      const [bx, by] = curva((i + 1) / lobos);
      const r = Math.hypot(bx - ax, by - ay) * 0.58;
      pts.push(`L${ax.toFixed(1)},${ay.toFixed(1)} A${r.toFixed(1)},${r.toFixed(1)} 0 0 1 ${bx.toFixed(1)},${by.toFixed(1)}`);
    }
    const [x1] = curva(1);
    pts.push(`L${x1},${base} Z`);
    return pts.join(' ');
  }, []);
  const lotus = (x: number, y: number, s: number, cor: string) => (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      {[-50, -25, 0, 25, 50].map((a) => (
        <path key={a} d="M0 0 C-5 -6 -4 -15 0 -20 C4 -15 5 -6 0 0Z" fill={cor} stroke="#fff3f8" strokeWidth="0.6" transform={`rotate(${a})`} opacity={a === 0 ? 1 : 0.92} />
      ))}
      <ellipse cx="0" cy="1" rx="13" ry="2.6" fill="#1c5b4a" />
    </g>
  );
  return (
    <svg viewBox="0 0 320 200" className={className} role="img" aria-label="Capa do Quiz do Kama Sutra: arco sob a lua, com flores de lótus">
      <defs>
        <linearGradient id={`fundo-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2a0f3d" /><stop offset="100%" stopColor="#4a1a4f" />
        </linearGradient>
        <linearGradient id={`ceu-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0f0828" /><stop offset="70%" stopColor="#3a1d6b" /><stop offset="100%" stopColor="#7a2d6b" />
        </linearGradient>
        <linearGradient id={`ouro-${uid}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#fbe7a1" /><stop offset="45%" stopColor="#c48f33" /><stop offset="100%" stopColor="#f6d77a" />
        </linearGradient>
        <radialGradient id={`lua-${uid}`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0%" stopColor="#fff6d0" stopOpacity="0.9" /><stop offset="100%" stopColor="#fff6d0" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`lanterna-${uid}`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0%" stopColor="#ffb35c" stopOpacity="0.6" /><stop offset="100%" stopColor="#ffb35c" stopOpacity="0" />
        </radialGradient>
        <pattern id={`trelica-${uid}`} width="14" height="14" patternUnits="userSpaceOnUse">
          <path d="M7 0 L14 7 L7 14 L0 7Z" fill="none" stroke="#e9b949" strokeWidth="0.5" opacity="0.18" />
          <circle cx="7" cy="7" r="0.9" fill="#e9b949" opacity="0.28" />
        </pattern>
        <clipPath id={`dentro-${uid}`}><path d={arco} /></clipPath>
      </defs>
      <rect width="320" height="200" rx="22" fill={`url(#fundo-${uid})`} />
      <rect width="320" height="200" rx="22" fill={`url(#trelica-${uid})`} />
      {/* céu dentro do arco */}
      <g clipPath={`url(#dentro-${uid})`}>
        <rect x="0" y="0" width="320" height="200" fill={`url(#ceu-${uid})`} />
        <circle cx="160" cy="78" r="46" fill={`url(#lua-${uid})`} className="capa-lua" />
        <circle cx="160" cy="78" r="20" fill="#fff3c4" />
        <circle cx="168" cy="72" r="17" fill="#1d0f3f" />
        {[[110, 60, 1.1], [205, 52, 0.9], [128, 104, 0.7], [196, 96, 1], [150, 40, 0.6], [178, 118, 0.6], [100, 92, 0.6], [220, 80, 0.7]].map(([x, y, r], i) => (
          <circle key={i} cx={x} cy={y} r={r} fill="#fff" className="capa-estrela" style={{ animationDelay: `${i * 0.37}s` }} />
        ))}
        {/* água com reflexo da lua */}
        <rect x="0" y="150" width="320" height="50" fill="#140a2c" opacity="0.85" />
        <path d="M150 156 H170 M146 162 H174 M152 168 H168" stroke="#fff3c4" strokeWidth="1.4" strokeLinecap="round" opacity="0.5" />
        {lotus(120, 160, 0.9, '#f9a8d4')}
        {lotus(200, 162, 0.75, '#f472b6')}
        {lotus(160, 172, 1.05, '#fbcfe8')}
      </g>
      {/* contorno dourado duplo do arco */}
      <path d={arco} fill="none" stroke={`url(#ouro-${uid})`} strokeWidth="4" strokeLinejoin="round" />
      <path d={arco} fill="none" stroke="#fbe7a1" strokeWidth="0.8" opacity="0.7" transform="translate(160 178) scale(0.94) translate(-160 -178)" />
      {/* base do arco */}
      <rect x="56" y="176" width="208" height="8" rx="3" fill={`url(#ouro-${uid})`} />
      {/* lanternas */}
      {[34, 286].map((x) => (
        <g key={x}>
          <circle cx={x} cy="66" r="30" fill={`url(#lanterna-${uid})`} className="capa-lanterna" />
          <path d={`M${x} 0 V48`} stroke="#e9b949" strokeWidth="1" />
          <path d={`M${x - 9} 50 H${x + 9} L${x + 6} 80 H${x - 6}Z`} fill="#ffb35c" stroke="#e9b949" strokeWidth="1.4" />
          <path d={`M${x - 11} 50 H${x + 11} M${x - 8} 81 H${x + 8}`} stroke="#e9b949" strokeWidth="2.4" strokeLinecap="round" />
          <path d={`M${x} 82 V92`} stroke="#e9b949" strokeWidth="1" />
          <circle cx={x} cy="94" r="2" fill="#e9b949" />
        </g>
      ))}
    </svg>
  );
};

/** Explosão de confete (só aparece quando a chave muda). */
export const Confete: React.FC<{ disparo: number; quantidade?: number }> = ({ disparo, quantidade = 26 }) => {
  const pecas = useMemo(() => Array.from({ length: quantidade }, (_, i) => {
    const ang = (i / quantidade) * Math.PI * 2 + Math.random() * 0.4;
    const dist = 70 + Math.random() * 90;
    return {
      dx: Math.cos(ang) * dist, dy: Math.sin(ang) * dist - 40, rot: Math.random() * 540 - 270,
      cor: ['#e9b949', '#f472b6', '#34d399', '#fde68a', '#c084fc', '#ffffff'][i % 6],
      forma: i % 3, atraso: Math.random() * 80,
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [disparo, quantidade]);
  if (!disparo) return null;
  return (
    <span key={disparo} className="pointer-events-none absolute left-1/2 top-1/2 z-20" aria-hidden>
      {pecas.map((p, i) => (
        <span key={i} className="confete-peca absolute block"
          style={{
            '--dx': `${p.dx}px`, '--dy': `${p.dy}px`, '--rot': `${p.rot}deg`, animationDelay: `${p.atraso}ms`,
            background: p.cor, width: p.forma === 0 ? 8 : 6, height: p.forma === 0 ? 4 : 6, borderRadius: p.forma === 2 ? 999 : 1,
          } as React.CSSProperties} />
      ))}
    </span>
  );
};

/** Medalha do placar: ouro (venceu/empate) ou prata. */
export const Medalha: React.FC<{ tipo: 'ouro' | 'prata'; className?: string }> = ({ tipo, className = '' }) => {
  const uid = React.useId().replace(/:/g, '');
  const [c1, c2, c3] = tipo === 'ouro' ? ['#fff1b8', '#e9b949', '#9c6a1f'] : ['#ffffff', '#c7c9d6', '#6b6f82'];
  return (
    <svg viewBox="0 0 80 96" className={className} role="img" aria-label={tipo === 'ouro' ? 'Medalha de ouro' : 'Medalha de prata'}>
      <defs>
        <linearGradient id={`m-${uid}`} x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor={c1} /><stop offset="50%" stopColor={c2} /><stop offset="100%" stopColor={c3} /></linearGradient>
      </defs>
      <path d="M22 0 H36 L44 30 H30Z" fill="#c026d3" /><path d="M58 0 H44 L36 30 H50Z" fill="#db2777" />
      <circle cx="40" cy="60" r="30" fill={`url(#m-${uid})`} stroke={c3} strokeWidth="2" />
      <circle cx="40" cy="60" r="23" fill="none" stroke={c1} strokeWidth="1.2" opacity="0.8" />
      {Array.from({ length: 8 }, (_, i) => (
        <ellipse key={i} cx="40" cy="47" rx="3.2" ry="7" fill={c1} opacity="0.85" transform={`rotate(${i * 45} 40 60)`} />
      ))}
      <circle cx="40" cy="60" r="6" fill={tipo === 'ouro' ? '#fb3a6b' : '#a78bfa'} stroke={c1} strokeWidth="1.2" />
    </svg>
  );
};

/** Ampulheta girando (espera pela outra pessoa). */
export const Ampulheta: React.FC<{ className?: string }> = ({ className = '' }) => (
  <svg viewBox="0 0 40 56" className={`ampulheta ${className}`} aria-hidden>
    <path d="M6 3 H34 M6 53 H34" stroke="#e9b949" strokeWidth="3.5" strokeLinecap="round" />
    <path d="M9 5 C9 20 18 24 18 28 C18 32 9 36 9 51 H31 C31 36 22 32 22 28 C22 24 31 20 31 5Z" fill="rgba(255,255,255,0.08)" stroke="#fbe7a1" strokeWidth="1.5" />
    <path d="M12 9 H28 C27 17 21 21 20 26 C19 21 13 17 12 9Z" fill="#f472b6" className="ampulheta-areia-cima" />
    <path d="M12 49 C13 43 17 41 20 40 C23 41 27 43 28 49Z" fill="#f472b6" />
    <path d="M20 27 V40" stroke="#f472b6" strokeWidth="1.2" strokeDasharray="1.5 1.5" className="ampulheta-fio" />
  </svg>
);

/** Número que conta até o valor final. */
export function useContagem(alvo: number, ms = 900): number {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { setV(alvo); return; }
    let raf = 0;
    const t0 = performance.now();
    const passo = (t: number) => {
      const p = Math.min(1, (t - t0) / ms);
      setV(Math.round(alvo * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(passo);
    };
    raf = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(raf);
  }, [alvo, ms]);
  return v;
}

// ---------------------------------------------------------------- sons (opcionais, desligados por padrão)
const CHAVE_SOM = 'vybe-quiz-som';
export function useSom(): [boolean, () => void] {
  const [ligado, setLigado] = useState(() => {
    try { return localStorage.getItem(CHAVE_SOM) === '1'; } catch { return false; }
  });
  const alternar = () => setLigado((v) => {
    try { localStorage.setItem(CHAVE_SOM, v ? '0' : '1'); } catch { /* sem armazenamento */ }
    return !v;
  });
  return [ligado, alternar];
}

let ctx: AudioContext | null = null;
/** Sons sintetizados na hora (sem arquivos): acerto sobe, erro desce, vitória faz um arpejo. */
export function tocar(tipo: 'acerto' | 'erro' | 'vitoria'): void {
  try {
    ctx ??= new AudioContext();
    const notas = tipo === 'acerto' ? [659, 988] : tipo === 'erro' ? [330, 247] : [523, 659, 784, 1047];
    const passo = tipo === 'vitoria' ? 0.11 : 0.09;
    notas.forEach((f, i) => {
      const o = ctx!.createOscillator();
      const g = ctx!.createGain();
      o.type = tipo === 'erro' ? 'triangle' : 'sine';
      o.frequency.value = f;
      const t = ctx!.currentTime + i * passo;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(tipo === 'erro' ? 0.12 : 0.16, t + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
      o.connect(g).connect(ctx!.destination);
      o.start(t);
      o.stop(t + 0.3);
    });
  } catch {
    /* sem áudio */
  }
}

/** vibração curta no celular (se o aparelho permitir) */
export function vibrar(tipo: 'acerto' | 'erro'): void {
  try { navigator.vibrate?.(tipo === 'acerto' ? 25 : [18, 50, 18]); } catch { /* sem vibração */ }
}

