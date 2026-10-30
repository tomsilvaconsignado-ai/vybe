// Cada publicação gera arquivos com nomes novos (ex.: DiscoverView-B9kM3WEi.js) e apaga os antigos.
// Quem estava com o site aberto, ao abrir uma tela pela primeira vez, pede o arquivo antigo e
// recebe 404 ("Failed to fetch dynamically imported module"). A saída é recarregar a página uma
// vez para pegar a versão nova. A trava evita ficar recarregando sem parar se o erro for outro.

const RELOAD_KEY = 'vybelog:chunk-reload-at';
const RETRY_WINDOW_MS = 30_000;

export function isChunkLoadError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? '');
  return /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Unable to preload CSS|ChunkLoadError/i.test(message);
}

// Recarrega se ainda não tentou nos últimos 30 s. Retorna false quando já tentou (aí mostra o erro).
export function reloadForNewVersion(): boolean {
  try {
    const last = Number(sessionStorage.getItem(RELOAD_KEY) || 0);
    if (Date.now() - last < RETRY_WINDOW_MS) return false;
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
  } catch {
    // Sem sessionStorage (modo privado restrito): recarrega mesmo assim, uma vez por carregamento
    if ((window as any).__vybelogChunkReloaded) return false;
    (window as any).__vybelogChunkReloaded = true;
  }
  window.location.reload();
  return true;
}

// Carrega uma tela sob demanda; se o arquivo sumiu por causa de uma publicação nova, recarrega
export function importWithReload<T>(loader: () => Promise<T>): Promise<T> {
  return loader().catch(error => {
    if (isChunkLoadError(error) && reloadForNewVersion()) {
      // A página está recarregando: segura a promessa para não piscar a tela de erro
      return new Promise<T>(() => undefined);
    }
    throw error;
  });
}
