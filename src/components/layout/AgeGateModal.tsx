import React from 'react';
import { useApp } from '../../context/AppContext';
import logoUrl from '../../assets/logo.png';
import { ShieldAlert, CheckCircle, AlertTriangle, Lock } from 'lucide-react';

export const AgeGateModal: React.FC = () => {
  const { isAgeConfirmed, confirmAge } = useApp();

  if (isAgeConfirmed) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-[#110c1c] border border-purple-800/40 rounded-3xl p-6 sm:p-8 shadow-2xl text-center relative overflow-hidden">
        {/* Glow accent */}
        <div className="absolute -top-16 -left-16 w-32 h-32 bg-rose-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-16 -right-16 w-32 h-32 bg-purple-500/20 rounded-full blur-3xl pointer-events-none" />

        <img src={logoUrl} alt="Vybelog" className="w-24 h-24 mx-auto mb-3 rounded-full shadow-xl shadow-amber-900/30" />
        <span className="inline-block mb-3 text-xs font-black tracking-widest px-2 py-0.5 rounded bg-rose-500/20 text-rose-400 border border-rose-500/30">
          +18
        </span>

        <h2 className="text-2xl font-extrabold text-white mb-2">
          Acesso Exclusivo para Adultos
        </h2>
        
        <p className="text-sm text-zinc-300 mb-6 leading-relaxed">
          O <strong className="text-purple-300">Vybelog</strong> é uma rede social voltada exclusivamente para pessoas maiores de 18 anos, casais liberais e solteiros, baseada no <strong className="text-rose-300">consentimento estrito</strong>, respeito mútuo e conformidade com a LGPD.
        </p>

        <div className="bg-zinc-950/70 border border-purple-900/30 rounded-2xl p-4 text-left space-y-2 mb-6">
          <div className="flex items-start gap-2.5 text-xs text-zinc-300">
            <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>Declaro sob as penas da lei que possuo 18 anos ou mais.</span>
          </div>
          <div className="flex items-start gap-2.5 text-xs text-zinc-300">
            <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>Concordo com as diretrizes de consentimento mútuo e privacidade restrita.</span>
          </div>
          <div className="flex items-start gap-2.5 text-xs text-zinc-300">
            <Lock className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
            <span>Tolerância zero para perfis falsos, assédio ou qualquer conteúdo sem consentimento.</span>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <button
            onClick={confirmAge}
            className="w-full py-3.5 px-6 rounded-2xl font-bold text-white bg-gradient-to-r from-purple-600 via-fuchsia-600 to-rose-600 hover:from-purple-500 hover:to-rose-500 shadow-lg shadow-purple-900/40 transition-all cursor-pointer"
          >
            Tenho 18 anos ou mais — Entrar
          </button>
          
          <a
            href="https://google.com"
            className="text-xs text-zinc-400 hover:text-zinc-300 transition-colors py-1 cursor-pointer"
          >
            Sou menor de 18 anos (Sair)
          </a>
        </div>
      </div>
    </div>
  );
};
