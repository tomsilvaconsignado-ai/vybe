import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { HeartHandshake, Check } from 'lucide-react';
import { ProfileCard } from '../discover/ProfileCard';

export const ConnectionsView: React.FC = () => {
  const {
    profiles,
    connections,
    incomingConnectionRequests,
    outgoingConnectionRequests,
    acceptConnection
  } = useApp();
  const [tab, setTab] = useState<'connected' | 'incoming' | 'outgoing'>('connected');

  const connectedProfiles = profiles.filter(p => connections.includes(p.id));
  const incomingProfiles = profiles.filter(p => incomingConnectionRequests.includes(p.id));
  const outgoingProfiles = profiles.filter(p => outgoingConnectionRequests.includes(p.id));

  const tabs = [
    { id: 'connected' as const, label: `Conexões Mútuas (${connectedProfiles.length})` },
    { id: 'incoming' as const, label: `Pedidos Recebidos (${incomingProfiles.length})` },
    { id: 'outgoing' as const, label: `Pedidos Enviados (${outgoingProfiles.length})` }
  ];

  const visibleProfiles =
    tab === 'connected' ? connectedProfiles : tab === 'incoming' ? incomingProfiles : outgoingProfiles;

  const emptyMessages = {
    connected: {
      title: 'Nenhuma conexão mútua ainda',
      text: 'Explore perfis compatíveis na aba Descobrir para solicitar novas conexões com respeito e diálogo.'
    },
    incoming: {
      title: 'Nenhum pedido recebido',
      text: 'Quando alguém pedir para se conectar com você, o pedido aparece aqui.'
    },
    outgoing: {
      title: 'Nenhum pedido pendente',
      text: 'Os pedidos de conexão que você enviar aparecem aqui até serem aceitos.'
    }
  };

  return (
    <div className="max-w-5xl mx-auto py-6 px-4">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-white flex items-center gap-2">
            <span>Conexões Mútuas</span>
          </h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            Gerencie laços consensuais estabelecidos com outros membros.
          </p>
        </div>

        <div className="bg-zinc-900/80 p-1 rounded-xl flex items-center gap-1 overflow-x-auto">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                tab === t.id ? 'bg-purple-600 text-white shadow' : 'text-zinc-400 hover:text-white'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {visibleProfiles.length > 0 ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {visibleProfiles.map(p => (
            <div key={p.id} className="space-y-2">
              <ProfileCard profile={p} viewMode="grid" />
              {tab === 'incoming' && (
                <button
                  onClick={() => acceptConnection(p.id)}
                  className="w-full py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-purple-600 to-rose-600 hover:opacity-90 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  Aceitar conexão
                </button>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="p-12 text-center bg-[#120d20] border border-purple-900/30 rounded-3xl">
          <HeartHandshake className="w-12 h-12 text-purple-400 mx-auto mb-3 opacity-60" />
          <h3 className="text-base font-bold text-white mb-1">{emptyMessages[tab].title}</h3>
          <p className="text-xs text-zinc-400 max-w-sm mx-auto">{emptyMessages[tab].text}</p>
        </div>
      )}

    </div>
  );
};
