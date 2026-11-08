import React, { useEffect, useRef, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { StoriesBar } from './StoriesBar';
import { PostCard } from './PostCard';
import { CreatePostModal } from './CreatePostModal';
import { AdSlot } from '../ads/AdSlot';
import { Plus, HeartHandshake } from 'lucide-react';

export const FeedView: React.FC = () => {
  const { posts, currentUser, following, loadMorePosts, feedHasMore, feedLoadingMore, setActiveTab } = useApp();
  const [filterType, setFilterType] = useState<'all' | 'following' | 'verified'>('all');
  const [createPostOpen, setCreatePostOpen] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Rolagem infinita: ao chegar perto do fim, busca a próxima página
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !feedHasMore) return;
    const observer = new IntersectionObserver(entries => {
      if (entries.some(e => e.isIntersecting)) loadMorePosts();
    }, { rootMargin: '800px 0px' });
    observer.observe(el);
    return () => observer.disconnect();
  }, [feedHasMore, loadMorePosts, posts.length]);

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
          className="flex-1 min-w-0 min-h-[44px] text-left px-4 py-2.5 rounded-full bg-zinc-900/80 border border-zinc-800 text-xs sm:text-sm text-zinc-400 hover:text-zinc-200 hover:border-purple-800/60 transition-all cursor-pointer truncate"
        >
          O que você ou o casal estão pensando hoje?
        </button>
        <button
          onClick={() => setCreatePostOpen(true)}
          className="w-11 h-11 shrink-0 flex items-center justify-center rounded-full bg-gradient-to-r from-purple-600 to-rose-600 hover:from-purple-500 hover:to-rose-500 text-white shadow-md shadow-purple-950/50 cursor-pointer transition-transform hover:scale-105"
          title="Nova publicação"
          aria-label="Nova publicação"
        >
          <Plus className="w-5 h-5" />
        </button>
      </div>

      {/* Filtros do feed */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar" role="group" aria-label="Filtrar o feed">
          {([
            { id: 'all', label: 'Para Você' },
            { id: 'following', label: `Seguindo (${following.length})` },
            { id: 'verified', label: '✓ Verificados' }
          ] as const).map(f => (
            <button
              key={f.id}
              onClick={() => setFilterType(f.id)}
              aria-pressed={filterType === f.id}
              className={`shrink-0 min-h-[36px] px-4 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                filterType === f.id
                  ? 'bg-purple-600 text-white shadow-md shadow-purple-950/40'
                  : 'text-zinc-400 hover:text-zinc-200 bg-zinc-900/60'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <span className="text-[11px] text-zinc-400 hidden sm:inline">
          {filteredPosts.length} publicações
        </span>
      </div>

      {/* Publicações (feed acessível: o leitor de tela anuncia o carregamento) */}
      <div className="space-y-6" role="feed" aria-busy={feedLoadingMore} aria-label="Publicações">
        {filteredPosts.map((post, index) => (
          <React.Fragment key={post.id}>
            <PostCard post={post} priority={index === 0} position={index + 1} total={filteredPosts.length} />
            {/* Patrocinado a cada 5 publicações */}
            {(index + 1) % 5 === 0 && <AdSlot placement="feed" variant="feed" index={Math.floor(index / 5)} />}
          </React.Fragment>
        ))}

        {filteredPosts.length === 0 && !feedLoadingMore && (
          <div className="p-8 text-center bg-[#130d22] border border-purple-900/30 rounded-3xl">
            <HeartHandshake className="w-10 h-10 text-purple-400 mx-auto mb-2 opacity-60" />
            <h4 className="text-sm font-bold text-white mb-1">
              {filterType === 'following' ? 'Quem você segue ainda não publicou' : filterType === 'verified' ? 'Nenhuma publicação de perfis verificados' : 'Nenhuma publicação encontrada'}
            </h4>
            <p className="text-xs text-zinc-400 mb-4">
              Explore novos perfis na aba Descobrir para ver mais publicações no feed.
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              <button onClick={() => setActiveTab('discover')} className="min-h-[40px] px-4 rounded-full text-xs font-bold text-white bg-gradient-to-r from-purple-600 to-rose-600 cursor-pointer">
                Descobrir perfis
              </button>
              {filterType !== 'all' && (
                <button onClick={() => setFilterType('all')} className="min-h-[40px] px-4 rounded-full text-xs font-semibold text-zinc-300 bg-zinc-900/60 cursor-pointer">
                  Ver todas
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Fim da lista: dispara a próxima página */}
      <div ref={sentinelRef} aria-hidden="true" />
      {feedLoadingMore && (
        <div className="py-6 flex justify-center" role="status" aria-label="Carregando mais publicações">
          <div className="w-7 h-7 rounded-full border-2 border-purple-500 border-t-transparent animate-spin" />
        </div>
      )}
      {!feedHasMore && posts.length > 0 && (
        <p className="py-6 text-center text-xs text-zinc-500">Você viu todas as publicações recentes.</p>
      )}

      {/* Modal */}
      <CreatePostModal isOpen={createPostOpen} onClose={() => setCreatePostOpen(false)} />

    </div>
  );
};
