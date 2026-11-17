import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Plus } from 'lucide-react';
import { StoryViewer } from './StoryViewer';
import { StoryComposer } from './StoryComposer';

// Barra de stories: o anel do story novo é um neon que gira devagar; o já visto fica cinza e parado.
export const StoriesBar: React.FC = () => {
  const { storyGroups, currentUser } = useApp();
  const [openGroupIndex, setOpenGroupIndex] = useState<number | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);

  const myGroupIndex = storyGroups.findIndex(g => g.userId === currentUser.id);
  // novos primeiro (como no Instagram), depois os já vistos
  const others = storyGroups
    .map((g, index) => ({ g, index }))
    .filter(({ g }) => g.userId !== currentUser.id)
    .sort((a, b) => Number(b.g.hasUnseen) - Number(a.g.hasUnseen));
  const meuNovo = myGroupIndex >= 0 && storyGroups[myGroupIndex]?.hasUnseen;

  return (
    <>
      <div className="flex items-start gap-3.5 overflow-x-auto py-1 px-3 sm:px-1 no-scrollbar" role="list" aria-label="Stories">

        {/* Seu story: abre o seu se existir; o "+" sempre publica um novo */}
        <div className="flex flex-col items-center gap-1 shrink-0 w-[72px]" role="listitem">
          <div className="relative">
            <button
              type="button"
              onClick={() => (myGroupIndex >= 0 ? setOpenGroupIndex(myGroupIndex) : setComposerOpen(true))}
              className={`block w-[68px] h-[68px] rounded-full p-[2.5px] cursor-pointer ${myGroupIndex >= 0 ? (meuNovo ? 'anel-neon' : 'bg-zinc-700') : 'bg-transparent'}`}
              aria-label={myGroupIndex >= 0 ? 'Ver seu story' : 'Publicar story'}
            >
              <span className="block w-full h-full rounded-full bg-fundo p-[2.5px]"><img src={currentUser.avatarUrl} alt="" className="w-full h-full object-cover rounded-full" /></span>
            </button>
            <button
              type="button"
              onClick={() => setComposerOpen(true)}
              className="absolute bottom-0 right-0 w-6 h-6 rounded-full fundo-neon ring-[3px] ring-fundo flex items-center justify-center text-white cursor-pointer"
              aria-label="Publicar novo story"
            >
              <Plus className="w-3.5 h-3.5" strokeWidth={3} />
            </button>
          </div>
          <span className="text-xs text-zinc-400 truncate max-w-full">Seu story</span>
        </div>

        {others.map(({ g, index }) => (
          <div key={g.userId} role="listitem" className="shrink-0 w-[72px]">
            <button
              type="button"
              onClick={() => setOpenGroupIndex(index)}
              className="w-full flex flex-col items-center gap-1 cursor-pointer group"
              aria-label={`Story de @${g.username}${g.hasUnseen ? ' (novo)' : ''}`}
            >
              <span className={`block w-[68px] h-[68px] rounded-full p-[2.5px] ${g.hasUnseen ? 'anel-neon' : 'bg-zinc-700/80'}`}>
                <span className="block w-full h-full rounded-full bg-fundo p-[2.5px]"><img src={g.avatarUrl} alt="" className="w-full h-full object-cover rounded-full transition-transform duration-300 group-hover:scale-[1.04] group-active:scale-95" /></span>
              </span>
              <span className={`text-xs truncate max-w-full ${g.hasUnseen ? 'text-zinc-100' : 'text-zinc-500'}`}>
                {g.username}
              </span>
            </button>
          </div>
        ))}

        {others.length === 0 && (
          <p className="self-center text-xs text-zinc-500 max-w-[220px] leading-snug">
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
