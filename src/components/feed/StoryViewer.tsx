import React, { useEffect, useRef, useState } from 'react';
import { X, Eye, Trash2, Users } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { StoryGroup } from '../../types';
import { deleteStory, fetchStoryViewers, markStoryViewed } from '../../lib/stories';

interface StoryViewerProps {
  groups: StoryGroup[];
  startGroupIndex: number;
  onClose: () => void;
}

const IMAGE_DURATION_MS = 5000;

type Viewer = Awaited<ReturnType<typeof fetchStoryViewers>>[number];

export const StoryViewer: React.FC<StoryViewerProps> = ({ groups, startGroupIndex, onClose }) => {
  const { currentUser, refreshStories, setSelectedProfileId, startOrOpenConversation } = useApp();
  const [groupIndex, setGroupIndex] = useState(startGroupIndex);
  const [storyIndex, setStoryIndex] = useState(() => {
    // Começa no primeiro story ainda não visto, como no Instagram
    const firstUnseen = groups[startGroupIndex]?.stories.findIndex(s => !s.viewedByMe) ?? 0;
    return firstUnseen > 0 ? firstUnseen : 0;
  });
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const [viewers, setViewers] = useState<Viewer[] | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  // Toque curto navega; segurar só pausa (como no Instagram)
  const pressStartedAt = useRef(0);

  const group = groups[groupIndex];
  const story = group?.stories[storyIndex];
  const isMine = group?.userId === currentUser.id;

  const next = () => {
    if (!group) return;
    if (storyIndex < group.stories.length - 1) setStoryIndex(storyIndex + 1);
    else if (groupIndex < groups.length - 1) { setGroupIndex(groupIndex + 1); setStoryIndex(0); }
    else onClose();
  };
  const prev = () => {
    if (storyIndex > 0) setStoryIndex(storyIndex - 1);
    else if (groupIndex > 0) { setGroupIndex(groupIndex - 1); setStoryIndex(0); }
  };

  // Registra visualização e reinicia o progresso a cada story
  useEffect(() => {
    if (!story) return;
    setProgress(0);
    setViewers(null);
    if (!isMine && !story.viewedByMe) markStoryViewed(currentUser.id, story.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [story?.id]);

  // Avanço automático das imagens (vídeos avançam ao terminar)
  useEffect(() => {
    if (!story || story.mediaType === 'video' || paused || viewers) return;
    const started = Date.now() - (progress / 100) * IMAGE_DURATION_MS;
    const timer = setInterval(() => {
      const pct = Math.min(100, ((Date.now() - started) / IMAGE_DURATION_MS) * 100);
      setProgress(pct);
      if (pct >= 100) {
        clearInterval(timer);
        next();
      }
    }, 50);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [story?.id, paused, viewers]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') next();
      if (e.key === 'ArrowLeft') prev();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // Ao fechar, atualiza anéis de "não visto"
  useEffect(() => () => { refreshStories(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!group || !story) return null;

  const handleDelete = async () => {
    if (!confirm('Apagar este story?')) return;
    const error = await deleteStory(story.id);
    if (error) alert(`Não foi possível apagar: ${error}`);
    await refreshStories();
    onClose();
  };

  const openViewers = async () => {
    setPaused(true);
    setViewers(await fetchStoryViewers(story.id));
  };

  return (
    <div className="fixed inset-0 z-[70] bg-black flex items-center justify-center select-none">
      <div className="relative w-full h-full sm:max-w-[420px] sm:h-[92vh] sm:rounded-2xl overflow-hidden bg-zinc-950">

        {/* Barras de progresso */}
        <div className="absolute top-0 inset-x-0 z-20 flex gap-1 p-2 pt-[max(0.5rem,env(safe-area-inset-top))]">
          {group.stories.map((s, i) => (
            <div key={s.id} className="flex-1 h-0.5 rounded-full bg-white/30 overflow-hidden">
              <div className="h-full bg-white" style={{ width: i < storyIndex ? '100%' : i === storyIndex ? `${progress}%` : '0%' }} />
            </div>
          ))}
        </div>

        {/* Cabeçalho */}
        <div className="absolute top-4 inset-x-0 z-20 px-3 pt-[env(safe-area-inset-top)] flex items-center justify-between">
          <button
            type="button"
            onClick={() => { onClose(); setSelectedProfileId(group.userId); }}
            className="flex items-center gap-2 cursor-pointer"
          >
            <img src={group.avatarUrl} alt="" className="w-8 h-8 rounded-full object-cover border border-white/40" />
            <span className="text-sm font-bold text-white drop-shadow">{group.username}</span>
            <span className="text-xs text-white/70">{story.createdAt}</span>
            {story.audience === 'connections' && <Users className="w-3.5 h-3.5 text-white/70" aria-label="Somente conexões" />}
          </button>
          <div className="flex items-center gap-1">
            {isMine && (
              <button type="button" onClick={handleDelete} className="p-2 text-white/80 hover:text-white cursor-pointer" aria-label="Apagar story">
                <Trash2 className="w-5 h-5" />
              </button>
            )}
            <button type="button" onClick={onClose} className="p-2 text-white/80 hover:text-white cursor-pointer" aria-label="Fechar">
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Mídia */}
        {story.mediaType === 'video' ? (
          <video
            ref={videoRef}
            key={story.id}
            src={story.mediaUrl}
            autoPlay
            playsInline
            disablePictureInPicture
            className="w-full h-full object-contain"
            onTimeUpdate={e => setProgress((e.currentTarget.currentTime / (e.currentTarget.duration || 1)) * 100)}
            onEnded={next}
          />
        ) : (
          <img key={story.id} src={story.mediaUrl} alt={story.caption ?? ''} className="w-full h-full object-contain" />
        )}

        {/* Zonas de toque: esquerda volta, direita avança, segurar pausa */}
        <div className="absolute inset-0 z-10 flex">
          {[prev, next].map((action, i) => (
            <button
              key={i}
              type="button"
              aria-label={i === 0 ? 'Story anterior' : 'Próximo story'}
              className={i === 0 ? 'w-1/3 h-full' : 'w-2/3 h-full'}
              onClick={() => { if (Date.now() - pressStartedAt.current < 250) action(); }}
              onPointerDown={() => { pressStartedAt.current = Date.now(); setPaused(true); videoRef.current?.pause(); }}
              onPointerUp={() => { setPaused(false); videoRef.current?.play(); }}
              onPointerLeave={() => { setPaused(false); }}
            />
          ))}
        </div>

        {/* Legenda e ações */}
        <div className="absolute bottom-0 inset-x-0 z-20 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] bg-gradient-to-t from-black/80 to-transparent space-y-3">
          {story.caption && <p className="text-sm text-white text-center drop-shadow">{story.caption}</p>}
          {isMine ? (
            <button type="button" onClick={openViewers} className="mx-auto flex items-center gap-1.5 text-xs font-semibold text-white/90 cursor-pointer">
              <Eye className="w-4 h-4" /> Quem viu
            </button>
          ) : (
            <button
              type="button"
              onClick={() => { onClose(); startOrOpenConversation(group.userId); }}
              className="w-full py-2.5 rounded-full border border-white/40 text-sm text-white/90 cursor-pointer"
            >
              Responder por mensagem
            </button>
          )}
        </div>

        {/* Lista de quem visualizou */}
        {viewers && (
          <div className="absolute inset-x-0 bottom-0 z-30 max-h-[60%] bg-[#130d22] rounded-t-3xl p-4 overflow-y-auto">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-bold text-white">{viewers.length} visualizaç{viewers.length === 1 ? 'ão' : 'ões'}</h4>
              <button type="button" onClick={() => { setViewers(null); setPaused(false); }} className="p-1 text-zinc-400 cursor-pointer" aria-label="Fechar lista">
                <X className="w-5 h-5" />
              </button>
            </div>
            {viewers.length === 0 && <p className="text-xs text-zinc-400">Ninguém viu ainda.</p>}
            <div className="space-y-2.5">
              {viewers.map(v => (
                <div key={v.id} className="flex items-center gap-2.5">
                  <img src={v.avatarUrl} alt="" className="w-8 h-8 rounded-full object-cover" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-white truncate">{v.displayName}</p>
                    <p className="text-[10px] text-zinc-400">@{v.username} • {v.viewedAt}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
