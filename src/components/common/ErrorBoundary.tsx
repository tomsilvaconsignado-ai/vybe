import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Trash2, Shield } from 'lucide-react';
import logoUrl from '../../assets/logo.png';
import { isChunkLoadError, reloadForNewVersion } from '../../lib/chunkReload';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Versão nova publicada com a aba aberta: recarrega sozinho em vez de mostrar o erro
    if (isChunkLoadError(error) && reloadForNewVersion()) return;
    console.error('[Vybelog ErrorBoundary] Uncaught render error:', error, errorInfo);
    this.setState({ error, errorInfo });
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleResetStorage = () => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch (e) {
      console.warn('Could not clear storage:', e);
    }
    window.location.reload();
  };

  public render() {
    // Falha ao baixar uma tela: quase sempre é versão nova publicada ou conexão instável
    if (this.state.hasError && isChunkLoadError(this.state.error)) {
      return (
        <div className="min-h-dvh bg-[#08060c] text-zinc-100 flex flex-col items-center justify-center p-6 text-center select-none">
          <div className="w-full max-w-sm bg-[#120f1a] border border-purple-500/30 rounded-2xl p-6 sm:p-8 shadow-2xl">
            <img src={logoUrl} alt="" className="w-14 h-14 rounded-full mx-auto mb-4" />
            <h1 className="text-lg font-bold text-white mb-2">O Vybelog foi atualizado</h1>
            <p className="text-sm text-zinc-400 mb-6">
              Há uma versão nova disponível. Toque abaixo para continuar. Se não funcionar, confira sua conexão com a internet.
            </p>
            <button
              onClick={this.handleReload}
              className="w-full py-3 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-purple-600 to-rose-600 flex items-center justify-center gap-2 cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" /> Atualizar agora
            </button>
          </div>
        </div>
      );
    }
    if (this.state.hasError) {
      return (
        <div className="min-h-dvh bg-[#08060c] text-zinc-100 flex flex-col items-center justify-center p-6 text-center select-none">
          <div className="w-full max-w-md bg-[#120f1a] border border-rose-500/30 rounded-2xl p-6 sm:p-8 shadow-2xl shadow-rose-950/40">
            {/* Brand Logo & Icon */}
            <div className="flex items-center justify-center gap-2 mb-4">
              <img src={logoUrl} alt="" className="w-10 h-10 rounded-full" />
              <span className="text-2xl font-black tracking-widest bg-gradient-to-r from-rose-500 via-fuchsia-500 to-violet-400 bg-clip-text text-transparent">
                Vybelog
              </span>
              <div className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
            </div>

            <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-7 h-7" />
            </div>

            <h1 className="text-xl font-bold text-white mb-2">
              Recuperação do Sistema Vybelog
            </h1>

            <p className="text-sm text-zinc-400 mb-6 leading-relaxed">
              Identificamos um imprevisto na renderização da interface. Nossos mecanismos de proteção evitaram uma falha silenciosa.
            </p>

            {this.state.error && (
              <div className="text-left bg-black/60 border border-zinc-800 rounded-xl p-3 mb-6 text-xs text-rose-300 font-mono overflow-auto max-h-32">
                <span className="font-semibold text-zinc-400 block mb-1">Motivo detectado:</span>
                {this.state.error.message || String(this.state.error)}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={this.handleReload}
                className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-rose-600 to-fuchsia-600 hover:from-rose-500 hover:to-fuchsia-500 text-white font-medium text-sm flex items-center justify-center gap-2 shadow-lg shadow-rose-600/25 transition cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                Recarregar Página
              </button>
              
              <button
                onClick={this.handleResetStorage}
                className="py-3 px-4 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700/60 text-zinc-300 font-medium text-sm flex items-center justify-center gap-2 transition cursor-pointer"
                title="Limpar dados temporários corrompidos e reiniciar"
              >
                <Trash2 className="w-4 h-4 text-zinc-400" />
                Redefinir Dados
              </button>
            </div>

            <div className="mt-6 pt-4 border-t border-zinc-800/80 flex items-center justify-center gap-2 text-xs text-zinc-500">
              <Shield className="w-3.5 h-3.5 text-zinc-400" />
              <span>Ambiente Seguro +18 • Vybelog Plataforma</span>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
