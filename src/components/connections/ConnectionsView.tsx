import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { HeartHandshake, Heart, UserCheck, MessageSquare, Sparkles } from 'lucide-react';
import { ProfileCard } from '../discover/ProfileCard';

export const ConnectionsView: React.FC = () => {
  const { profiles, connections, following, startOrOpenConversation, setSelectedProfileId } = useApp();
  const [tab, setTab] = useState<'connected' | 'likes'>('connected');

  const connectedProfiles = profiles.filter(p => connections.includes(p.id));
  const likedProfiles = profiles.filter(p => !connections.includes(p.id));

  return (
    <div className="max-w-5xl mx-auto py-6 px-4">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-white flex items-center gap-2">
            <span>Curtidas & Conexões Mútuas</span>
          </h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            Gerencie laços consensuais estabelecidos com outros membros.
          </p>
        </div>

        <div className="bg-zinc-900/80 p-1 rounded-xl flex items-center gap-1">
          <button
            onClick={() => setTab('connected')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              tab === 'connected' ? 'bg-purple-600 text-white shadow' : 'text-zinc-400 hover:text-white'
            }`}
          >
            Conexões Mútuas ({connectedProfiles.length})
          </button>
          <button
            onClick={() => setTab('likes')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              tab === 'likes' ? 'bg-purple-600 text-white shadow' : 'text-zinc-400 hover:text-white'
            }`}
          >
            Curtiram Seu Perfil ({likedProfiles.length})
          </button>
        </div>
      </div>

      {/* Content */}
      {tab === 'connected' ? (
        connectedProfiles.length > 0 ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {connectedProfiles.map(p => (
              <ProfileCard key={p.id} profile={p} viewMode="grid" />
            ))}
          </div>
        ) : (
          <div className="p-12 text-center bg-[#120d20] border border-purple-900/30 rounded-3xl">
            <HeartHandshake className="w-12 h-12 text-purple-400 mx-auto mb-3 opacity-60" />
            <h3 className="text-base font-bold text-white mb-1">Nenhuma conexão mútua ainda</h3>
            <p className="text-xs text-zinc-400 max-w-sm mx-auto">
              Explore perfis compatíveis na aba Descobrir para solicitar novas conexões com respeito e diálogo.
            </p>
          </div>
        )
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {likedProfiles.map(p => (
            <ProfileCard key={p.id} profile={p} viewMode="grid" />
          ))}
        </div>
      )}

    </div>
  );
};
