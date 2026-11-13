// Coordenação das janelas de divulgação (campanha de convite e publicidade): nunca as duas ao mesmo
// tempo, e a publicidade só depois de um intervalo desde que a janela de convite foi fechada.
let conviteAberto = false;
let conviteFechadoEm = 0;

export function marcarConviteAberto(aberto: boolean) {
  conviteAberto = aberto;
  if (!aberto) conviteFechadoEm = Date.now();
}

/** A publicidade pode aparecer agora? (convite fechado há pelo menos `intervaloMs`, ou não exibido) */
export function publicidadeLiberada(intervaloMs: number, agora = Date.now()) {
  if (conviteAberto) return false;
  return conviteFechadoEm === 0 || agora - conviteFechadoEm >= intervaloMs;
}

/** Próximo anúncio do revezamento (guardado no aparelho: cada acesso mostra o seguinte) */
export function proximoDoRevezamento(total: number, chave = 'vybe.popup.anuncio.vez'): number {
  if (total <= 0) return -1;
  let vez = 0;
  try { vez = Number(localStorage.getItem(chave) ?? 0) || 0; } catch { /* sem armazenamento */ }
  const indice = ((vez % total) + total) % total;
  try { localStorage.setItem(chave, String(vez + 1)); } catch { /* sem armazenamento */ }
  return indice;
}
