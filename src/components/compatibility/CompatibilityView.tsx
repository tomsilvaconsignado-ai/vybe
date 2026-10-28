import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { 
  Sparkles, 
  CheckCircle2, 
  AlertCircle, 
  MapPin, 
  Heart, 
  Sliders, 
  UserCheck, 
  ArrowRight,
  Shield,
  MessageSquare
} from 'lucide-react';
import { calculateCompatibility, OBJECTIVE_LABELS } from '../../utils/compatibility';

export const CompatibilityView: React.FC = () => {
  const { profiles, currentUser, getCompatibility, setSelectedProfileId, startOrOpenConversation } = useApp();
  const [selectedTargetId, setSelectedTargetId] = useState<string>(profiles[0]?.id || '');

  const targetProfile = profiles.find(p => p.id === selectedTargetId) || profiles[0];
  const compat = targetProfile ? getCompatibility(targetProfile) : null;

  return (
    <div className="max-w-5xl mx-auto py-6 px-4">
      
      {/* Title & Methodology Banner */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-fuchsia-600 to-rose-600 p-[1.5px] flex items-center justify-center">
            <div className="w-full h-full bg-[#0d0a17] rounded-[7px] flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-fuchsia-400" />
            </div>
          </div>
          <h1 className="text-2xl font-extrabold text-white">
            Algoritmo de Sintonia Bidirecional
          </h1>
        </div>
        <p className="text-xs text-zinc-400 leading-relaxed max-w-2xl">
          A compatibilidade no Vybelog avalia a reciprocidade de ambos os lados: objetivos declarados, estilo de aproximação, interesses culturais, discrição e limites mútuos. Não prometemos garantias afetivas, apenas clareza e transparência.
        </p>
      </div>

      {/* Target Profile Picker Carousel */}
      <div className="bg-[#120d20] border border-purple-900/30 rounded-3xl p-4 mb-6 shadow-xl">
        <label className="block text-xs font-bold text-zinc-300 mb-3">
          Selecione um perfil para analisar a sintonia mútua:
        </label>
        
        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none">
          {profiles.map(p => {
            const isSelected = p.id === selectedTargetId;
            const matchScore = getCompatibility(p).score;

            return (
              <button
                key={p.id}
                onClick={() => setSelectedTargetId(p.id)}
                className={`p-2.5 rounded-2xl border flex items-center gap-3 shrink-0 transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-purple-950/80 border-fuchsia-500 shadow-lg shadow-purple-950/50'
                    : 'bg-zinc-900/40 border-zinc-800 hover:border-zinc-700'
                }`}
              >
                <img
                  src={p.avatarUrl}
                  alt={p.displayName}
                  className="w-10 h-10 rounded-full object-cover border border-purple-500/40"
                />
                <div className="text-left">
                  <div className="text-xs font-bold text-white truncate max-w-[110px]">{p.displayName}</div>
                  <div className="text-[10px] text-fuchsia-400 font-semibold">{matchScore}% Sintonia</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Detailed Side-by-Side Comparison */}
      {targetProfile && compat && (
        <div className="grid lg:grid-cols-12 gap-6">
          
          {/* Left Column: Overall Score & Radar Meter */}
          <div className="lg:col-span-5 bg-[#120d20] border border-purple-900/30 rounded-3xl p-6 shadow-xl flex flex-col justify-between">
            <div className="text-center">
              
              {/* Score circle */}
              <div className="relative w-36 h-36 mx-auto mb-4 flex items-center justify-center">
                <div 
                  className="w-full h-full rounded-full border-4 flex items-center justify-center shadow-2xl"
                  style={{ borderColor: compat.color, boxShadow: `0 0 35px ${compat.color}40` }}
                >
                  <div className="text-center">
                    <span className="text-4xl font-black text-white">{compat.score}%</span>
                    <span className="block text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                      Sintonia
                    </span>
                  </div>
                </div>
              </div>

              <h2 className="text-xl font-bold text-white mb-1" style={{ color: compat.color }}>
                {compat.tier}
              </h2>
              <p className="text-xs text-zinc-300 mb-4">
                Entre <strong>{currentUser.displayName}</strong> e <strong>{targetProfile.displayName}</strong>
              </p>

              {/* Profiles comparison thumbnail row */}
              <div className="flex items-center justify-center gap-3 py-3 border-y border-purple-900/30 mb-4">
                <div className="text-center">
                  <img
                    src={currentUser.avatarUrl}
                    alt={currentUser.displayName}
                    className="w-12 h-12 rounded-full object-cover mx-auto mb-1 border-2 border-purple-500"
                  />
                  <span className="text-[11px] text-zinc-300 font-medium block truncate max-w-[90px]">
                    {currentUser.displayName}
                  </span>
                </div>

                <div className="w-8 h-8 rounded-full bg-purple-950 flex items-center justify-center text-fuchsia-400 font-bold text-xs">
                  ⚡
                </div>

                <div className="text-center">
                  <img
                    src={targetProfile.avatarUrl}
                    alt={targetProfile.displayName}
                    className="w-12 h-12 rounded-full object-cover mx-auto mb-1 border-2 border-fuchsia-500"
                  />
                  <span className="text-[11px] text-zinc-300 font-medium block truncate max-w-[90px]">
                    {targetProfile.displayName}
                  </span>
                </div>
              </div>

            </div>

            {/* CTA buttons */}
            <div className="space-y-2">
              <button
                onClick={() => startOrOpenConversation(targetProfile.id)}
                className="w-full py-3 rounded-2xl font-bold text-xs text-white bg-gradient-to-r from-purple-600 to-rose-600 hover:from-purple-500 hover:to-rose-500 shadow-md shadow-purple-950/50 flex items-center justify-center gap-2 cursor-pointer transition-all"
              >
                <MessageSquare className="w-4 h-4" />
                <span>Iniciar Conversa com esta Sintonia</span>
              </button>

              <button
                onClick={() => setSelectedProfileId(targetProfile.id)}
                className="w-full py-2.5 rounded-2xl font-semibold text-xs text-zinc-300 bg-zinc-900 hover:bg-zinc-800 transition-colors cursor-pointer"
              >
                Ver Perfil Completo
              </button>
            </div>
          </div>

          {/* Right Column: Breakdown Factors */}
          <div className="lg:col-span-7 bg-[#120d20] border border-purple-900/30 rounded-3xl p-6 shadow-xl space-y-6">
            
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              Por que vocês combinam? (Critérios Ponderados)
            </h3>

            {/* Reasons checklist */}
            <div className="space-y-2.5">
              {compat.reasons.map((r, i) => (
                <div key={i} className="flex items-start gap-2.5 p-3 rounded-2xl bg-zinc-950/70 border border-purple-900/20">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 mt-1.5 shrink-0" />
                  <span className="text-xs text-zinc-200 leading-snug">{r}</span>
                </div>
              ))}
            </div>

            {/* Shared Objectives */}
            <div>
              <h4 className="text-xs font-bold text-purple-300 uppercase tracking-wider mb-2">
                Objetivos Mútuos na Plataforma:
              </h4>
              <div className="flex flex-wrap gap-2">
                {compat.sharedObjectives.length > 0 ? (
                  compat.sharedObjectives.map(obj => (
                    <span key={obj} className="px-3 py-1 rounded-xl bg-purple-950/70 border border-purple-800/40 text-xs text-purple-200 font-medium">
                      ✓ {OBJECTIVE_LABELS[obj] || obj}
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-zinc-400">Nenhum objetivo idêntico marcado, porém sem conflitos primários.</span>
                )}
              </div>
            </div>

            {/* Shared Interests & Lifestyle */}
            <div>
              <h4 className="text-xs font-bold text-fuchsia-300 uppercase tracking-wider mb-2">
                Afinidades de Estilo de Vida & Interesses:
              </h4>
              <div className="flex flex-wrap gap-2">
                {[...compat.sharedInterests, ...compat.sharedLifestyleTags].map((tag, i) => (
                  <span key={i} className="px-3 py-1 rounded-xl bg-fuchsia-950/40 border border-fuchsia-800/30 text-xs text-fuchsia-200">
                    ★ {tag}
                  </span>
                ))}
              </div>
            </div>

            {/* Stated Limits & Respect */}
            <div className="p-4 rounded-2xl bg-purple-950/20 border border-purple-900/30">
              <h4 className="text-xs font-bold text-zinc-200 mb-1 flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-purple-400" />
                Limites Pessoais Declarados por {targetProfile.displayName}:
              </h4>
              <ul className="text-xs text-zinc-400 list-disc list-inside space-y-1">
                {targetProfile.compatibilityPrefs.personalLimits.map((limit, idx) => (
                  <li key={idx}>{limit}</li>
                ))}
              </ul>
            </div>

          </div>

        </div>
      )}

    </div>
  );
};
