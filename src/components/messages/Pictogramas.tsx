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
    a: { cabeca: [42, 28], pescoco: [44, 37], quadril: [46, 70], bracos: [[[55, 46], [64, 42]], [[56, 52], [66, 50]]], pernas: [[[64, 77], [50, 81]], [[28, 77], [42, 81]]] },
    b: { cabeca: [66, 24], pescoco: [63, 33], quadril: [58, 62], bracos: [[[55, 34], [47, 36]], [[56, 41], [48, 43]]], pernas: [[[42, 60], [33, 68]], [[44, 66], [36, 74]]] },
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

// ---------------------------------------------------------------- silhuetas
// Cada corpo é montado com peças afinadas (tronco com cintura e quadril, coxas mais grossas que as
// pernas, braços finos) e juntas arredondadas. O contorno neon é desenhado por baixo de tudo e o
// preenchimento por cima, então só a borda de fora brilha (as peças se fundem num corpo só).

const sub = (a: P, b: P): P => [a[0] - b[0], a[1] - b[1]];
const soma = (a: P, b: P): P => [a[0] + b[0], a[1] + b[1]];
const mult = (a: P, k: number): P => [a[0] * k, a[1] * k];
const tam = (a: P) => Math.hypot(a[0], a[1]) || 1;
const normal = (a: P, b: P): P => { const d = sub(b, a); const n = tam(d); return [-d[1] / n, d[0] / n]; };
const entre = (a: P, b: P, t: number): P => soma(a, mult(sub(b, a), t));
const f1 = (n: number) => Math.round(n * 10) / 10;

/** caminho suave e fechado por uma lista de pontos (Catmull-Rom → Bézier) */
function fechado(pts: P[]) {
  const n = pts.length;
  let d = `M${f1(pts[0][0])},${f1(pts[0][1])}`;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
    const c1 = soma(p1, mult(sub(p2, p0), 1 / 6)), c2 = sub(p2, mult(sub(p3, p1), 1 / 6));
    d += ` C${f1(c1[0])},${f1(c1[1])} ${f1(c2[0])},${f1(c2[1])} ${f1(p2[0])},${f1(p2[1])}`;
  }
  return d + 'Z';
}

/** membro afinado de a (largura wa) até b (largura wb), levemente encorpado no meio */
function membro(a: P, b: P, wa: number, wb: number) {
  const n = normal(a, b);
  const meio = ((wa + wb) / 4) * 1.06;
  return fechado([soma(a, mult(n, wa / 2)), soma(entre(a, b, 0.5), mult(n, meio)), soma(b, mult(n, wb / 2)),
    sub(b, mult(n, wb / 2)), sub(entre(a, b, 0.5), mult(n, meio)), sub(a, mult(n, wa / 2))]);
}

const circulo = (p: P, raio: number) => `M${f1(p[0] - raio)},${f1(p[1])} a${raio},${raio} 0 1,0 ${f1(raio * 2)},0 a${raio},${raio} 0 1,0 ${f1(-raio * 2)},0Z`;

interface Medidas { ombro: number; peito: number; cintura: number; quadril: number; coxa: number; joelho: number; tornozelo: number; braco: number; pulso: number; cabeca: number }
const CORPO_A: Medidas = { ombro: 11.2, peito: 9.8, cintura: 8, quadril: 8.6, coxa: 7.2, joelho: 4.7, tornozelo: 2.9, braco: 4.3, pulso: 2.5, cabeca: 5.8 };
const CORPO_B: Medidas = { ombro: 8.8, peito: 10, cintura: 6, quadril: 11.8, coxa: 7.8, joelho: 4.2, tornozelo: 2.4, braco: 3.6, pulso: 2.1, cabeca: 5.4 };

/** peças de um corpo (caminhos SVG) */
function pecas(c: Corpo, m: Medidas): string[] {
  const { pescoco: ne, quadril: hi } = c;
  const n = normal(ne, hi);
  const larg: Array<[number, number]> = [[0.02, m.ombro], [0.3, m.peito], [0.62, m.cintura], [0.92, m.quadril], [1.08, m.quadril * 0.8]];
  const ladoA = larg.map(([t, w]) => soma(entre(ne, hi, t), mult(n, w / 2)));
  const ladoB = larg.map(([t, w]) => sub(entre(ne, hi, t), mult(n, w / 2))).reverse();
  const ombro = entre(ne, hi, 0.07);
  const junta = entre(ne, hi, 0.94);
  const out = [fechado([...ladoA, ...ladoB]), membro(c.cabeca, ne, 3.2, 3.6)];
  for (const [cot, mao] of c.bracos) out.push(membro(ombro, cot, m.braco, m.braco * 0.8), membro(cot, mao, m.braco * 0.8, m.pulso));
  for (const [joe, pe] of c.pernas) out.push(membro(junta, joe, m.coxa, m.joelho), membro(joe, pe, m.joelho, m.tornozelo));
  for (const [cot, mao] of c.bracos) out.push(circulo(cot, m.braco * 0.42), circulo(mao, m.pulso * 0.75));
  for (const [joe, pe] of c.pernas) out.push(circulo(joe, m.joelho * 0.55), circulo(pe, m.tornozelo * 0.8));
  out.push(circulo(c.cabeca, m.cabeca));
  return out;
}

function Silhueta({ c, m, id, borda, claro, escuro, cabelo }: { c: Corpo; m: Medidas; id: string; borda: string; claro: string; escuro: string; cabelo?: P }) {
  // cabelo comprido: cai da cabeça pela nuca, para o lado oposto ao do parceiro (`cabelo` = cabeça dele)
  let fio = '';
  if (cabelo) {
    const desce = sub(c.pescoco, c.cabeca);
    const lado0 = normal(c.cabeca, c.pescoco);
    const paraLonge = sub(c.cabeca, cabelo);
    const lado = lado0[0] * paraLonge[0] + lado0[1] * paraLonge[1] >= 0 ? lado0 : mult(lado0, -1);
    const topo = soma(c.cabeca, soma(mult(desce, -0.15), mult(lado, m.cabeca * 0.55)));
    const ponta = soma(c.pescoco, soma(mult(desce, 0.9), mult(lado, m.cabeca * 1.1)));
    fio = ' ' + membro(topo, ponta, m.cabeca * 1.7, 1.6);
  }
  const d = pecas(c, m).join(' ') + fio;
  return (
    <g>
      <defs>
        <linearGradient id={`grad-${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={claro} /><stop offset="100%" stopColor={escuro} />
        </linearGradient>
      </defs>
      {/* brilho neon só na borda de fora: contorno por baixo, preenchimento por cima */}
      <path d={d} fill="none" stroke={borda} strokeWidth={3.4} strokeLinejoin="round" opacity={0.5} filter="url(#pg-brilho)" />
      <path d={d} fill="none" stroke={borda} strokeWidth={1.5} strokeLinejoin="round" />
      <path d={d} fill={`url(#grad-${id})`} />
    </g>
  );
}

function Cenario({ tipo }: { tipo?: Cenario }) {
  const p = { stroke: 'rgba(255,255,255,0.22)', strokeWidth: 1.6, fill: 'none', strokeLinecap: 'round' as const };
  const lencol = 'rgba(168,85,247,0.16)';
  switch (tipo) {
    case 'cama': return <g><path d="M6 71 Q60 66 114 71 V74 H6 Z" fill={lencol} /><g {...p}><path d="M6 74 H114 M10 74 V83 M110 74 V83 M7 74 V58" /></g></g>;
    case 'cadeira': return <g {...p}><path d="M28 61 H72 M32 61 V83 M68 61 V83 M30 61 V22" /></g>;
    case 'sofa': return <g><path d="M22 60 H78 V66 H22 Z" fill={lencol} /><g {...p}><path d="M22 66 V82 M78 66 V82 M22 60 V34 Q22 30 28 30 H34" /></g></g>;
    case 'parede': return <g><path d="M4 4 H20 V82 H4 Z" fill="rgba(168,85,247,0.10)" /><g {...p}><path d="M20 4 V82 M6 83 H114" /></g></g>;
    case 'bancada': return <g><path d="M12 54 H54 V58 H12 Z" fill={lencol} /><g {...p}><path d="M16 58 V83 M50 58 V83 M6 83 H114" /></g></g>;
    case 'chuveiro': return <g><g {...p}><path d="M22 83 V6 H38 M35 6 V10 M6 83 H114" /></g><path d="M30 14 l-3 9 M35 14 l-1 10 M40 14 l1 9 M45 14 l3 9" stroke="rgba(125,211,252,0.45)" strokeWidth={1.2} strokeDasharray="2 3" strokeLinecap="round" /></g>;
    case 'chao': return <g {...p}><path d="M6 83 H114" /></g>;
    default: return null;
  }
}

export const PictogramaPosicao: React.FC<{ id: string; className?: string; titulo?: string }> = ({ id, className = '', titulo }) => {
  const pose = POSES[id];
  const uid = React.useId().replace(/:/g, '');
  if (!pose) return null;
  return (
    <svg viewBox="0 0 120 88" className={className} role="img" aria-label={titulo ?? 'Ilustração da posição'}>
      <defs>
        <radialGradient id={`luz-${uid}`} cx="50%" cy="45%" r="60%">
          <stop offset="0%" stopColor="#ec4899" stopOpacity={0.28} /><stop offset="100%" stopColor="#ec4899" stopOpacity={0} />
        </radialGradient>
        <filter id="pg-brilho" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="1.6" /></filter>
      </defs>
      <ellipse cx="60" cy="46" rx="58" ry="42" fill={`url(#luz-${uid})`} />
      <Cenario tipo={pose.cenario} />
      <Silhueta c={pose.a} m={CORPO_A} id={`a-${uid}`} borda="#c4b5fd" claro="#3b2a63" escuro="#1a1033" />
      <Silhueta c={pose.b} m={CORPO_B} id={`b-${uid}`} borda="#f472b6" claro="#9d174d" escuro="#3f0a24" cabelo={pose.a.cabeca} />
    </svg>
  );
};
