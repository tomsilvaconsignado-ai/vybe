import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { X, Save, User, MapPin, Sparkles, Shield, Camera } from 'lucide-react';
import { LocationPrivacy } from '../../types';

interface EditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const EditProfileModal: React.FC<EditProfileModalProps> = ({ isOpen, onClose }) => {
  const { currentUser, updateCurrentUser } = useApp();

  const [displayName, setDisplayName] = useState(currentUser.displayName);
  const [bio, setBio] = useState(currentUser.bio);
  const [city, setCity] = useState(currentUser.city);
  const [state, setState] = useState(currentUser.state);
  const [locationPrivacy, setLocationPrivacy] = useState<LocationPrivacy>(currentUser.locationPrivacy);
  const [avatarUrl, setAvatarUrl] = useState(currentUser.avatarUrl);
  const [coverUrl, setCoverUrl] = useState(currentUser.coverUrl);
  const [statusText, setStatusText] = useState(currentUser.statusText || '');

  if (!isOpen) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    updateCurrentUser({
      displayName,
      bio,
      city,
      state,
      locationPrivacy,
      avatarUrl,
      coverUrl,
      statusText
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
      <div className="max-w-lg w-full bg-[#130d22] border border-purple-800/40 rounded-3xl p-6 sm:p-8 shadow-2xl relative my-auto">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-zinc-400 hover:text-white p-1 rounded-full hover:bg-zinc-800 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <h3 className="text-xl font-bold text-white mb-1">Editar Meu Perfil</h3>
        <p className="text-xs text-zinc-400 mb-6">Atualize suas informações públicas e discrição.</p>

        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1">Apelido de Exibição</label>
            <input
              type="text"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              className="w-full px-3.5 py-2 bg-zinc-900 border border-purple-900/30 rounded-xl text-xs text-white focus:outline-none focus:border-purple-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1">Status Rápido / Frase do Dia</label>
            <input
              type="text"
              value={statusText}
              onChange={e => setStatusText(e.target.value)}
              placeholder="Ex: Planejando jantar no final de semana..."
              className="w-full px-3.5 py-2 bg-zinc-900 border border-purple-900/30 rounded-xl text-xs text-white focus:outline-none focus:border-purple-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1">Biografia</label>
            <textarea
              rows={3}
              value={bio}
              onChange={e => setBio(e.target.value)}
              className="w-full px-3.5 py-2 bg-zinc-900 border border-purple-900/30 rounded-xl text-xs text-white focus:outline-none focus:border-purple-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1">Cidade</label>
              <input
                type="text"
                value={city}
                onChange={e => setCity(e.target.value)}
                className="w-full px-3.5 py-2 bg-zinc-900 border border-purple-900/30 rounded-xl text-xs text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1">Estado</label>
              <input
                type="text"
                value={state}
                onChange={e => setState(e.target.value)}
                className="w-full px-3.5 py-2 bg-zinc-900 border border-purple-900/30 rounded-xl text-xs text-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1">Privacidade da Localização:</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'city', label: 'Cidade' },
                { id: 'approximate_region', label: 'Região Aprox.' },
                { id: 'hidden', label: 'Ocultar' }
              ].map(opt => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setLocationPrivacy(opt.id as LocationPrivacy)}
                  className={`py-1.5 px-2 text-xs rounded-xl border text-center transition-all cursor-pointer ${
                    locationPrivacy === opt.id
                      ? 'bg-purple-950 border-purple-500 text-white font-bold'
                      : 'bg-zinc-900/40 border-zinc-800 text-zinc-400'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1">URL Foto Perfil</label>
              <input
                type="text"
                value={avatarUrl}
                onChange={e => setAvatarUrl(e.target.value)}
                className="w-full px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1">URL Foto Capa</label>
              <input
                type="text"
                value={coverUrl}
                onChange={e => setCoverUrl(e.target.value)}
                className="w-full px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-white"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-purple-950/40 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-zinc-400 hover:text-white cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 rounded-xl font-bold text-xs text-white bg-gradient-to-r from-purple-600 to-rose-600 hover:from-purple-500 hover:to-rose-500 shadow-md shadow-purple-950/50 flex items-center gap-1.5 cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              Salvar Alterações
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
