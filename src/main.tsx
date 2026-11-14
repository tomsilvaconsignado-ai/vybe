import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { reloadForNewVersion } from './lib/chunkReload';
import '@fontsource-variable/plus-jakarta-sans/wght.css';
import '@fontsource-variable/plus-jakarta-sans/wght-italic.css';
import './index.css';
import { conviteDoEndereco, guardarConvite } from './lib/convite';
import { registrarVisita } from './lib/crescimento';
import { destinoCompartilhado } from './lib/rotas';
import { prepararImagemDaMarca } from './lib/compartilhar';

// Link de convite (/convite/<código> ou ?convite=): guarda o código para o cadastro e limpa o endereço
{
  let caminho = window.location.pathname;
  let busca = window.location.search;
  const c = conviteDoEndereco(caminho, busca);
  if (c) {
    guardarConvite(c.codigo, c.campanha);
    void registrarVisita(c.codigo);
    caminho = c.caminhoLimpo; busca = c.buscaLimpa;
  }
  // link compartilhado (?ir=/perfil/...): abre a tela certa
  const d = destinoCompartilhado(busca);
  if (d) { caminho = d.caminho; busca = d.busca; }
  if (c || d) window.history.replaceState(null, '', caminho + busca + window.location.hash);
}
// imagem do Vybelog pronta para ir junto nos compartilhamentos
prepararImagemDaMarca();

// Arquivo de uma versão anterior que já não existe no servidor (site publicado de novo
// com a aba aberta): recarrega uma vez para pegar a versão nova em vez de quebrar a tela.
window.addEventListener('vite:preloadError', event => {
  if (reloadForNewVersion()) event.preventDefault();
});

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
