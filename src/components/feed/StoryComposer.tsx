import React, { useEffect, useState } from 'react';
import { X, Image, Users, Globe } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { publishStory } from '../../lib/stories';

const MAX_MB = 20;

export const StoryComposer: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { currentUser, refreshStories } = useApp();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [audience, setAudience] = useState<'all' | 'connections'>('all');
  const [publishing, setPublishing] = useState(false);

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const handlePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = e.target.files?.[0];
    e.target.value = '';
    if (!picked) return;
    if (picked.size > MAX_MB * 1024 * 1024) {
      alert(`O arquivo deve ter no máximo ${MAX_MB} MB.`);
      return;
    }
    setFile(picked);
    setPreview(URL.createObjectURL(picked));
  };

  const handlePublish = async () => {
    if (!file) return;
    setPublishing(true);
    const error = await publishStory(currentUser.id, file, caption, audience);
    setPublishing(false);
    if (error) {
      alert(`Não foi possível publicar: ${error}`);
      return;
    }
    await refreshStories();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[70] bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-[#130d22] border border-purple-800/40 rounded-3xl p-5 space-y-4 relative">
        <button type="button" onClick={onClose} className="absolute top-4 right-4 text-zinc-400 hover:text-white cursor-pointer" aria-label="Fechar">
          <X className="w-5 h-5" />
        </button>
        <div>
          <h3 className="text-lg font-bold text-white">Novo story</h3>
          <p className="text-xs text-zinc-400">Some automaticamente em 24 horas.</p>
        </div>

        {preview ? (
          <div className="relative aspect-[9/16] max-h-[50vh] mx-auto rounded-2xl overflow-hidden bg-black">
            {file?.type.startsWith('video/') ? (
              <video src={preview} className="w-full h-full object-contain" autoPlay muted loop playsInline />
            ) : (
              <img src={preview} alt="Prévia" className="w-full h-full object-contain" />
            )}
            <label className="absolute bottom-2 right-2 px-3 py-1.5 rounded-full bg-black/70 text-xs text-white cursor-pointer">
              Trocar
              <input type="file" accept="image/jpeg,image/png,image/webp,video/mp4" className="hidden" onChange={handlePick} />
            </label>
          </div>
        ) : (
          <label className="flex flex-col items-center justify-center gap-2 aspect-[9/16] max-h-[40vh] mx-auto w-full rounded-2xl border-2 border-dashed border-purple-700/50 text-purple-200 cursor-pointer hover:bg-purple-950/30">
            <Image className="w-8 h-8" />
            <span className="text-xs font-semibold">Escolher foto ou vídeo</span>
            <input type="file" accept="image/jpeg,image/png,image/webp,video/mp4" className="hidden" onChange={handlePick} />
          </label>
        )}

        <input
          type="text"
          maxLength={200}
          value={caption}
          onChange={e => setCaption(e.target.value)}
          placeholder="Legenda (opcional)"
          className="w-full px-3.5 py-2.5 bg-zinc-900/80 border border-purple-900/30 rounded-xl text-sm text-zinc-100 focus:outline-none focus:border-purple-500"
        />

        <div className="grid grid-cols-2 gap-2">
          {([
            { id: 'all', label: 'Todos os membros', icon: Globe },
            { id: 'connections', label: 'Só conexões', icon: Users }
          ] as const).map(opt => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setAudience(opt.id)}
              className={`py-2 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer ${
                audience === opt.id ? 'bg-purple-950 border-purple-500 text-white' : 'bg-zinc-900/40 border-zinc-800 text-zinc-400'
              }`}
            >
              <opt.icon className="w-3.5 h-3.5" />
              {opt.label}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={handlePublish}
          disabled={!file || publishing}
          className="w-full py-3 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-purple-600 to-rose-600 disabled:opacity-50 cursor-pointer"
        >
          {publishing ? 'Publicando...' : 'Publicar story'}
        </button>
      </div>
    </div>
  );
};
