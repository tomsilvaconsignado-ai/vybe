import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Plus } from 'lucide-react';
import { StoryViewer } from './StoryViewer';
import { StoryComposer } from './StoryComposer';

export const StoriesBar: React.FC = () => {
  const { storyGroups, currentUser } = useApp();
  const [openGroupIndex, setOpenGroupIndex] = useState<number | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);

  const myGroupIndex = storyGroups.findIndex(g => g.userId === currentUser.id);
  const others = storyGroups.map((g, index) => ({ g, index })).filter(({ g }) => g.userId !== currentUser.id);

  return (
    <>
      <div className="flex items-start gap-4 overflow-x-auto pb-4 pt-1 px-1 no-scrollbar" role="list" aria-label="Stories">

        {/* Seu story: abre o seu se existir; o "+" sempre publica um novo */}
        <div className="flex flex-col items-center gap-1.5 shrink-0" role="listitem">
          <div className="relative">
            <button
              type="button"
              onClick={() => (myGroupIndex >= 0 ? setOpenGroupIndex(myGroupIndex) : setComposerOpen(true))}
              className={`w-16 h-16 rounded-full p-[2.5px] cursor-pointer ${myGroupIndex >= 0 ? 'bg-gradient-to-tr from-purple-600 via-fuchsia-600 to-rose-500' : 'bg-zinc-800'}`}
              aria-label={myGroupIndex >= 0 ? 'Ver seu story' : 'Publicar story'}
            >
              <img src={currentUser.avatarUrl} alt="" className="w-full h-full object-cover rounded-full border-2 border-[#09070f]" />
            </button>
            <button
              type="button"
              onClick={() => setComposerOpen(true)}
              className="absolute bottom-0 right-0 w-5 h-5 rounded-full bg-rose-500 border-2 border-[#09070f] flex items-center justify-center text-white cursor-pointer"
              aria-label="Publicar novo story"
            >
              <Plus className="w-3 h-3" />
            </button>
          </div>
          <span className="text-[11px] font-medium text-zinc-300 truncate max-w-[68px]">Seu story</span>
        </div>

        {others.map(({ g, index }) => (
          <button
            key={g.userId}
            type="button"
            onClick={() => setOpenGroupIndex(index)}
            className="flex flex-col items-center gap-1.5 shrink-0 cursor-pointer group"
            role="listitem"
          >
            <span className={`w-16 h-16 rounded-full p-[2.5px] transition-all ${
              g.hasUnseen ? 'bg-gradient-to-tr from-fuchsia-500 via-purple-600 to-rose-500' : 'bg-zinc-700'
            }`}>
              <img src={g.avatarUrl} alt="" className="w-full h-full object-cover rounded-full border-2 border-[#09070f] group-hover:scale-105 transition-transform" />
            </span>
            <span className={`text-[11px] font-medium truncate max-w-[68px] ${g.hasUnseen ? 'text-zinc-200' : 'text-zinc-500'}`}>
              {g.username}
            </span>
          </button>
        ))}

        {others.length === 0 && (
          <p className="self-center text-[11px] text-zinc-500 max-w-[220px] leading-snug">
            Nenhum story nas últimas 24h. Publique o primeiro: ele some sozinho em um dia.
          </p>
        )}
      </div>

      {openGroupIndex !== null && (
        <StoryViewer
          groups={storyGroups}
          startGroupIndex={openGroupIndex}
          onClose={() => setOpenGroupIndex(null)}
        />
      )}
      {composerOpen && <StoryComposer onClose={() => setComposerOpen(false)} />}
    </>
  );
};
