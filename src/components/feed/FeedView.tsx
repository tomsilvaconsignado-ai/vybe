import React, { useEffect, useRef, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { StoriesBar } from './StoriesBar';
import { PostCard } from './PostCard';
import { ConviteCard } from '../growth/ConviteCard';
import { CreatePostModal } from './CreatePostModal';
import { AdSlot } from '../ads/AdSlot';
import { AvisoSeloFoto } from '../growth/AvisoSeloFoto';
import { Plus, HeartHandshake, ArrowUp } from 'lucide-react';

export const FeedView: React.FC = () => {
  const { posts, currentUser, following, loadMorePosts, feedHasMore, feedLoadingMore, setActiveTab, activeTab, feedFilter: filterType, changeFeedFilter, newPostsCount, checkNewPosts } = useApp();

  // Novas publicações: confere a cada minuto, só com a aba visível (e ao voltar para ela).
  // A função do contexto muda a cada renderização: o relógio usa sempre a mais recente sem ser reiniciado.
  const conferirRef = useRef(checkNewPosts);
  conferirRef.current = checkNewPosts;
  useEffect(() => {
    const conferir = () => { if (document.visibilityState === 'visible') conferirRef.current(); };
    const timer = setInterval(conferir, 60000);
    document.addEventListener('visibilitychange', conferir);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', conferir); };
  }, []);
  const verNovas = () => { window.scrollTo({ top: 0, behavior: 'smooth' }); changeFeedFilter(filterType); };
  // "Seguindo" tem endereço próprio (/seguindo); as demais abas ficam na página inicial
  const setFilterType = (f: 'foryou' | 'all' | 'following' | 'verified') => {
    setActiveTab(f === 'following' ? 'following' : 'feed');
    if (f !== filterType) changeFeedFilter(f);
  };
  // voltar/avançar e F5 em /seguindo: a aba acompanha o endereço
  useEffect(() => {
    // (também recarrega quando a lista de quem você segue termina de chegar ou muda)
    if (activeTab === 'following') changeFeedFilter('following');
    if (activeTab === 'feed' && filterType === 'following') changeFeedFilter('foryou');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, following.length]);
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

  // O filtro já vem aplicado do servidor (páginas filtradas); aqui só protege publicações novas fora do filtro
  const filteredPosts = posts.filter(post =>
    filterType === 'following' ? following.includes(post.userId) || post.userId === currentUser.id
      : filterType === 'verified' ? post.user.isVerified
        : true);

  const filtros = [
    { id: 'foryou', label: 'Para você' },
    { id: 'following', label: 'Seguindo' },
    { id: 'all', label: 'Recentes' },
    { id: 'verified', label: 'Verificados' }
  ] as const;
  const filtroAtivo = Math.max(0, filtros.findIndex(f => f.id === filterType));

  return (
    <div className="max-w-[600px] mx-auto pt-3 sm:pt-6 sm:px-4">
      {/* Stories */}
      <div className="pb-3 border-b border-white/[0.06]">
        <StoriesBar />
      </div>

      {/* sem foto de perfil: avisa que os selos só aparecem com foto */}
      <AvisoSeloFoto className="mx-3 sm:mx-0 mt-4" />

      {/* Publicar: uma linha leve, sem caixa */}
      <div className="flex items-center gap-3 px-3 sm:px-1 py-3 border-b border-white/[0.06]">
        <img src={currentUser.avatarUrl} alt="" className="w-10 h-10 rounded-full object-cover ring-1 ring-white/10" />
        <button
          onClick={() => setCreatePostOpen(true)}
          className="flex-1 min-w-0 min-h-[44px] text-left px-4 rounded-full bg-white/[0.05] hover:bg-white/[0.08] text-sm text-zinc-400 transition-colors cursor-pointer truncate"
        >
          Compartilhe um momento…
        </button>
        <button
          onClick={() => setCreatePostOpen(true)}
          className="w-11 h-11 shrink-0 flex items-center justify-center rounded-full fundo-neon text-white shadow-[0_6px_20px_-6px_rgba(236,72,153,0.8)] cursor-pointer transition-transform hover:scale-105"
          title="Nova publicação"
          aria-label="Nova publicação"
        >
          <Plus className="w-5 h-5" strokeWidth={2.6} />
        </button>
      </div>

      {/* Filtros do feed: abas com sublinhado de luz que desliza */}
      <div className="sticky top-[calc(49px+max(0.5rem,env(safe-area-inset-top)))] z-20 bg-fundo/85 backdrop-blur-xl border-b border-white/[0.06] mb-1 sm:mb-4">
        <div className="relative grid grid-cols-4" role="group" aria-label="Filtrar o feed">
          {filtros.map(f => (
            <button
              key={f.id}
              onClick={() => setFilterType(f.id)}
              aria-pressed={filterType === f.id}
              className={`h-11 text-[14px] transition-colors cursor-pointer ${filterType === f.id ? 'text-white font-bold' : 'text-zinc-500 font-semibold hover:text-zinc-300'}`}
            >
              {f.label}
              {f.id === 'following' && following.length > 0 && <span className="ml-1 text-xs font-medium text-zinc-500">{following.length}</span>}
            </button>
          ))}
          <span
            aria-hidden
            className="luz-ativa absolute bottom-0 h-[2px] w-[14%] rounded-full transition-[left] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
            style={{ left: `${filtroAtivo * 25 + 5.5}%` }}
          />
        </div>
      </div>

      {/* Publicações (feed acessível: o leitor de tela anuncia o carregamento) */}
      {/* novas publicações: flutua logo abaixo das abas, por cima das publicações */}
      {newPostsCount > 0 && (
        <div className="sticky top-[calc(101px+max(0.5rem,env(safe-area-inset-top)))] z-20 h-0 flex justify-center pointer-events-none" aria-live="polite">
          <button
            type="button"
            onClick={verNovas}
            className="pointer-events-auto mt-2.5 h-9 pl-3 pr-4 rounded-full text-[13px] font-bold text-white fundo-neon shadow-[0_8px_30px_-6px_rgba(236,72,153,0.7)] flex items-center gap-1.5 cursor-pointer"
          >
            <ArrowUp className="w-4 h-4" strokeWidth={2.6} />
            {newPostsCount > 9 ? '9+' : newPostsCount} {newPostsCount === 1 ? 'nova publicação' : 'novas publicações'}
          </button>
        </div>
      )}

      <div className="sm:space-y-5" role="feed" aria-busy={feedLoadingMore} aria-label="Publicações">
        {filteredPosts.map((post, index) => (
          <React.Fragment key={post.id}>
            <PostCard post={post} priority={index === 0} position={index + 1} total={filteredPosts.length} />
            {index === 2 && <ConviteCard />}
            {/* Patrocinado a cada 5 publicações */}
            {(index + 1) % 5 === 0 && <AdSlot placement="feed" variant="feed" index={Math.floor(index / 5)} />}
          </React.Fragment>
        ))}

        {filteredPosts.length === 0 && !feedLoadingMore && (
          <div className="mx-3 sm:mx-0 my-6 p-8 text-center rounded-3xl border border-white/[0.06]">
            <HeartHandshake className="w-10 h-10 text-purple-400 mx-auto mb-2 opacity-60" />
            <h4 className="text-sm font-bold text-white mb-1">
              {filterType === 'following' ? 'Quem você segue ainda não publicou' : filterType === 'verified' ? 'Nenhuma publicação de perfis verificados' : 'Nenhuma publicação encontrada'}
            </h4>
            <p className="text-xs text-zinc-400 mb-4">
              Explore novos perfis na aba Descobrir para ver mais publicações no feed.
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              <button onClick={() => setActiveTab('discover')} className="min-h-[40px] px-4 rounded-full text-xs font-bold text-white bg-gradient-to-r from-fuchsia-600 via-pink-600 to-orange-600 cursor-pointer">
                Descobrir perfis
              </button>
              {filterType !== 'foryou' && (
                <button onClick={() => setFilterType('foryou')} className="min-h-[40px] px-4 rounded-full text-xs font-semibold text-zinc-300 bg-zinc-900/60 cursor-pointer">
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
