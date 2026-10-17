import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { X, Image, Sparkles, Send, Plus, BarChart2 } from 'lucide-react';

interface CreatePostModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CreatePostModal: React.FC<CreatePostModalProps> = ({ isOpen, onClose }) => {
  const { createPost, currentUser } = useApp();
  const [content, setContent] = useState('');
  const [mediaUrlInput, setMediaUrlInput] = useState('');
  const [mediaUrls, setMediaUrls] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>(['VYBE', 'VidaLiberal']);

  // Poll state
  const [includePoll, setIncludePoll] = useState(false);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState(['', '']);

  if (!isOpen) return null;

  const handleAddMedia = () => {
    if (mediaUrlInput.trim()) {
      setMediaUrls(prev => [...prev, mediaUrlInput.trim()]);
      setMediaUrlInput('');
    }
  };

  const handleAddTag = () => {
    if (tagInput.trim()) {
      const clean = tagInput.trim().replace(/^#/, '');
      if (!tags.includes(clean)) setTags(prev => [...prev, clean]);
      setTagInput('');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() && mediaUrls.length === 0) {
      alert('Escreva algo ou adicione uma foto para publicar.');
      return;
    }

    createPost(
      content,
      mediaUrls,
      tags,
      includePoll && pollQuestion.trim() ? {
        question: pollQuestion.trim(),
        options: pollOptions.filter(o => o.trim())
      } : undefined
    );

    // Reset and close
    setContent('');
    setMediaUrls([]);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
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

          {/* Add media URL or presets */}
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Inserir URL de imagem ou foto..."
              value={mediaUrlInput}
              onChange={e => setMediaUrlInput(e.target.value)}
              className="flex-1 px-3 py-1.5 bg-zinc-900/90 border border-purple-900/30 rounded-xl text-xs text-zinc-200"
            />
            <button
              type="button"
              onClick={handleAddMedia}
              className="px-3 py-1.5 bg-purple-900/40 hover:bg-purple-900/70 border border-purple-700/40 rounded-xl text-xs font-semibold text-purple-200 cursor-pointer"
            >
              Adicionar
            </button>
          </div>

          {/* Quick aesthetic presets for testing */}
          <div className="flex items-center gap-1.5 text-[11px] text-zinc-400">
            <span>Sugestões visuais:</span>
            <button
              type="button"
              onClick={() => setMediaUrls(prev => [...prev, 'https://images.unsplash.com/photo-1517457373958-b7bdd4587205?w=900&auto=format&fit=crop&q=80'])}
              className="text-purple-400 hover:underline"
            >
              + Lounge Noturno
            </button>
            <span>•</span>
            <button
              type="button"
              onClick={() => setMediaUrls(prev => [...prev, 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=900&auto=format&fit=crop&q=80'])}
              className="text-fuchsia-400 hover:underline"
            >
              + Brinde
            </button>
          </div>

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
              className="px-6 py-2.5 rounded-xl font-bold text-xs text-white bg-gradient-to-r from-purple-600 via-fuchsia-600 to-rose-600 hover:from-purple-500 hover:to-rose-500 shadow-md shadow-purple-950/50 flex items-center gap-1.5 cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              Publicar no Feed
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
