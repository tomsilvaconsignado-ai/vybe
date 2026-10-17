import React from 'react';
import { useApp } from '../../context/AppContext';
import { Plus } from 'lucide-react';

export const StoriesBar: React.FC = () => {
  const { profiles, currentUser, setSelectedProfileId } = useApp();

  return (
    <div className="flex items-center gap-4 overflow-x-auto pb-4 pt-1 px-1 scrollbar-none no-scrollbar">
      
      {/* Current user add story */}
      <div className="flex flex-col items-center gap-1.5 shrink-0 cursor-pointer group">
        <div className="relative">
          <div className="w-16 h-16 rounded-full p-[2px] bg-gradient-to-tr from-purple-600 via-fuchsia-600 to-rose-500">
            <img
              src={currentUser.avatarUrl}
              alt="Seu Momento"
              className="w-full h-full object-cover rounded-full border-2 border-[#09070f] group-hover:scale-105 transition-transform"
            />
          </div>
          <div className="absolute bottom-0 right-0 w-5 h-5 rounded-full bg-rose-500 border-2 border-[#09070f] flex items-center justify-center text-white">
            <Plus className="w-3 h-3" />
          </div>
        </div>
        <span className="text-[11px] font-medium text-zinc-300 truncate max-w-[68px]">Seu status</span>
      </div>

      {/* Other active profiles stories */}
      {profiles.map(prof => (
        <div
          key={prof.id}
          onClick={() => setSelectedProfileId(prof.id)}
          className="flex flex-col items-center gap-1.5 shrink-0 cursor-pointer group"
        >
          <div className="w-16 h-16 rounded-full p-[2.5px] bg-gradient-to-tr from-fuchsia-500 via-purple-600 to-rose-500 group-hover:p-[3px] transition-all">
            <img
              src={prof.avatarUrl}
              alt={prof.displayName}
              className="w-full h-full object-cover rounded-full border-2 border-[#09070f] group-hover:scale-105 transition-transform"
            />
          </div>
          <span className="text-[11px] font-medium text-zinc-300 truncate max-w-[68px] group-hover:text-purple-300">
            {prof.username}
          </span>
        </div>
      ))}

    </div>
  );
};
