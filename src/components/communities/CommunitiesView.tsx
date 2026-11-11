import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Hash, Users, Lock, Plus, Mail, Search } from 'lucide-react';
import { Community } from '../../types';
import { useEstadoSalvo } from '../../lib/estadoSalvo';
import { ACCESS_INFO, COMMUNITY_CATEGORIES } from '../../lib/comunidades';
import { CommunityPage } from './CommunityPage';
import { CommunityFormModal } from './CommunityFormModal';

export const CommunitiesView: React.FC = () => {
  const { communities, toggleJoinCommunity, selectedCommunityId, setSelectedCommunityId, refreshCommunities } = useApp();
  // a comunidade aberta vem do endereço (/comunidades/<id>); categoria e filtro sobrevivem ao F5
  const selectedCommunity = communities.find(c => c.id === selectedCommunityId) ?? null;
  const [activeCategory, setActiveCategory] = useEstadoSalvo<string>('comunidades.categoria', 'all');
  const [busca, setBusca] = useState('');
  const [criando, setCriando] = useState(false);

  if (selectedCommunity) {
    return <CommunityPage community={selectedCommunity} aoVoltar={() => setSelectedCommunityId(null)} />;
  }

  const q = busca.trim().toLowerCase();
  const convites = communities.filter(c => c.invited && !c.isJoined);
  const filtered = communities.filter(c =>
    (activeCategory === 'all' || (activeCategory === 'mine' ? c.isJoined : c.category === activeCategory))
    && (!q || c.name.toLowerCase().includes(q) || c.description.toLowerCase().includes(q)));

  const botaoEntrar = (comm: Community) => {
    if (comm.isJoined) return { label: comm.myRole === 'admin' ? 'Administrador' : comm.myRole === 'moderator' ? 'Moderador' : 'Membro ✓', ativo: true };
    if (comm.requested) return { label: 'Pedido enviado', ativo: true };
    if (comm.invited) return { label: 'Aceitar convite', ativo: false };
    return { label: comm.access === 'approval' ? 'Pedir para entrar' : 'Participar', ativo: false };
  };

  return (
    <div className="max-w-5xl mx-auto py-6 px-4">
      <div className="mb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-purple-600 to-rose-600 p-[1.5px] flex items-center justify-center">
              <div className="w-full h-full bg-[#0d0a17] rounded-[7px] flex items-center justify-center">
                <Hash className="w-4 h-4 text-purple-400" />
              </div>
            </div>
            <h1 className="text-2xl font-extrabold text-white">Comunidades</h1>
          </div>
          <p className="text-xs text-zinc-400 leading-relaxed max-w-2xl">
            Espaços de diálogo seguro, amizade e troca de vivências. Crie a sua, abra para todos ou mantenha só para convidados.
          </p>
        </div>
        <button type="button" onClick={() => setCriando(true)}
          className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-rose-600 text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer">
          <Plus className="w-4 h-4" /> Criar comunidade
        </button>
      </div>

      {convites.length > 0 && (
        <div className="mb-6 p-4 rounded-2xl bg-gradient-to-r from-purple-900/40 to-rose-900/30 border border-purple-700/40">
          <p className="text-xs font-bold text-white flex items-center gap-1.5 mb-2"><Mail className="w-4 h-4 text-fuchsia-300" /> Você foi convidado</p>
          <div className="flex flex-wrap gap-2">
            {convites.map(c => (
              <button key={c.id} type="button" onClick={() => setSelectedCommunityId(c.id)} className="px-3 py-1.5 rounded-full bg-black/40 text-xs text-zinc-100 font-semibold cursor-pointer hover:bg-black/60">
                {c.iconUrl} {c.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <label className="flex items-center gap-2 px-3.5 py-2.5 mb-4 rounded-xl bg-zinc-900/80 border border-purple-900/30">
        <Search className="w-4 h-4 text-zinc-500" />
        <input type="search" value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar comunidades" aria-label="Buscar comunidades"
          className="flex-1 bg-transparent text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none" />
      </label>

      <div className="flex items-center gap-2 overflow-x-auto pb-2 mb-6 scrollbar-none">
        {[{ id: 'all', label: 'Todas' }, { id: 'mine', label: 'Minhas' }, ...COMMUNITY_CATEGORIES].map(cat => (
          <button
            key={cat.id}
            type="button"
            onClick={() => setActiveCategory(cat.id)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold shrink-0 transition-all cursor-pointer ${
              activeCategory === cat.id ? 'bg-purple-600 text-white shadow-md' : 'bg-zinc-900/80 text-zinc-400 hover:text-zinc-200 border border-zinc-800'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="p-10 text-center bg-[#120d20] border border-purple-900/30 rounded-3xl">
          <Hash className="w-10 h-10 text-purple-400 mx-auto mb-2 opacity-60" />
          <p className="text-sm font-bold text-white">{activeCategory === 'mine' ? 'Você ainda não participa de comunidades' : 'Nenhuma comunidade encontrada'}</p>
          <p className="text-xs text-zinc-400 mt-1">Que tal criar uma?</p>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        {filtered.map(comm => {
          const b = botaoEntrar(comm);
          return (
            <div
              key={comm.id}
              className="bg-[#120d20] border border-purple-900/30 rounded-3xl overflow-hidden shadow-xl hover:border-purple-600/50 transition-all flex flex-col justify-between"
            >
              <button type="button" onClick={() => setSelectedCommunityId(comm.id)} className="text-left cursor-pointer" aria-label={`Abrir ${comm.name}`}>
                <div className="h-28 relative bg-gradient-to-br from-purple-900 via-fuchsia-900 to-rose-900 overflow-hidden">
                  {comm.coverUrl && <img src={comm.coverUrl} alt="" loading="lazy" className="w-full h-full object-cover" />}
                  <div className="absolute inset-0 bg-gradient-to-t from-[#120d20] via-black/30 to-transparent" />
                  <div className="absolute top-3 left-3 w-10 h-10 rounded-2xl bg-black/60 backdrop-blur-md border border-white/10 flex items-center justify-center text-xl shadow">
                    {comm.iconUrl}
                  </div>
                  <div className="absolute top-3 right-3">
                    <span className={`px-2.5 py-1 rounded-full backdrop-blur-md text-[10px] font-bold flex items-center gap-1 ${
                      comm.access === 'public' ? 'bg-zinc-900/80 border border-zinc-700 text-zinc-300' : 'bg-purple-950/80 border border-purple-500/40 text-purple-300'}`}>
                      {comm.access !== 'public' && <Lock className="w-3 h-3" />} {ACCESS_INFO[comm.access].label}
                    </span>
                  </div>
                </div>
                <div className="px-5 pt-4">
                  <h3 className="text-base font-bold text-white mb-1">{comm.name}</h3>
                  <p className="text-xs text-zinc-300 leading-relaxed line-clamp-3">{comm.description}</p>
                </div>
              </button>

              <div className="p-5 pt-4">
                <div className="pt-3 border-t border-purple-900/30 flex items-center justify-between">
                  <div className="flex items-center gap-3 text-xs text-zinc-400">
                    <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5 text-fuchsia-400" /> {comm.membersCount}</span>
                    <span>•</span>
                    <span>{comm.postsCount} publicações</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => (b.ativo || comm.access === 'approval' ? setSelectedCommunityId(comm.id) : toggleJoinCommunity(comm.id))}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      b.ativo ? 'bg-zinc-800 text-zinc-300 border border-zinc-700' : 'bg-gradient-to-r from-purple-600 to-rose-600 hover:from-purple-500 hover:to-rose-500 text-white shadow-md'
                    }`}
                  >
                    {b.label}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {criando && (
        <CommunityFormModal
          aoFechar={() => setCriando(false)}
          aoSalvar={async id => { setCriando(false); await refreshCommunities(); setSelectedCommunityId(id); }}
        />
      )}
    </div>
  );
};
