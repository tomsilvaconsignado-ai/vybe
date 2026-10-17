import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { StoriesBar } from './StoriesBar';
import { PostCard } from './PostCard';
import { CreatePostModal } from './CreatePostModal';
import { Plus, Sparkles, Filter, ShieldCheck, HeartHandshake } from 'lucide-react';

export const FeedView: React.FC = () => {
  const { posts, currentUser, following } = useApp();
  const [filterType, setFilterType] = useState<'all' | 'following' | 'verified'>('all');
  const [createPostOpen, setCreatePostOpen] = useState(false);

  const filteredPosts = posts.filter(post => {
    if (filterType === 'following') {
      return following.includes(post.userId) || post.userId === currentUser.id;
    }
    if (filterType === 'verified') {
      return post.user.isVerified;
    }
    return true;
  });

  return (
    <div className="max-w-2xl mx-auto py-6 px-4">
      
      {/* Stories Carousel */}
      <div className="mb-6 pb-2 border-b border-purple-950/40">
        <StoriesBar />
      </div>

      {/* Quick Create Post Bar */}
      <div className="bg-[#120d20] border border-purple-900/30 rounded-3xl p-4 mb-6 shadow-xl flex items-center gap-3">
        <img
          src={currentUser.avatarUrl}
          alt={currentUser.displayName}
          className="w-10 h-10 rounded-full object-cover border border-purple-500/40"
        />
        <button
          onClick={() => setCreatePostOpen(true)}
          className="flex-1 text-left px-4 py-2.5 rounded-full bg-zinc-900/80 border border-zinc-800 text-xs text-zinc-400 hover:text-zinc-200 hover:border-purple-800/60 transition-all cursor-pointer"
        >
          O que você ou o casal estão pensando hoje?
        </button>
        <button
          onClick={() => setCreatePostOpen(true)}
          className="p-2.5 rounded-full bg-gradient-to-r from-purple-600 to-rose-600 hover:from-purple-500 hover:to-rose-500 text-white shadow-md shadow-purple-950/50 cursor-pointer transition-transform hover:scale-105"
          title="Nova publicação"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {/* Feed Filters Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setFilterType('all')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
              filterType === 'all'
                ? 'bg-purple-600 text-white shadow-md shadow-purple-950/40'
                : 'text-zinc-400 hover:text-zinc-200 bg-zinc-900/60'
            }`}
          >
            Para Você
          </button>
          <button
            onClick={() => setFilterType('following')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
              filterType === 'following'
                ? 'bg-purple-600 text-white shadow-md shadow-purple-950/40'
                : 'text-zinc-400 hover:text-zinc-200 bg-zinc-900/60'
            }`}
          >
            Seguindo ({following.length})
          </button>
          <button
            onClick={() => setFilterType('verified')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
              filterType === 'verified'
                ? 'bg-purple-600 text-white shadow-md shadow-purple-950/40'
                : 'text-zinc-400 hover:text-zinc-200 bg-zinc-900/60'
            }`}
          >
            ✓ Verificados
          </button>
        </div>

        <span className="text-[11px] text-zinc-400 hidden sm:inline">
          {filteredPosts.length} publicações ativas
        </span>
      </div>

      {/* Posts Stream */}
      <div className="space-y-6">
        {filteredPosts.map(post => (
          <PostCard key={post.id} post={post} />
        ))}

        {filteredPosts.length === 0 && (
          <div className="p-8 text-center bg-[#130d22] border border-purple-900/30 rounded-3xl">
            <HeartHandshake className="w-10 h-10 text-purple-400 mx-auto mb-2 opacity-60" />
            <h4 className="text-sm font-bold text-white mb-1">Nenhuma publicação encontrada</h4>
            <p className="text-xs text-zinc-400 mb-4">
              Explore novos perfis na aba Descobrir para ver mais publicações no feed.
            </p>
          </div>
        )}
      </div>

      {/* Modal */}
      <CreatePostModal isOpen={createPostOpen} onClose={() => setCreatePostOpen(false)} />

    </div>
  );
};
