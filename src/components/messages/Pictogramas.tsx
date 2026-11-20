// Pictogramas próprios das posições do Match de Desejos (desenho original do Vybelog, em SVG):
// duas silhuetas de traço grosso, uma clara e outra em rosa neon, sugestivas e sem nada explícito.
// Cada pose é um esqueleto simples (cabeça, pescoço, quadril, cotovelos, mãos, joelhos e pés).
import React from 'react';

type P = [number, number];
interface Corpo { cabeca: P; pescoco: P; quadril: P; bracos: [P, P][]; pernas: [P, P][] }
type Cenario = 'cama' | 'cama-curta' | 'cadeira' | 'banqueta' | 'sofa' | 'parede' | 'bancada' | 'chuveiro' | 'escada' | 'chao';
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
  // ---- posições do quiz (nomes populares do Kama Sutra; desenhos próprios)
  tigre: {
    cenario: 'cama',
    b: { cabeca: [24, 58], pescoco: [31, 60], quadril: [58, 50], bracos: [[[30, 70], [20, 71]], [[36, 70], [27, 71]]], pernas: [[[60, 70], [76, 71]], [[63, 70], [79, 71]]] },
    a: { cabeca: [45, 30], pescoco: [52, 34], quadril: [72, 48], bracos: [[[50, 46], [56, 52]], [[56, 44], [61, 50]]], pernas: [[[72, 70], [90, 71]], [[75, 70], [93, 71]]] },
  },
  ponte: {
    cenario: 'chao',
    a: { cabeca: [32, 62], pescoco: [40, 54], quadril: [70, 50], bracos: [[[34, 68], [30, 81]], [[39, 68], [37, 81]]], pernas: [[[80, 64], [84, 81]], [[77, 66], [79, 81]]] },
    b: { cabeca: [68, 10], pescoco: [68, 18], quadril: [70, 44], bracos: [[[61, 27], [57, 18]], [[75, 27], [79, 18]]], pernas: [[[80, 54], [84, 68]], [[60, 54], [56, 68]]] },
  },
  aguia: {
    cenario: 'cama',
    b: { cabeca: [16, 64], pescoco: [23, 65], quadril: [52, 66], bracos: [[[30, 70], [38, 71]], [[24, 70], [16, 71]]], pernas: [[[62, 50], [70, 32]], [[66, 56], [82, 44]]] },
    a: { cabeca: [64, 17], pescoco: [64, 26], quadril: [64, 52], bracos: [[[66, 32], [70, 32]], [[74, 40], [80, 44]]], pernas: [[[72, 70], [90, 71]], [[70, 70], [88, 72]]] },
  },
  visitante: {
    cenario: 'chao',
    a: { cabeca: [50, 12], pescoco: [51, 20], quadril: [52, 48], bracos: [[[60, 28], [66, 26]], [[60, 36], [67, 38]]], pernas: [[[52, 64], [52, 81]], [[48, 64], [46, 81]]] },
    b: { cabeca: [66, 15], pescoco: [64, 23], quadril: [62, 49], bracos: [[[56, 22], [48, 22]], [[58, 30], [50, 32]]], pernas: [[[64, 64], [66, 81]], [[60, 65], [60, 81]]] },
  },
  deslizar: {
    cenario: 'cama',
    a: { cabeca: [18, 62], pescoco: [25, 63], quadril: [56, 64], bracos: [[[30, 54], [40, 52]], [[34, 70], [42, 70]]], pernas: [[[74, 65], [94, 66]], [[74, 66], [92, 67]]] },
    b: { cabeca: [24, 51], pescoco: [31, 54], quadril: [60, 56], bracos: [[[26, 62], [20, 70]], [[34, 62], [30, 70]]], pernas: [[[78, 58], [96, 60]], [[78, 59], [95, 61]]] },
  },
  heroi: {
    cenario: 'cama',
    b: { cabeca: [14, 64], pescoco: [21, 65], quadril: [50, 66], bracos: [[[28, 70], [36, 71]], [[22, 70], [14, 71]]], pernas: [[[42, 50], [52, 34]], [[46, 48], [58, 32]]] },
    a: { cabeca: [64, 15], pescoco: [63, 24], quadril: [62, 50], bracos: [[[58, 34], [54, 36]], [[64, 34], [58, 32]]], pernas: [[[70, 70], [88, 71]], [[68, 70], [86, 72]]] },
  },
  caracol: {
    cenario: 'banqueta',
    b: { cabeca: [26, 38], pescoco: [33, 42], quadril: [62, 44], bracos: [[[28, 50], [26, 58]], [[33, 50], [31, 58]]], pernas: [[[62, 62], [64, 81]], [[58, 62], [58, 81]]] },
    a: { cabeca: [76, 12], pescoco: [75, 20], quadril: [72, 48], bracos: [[[70, 34], [64, 42]], [[74, 36], [66, 44]]], pernas: [[[74, 64], [76, 81]], [[70, 64], [70, 81]]] },
  },
  lobo: {
    cenario: 'chao',
    b: { cabeca: [31, 24], pescoco: [38, 29], quadril: [58, 48], bracos: [[[46, 40], [56, 48]], [[44, 42], [54, 50]]], pernas: [[[58, 64], [56, 81]], [[54, 64], [50, 81]]] },
    a: { cabeca: [72, 12], pescoco: [71, 20], quadril: [68, 48], bracos: [[[64, 36], [57, 47]], [[68, 38], [60, 49]]], pernas: [[[70, 64], [72, 81]], [[66, 64], [66, 81]]] },
  },
  sussurro: {
    cenario: 'cama',
    a: { cabeca: [16, 62], pescoco: [23, 63], quadril: [54, 64], bracos: [[[34, 56], [44, 56]], [[28, 70], [36, 71]]], pernas: [[[72, 65], [92, 66]], [[72, 66], [90, 67]]] },
    b: { cabeca: [62, 23], pescoco: [62, 32], quadril: [54, 56], bracos: [[[72, 46], [76, 64]], [[70, 48], [72, 64]]], pernas: [[[42, 64], [52, 71]], [[44, 66], [55, 72]]] },
  },
  desafio: {
    cenario: 'banqueta',
    b: { cabeca: [22, 22], pescoco: [28, 26], quadril: [44, 40], bracos: [[[26, 40], [22, 46]], [[30, 40], [26, 48]]], pernas: [[[30, 42], [32, 58]], [[32, 44], [36, 58]]] },
    a: { cabeca: [57, 12], pescoco: [56, 20], quadril: [54, 46], bracos: [[[52, 32], [46, 38]], [[56, 34], [48, 40]]], pernas: [[[56, 64], [58, 81]], [[52, 64], [50, 81]]] },
  },
  elefante: {
    cenario: 'chao',
    a: { cabeca: [50, 25], pescoco: [52, 34], quadril: [50, 61], bracos: [[[60, 41], [66, 39]], [[60, 47], [66, 49]]], pernas: [[[52, 80], [36, 81]], [[48, 80], [34, 81]]] },
    b: { cabeca: [66, 27], pescoco: [64, 36], quadril: [64, 61], bracos: [[[56, 35], [48, 35]], [[58, 41], [50, 41]]], pernas: [[[62, 80], [80, 81]], [[66, 80], [82, 81]]] },
  },
  aranha: {
    cenario: 'cama',
    b: { cabeca: [24, 46], pescoco: [31, 50], quadril: [60, 50], bracos: [[[32, 60], [30, 70]], [[36, 60], [36, 70]]], pernas: [[[62, 70], [78, 71]], [[74, 48], [92, 40]]] },
    a: { cabeca: [75, 13], pescoco: [74, 22], quadril: [72, 48], bracos: [[[70, 36], [64, 46]], [[80, 36], [88, 40]]], pernas: [[[76, 70], [94, 71]], [[72, 70], [90, 72]]] },
  },
  tarantula: {
    cenario: 'cama',
    a: { cabeca: [33, 37], pescoco: [38, 44], quadril: [52, 66], bracos: [[[32, 56], [28, 71]], [[36, 58], [34, 71]]], pernas: [[[70, 64], [90, 70]], [[70, 66], [88, 71]]] },
    b: { cabeca: [77, 33], pescoco: [72, 40], quadril: [58, 62], bracos: [[[80, 52], [84, 71]], [[78, 54], [80, 71]]], pernas: [[[44, 58], [30, 64]], [[44, 62], [28, 68]]] },
  },
  esfinge: {
    cenario: 'cama',
    b: { cabeca: [22, 54], pescoco: [29, 58], quadril: [60, 64], bracos: [[[32, 68], [22, 70]], [[36, 68], [28, 70]]], pernas: [[[76, 66], [94, 68]], [[74, 60], [84, 52]]] },
    a: { cabeca: [26, 39], pescoco: [33, 43], quadril: [64, 52], bracos: [[[32, 56], [30, 70]], [[38, 56], [38, 70]]], pernas: [[[80, 58], [98, 64]], [[80, 60], [96, 66]]] },
  },
  poltrona: {
    cenario: 'cama',
    a: { cabeca: [79, 33], pescoco: [74, 41], quadril: [62, 64], bracos: [[[82, 54], [86, 71]], [[80, 56], [82, 71]]], pernas: [[[50, 62], [36, 70]], [[50, 64], [38, 71]]] },
    b: { cabeca: [12, 64], pescoco: [19, 65], quadril: [46, 62], bracos: [[[24, 70], [32, 71]], [[18, 70], [10, 71]]], pernas: [[[60, 52], [76, 40]], [[58, 54], [74, 44]]] },
  },
  'arco-do-triunfo': {
    cenario: 'cama',
    a: { cabeca: [46, 38], pescoco: [52, 44], quadril: [62, 66], bracos: [[[44, 54], [38, 58]], [[48, 56], [40, 62]]], pernas: [[[44, 68], [26, 70]], [[46, 66], [28, 68]]] },
    b: { cabeca: [20, 63], pescoco: [28, 65], quadril: [56, 62], bracos: [[[24, 70], [16, 71]], [[34, 70], [42, 71]]], pernas: [[[66, 58], [74, 66]], [[68, 60], [78, 68]]] },
  },
  vela: {
    cenario: 'cama',
    b: { cabeca: [26, 67], pescoco: [34, 66], quadril: [40, 40], bracos: [[[26, 70], [18, 71]], [[40, 70], [48, 71]]], pernas: [[[42, 24], [44, 8]], [[46, 24], [50, 8]]] },
    a: { cabeca: [59, 13], pescoco: [58, 22], quadril: [56, 48], bracos: [[[50, 30], [44, 26]], [[52, 36], [46, 34]]], pernas: [[[60, 70], [78, 71]], [[56, 70], [74, 72]]] },
  },
  lacada: {
    cenario: 'cama',
    a: { cabeca: [41, 31], pescoco: [42, 40], quadril: [44, 66], bracos: [[[50, 50], [58, 44]], [[50, 54], [58, 50]]], pernas: [[[60, 60], [74, 64]], [[58, 64], [72, 70]]] },
    b: { cabeca: [73, 31], pescoco: [72, 40], quadril: [70, 64], bracos: [[[64, 48], [56, 44]], [[64, 52], [56, 50]]], pernas: [[[54, 56], [40, 60]], [[56, 60], [40, 66]]] },
  },
  contorcionista: {
    cenario: 'cama-curta',
    a: { cabeca: [84, 74], pescoco: [76, 66], quadril: [44, 66], bracos: [[[84, 76], [88, 84]], [[80, 76], [82, 84]]], pernas: [[[28, 64], [10, 66]], [[28, 66], [12, 67]]] },
    b: { cabeca: [47, 21], pescoco: [46, 30], quadril: [46, 56], bracos: [[[40, 42], [36, 48]], [[52, 42], [56, 48]]], pernas: [[[34, 62], [26, 70]], [[58, 62], [66, 70]]] },
  },
  presidente: {
    cenario: 'banqueta',
    b: { cabeca: [36, 14], pescoco: [38, 22], quadril: [44, 48], bracos: [[[44, 32], [48, 40]], [[40, 34], [36, 42]]], pernas: [[[30, 50], [28, 58]], [[44, 64], [44, 81]]] },
    a: { cabeca: [51, 10], pescoco: [50, 18], quadril: [53, 48], bracos: [[[44, 30], [40, 36]], [[46, 36], [42, 40]]], pernas: [[[53, 64], [55, 81]], [[57, 64], [59, 81]]] },
  },
  cipo: {
    cenario: 'chao',
    a: { cabeca: [70, 12], pescoco: [69, 20], quadril: [66, 48], bracos: [[[60, 34], [54, 40]], [[62, 40], [54, 46]]], pernas: [[[66, 64], [68, 81]], [[62, 64], [62, 81]]] },
    b: { cabeca: [44, 16], pescoco: [46, 24], quadril: [50, 50], bracos: [[[56, 22], [64, 20]], [[56, 28], [64, 26]]], pernas: [[[50, 66], [50, 81]], [[58, 34], [68, 16]]] },
  },
  sereia: {
    cenario: 'bancada',
    b: { cabeca: [12, 48], pescoco: [19, 50], quadril: [48, 51], bracos: [[[24, 55], [30, 53]], [[16, 55], [10, 53]]], pernas: [[[52, 34], [56, 16]], [[54, 34], [60, 16]]] },
    a: { cabeca: [66, 13], pescoco: [65, 22], quadril: [62, 48], bracos: [[[60, 28], [57, 18]], [[62, 26], [60, 16]]], pernas: [[[62, 64], [64, 81]], [[66, 64], [68, 81]]] },
  },
  escada: {
    cenario: 'escada',
    b: { cabeca: [22, 40], pescoco: [29, 44], quadril: [50, 48], bracos: [[[26, 52], [22, 58]], [[30, 52], [28, 58]]], pernas: [[[46, 66], [60, 74]], [[50, 66], [64, 74]]] },
    a: { cabeca: [71, 13], pescoco: [70, 22], quadril: [68, 48], bracos: [[[64, 36], [56, 44]], [[68, 38], [58, 46]]], pernas: [[[70, 64], [72, 81]], [[66, 64], [66, 81]]] },
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

// ---------------------------------------------------------------- personagens em cartoon
// Corpo em tom de pele com contorno quente; rosto com olhos fechados, sorriso e bochecha rosada;
// cabelo curto nele e coque com mecha nela. Nudez só insinuada: corpos lisos, sem detalhes íntimos.

const unit = (a: P): P => mult(a, 1 / tam(a));
const dot = (a: P, b: P) => a[0] * b[0] + a[1] * b[1];

interface Estilo { pele: string; sombra: string; contorno: string; cabelo: string; coque?: boolean }
const ESTILO_A: Estilo = { pele: '#f2c29b', sombra: '#e3a87f', contorno: '#b97a55', cabelo: '#4a2e24' };
const ESTILO_B: Estilo = { pele: '#fcdcc4', sombra: '#f2c1a2', contorno: '#c98b68', cabelo: '#7a2a24', coque: true };

function Personagem({ c, m, e, parceiro, id }: { c: Corpo; m: Medidas; e: Estilo; parceiro: P; id: string }) {
  const corpo = pecas(c, m).slice(0, -1).join(' '); // sem a cabeça (vai à parte, com rosto)
  const up = unit(sub(c.cabeca, c.pescoco));
  const r = m.cabeca * 1.32;
  // para onde o rosto olha: na direção do parceiro, perpendicular ao pescoço
  const p = unit(sub(parceiro, c.cabeca));
  let f = sub(p, mult(up, dot(p, up)));
  f = tam(f) < 0.2 ? [1, 0] : unit(f);
  const lado: P = [-up[1], up[0]];
  const ladoFora = dot(lado, f) >= 0 ? mult(lado, -1) : lado; // nuca
  const centro = c.cabeca;
  const ponto = (frente: number, alto: number) => soma(centro, soma(mult(f, frente * r), mult(up, alto * r)));
  const olho = ponto(0.4, 0.02), boca = ponto(0.58, -0.42), bochecha = ponto(0.22, -0.3);
  const nOlho = mult(f, 1);
  const arcoOlho = `M${f1(olho[0] - nOlho[0] * 1.1 - up[0] * 0.2)},${f1(olho[1] - nOlho[1] * 1.1 - up[1] * 0.2)} Q${f1(olho[0] - up[0] * 1.1)},${f1(olho[1] - up[1] * 1.1)} ${f1(olho[0] + nOlho[0] * 1.1 - up[0] * 0.2)},${f1(olho[1] + nOlho[1] * 1.1 - up[1] * 0.2)}`;
  const sorriso = `M${f1(boca[0] - f[0] * 0.9 + up[0] * 0.4)},${f1(boca[1] - f[1] * 0.9 + up[1] * 0.4)} Q${f1(boca[0] - up[0] * 0.8)},${f1(boca[1] - up[1] * 0.8)} ${f1(boca[0] + f[0] * 0.6 + up[0] * 0.5)},${f1(boca[1] + f[1] * 0.6 + up[1] * 0.5)}`;
  // cabelo: calota no alto da cabeça, puxada para a nuca
  const cal = soma(centro, soma(mult(up, r * 0.78), mult(ladoFora, r * 0.42)));
  const coque = soma(centro, soma(mult(up, r * 0.95), mult(ladoFora, r * 0.55)));
  const mecha = soma(centro, soma(mult(up, -r * 0.7), mult(ladoFora, r * 0.75)));
  return (
    <g>
      <defs>
        <linearGradient id={`pele-${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={e.pele} /><stop offset="100%" stopColor={e.sombra} />
        </linearGradient>
      </defs>
      {/* contorno por baixo, preenchimento por cima: as peças viram um corpo só */}
      <path d={corpo} fill="none" stroke={e.contorno} strokeWidth={1.5} strokeLinejoin="round" />
      <path d={corpo} fill={`url(#pele-${id})`} />
      {/* brilho suave no corpo */}
      <path d={corpo} fill="#fff" opacity={0.08} transform={`translate(${f1(-up[0] * 0.6)},${f1(-up[1] * 0.6)})`} />
      {e.coque && <circle cx={f1(coque[0])} cy={f1(coque[1])} r={f1(r * 0.55)} fill={e.cabelo} stroke={e.contorno} strokeWidth={0.6} />}
      <circle cx={f1(centro[0])} cy={f1(centro[1])} r={f1(r)} fill={e.pele} stroke={e.contorno} strokeWidth={1.2} />
      <circle cx={f1(cal[0])} cy={f1(cal[1])} r={f1(r * 0.92)} fill={e.cabelo} clipPath={`url(#cabeca-${id})`} />
      {e.coque && <path d={membro(soma(centro, mult(ladoFora, r * 0.7)), mecha, r * 0.45, r * 0.2)} fill={e.cabelo} />}
      <clipPath id={`cabeca-${id}`}><circle cx={f1(centro[0])} cy={f1(centro[1])} r={f1(r)} /></clipPath>
      <circle cx={f1(bochecha[0])} cy={f1(bochecha[1])} r={f1(r * 0.24)} fill="#f08f8f" opacity={0.55} />
      <path d={arcoOlho} fill="none" stroke="#3a2420" strokeWidth={0.85} strokeLinecap="round" />
      <path d={sorriso} fill="none" stroke="#9c4a3a" strokeWidth={0.7} strokeLinecap="round" />
    </g>
  );
}

function Cenario({ tipo }: { tipo?: Cenario }) {
  const madeira = '#6e3f2a', lencol = '#ded4ec', lencolSombra = '#c9bcdc', chao = '#d8d0e4';
  const pe = { stroke: madeira, strokeWidth: 2.2, strokeLinecap: 'round' as const };
  switch (tipo) {
    case 'cama': return <g><rect x="6" y="70" width="108" height="7" rx="2" fill={lencol} stroke={lencolSombra} strokeWidth={0.8} /><path d="M12 77 V83 M108 77 V83" {...pe} /><ellipse cx="16" cy="69" rx="10" ry="3.2" fill="#f1eef7" stroke={lencolSombra} strokeWidth={0.6} /></g>;
    case 'cama-curta': return <g><rect x="6" y="70" width="72" height="7" rx="2" fill={lencol} stroke={lencolSombra} strokeWidth={0.8} /><path d="M12 77 V83 M72 77 V83" {...pe} /></g>;
    case 'cadeira': return <g><path d="M28 61 H72" stroke={madeira} strokeWidth={3} strokeLinecap="round" /><path d="M32 62 V83 M68 62 V83 M30 61 V24" {...pe} /></g>;
    case 'banqueta': return <g><path d="M16 58 H40" stroke={madeira} strokeWidth={3.2} strokeLinecap="round" /><path d="M20 59 V83 M36 59 V83" {...pe} /><path d="M6 83 H114" stroke={chao} strokeWidth={1.4} /></g>;
    case 'sofa': return <g><rect x="22" y="58" width="56" height="9" rx="3" fill={lencol} stroke={lencolSombra} strokeWidth={0.8} /><rect x="20" y="30" width="8" height="37" rx="3" fill={lencol} stroke={lencolSombra} strokeWidth={0.8} /><path d="M26 67 V82 M74 67 V82" {...pe} /></g>;
    case 'parede': return <g><rect x="4" y="4" width="16" height="79" fill="#e7e1ef" /><path d="M20 4 V83" stroke={lencolSombra} strokeWidth={1} /><path d="M6 83 H114" stroke={chao} strokeWidth={1.4} /></g>;
    case 'bancada': return <g><path d="M10 56 H56" stroke={madeira} strokeWidth={3.4} strokeLinecap="round" /><path d="M16 58 V83 M50 58 V83" {...pe} /><path d="M6 83 H114" stroke={chao} strokeWidth={1.4} /></g>;
    case 'chuveiro': return <g><path d="M22 83 V6 H38 M35 6 V10" stroke="#9aa3b5" strokeWidth={1.8} fill="none" strokeLinecap="round" /><path d="M30 14 l-3 9 M35 14 l-1 10 M40 14 l1 9 M45 14 l3 9" stroke="#7cc6f0" strokeWidth={1.2} strokeDasharray="2 3" strokeLinecap="round" /><path d="M6 83 H114" stroke={chao} strokeWidth={1.4} /></g>;
    case 'escada': return <g><path d="M8 83 V58 H24 V66 H40 V74 H56 V83 Z" fill="#b9b2c6" /><path d="M6 83 H114" stroke={chao} strokeWidth={1.4} /></g>;
    case 'chao': return <path d="M6 83 H114" stroke={chao} strokeWidth={1.4} />;
    default: return null;
  }
}

export const PictogramaPosicao: React.FC<{ id: string; className?: string; titulo?: string }> = ({ id, className = '', titulo }) => {
  const pose = POSES[id];
  const uid = React.useId().replace(/:/g, '');
  if (!pose) return null;
  return (
    <svg viewBox="0 0 120 88" className={className} role="img" aria-label={titulo ?? 'Ilustração da posição'}>
      <rect x="0" y="0" width="120" height="88" rx="9" fill="#fbf8fd" />
      <circle cx="62" cy="44" r="36" fill="#e6def1" />
      <Cenario tipo={pose.cenario} />
      <Personagem c={pose.a} m={CORPO_A} e={ESTILO_A} parceiro={pose.b.cabeca} id={`a-${uid}`} />
      <Personagem c={pose.b} m={CORPO_B} e={ESTILO_B} parceiro={pose.a.cabeca} id={`b-${uid}`} />
    </svg>
  );
};
