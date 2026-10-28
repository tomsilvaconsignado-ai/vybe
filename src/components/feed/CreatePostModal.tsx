import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { uploadPublicMedia } from '../../lib/supabase';
import { X, Image, Sparkles, Send, Plus, BarChart2 } from 'lucide-react';

interface CreatePostModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CreatePostModal: React.FC<CreatePostModalProps> = ({ isOpen, onClose }) => {
  const { createPost, currentUser } = useApp();
  const [content, setContent] = useState('');
  const [mediaUrls, setMediaUrls] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>(['Vybelog', 'VidaLiberal']);
  const [isUploading, setIsUploading] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);

  // Poll state
  const [includePoll, setIncludePoll] = useState(false);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState(['', '']);

  if (!isOpen) return null;

  const handleUploadFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (files.length === 0) return;

    setIsUploading(true);
    for (const file of files) {
      if (file.size > 20 * 1024 * 1024) {
        alert(`"${file.name}" excede o limite de 20 MB.`);
        continue;
      }
      const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg';
      const path = `${currentUser.id}/posts/${crypto.randomUUID()}.${extension}`;
      const { publicUrl, error } = await uploadPublicMedia(file, path);
      if (error || !publicUrl) {
        alert(error?.message.startsWith('Não foi possível processar') ? error.message : `Não foi possível enviar "${file.name}". Tente novamente.`);
        continue;
      }
      setMediaUrls(prev => [...prev, publicUrl]);
    }
    setIsUploading(false);
  };

  const handleAddTag = () => {
    if (tagInput.trim()) {
      const clean = tagInput.trim().replace(/^#/, '');
      if (!tags.includes(clean)) setTags(prev => [...prev, clean]);
      setTagInput('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() && mediaUrls.length === 0) {
      alert('Escreva algo ou adicione uma foto para publicar.');
      return;
    }

    setIsPublishing(true);
    await createPost(
      content,
      mediaUrls,
      tags,
      includePoll && pollQuestion.trim() ? {
        question: pollQuestion.trim(),
        options: pollOptions.filter(o => o.trim())
      } : undefined
    );

    // Reset and close
    setIsPublishing(false);
    setContent('');
    setMediaUrls([]);
    onClose();
  };

  return (
    <div className="modal-overlay fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="max-w-lg w-full bg-[#130d22] border border-purple-800/40 rounded-3xl p-6 shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-zinc-400 hover:text-white p-1 rounded-full hover:bg-zinc-800 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <img
            src={currentUser.avatarUrl}
            alt={currentUser.displayName}
            className="w-10 h-10 rounded-full object-cover border border-purple-500/50"
          />
          <div>
            <h3 className="text-base font-bold text-white">Criar Nova Publicação</h3>
            <span className="text-xs text-purple-400 capitalize">
              {currentUser.profileType === 'couple' ? 'Publicando como Casal' : 'Publicando como Solteiro(a)'}
            </span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <textarea
              rows={4}
              value={content}
              onChange={e => setContent(e.target.value)}
              placeholder="Compartilhe suas ideias, reflexões sobre relações liberais, estilo de vida..."
              className="w-full px-3.5 py-2.5 bg-zinc-900/80 border border-purple-900/30 rounded-2xl text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-purple-500"
            />
          </div>

          {/* Media preview */}
          {mediaUrls.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-2">
              {mediaUrls.map((url, i) => (
                <div key={i} className="relative w-20 h-20 rounded-xl overflow-hidden shrink-0 border border-purple-500/40">
                  <img src={url} alt="Upload" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setMediaUrls(prev => prev.filter((_, idx) => idx !== i))}
                    className="absolute top-1 right-1 bg-black/70 rounded-full p-0.5 text-white"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Upload from device */}
          <label className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border border-dashed border-purple-700/50 text-xs font-semibold text-purple-200 hover:bg-purple-950/40 cursor-pointer ${isUploading ? 'opacity-50 pointer-events-none' : ''}`}>
            <Image className="w-4 h-4" />
            {isUploading ? 'Enviando foto...' : 'Enviar foto do dispositivo'}
            <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple className="hidden" onChange={handleUploadFiles} />
          </label>

          <p className="text-[11px] text-zinc-500">
            Removemos automaticamente a localização GPS e outros dados escondidos das fotos antes do envio.
          </p>

          {/* Tags */}
          <div>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                placeholder="Adicionar hashtag (#Diálogo, #Jantar)..."
                value={tagInput}
                onChange={e => setTagInput(e.target.value)}
                className="flex-1 px-3 py-1.5 bg-zinc-900/90 border border-purple-900/30 rounded-xl text-xs text-zinc-200"
              />
              <button
                type="button"
                onClick={handleAddTag}
                className="px-3 py-1.5 bg-zinc-800 rounded-xl text-xs text-zinc-300 cursor-pointer"
              >
                + Tag
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {tags.map(t => (
                <span
                  key={t}
                  className="px-2 py-0.5 rounded-md bg-purple-950/60 border border-purple-800/40 text-[11px] text-purple-300 flex items-center gap-1"
                >
                  #{t}
                  <button type="button" onClick={() => setTags(prev => prev.filter(x => x !== t))}>
                    <X className="w-2.5 h-2.5 text-zinc-400 hover:text-white" />
                  </button>
                </span>
              ))}
            </div>
          </div>

          {/* Poll toggle */}
          <div>
            <button
              type="button"
              onClick={() => setIncludePoll(!includePoll)}
              className="text-xs font-semibold text-purple-300 hover:text-purple-200 flex items-center gap-1.5 cursor-pointer"
            >
              <BarChart2 className="w-4 h-4 text-fuchsia-400" />
              <span>{includePoll ? 'Remover Enquete Social' : 'Criar Enquete Social'}</span>
            </button>

            {includePoll && (
              <div className="mt-3 p-3 bg-zinc-950/80 border border-purple-900/30 rounded-2xl space-y-2">
                <input
                  type="text"
                  placeholder="Pergunta da enquete (Ex: Qual o drink preferido num encontro?)"
                  value={pollQuestion}
                  onChange={e => setPollQuestion(e.target.value)}
                  className="w-full px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-white"
                />
                {pollOptions.map((opt, i) => (
                  <input
                    key={i}
                    type="text"
                    placeholder={`Opção ${i + 1}`}
                    value={opt}
                    onChange={e => {
                      const updated = [...pollOptions];
                      updated[i] = e.target.value;
                      setPollOptions(updated);
                    }}
                    className="w-full px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-white"
                  />
                ))}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="pt-4 border-t border-purple-950/40 flex items-center justify-between">
            <span className="text-[11px] text-zinc-400">Todo conteúdo deve ser respeitoso.</span>
            <button
              type="submit"
              disabled={isUploading || isPublishing}
              className="px-6 py-2.5 rounded-xl font-bold text-xs text-white bg-gradient-to-r from-purple-600 via-fuchsia-600 to-rose-600 hover:from-purple-500 hover:to-rose-500 shadow-md shadow-purple-950/50 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
              {isPublishing ? 'Publicando...' : 'Publicar no Feed'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
