import React from 'react';
import { useApp } from '../../context/AppContext';
import { X, Key, ShieldCheck, UserCheck, Trash2, CheckCircle2 } from 'lucide-react';
import { MediaAlbum } from '../../types';

interface AlbumPermissionsModalProps {
  album: MediaAlbum;
  isOpen: boolean;
  onClose: () => void;
  onChanged: () => Promise<void>;
}

export const AlbumPermissionsModal: React.FC<AlbumPermissionsModalProps> = ({ album, isOpen, onClose, onChanged }) => {
  const { profiles, approveAlbumAccess, revokeAlbumAccess } = useApp();

  if (!isOpen) return null;

  const run = async (action: Promise<boolean>) => {
    if (await action) await onChanged();
  };

  const allowedUsers = profiles.filter(p => album.allowedUserIds.includes(p.id));
  const pendingUsers = profiles.filter(p => album.pendingRequestUserIds.includes(p.id));

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-[#130d22] border border-purple-800/40 rounded-3xl p-6 shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-zinc-400 hover:text-white p-1 rounded-full hover:bg-zinc-800 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-fuchsia-600/20 border border-fuchsia-500/30 flex items-center justify-center text-fuchsia-400">
            <Key className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">Chaves do Cofre Privado</h3>
            <p className="text-xs text-zinc-400">{album.title}</p>
          </div>
        </div>

        {/* Pending Requests Section */}
        <div className="mb-6">
          <h4 className="text-xs font-bold text-fuchsia-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <span>Solicitações Pendentes</span>
            <span className="px-1.5 py-0.2 rounded-full bg-fuchsia-950 text-fuchsia-400 border border-fuchsia-800/40 text-[10px]">
              {pendingUsers.length}
            </span>
          </h4>

          {pendingUsers.length > 0 ? (
            <div className="space-y-2">
              {pendingUsers.map(u => (
                <div key={u.id} className="p-3 bg-zinc-950/70 border border-purple-900/30 rounded-2xl flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <img src={u.avatarUrl} alt={u.displayName} className="w-9 h-9 rounded-full object-cover border border-purple-500" />
                    <div>
                      <div className="text-xs font-bold text-white">{u.displayName}</div>
                      <div className="text-[10px] text-zinc-400">@{u.username}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => run(revokeAlbumAccess(album.id, u.id))}
                    className="px-2.5 py-1.5 rounded-xl text-xs font-semibold text-zinc-400 hover:text-white hover:bg-zinc-800 cursor-pointer"
                  >
                    Recusar
                  </button>
                  <button
                    onClick={() => run(approveAlbumAccess(album.id, u.id))}
                    className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-purple-600 hover:from-emerald-500 hover:to-purple-500 text-white text-xs font-bold cursor-pointer transition-all"
                  >
                    Aprovar
                  </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-zinc-400 bg-zinc-900/30 p-3 rounded-xl">
              Nenhuma solicitação pendente no momento.
            </p>
          )}
        </div>

        {/* Currently Allowed Users */}
        <div>
          <h4 className="text-xs font-bold text-zinc-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <span>Usuários com Acesso Liberado</span>
            <span className="px-1.5 py-0.2 rounded-full bg-zinc-800 text-zinc-300 text-[10px]">
              {allowedUsers.length}
            </span>
          </h4>

          {allowedUsers.length > 0 ? (
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {allowedUsers.map(u => (
                <div key={u.id} className="p-2.5 bg-zinc-950/40 border border-zinc-800 rounded-2xl flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <img src={u.avatarUrl} alt={u.displayName} className="w-8 h-8 rounded-full object-cover" />
                    <div>
                      <div className="text-xs font-semibold text-zinc-200">{u.displayName}</div>
                      <div className="text-[10px] text-emerald-400">Chave ativa</div>
                    </div>
                  </div>
                  <button
                    onClick={() => run(revokeAlbumAccess(album.id, u.id))}
                    className="p-1.5 rounded-lg text-rose-400 hover:bg-rose-950/40 transition-colors cursor-pointer"
                    title="Revogar Acesso Imediatamente"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-zinc-400 bg-zinc-900/30 p-3 rounded-xl">
              Nenhum usuário externo possui acesso a este cofre atualmente.
            </p>
          )}
        </div>

      </div>
    </div>
  );
};
