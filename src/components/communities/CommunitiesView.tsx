import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { 
  Hash, 
  Users, 
  ShieldCheck, 
  Lock, 
  Check, 
  Plus, 
  MessageSquare, 
  Sparkles,
  Info,
  ChevronRight
} from 'lucide-react';
import { Community } from '../../types';

export const CommunitiesView: React.FC = () => {
  const { communities, toggleJoinCommunity, setSelectedProfileId } = useApp();
  const [selectedCommunity, setSelectedCommunity] = useState<Community | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>('all');

  const filteredCommunities = communities.filter(c => {
    if (activeCategory === 'all') return true;
    return c.category === activeCategory;
  });

  return (
    <div className="max-w-5xl mx-auto py-6 px-4">
      
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-purple-600 to-rose-600 p-[1.5px] flex items-center justify-center">
            <div className="w-full h-full bg-[#0d0a17] rounded-[7px] flex items-center justify-center">
              <Hash className="w-4 h-4 text-purple-400" />
            </div>
          </div>
          <h1 className="text-2xl font-extrabold text-white">Comunidades & Fóruns</h1>
        </div>
        <p className="text-xs text-zinc-400 leading-relaxed max-w-2xl">
          Espaços de diálogo seguro, amizade e troca de vivências liberais sem exigência de interesse romântico ou sexual imediato.
        </p>
      </div>

      {/* Category Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 mb-6 scrollbar-none">
        {[
          { id: 'all', label: 'Todas as Comunidades' },
          { id: 'regional', label: 'Regionais / Cidades' },
          { id: 'beginners', label: 'Iniciantes no Meio' },
          { id: 'lifestyle', label: 'Estilo de Vida & Poliamor' },
          { id: 'events', label: 'Festas & Lounges' }
        ].map(cat => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(cat.id)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold shrink-0 transition-all cursor-pointer ${
              activeCategory === cat.id
                ? 'bg-purple-600 text-white shadow-md'
                : 'bg-zinc-900/80 text-zinc-400 hover:text-zinc-200 border border-zinc-800'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Communities Grid */}
      <div className="grid md:grid-cols-2 gap-6">
        {filteredCommunities.map(comm => (
          <div
            key={comm.id}
            className="bg-[#120d20] border border-purple-900/30 rounded-3xl overflow-hidden shadow-xl hover:border-purple-600/50 transition-all flex flex-col justify-between"
          >
            {/* Cover header */}
            <div className="h-28 relative bg-zinc-950 overflow-hidden">
              <img src={comm.coverUrl} alt={comm.name} className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-[#120d20] via-black/30 to-transparent" />

              <div className="absolute top-3 left-3 w-10 h-10 rounded-2xl bg-black/60 backdrop-blur-md border border-white/10 flex items-center justify-center text-xl shadow">
                {comm.iconUrl}
              </div>

              <div className="absolute top-3 right-3">
                {comm.isPrivate ? (
                  <span className="px-2.5 py-1 rounded-full bg-purple-950/80 backdrop-blur-md border border-purple-500/40 text-purple-300 text-[10px] font-bold flex items-center gap-1">
                    <Lock className="w-3 h-3" /> Privada
                  </span>
                ) : (
                  <span className="px-2.5 py-1 rounded-full bg-zinc-900/80 backdrop-blur-md border border-zinc-700 text-zinc-300 text-[10px] font-bold">
                    Aberta
                  </span>
                )}
              </div>
            </div>

            {/* Body */}
            <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
              <div>
                <h3 className="text-base font-bold text-white mb-1">{comm.name}</h3>
                <p className="text-xs text-zinc-300 leading-relaxed">{comm.description}</p>
              </div>

              {/* Rules preview pill */}
              <div className="p-3 rounded-2xl bg-zinc-950/60 border border-purple-900/20 space-y-1.5">
                <span className="text-[11px] font-bold text-purple-300 uppercase tracking-wider block">
                  Regras Fundamentais da Comunidade:
                </span>
                <ul className="text-[11px] text-zinc-400 space-y-1">
                  {comm.rules.slice(0, 2).map((r, i) => (
                    <li key={i} className="flex items-start gap-1.5">
                      <span className="text-purple-400">•</span>
                      <span>{r}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Footer with stats & join button */}
              <div className="pt-2 border-t border-purple-900/30 flex items-center justify-between">
                <div className="flex items-center gap-3 text-xs text-zinc-400">
                  <span className="flex items-center gap-1">
                    <Users className="w-3.5 h-3.5 text-fuchsia-400" />
                    {comm.membersCount} membros
                  </span>
                  <span>•</span>
                  <span>{comm.postsCount} debates</span>
                </div>

                <button
                  onClick={() => toggleJoinCommunity(comm.id)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    comm.isJoined
                      ? 'bg-zinc-800 text-zinc-300 border border-zinc-700'
                      : 'bg-gradient-to-r from-purple-600 to-rose-600 hover:from-purple-500 hover:to-rose-500 text-white shadow-md'
                  }`}
                >
                  {comm.isJoined ? 'Membro Ativo ✓' : 'Participar'}
                </button>
              </div>

            </div>
          </div>
        ))}
      </div>

    </div>
  );
};
