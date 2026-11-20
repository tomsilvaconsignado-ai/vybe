// Pictogramas próprios das posições do Match de Desejos (desenho original do Vybelog, em SVG):
// duas silhuetas de traço grosso, uma clara e outra em rosa neon, sugestivas e sem nada explícito.
// Cada pose é um esqueleto simples (cabeça, pescoço, quadril, cotovelos, mãos, joelhos e pés).
import React from 'react';

type P = [number, number];
interface Corpo { cabeca: P; pescoco: P; quadril: P; bracos: [P, P][]; pernas: [P, P][] }
type Cenario = 'cama' | 'cadeira' | 'sofa' | 'parede' | 'bancada' | 'chuveiro' | 'chao';
interface Pose { a: Corpo; b: Corpo; cenario?: Cenario }

const POSES: Record<string, Pose> = {
  conchinha: {
    cenario: 'cama',
    b: { cabeca: [24, 50], pescoco: [31, 55], quadril: [60, 58], bracos: [[[30, 64], [22, 66]], [[40, 63], [44, 68]]], pernas: [[[72, 50], [86, 58]], [[74, 54], [88, 62]]] },
    a: { cabeca: [36, 41], pescoco: [43, 46], quadril: [70, 51], bracos: [[[50, 55], [40, 60]], [[36, 49], [30, 44]]], pernas: [[[82, 43], [96, 51]], [[84, 47], [98, 55]]] },
  },
  'olho-no-olho': {
    cenario: 'cama',
    b: { cabeca: [20, 60], pescoco: [27, 61], quadril: [56, 62], bracos: [[[36, 50], [44, 42]], [[30, 54], [38, 46]]], pernas: [[[70, 48], [84, 60]], [[68, 50], [86, 62]]] },
    a: { cabeca: [30, 40], pescoco: [37, 44], quadril: [64, 52], bracos: [[[32, 52], [26, 61]], [[40, 53], [36, 61]]], pernas: [[[82, 56], [100, 60]], [[82, 58], [98, 62]]] },
  },
  lotus: {
    cenario: 'chao',
    a: { cabeca: [40, 24], pescoco: [43, 32], quadril: [48, 64], bracos: [[[56, 40], [66, 38]], [[56, 46], [66, 46]]], pernas: [[[64, 70], [74, 78]], [[60, 74], [44, 78]]] },
    b: { cabeca: [74, 20], pescoco: [71, 28], quadril: [64, 58], bracos: [[[60, 30], [48, 28]], [[60, 36], [50, 36]]], pernas: [[[50, 58], [34, 54]], [[50, 64], [34, 64]]] },
  },
  'no-sofa': {
    cenario: 'sofa',
    a: { cabeca: [40, 24], pescoco: [42, 32], quadril: [46, 58], bracos: [[[54, 42], [64, 44]], [[52, 48], [62, 50]]], pernas: [[[66, 58], [68, 78]], [[64, 60], [64, 78]]] },
    b: { cabeca: [70, 22], pescoco: [68, 30], quadril: [60, 54], bracos: [[[58, 36], [46, 34]], [[60, 40], [48, 40]]], pernas: [[[48, 60], [42, 72]], [[74, 62], [80, 74]]] },
  },
  cavalgada: {
    cenario: 'cama',
    a: { cabeca: [22, 60], pescoco: [29, 61], quadril: [60, 62], bracos: [[[40, 54], [50, 48]], [[36, 66], [46, 70]]], pernas: [[[78, 62], [96, 64]], [[78, 64], [94, 66]]] },
    b: { cabeca: [56, 18], pescoco: [57, 26], quadril: [60, 52], bracos: [[[50, 36], [48, 46]], [[66, 36], [70, 46]]], pernas: [[[46, 58], [44, 64]], [[72, 58], [76, 64]]] },
  },
  'cavalgada-invertida': {
    cenario: 'cama',
    a: { cabeca: [22, 60], pescoco: [29, 61], quadril: [60, 62], bracos: [[[38, 54], [48, 52]], [[36, 66], [46, 70]]], pernas: [[[78, 62], [96, 64]], [[78, 64], [94, 66]]] },
    b: { cabeca: [66, 16], pescoco: [64, 24], quadril: [58, 50], bracos: [[[72, 36], [82, 46]], [[68, 38], [76, 50]]], pernas: [[[72, 56], [80, 64]], [[46, 56], [42, 64]]] },
  },
  'quatro-apoios': {
    cenario: 'cama',
    b: { cabeca: [26, 40], pescoco: [33, 44], quadril: [64, 44], bracos: [[[30, 54], [28, 64]], [[36, 54], [36, 64]]], pernas: [[[64, 60], [84, 64]], [[66, 62], [86, 66]]] },
    a: { cabeca: [80, 14], pescoco: [79, 22], quadril: [74, 46], bracos: [[[72, 32], [66, 42]], [[78, 34], [70, 44]]], pernas: [[[86, 60], [100, 64]], [[84, 62], [98, 66]]] },
  },
  'beira-da-cama': {
    cenario: 'cama',
    b: { cabeca: [24, 60], pescoco: [31, 61], quadril: [62, 58], bracos: [[[40, 52], [46, 46]], [[34, 66], [42, 70]]], pernas: [[[74, 44], [86, 30]], [[72, 42], [82, 26]]] },
    a: { cabeca: [92, 10], pescoco: [91, 18], quadril: [86, 46], bracos: [[[86, 30], [80, 34]], [[90, 32], [84, 38]]], pernas: [[[88, 62], [90, 80]], [[84, 62], [84, 80]]] },
  },
  'na-cadeira': {
    cenario: 'cadeira',
    a: { cabeca: [38, 22], pescoco: [40, 30], quadril: [44, 56], bracos: [[[52, 40], [62, 44]], [[50, 46], [60, 50]]], pernas: [[[64, 58], [66, 78]], [[62, 60], [60, 78]]] },
    b: { cabeca: [62, 22], pescoco: [61, 30], quadril: [58, 54], bracos: [[[68, 40], [74, 52]], [[66, 42], [70, 54]]], pernas: [[[80, 58], [84, 78]], [[78, 62], [78, 78]]] },
  },
  'meia-nove': {
    cenario: 'cama',
    b: { cabeca: [20, 62], pescoco: [27, 63], quadril: [58, 63], bracos: [[[34, 56], [42, 52]], [[32, 68], [40, 70]]], pernas: [[[74, 54], [86, 58]], [[74, 58], [88, 62]]] },
    a: { cabeca: [84, 46], pescoco: [77, 48], quadril: [46, 50], bracos: [[[80, 56], [86, 62]], [[74, 56], [78, 62]]], pernas: [[[32, 46], [18, 50]], [[30, 50], [16, 54]]] },
  },
  'no-chuveiro': {
    cenario: 'chuveiro',
    b: { cabeca: [52, 16], pescoco: [52, 24], quadril: [50, 50], bracos: [[[42, 30], [36, 22]], [[44, 34], [38, 28]]], pernas: [[[48, 64], [46, 80]], [[52, 64], [52, 80]]] },
    a: { cabeca: [64, 14], pescoco: [63, 22], quadril: [60, 50], bracos: [[[56, 34], [48, 40]], [[58, 38], [50, 44]]], pernas: [[[62, 64], [60, 80]], [[66, 64], [68, 80]]] },
  },
  'contra-a-parede': {
    cenario: 'parede',
    b: { cabeca: [30, 14], pescoco: [31, 22], quadril: [36, 44], bracos: [[[42, 24], [50, 22]], [[40, 28], [48, 28]]], pernas: [[[52, 46], [60, 56]], [[50, 50], [58, 60]]] },
    a: { cabeca: [58, 12], pescoco: [56, 20], quadril: [52, 48], bracos: [[[46, 32], [38, 40]], [[48, 36], [40, 44]]], pernas: [[[54, 64], [56, 80]], [[50, 64], [48, 80]]] },
  },
  bancada: {
    cenario: 'bancada',
    b: { cabeca: [36, 18], pescoco: [38, 26], quadril: [40, 48], bracos: [[[48, 28], [56, 26]], [[30, 38], [28, 48]]], pernas: [[[54, 44], [64, 54]], [[52, 48], [60, 58]]] },
    a: { cabeca: [66, 12], pescoco: [65, 20], quadril: [62, 48], bracos: [[[56, 30], [48, 34]], [[58, 36], [50, 40]]], pernas: [[[64, 64], [66, 80]], [[60, 64], [60, 80]]] },
  },
  borboleta: {
    cenario: 'cama',
    b: { cabeca: [22, 62], pescoco: [29, 62], quadril: [62, 58], bracos: [[[36, 54], [30, 48]], [[38, 68], [46, 70]]], pernas: [[[70, 40], [80, 22]], [[72, 42], [84, 26]]] },
    a: { cabeca: [92, 10], pescoco: [90, 18], quadril: [84, 46], bracos: [[[86, 28], [82, 24]], [[90, 30], [86, 26]]], pernas: [[[86, 62], [88, 80]], [[82, 62], [82, 80]]] },
  },
  tesoura: {
    cenario: 'cama',
    b: { cabeca: [18, 54], pescoco: [25, 57], quadril: [52, 60], bracos: [[[24, 66], [16, 68]], [[34, 66], [40, 70]]], pernas: [[[66, 52], [80, 44]], [[66, 58], [82, 54]]] },
    a: { cabeca: [104, 52], pescoco: [97, 55], quadril: [72, 58], bracos: [[[98, 66], [106, 68]], [[88, 64], [82, 68]]], pernas: [[[60, 60], [46, 52]], [[60, 64], [44, 66]]] },
  },
  'carrinho-de-mao': {
    cenario: 'chao',
    b: { cabeca: [18, 52], pescoco: [25, 54], quadril: [56, 48], bracos: [[[24, 64], [22, 76]], [[30, 64], [30, 76]]], pernas: [[[72, 44], [86, 42]], [[72, 48], [86, 46]]] },
    a: { cabeca: [86, 14], pescoco: [85, 22], quadril: [80, 50], bracos: [[[80, 34], [84, 44]], [[86, 36], [88, 46]]], pernas: [[[82, 64], [84, 80]], [[78, 64], [76, 80]]] },
  },
};

export const temPictograma = (id: string) => id in POSES;

const linha = (pts: P[]) => pts.map((p) => p.join(',')).join(' ');

function Silhueta({ c, cor }: { c: Corpo; cor: string }) {
  return (
    <g stroke={cor} strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" fill="none">
      <polyline points={linha([c.pescoco, c.quadril])} strokeWidth={7.5} />
      {c.bracos.map(([cot, mao], i) => <polyline key={'b' + i} points={linha([c.pescoco, cot, mao])} />)}
      {c.pernas.map(([joe, pe], i) => <polyline key={'p' + i} points={linha([c.quadril, joe, pe])} />)}
      <circle cx={c.cabeca[0]} cy={c.cabeca[1]} r={6} fill={cor} stroke="none" />
    </g>
  );
}

function Cenario({ tipo }: { tipo?: Cenario }) {
  const cor = 'rgba(255,255,255,0.28)';
  const p = { stroke: cor, strokeWidth: 2, fill: 'none', strokeLinecap: 'round' as const };
  switch (tipo) {
    case 'cama': return <g {...p}><path d="M6 72 H114" /><path d="M10 72 V82 M110 72 V82" /><path d="M8 72 V60" /></g>;
    case 'cadeira': return <g {...p}><path d="M30 60 H70 M34 60 V82 M66 60 V82 M32 60 V24" /></g>;
    case 'sofa': return <g {...p}><path d="M24 62 H76 M26 62 V80 M74 62 V80 M24 62 V36 Q24 32 30 32 H34" /></g>;
    case 'parede': return <g {...p}><path d="M20 4 V82 M8 82 H112" /></g>;
    case 'bancada': return <g {...p}><path d="M14 56 H52 M18 56 V82 M48 56 V82 M8 82 H112" /></g>;
    case 'chuveiro': return <g {...p}><path d="M24 82 V6 H40 M36 6 V10" /><path d="M32 14 l-2 6 M37 14 v6 M42 14 l2 6" strokeDasharray="2 3" /><path d="M8 82 H112" /></g>;
    case 'chao': return <g {...p}><path d="M8 82 H112" /></g>;
    default: return null;
  }
}

export const PictogramaPosicao: React.FC<{ id: string; className?: string; titulo?: string }> = ({ id, className = '', titulo }) => {
  const pose = POSES[id];
  if (!pose) return null;
  return (
    <svg viewBox="0 0 120 88" className={className} role="img" aria-label={titulo ?? 'Ilustração da posição'}>
      <Cenario tipo={pose.cenario} />
      <Silhueta c={pose.a} cor="#f4f4f5" />
      <Silhueta c={pose.b} cor="#ec4899" />
    </svg>
  );
};
