// Compartilhar com a imagem do Vybelog: no celular, o menu nativo envia a logo + o texto com o link
// (WhatsApp, Instagram, Telegram...). Onde não dá para anexar imagem, compartilha o link (a prévia com a
// logo vem das metatags do site) e, sem menu nativo, copia o link.
const IMAGEM = '/og-image.jpg?v=3';
let imagem: File | null = null;
let carregando: Promise<void> | null = null;

/** Baixa a imagem antes do toque: o navegador só permite compartilhar logo após o gesto da pessoa */
export function prepararImagemDaMarca() {
  if (imagem || carregando || typeof fetch === 'undefined') return;
  carregando = fetch(IMAGEM)
    .then(r => (r.ok ? r.blob() : Promise.reject(new Error('imagem indisponível'))))
    .then(b => { imagem = new File([b], 'vybelog.jpg', { type: 'image/jpeg' }); })
    .catch(() => { carregando = null; });
}

export type ResultadoCompartilhar = 'compartilhado' | 'copiado' | 'cancelado';

export async function compartilharComImagem({ titulo, texto, url }: { titulo: string; texto: string; url: string }): Promise<ResultadoCompartilhar> {
  const completo = texto.includes(url) ? texto : `${texto} ${url}`.trim();
  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      if (imagem && navigator.canShare?.({ files: [imagem] })) {
        await navigator.share({ files: [imagem], title: titulo, text: completo });
      } else {
        await navigator.share({ title: titulo, text: texto, url });
      }
      return 'compartilhado';
    } catch (e) {
      if ((e as Error)?.name === 'AbortError') return 'cancelado';
      // alguns aplicativos recusam arquivo: tenta só com o link
      try { await navigator.share({ title: titulo, text: texto, url }); return 'compartilhado'; } catch { /* segue para copiar */ }
    }
  }
  try { await navigator.clipboard.writeText(completo); return 'copiado'; } catch { return 'cancelado'; }
}
