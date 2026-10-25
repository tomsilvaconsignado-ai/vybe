import React from 'react';
import { useApp } from '../../context/AppContext';
import { 
  ShieldCheck, 
  Lock, 
  Sparkles, 
  Users, 
  Flame, 
  Heart, 
  EyeOff, 
  CheckCircle2, 
  ArrowRight,
  Shield,
  Key,
  MessageSquareHeart
} from 'lucide-react';

export const LandingPage: React.FC = () => {
  const { setAuthModalType, setPrivacyTermsModalOpen } = useApp();

  return (
    <div className="min-h-screen bg-[#08060c] text-zinc-100 flex flex-col selection:bg-purple-600 selection:text-white">
      
      {/* Top Banner Warning +18 */}
      <div className="bg-gradient-to-r from-purple-950/80 via-rose-950/80 to-purple-950/80 border-b border-rose-900/40 py-2 px-4 text-center text-xs font-semibold text-rose-300 flex items-center justify-center gap-2">
        <ShieldCheck className="w-4 h-4 text-rose-400" />
        <span>Ambiente estritamente restrito a maiores de 18 anos. Privacidade e consentimento mútuo garantidos.</span>
      </div>

      {/* Hero Section */}
      <section className="relative pt-12 pb-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto flex-1 flex flex-col justify-center">
        {/* Glow ambient background circles */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[550px] max-w-full h-[550px] bg-purple-700/15 rounded-full blur-[140px] pointer-events-none" />
        <div className="absolute top-1/3 right-10 w-[350px] h-[350px] bg-rose-600/10 rounded-full blur-[120px] pointer-events-none" />

        <div className="grid lg:grid-cols-12 gap-12 items-center relative z-10">
          
          {/* Left Column: Brand & Copy */}
          <div className="lg:col-span-7 space-y-6 text-center lg:text-left">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-purple-950/60 border border-purple-800/40 text-purple-300 text-xs font-semibold">
              <Sparkles className="w-3.5 h-3.5 text-fuchsia-400" />
              <span>Rede Social Liberal de Nova Geração</span>
            </div>

            <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-white leading-[1.1]">
              Sua conexão.{' '}
              <span className="bg-gradient-to-r from-purple-400 via-fuchsia-400 to-rose-400 bg-clip-text text-transparent">
                Suas regras.
              </span>
            </h1>

            <p className="text-base sm:text-lg text-zinc-300 max-w-xl mx-auto lg:mx-0 font-normal leading-relaxed">
              O <strong className="text-white font-semibold">VYBE</strong> é a plataforma social moderna para casais liberais e solteiros que buscam conexões autênticas, elegantes e estritamente consensuais. Sem vulgaridade, com discrição e controle absoluto sobre quem vê sua intimidade.
            </p>

            {/* CTAs */}
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3 sm:gap-4">
              <button
                onClick={() => setAuthModalType('register')}
                className="w-full sm:w-auto px-8 py-4 rounded-2xl font-bold text-white bg-gradient-to-r from-purple-600 via-fuchsia-600 to-rose-600 hover:from-purple-500 hover:to-rose-500 shadow-xl shadow-purple-900/40 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer text-base"
              >
                <span>Criar Conta Gratuita</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <button
                onClick={() => setAuthModalType('login')}
                className="w-full sm:w-auto px-8 py-4 rounded-2xl font-bold text-zinc-200 bg-zinc-900/90 border border-purple-900/40 hover:border-purple-600/60 hover:text-white transition-all flex items-center justify-center gap-2 cursor-pointer text-base"
              >
                <span>Já possuo conta</span>
              </button>
            </div>

            {/* Micro guarantees */}
            <div className="pt-4 grid grid-cols-3 gap-2 sm:gap-4 border-t border-purple-950/40 max-w-lg mx-auto lg:mx-0 text-left">
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-purple-400 shrink-0" />
                <span className="text-[11px] text-zinc-400">Cofres com chave privativa</span>
              </div>
              <div className="flex items-center gap-2">
                <EyeOff className="w-4 h-4 text-rose-400 shrink-0" />
                <span className="text-[11px] text-zinc-400">Localização aproximada opcional</span>
              </div>
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="text-[11px] text-zinc-400">Conformidade LGPD estrita</span>
              </div>
            </div>

          </div>

          {/* Right Column: Visual Preview Cards */}
          <div className="lg:col-span-5 relative">
            <div className="relative mx-auto max-w-sm sm:max-w-md bg-[#130d22] border border-purple-900/40 rounded-3xl p-5 shadow-2xl shadow-purple-950/50 backdrop-blur-xl">
              
              {/* Couple mini card */}
              <div className="relative rounded-2xl overflow-hidden aspect-[4/3] mb-4 group">
                <img
                  src="https://images.unsplash.com/photo-1522529599102-193c0d76b5b6?w=800&auto=format&fit=crop&q=80"
                  alt="Exemplo ilustrativo de perfil de casal"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />

                <div className="absolute top-3 left-3 px-2 py-0.5 rounded-md bg-black/60 text-zinc-300 text-[10px] font-semibold">
                  Exemplo ilustrativo
                </div>

                <div className="absolute top-3 right-3 px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md border border-white/10 text-white text-[11px] font-semibold flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>Casal Verificado</span>
                </div>

                <div className="absolute bottom-3 left-3 right-3 text-left">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-white font-bold text-base">Rafa & Carol, 34 e 32</h4>
                      <p className="text-purple-300 text-xs">São Paulo • 6 km de distância</p>
                    </div>
                    <div className="px-2.5 py-1 rounded-xl bg-purple-600/80 text-white text-xs font-bold shadow">
                      94% Sintonia
                    </div>
                  </div>
                </div>
              </div>

              {/* Feed preview snippets */}
              <div className="bg-zinc-950/70 border border-purple-900/30 rounded-2xl p-3.5 space-y-3 text-left">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-zinc-300 flex items-center gap-1.5">
                    <Key className="w-3.5 h-3.5 text-fuchsia-400" />
                    Cofre Íntimo com Autorização
                  </span>
                  <span className="text-[10px] text-zinc-400 font-medium">3 mídias protegidas</span>
                </div>
                <p className="text-[11px] text-zinc-400 leading-relaxed">
                  Fotos e vídeos sensuais ficam borrados e trancados até você aprovar nominalmente o pedido de acesso.
                </p>
                <div className="flex gap-2">
                  <div className="flex-1 h-12 rounded-xl bg-purple-950/40 border border-purple-800/30 flex items-center justify-center text-zinc-400 text-xs">
                    🔒 Foto protegida
                  </div>
                  <div className="flex-1 h-12 rounded-xl bg-purple-950/40 border border-purple-800/30 flex items-center justify-center text-zinc-400 text-xs">
                    🔒 Foto protegida
                  </div>
                </div>
              </div>

            </div>
          </div>

        </div>
      </section>

      {/* Core Features Pillars */}
      <section className="py-16 bg-[#0a0712] border-t border-purple-950/40 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white mb-3">
              Construído para adultos exigentes
            </h2>
            <p className="text-sm text-zinc-400">
              Esqueça interfaces antigas e invasivas. O VYBE une o dinamismo de redes modernas com recursos de consentimento que você sempre quis.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            
            {/* Card 1 */}
            <div className="p-6 rounded-3xl bg-zinc-900/50 border border-purple-900/30 hover:border-purple-600/50 transition-all text-left">
              <div className="w-12 h-12 rounded-2xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-purple-400 mb-4">
                <Users className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Perfis de Casais e Solteiros</h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Suporte para contas conjuntas onde ambos os parceiros autorizam a presença, além de solteiras e solteiros que valorizam o diálogo antes de qualquer encontro.
              </p>
            </div>

            {/* Card 2 */}
            <div className="p-6 rounded-3xl bg-zinc-900/50 border border-purple-900/30 hover:border-fuchsia-600/50 transition-all text-left">
              <div className="w-12 h-12 rounded-2xl bg-fuchsia-600/20 border border-fuchsia-500/30 flex items-center justify-center text-fuchsia-400 mb-4">
                <Sparkles className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Algoritmo de Sintonia Bidirecional</h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Calcula afinidade baseada em limites declarados, objetivos (amizades, casais, 3ª pessoa), ritmo desejado e discrição mútua, sem promessas vazias.
              </p>
            </div>

            {/* Card 3 */}
            <div className="p-6 rounded-3xl bg-zinc-900/50 border border-purple-900/30 hover:border-rose-600/50 transition-all text-left">
              <div className="w-12 h-12 rounded-2xl bg-rose-600/20 border border-rose-500/30 flex items-center justify-center text-rose-400 mb-4">
                <MessageSquareHeart className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Filtro Protetivo de Mensagens</h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Desconhecidos não podem enviar mídias íntimas sem autorização. Todas as conversas iniciais passam por uma solicitação de contato aceita por você.
              </p>
            </div>

          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 border-t border-purple-950/40 bg-[#06040a] px-4 text-center text-xs text-zinc-400">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-extrabold text-lg text-white">VYBE</span>
            <span className="text-[11px] text-zinc-400">— Sua conexão. Suas regras.</span>
          </div>

          <div className="flex items-center gap-6">
            <button
              onClick={() => setPrivacyTermsModalOpen(true)}
              className="hover:text-purple-300 transition-colors cursor-pointer"
            >
              Termos de Uso
            </button>
            <button
              onClick={() => setPrivacyTermsModalOpen(true)}
              className="hover:text-purple-300 transition-colors cursor-pointer"
            >
              Política de Privacidade & LGPD
            </button>
            <span className="text-rose-400 font-bold">+18 Anos</span>
          </div>
        </div>
      </footer>

    </div>
  );
};
