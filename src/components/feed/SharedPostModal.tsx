import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { fetchPost } from '../../lib/social';
import { PostCard } from './PostCard';
import { comentarioDoEndereco } from '../../lib/rotas';

// Publicação aberta pelo endereço /publicacao/<id> (link compartilhado, notificação ou F5), por cima
// da tela atual. Fechar volta para a tela de baixo (o endereço acompanha).

export const SharedPostModal: React.FC = () => {
  const { currentUser, posts, postCache, cachePosts, openPostId: postId, setOpenPostId } = useApp();
  const [estado, setEstado] = useState<'carregando' | 'pronto' | 'indisponivel'>('carregando');

  useEffect(() => {
    if (!postId || !currentUser.id) return;
    setEstado('carregando');
    let ativo = true;
    fetchPost(postId, currentUser.id).then(p => {
      if (!ativo) return;
      if (p) { cachePosts([p]); setEstado('pronto'); } else setEstado('indisponivel');
    });
    return () => { ativo = false; };
  }, [postId, currentUser.id]);

  useEffect(() => {
    if (!postId) return;
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') fechar(); };
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [postId]);

  if (!postId) return null;

  function fechar() {
    setOpenPostId(null);
  }

  // estado atualizado (curtidas, comentários) vem do feed ou do cache
  const post = posts.find(p => p.id === postId) ?? postCache[postId];

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm overflow-y-auto" role="dialog" aria-modal="true" aria-label="Publicação compartilhada" onClick={fechar}>
      <div className="min-h-full flex items-start sm:items-center justify-center p-3 sm:p-6">
        <div className="relative w-full max-w-xl" onClick={e => e.stopPropagation()}>
          <button
            type="button"
            onClick={fechar}
            className="absolute -top-1 right-1 z-10 w-11 h-11 flex items-center justify-center rounded-full bg-black/60 text-white cursor-pointer"
            aria-label="Fechar publicação"
          >
            <X className="w-5 h-5" />
          </button>
          {estado === 'carregando' && (
            <div className="py-24 flex justify-center" role="status" aria-label="Carregando publicação">
              <div className="w-8 h-8 rounded-full border-2 border-purple-500 border-t-transparent animate-spin" />
            </div>
          )}
          {estado === 'indisponivel' && (
            <div className="mt-12 p-8 text-center bg-[#130d22] border border-purple-900/30 rounded-3xl">
              <h2 className="text-sm font-bold text-white mb-1">Publicação indisponível</h2>
              <p className="text-xs text-zinc-400">Ela foi removida ou é visível só para as conexões de quem publicou.</p>
            </div>
          )}
          {estado === 'pronto' && post && <div className="pt-12"><PostCard post={post} priority highlightCommentId={comentarioDoEndereco(window.location.search)} /></div>}
        </div>
      </div>
    </div>
  );
};
