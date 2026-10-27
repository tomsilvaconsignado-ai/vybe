import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import logoUrl from '../../assets/logo.png';
import { ProfileType } from '../../types';
import {
  ShieldCheck,
  Lock,
  Sparkles,
  Users,
  EyeOff,
  ArrowRight,
  ChevronDown,
  Shield,
  MessageSquareHeart
} from 'lucide-react';

const PROFILE_OPTIONS: { type: ProfileType; label: string }[] = [
  { type: 'couple', label: 'Casal' },
  { type: 'single_female', label: 'Mulher solteira' },
  { type: 'single_male', label: 'Homem solteiro' },
  { type: 'polyamorous', label: 'Poliamor / Tríade' },
];

export const LandingPage: React.FC = () => {
  const { setAuthModalType, setPrivacyTermsModalOpen, setRegisterProfileType } = useApp();
  const [profileType, setProfileType] = useState<ProfileType | ''>('');

  const openRegister = (type: ProfileType | null) => {
    setRegisterProfileType(type);
    setAuthModalType('register');
  };

  return (
    <div className="min-h-screen bg-[#08060c] text-zinc-100 flex flex-col selection:bg-purple-600 selection:text-white">
      
      {/* Top Banner Warning +18 */}
      <div className="bg-gradient-to-r from-purple-950/80 via-rose-950/80 to-purple-950/80 border-b border-rose-900/40 py-2 px-4 text-center text-xs font-semibold text-rose-300 flex items-center justify-center gap-2">
        <ShieldCheck className="w-4 h-4 text-rose-400" />
        <span>Ambiente estritamente restrito a maiores de 18 anos. Privacidade e consentimento mútuo garantidos.</span>
      </div>

      {/* Hero Section */}
      <section className="relative overflow-hidden flex-1 flex items-center min-h-[calc(100vh-7rem)] px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
        {/* Fundo: preto profundo com brilhos dourado e roxo da identidade */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#120a1f] via-[#08060c] to-[#1a0d12] pointer-events-none" />
        <div className="absolute -top-32 -left-32 w-[520px] h-[520px] bg-purple-700/25 rounded-full blur-[160px] pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-[480px] h-[480px] bg-amber-600/15 rounded-full blur-[150px] pointer-events-none" />
        <img
          src={logoUrl}
          alt=""
          aria-hidden="true"
          className="absolute -right-24 top-1/2 -translate-y-1/2 w-[640px] max-w-none opacity-[0.06] pointer-events-none select-none hidden lg:block"
        />

        <div className="relative z-10 w-full max-w-7xl mx-auto grid lg:grid-cols-12 gap-10 lg:gap-12 items-center">

          {/* Coluna esquerda: chamada principal */}
          <div className="lg:col-span-7 space-y-6 text-center lg:text-left">
            <img
              src={logoUrl}
              alt="Vybelog"
              className="w-24 h-24 sm:w-28 sm:h-28 mx-auto lg:mx-0 rounded-full shadow-2xl shadow-amber-900/40"
            />

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-light tracking-tight text-white leading-[1.15]">
              Conecte-se com <strong className="font-extrabold">casais</strong> e{' '}
              <strong className="font-extrabold">solteiros</strong> em uma{' '}
              <strong className="font-extrabold bg-gradient-to-r from-amber-300 via-amber-400 to-orange-400 bg-clip-text text-transparent">
                rede social adulta
              </strong>{' '}
              feita para a sua privacidade
            </h1>

            <p className="text-base sm:text-lg text-zinc-300 max-w-xl mx-auto lg:mx-0 leading-relaxed">
              Conexões autênticas, discretas e estritamente consensuais.{' '}
              <button
                type="button"
                onClick={() => openRegister(null)}
                className="font-bold text-amber-400 hover:text-amber-300 hover:underline cursor-pointer"
              >
                Cadastre-se grátis
              </button>
              !
            </p>

            <div className="pt-2 grid grid-cols-3 gap-2 sm:gap-4 max-w-lg mx-auto lg:mx-0 text-left">
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-amber-400 shrink-0" />
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

          {/* Coluna direita: card de cadastro */}
          <div className="lg:col-span-5">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                openRegister(profileType || null);
              }}
              className="mx-auto w-full max-w-md rounded-3xl p-6 sm:p-8 bg-white/[0.06] border border-amber-500/20 backdrop-blur-xl shadow-2xl shadow-black/50"
            >
              <h2 className="text-2xl sm:text-3xl font-extrabold text-white mb-6">
                Quero criar meu perfil:
              </h2>

              <label htmlFor="landing-profile-type" className="block text-lg font-semibold text-zinc-200 mb-2">
                Eu sou:
              </label>
              <div className="relative mb-5">
                <select
                  id="landing-profile-type"
                  value={profileType}
                  onChange={(e) => setProfileType(e.target.value as ProfileType | '')}
                  className="w-full appearance-none rounded-xl bg-[#0d0a17] border border-zinc-700 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/30 outline-none px-4 py-4 pr-10 text-base text-white cursor-pointer"
                >
                  <option value="" disabled>Selecione seu perfil</option>
                  {PROFILE_OPTIONS.map(opt => (
                    <option key={opt.type} value={opt.type}>{opt.label}</option>
                  ))}
                </select>
                <ChevronDown className="w-5 h-5 text-zinc-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>

              <button
                type="submit"
                className="w-full py-4 rounded-xl font-extrabold text-lg text-[#1a0f05] bg-gradient-to-r from-amber-300 via-amber-500 to-orange-500 hover:from-amber-200 hover:to-orange-400 shadow-xl shadow-amber-900/40 hover:scale-[1.01] active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>Criar minha conta grátis!</span>
                <ArrowRight className="w-5 h-5" />
              </button>

              <p className="mt-6 text-center">
                <button
                  type="button"
                  onClick={() => setAuthModalType('login')}
                  className="text-sm font-semibold text-zinc-200 underline underline-offset-4 hover:text-amber-300 cursor-pointer"
                >
                  Já tenho cadastro
                </button>
              </p>

              <p className="mt-6 pt-4 border-t border-white/10 text-[11px] text-zinc-400 text-center flex items-center justify-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-rose-400" />
                Exclusivo para maiores de 18 anos
              </p>
            </form>
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
              Esqueça interfaces antigas e invasivas. O Vybelog une o dinamismo de redes modernas com recursos de consentimento que você sempre quis.
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
            <img src={logoUrl} alt="" className="w-8 h-8 rounded-full" />
            <span className="font-extrabold text-lg text-white">Vybelog</span>
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
