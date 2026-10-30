import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { reloadForNewVersion } from './lib/chunkReload';
import './index.css';

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
