import React, { useEffect, useState } from 'react';
import { X, Search, BadgeCheck, Users } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { fetchFollowList, FollowListEntry, FollowListKind } from '../../lib/social';
import { notify, askConfirm } from '../common/Feedback';

interface FollowListModalProps {
  profileId: string;
  username: string;
  followersCount: number;
  followingCount: number;
  initialKind: FollowListKind;
  onClose: () => void;
}

// Seguidores / seguindo, como no Instagram: abas, busca e o botão certo em cada linha
export const FollowListModal: React.FC<FollowListModalProps> = ({ profileId, username, followersCount, followingCount, initialKind, onClose }) => {
  const { currentUser, following, toggleFollow, removeFollower, setSelectedProfileId } = useApp();
  const [kind, setKind] = useState<FollowListKind>(initialKind);
  const [entries, setEntries] = useState<FollowListEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const [query, setQuery] = useState('');
  const isOwn = profileId === currentUser.id;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setUnavailable(false);
    fetchFollowList(currentUser.id, profileId, kind).then(result => {
      if (cancelled) return;
      setEntries(result.entries);
      setUnavailable(result.unavailable);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [profileId, kind, currentUser.id]);

  const term = query.trim().toLowerCase();
  const visible = term
    ? entries.filter(e => e.username.toLowerCase().includes(term) || e.displayName.toLowerCase().includes(term))
    : entries;

  const openProfile = (id: string) => {
    onClose();
    setSelectedProfileId(id === currentUser.id ? null : id);
  };

  const handleUnfollow = async (entry: FollowListEntry) => {
    if (await askConfirm({ title: `Deixar de seguir @${entry.username}?`, message: 'Você pode seguir de novo quando quiser.', confirmLabel: 'Deixar de seguir', danger: true })) {
      await toggleFollow(entry.id);
      // Na minha lista de "seguindo" a pessoa sai da lista
      if (isOwn && kind === 'following') setEntries(prev => prev.filter(e => e.id !== entry.id));
    }
  };

  const handleRemove = async (entry: FollowListEntry) => {
    const confirmed = await askConfirm({
      title: 'Remover seguidor?',
      message: `@${entry.username} não será avisado(a) de que foi removido(a) dos seus seguidores.`,
      confirmLabel: 'Remover',
      danger: true
    });
    if (!confirmed) return;
    const error = await removeFollower(entry.id);
    if (error) {
      notify(error);
      return;
    }
    setEntries(prev => prev.filter(e => e.id !== entry.id));
  };

  const actionFor = (entry: FollowListEntry) => {
    if (entry.id === currentUser.id) return null;
    const iFollow = following.includes(entry.id);
    const base = 'px-3.5 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-colors shrink-0';

    if (isOwn && kind === 'followers') {
      return (
        <div className="flex items-center gap-2 shrink-0">
          {!iFollow && (
            <button type="button" onClick={() => toggleFollow(entry.id)} className="text-xs font-bold text-fuchsia-400 hover:text-fuchsia-300 cursor-pointer">
              Seguir de volta
            </button>
          )}
          <button type="button" onClick={() => handleRemove(entry)} className={`${base} bg-zinc-800 text-white hover:bg-zinc-700`}>
            Remover
          </button>
        </div>
      );
    }
    return iFollow ? (
      <button type="button" onClick={() => handleUnfollow(entry)} className={`${base} bg-zinc-800 text-white hover:bg-zinc-700`}>
        Seguindo
      </button>
    ) : (
      <button type="button" onClick={() => toggleFollow(entry.id)} className={`${base} bg-gradient-to-r from-purple-600 to-rose-600 text-white`}>
        Seguir
      </button>
    );
  };

  return (
    <div className="modal-overlay fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="w-full max-w-md bg-[#130d22] border border-purple-800/40 rounded-3xl shadow-2xl flex flex-col max-h-[85vh] sm:max-h-[80vh]"
        onClick={e => e.stopPropagation()}
      >
        <div className="relative px-5 pt-5 pb-0 text-center">
          <h3 className="text-sm font-bold text-white">@{username}</h3>
          <button type="button" onClick={onClose} className="absolute top-4 right-4 p-1 text-zinc-400 hover:text-white cursor-pointer" aria-label="Fechar">
            <X className="w-5 h-5" />
          </button>
          <div className="grid grid-cols-2 mt-3 border-b border-purple-950/60" role="tablist">
            {([
              { id: 'followers', label: 'seguidores', count: followersCount },
              { id: 'following', label: 'seguindo', count: followingCount }
            ] as const).map(t => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={kind === t.id}
                onClick={() => setKind(t.id)}
                className={`py-2.5 -mb-px border-b-2 text-xs font-bold cursor-pointer ${
                  kind === t.id ? 'border-white text-white' : 'border-transparent text-zinc-500 hover:text-zinc-300'
                }`}
              >
                {t.count} {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="px-5 pt-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <input
              type="search"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Pesquisar"
              className="w-full pl-9 pr-3 py-2 bg-zinc-900 rounded-xl text-sm text-white placeholder-zinc-500 focus:outline-none"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-3 space-y-1 min-h-[12rem]">
          {loading ? (
            Array.from({ length: 5 }, (_, i) => (
              <div key={i} className="flex items-center gap-3 py-2 animate-pulse">
                <div className="w-11 h-11 rounded-full bg-zinc-800" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 w-28 rounded bg-zinc-800" />
                  <div className="h-2.5 w-20 rounded bg-zinc-800/70" />
                </div>
              </div>
            ))
          ) : unavailable ? (
            <p className="py-10 text-center text-xs text-zinc-400">Ver as listas de outros perfis estará disponível em breve.</p>
          ) : visible.length === 0 ? (
            <div className="py-10 flex flex-col items-center gap-2 text-center">
              <div className="w-14 h-14 rounded-full border-2 border-zinc-700 flex items-center justify-center">
                <Users className="w-6 h-6 text-zinc-500" />
              </div>
              <p className="text-sm font-bold text-white">
                {term ? 'Nenhum resultado' : kind === 'followers' ? 'Nenhum seguidor ainda' : 'Ainda não segue ninguém'}
              </p>
              {!term && isOwn && kind === 'followers' && (
                <p className="text-xs text-zinc-400 max-w-xs">Quando alguém seguir você, a pessoa aparece aqui.</p>
              )}
            </div>
          ) : (
            visible.map(entry => (
              <div key={entry.id} className="flex items-center gap-3 py-1.5">
                <button type="button" onClick={() => openProfile(entry.id)} className="flex items-center gap-3 flex-1 min-w-0 text-left cursor-pointer">
                  <img src={entry.avatarUrl} alt="" className="w-11 h-11 rounded-full object-cover shrink-0" />
                  <span className="min-w-0">
                    <span className="flex items-center gap-1 text-sm font-semibold text-white truncate">
                      <span className="truncate">{entry.username}</span>
                      {entry.isVerified && <BadgeCheck className="w-3.5 h-3.5 text-purple-400 shrink-0" />}
                    </span>
                    <span className="block text-xs text-zinc-400 truncate">{entry.displayName}</span>
                  </span>
                </button>
                {actionFor(entry)}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
