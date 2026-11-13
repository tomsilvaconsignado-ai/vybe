import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { reloadForNewVersion } from './lib/chunkReload';
import './index.css';
import { conviteDoEndereco, guardarConvite } from './lib/convite';
import { registrarVisita } from './lib/crescimento';

// Link de convite (/convite/<código> ou ?convite=): guarda o código para o cadastro e limpa o endereço
{
  const c = conviteDoEndereco(window.location.pathname, window.location.search);
  if (c) {
    guardarConvite(c.codigo, c.campanha);
    void registrarVisita(c.codigo);
    window.history.replaceState(null, '', c.caminhoLimpo + c.buscaLimpa + window.location.hash);
  }
}

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
