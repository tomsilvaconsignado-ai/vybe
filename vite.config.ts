import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';
import {defineConfig, type Plugin} from 'vite';

// GitHub Pages: endereço interno (ex.: /perfil/<id>) não existe como arquivo e cai no 404.html.
// Com o 404.html igual ao index.html, o próprio app abre já na tela certa (F5 e links diretos).
const fallbackSpa = (): Plugin => ({
  name: 'vybe-fallback-spa',
  apply: 'build',
  closeBundle() {
    fs.copyFileSync(path.resolve(import.meta.dirname, 'dist/index.html'), path.resolve(import.meta.dirname, 'dist/404.html'));
  },
});

export default defineConfig(() => {
  return {
    // raiz absoluta: os arquivos do app carregam também em endereços internos (/perfil/<id>)
    base: '/',
    plugins: [react(), tailwindcss(), fallbackSpa()],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, './src'),
      },
    },
    build: {
      rolldownOptions: {
        output: {
          // Bibliotecas em arquivos próprios: o navegador as mantém em cache entre atualizações do app
          codeSplitting: {
            groups: [
              { name: 'vendor-supabase', test: /node_modules[\\/]@supabase[\\/]/ },
              { name: 'vendor-react', test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/ },
            ],
          },
        },
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
