// Posição de rolagem por endereço: guardada enquanto a pessoa rola e restaurada no F5 e no voltar/avançar.
// O conteúdo (feed, perfis) chega depois da tela; a restauração tenta por alguns segundos até a página
// ter altura suficiente e desiste se a própria pessoa começar a rolar.
const CHAVE = 'vybe.rolagem';
const LIMITE = 60;

function ler(): Record<string, number> {
  try { return JSON.parse(sessionStorage.getItem(CHAVE) ?? '{}') as Record<string, number>; } catch { return {}; }
}
function gravar(mapa: Record<string, number>) {
  try {
    const chaves = Object.keys(mapa);
    if (chaves.length > LIMITE) for (const k of chaves.slice(0, chaves.length - LIMITE)) delete mapa[k];
    sessionStorage.setItem(CHAVE, JSON.stringify(mapa));
  } catch { /* sem armazenamento */ }
}

/** Guarda a posição atual do endereço informado (ou do atual) */
export function lembrarRolagem(caminho = window.location.pathname) {
  const mapa = ler();
  mapa[caminho] = Math.round(window.scrollY);
  gravar(mapa);
}

let cancelarAnterior: (() => void) | null = null;

/** Volta à posição guardada do endereço (0 quando não houver) */
export function restaurarRolagem(caminho = window.location.pathname) {
  cancelarAnterior?.();
  const alvo = ler()[caminho] ?? 0;
  if (alvo <= 0) { window.scrollTo(0, 0); return; }
  let ativo = true;
  const parar = () => { ativo = false; };
  const eventos = ['wheel', 'touchstart', 'keydown', 'mousedown'] as const;
  eventos.forEach((e) => window.addEventListener(e, parar, { once: true, passive: true }));
  const inicio = Date.now();
  const tentar = () => {
    if (!ativo) return;
    const cabe = document.documentElement.scrollHeight - window.innerHeight >= alvo - 4;
    window.scrollTo(0, cabe ? alvo : document.documentElement.scrollHeight);
    if (!cabe && Date.now() - inicio < 4000) setTimeout(tentar, 120);
  };
  requestAnimationFrame(() => requestAnimationFrame(tentar));
  cancelarAnterior = () => { ativo = false; eventos.forEach((e) => window.removeEventListener(e, parar)); };
}

/** Assume o controle da rolagem (o navegador restauraria antes do conteúdo existir) e guarda enquanto rola */
export function iniciarRolagem() {
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  let agendado = 0;
  const aoRolar = () => {
    if (agendado) return;
    agendado = window.setTimeout(() => { agendado = 0; lembrarRolagem(); }, 200);
  };
  window.addEventListener('scroll', aoRolar, { passive: true });
  window.addEventListener('pagehide', () => lembrarRolagem());
  return () => window.removeEventListener('scroll', aoRolar);
}
