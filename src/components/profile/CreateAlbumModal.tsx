import React, { useState } from 'react';
import { X, Lock, Users, Globe } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { AlbumVisibility } from '../../types';
import { createAlbum } from '../../lib/albums';

interface CreateAlbumModalProps {
  onClose: () => void;
  onCreated: () => Promise<void>;
}

const OPTIONS: { id: AlbumVisibility; label: string; desc: string; icon: React.ElementType }[] = [
  { id: 'private_vault', label: 'Cofre privado', desc: 'Só quem você aprovar individualmente vê as fotos.', icon: Lock },
  { id: 'connections_only', label: 'Somente conexões', desc: 'Visível para suas conexões mútuas.', icon: Users },
  { id: 'public', label: 'Público', desc: 'Visível para todos os membros.', icon: Globe }
];

export const CreateAlbumModal: React.FC<CreateAlbumModalProps> = ({ onClose, onCreated }) => {
  const { currentUser } = useApp();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState<AlbumVisibility>('private_vault');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    const error = await createAlbum(currentUser.id, title.trim(), description.trim(), visibility);
    setSaving(false);
    if (error) {
      alert(`Não foi possível criar o álbum: ${error}`);
      return;
    }
    await onCreated();
    onClose();
  };

  return (
    <div className="modal-overlay fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
      <form onSubmit={handleSubmit} className="max-w-md w-full bg-[#130d22] border border-purple-800/40 rounded-3xl p-6 shadow-2xl relative space-y-4">
        <button type="button" onClick={onClose} className="absolute top-4 right-4 text-zinc-400 hover:text-white p-1 rounded-full hover:bg-zinc-800 cursor-pointer" aria-label="Fechar">
          <X className="w-5 h-5" />
        </button>
        <h3 className="text-lg font-bold text-white">Novo álbum</h3>

        <div>
          <label htmlFor="album-title" className="block text-xs font-semibold text-zinc-300 mb-1">Nome</label>
          <input
            id="album-title"
            type="text"
            required
            maxLength={120}
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Ex: Ensaio de aniversário"
            className="w-full px-3.5 py-2.5 bg-zinc-900/80 border border-purple-900/30 rounded-xl text-sm text-zinc-100 focus:outline-none focus:border-purple-500"
          />
        </div>

        <div>
          <label htmlFor="album-description" className="block text-xs font-semibold text-zinc-300 mb-1">Descrição (opcional)</label>
          <textarea
            id="album-description"
            rows={2}
            value={description}
            onChange={e => setDescription(e.target.value)}
            className="w-full px-3.5 py-2 bg-zinc-900/80 border border-purple-900/30 rounded-xl text-xs text-zinc-100 focus:outline-none focus:border-purple-500"
          />
        </div>

        <div className="space-y-2">
          <span className="block text-xs font-semibold text-zinc-300">Quem pode ver</span>
          {OPTIONS.map(opt => {
            const Icon = opt.icon;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => setVisibility(opt.id)}
                className={`w-full p-3 rounded-2xl border text-left flex items-start gap-3 cursor-pointer transition-all ${
                  visibility === opt.id ? 'bg-purple-950/70 border-purple-500' : 'bg-zinc-900/40 border-zinc-800 hover:border-zinc-700'
                }`}
              >
                <Icon className="w-4 h-4 text-fuchsia-400 mt-0.5 shrink-0" />
                <span>
                  <span className="block text-xs font-bold text-white">{opt.label}</span>
                  <span className="block text-[11px] text-zinc-400">{opt.desc}</span>
                </span>
              </button>
            );
          })}
        </div>

        <button
          type="submit"
          disabled={saving || !title.trim()}
          className="w-full py-3 rounded-xl font-bold text-xs text-white bg-gradient-to-r from-purple-600 to-rose-600 cursor-pointer disabled:opacity-50"
        >
          {saving ? 'Criando...' : 'Criar álbum'}
        </button>
      </form>
    </div>
  );
};
