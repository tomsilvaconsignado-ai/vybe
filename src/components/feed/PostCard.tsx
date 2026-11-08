import React, { useEffect, useRef, useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  Heart,
  MessageCircle,
  Bookmark,
  Send,
  MoreHorizontal,
  ShieldAlert,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  MapPin,
  CheckCircle2,
  Trash2,
  Link2
} from 'lucide-react';
import { Post } from '../../types';
import { notify, askConfirm } from '../common/Feedback';

interface PostCardProps {
  post: Post;
  /** primeira publicação da tela: a foto carrega com prioridade (melhora o tempo até o conteúdo aparecer) */
  priority?: boolean;
  /** posição no feed, para leitores de tela */
  position?: number;
  total?: number;
}

const CAPTION_PREVIEW_CHARS = 140;

/** Link direto da publicação (abre a publicação ao entrar no Vybelog) */
export const postLink = (postId: string) => `${window.location.origin}/?post=${postId}`;

export const PostCard: React.FC<PostCardProps> = ({ post, priority = false, position, total }) => {
  const {
    currentUser,
    toggleLikePost,
    toggleSavePost,
    addComment,
    votePoll,
    setSelectedProfileId,
    setReportModalTarget,
    deletePost
  } = useApp();

  const [activeMediaIndex, setActiveMediaIndex] = useState(0);
  const [showAllComments, setShowAllComments] = useState(false);
  const [commentInput, setCommentInput] = useState('');
  const [showMenu, setShowMenu] = useState(false);
  const [captionExpanded, setCaptionExpanded] = useState(false);
  const [heartBurst, setHeartBurst] = useState(false);
  const lastTapAt = useRef(0);
  const touchStartX = useRef<number | null>(null);
  const commentInputRef = useRef<HTMLInputElement>(null);

  const isOwner = currentUser?.id ? post.userId === currentUser.id : false;
  const mediaCount = post.mediaUrls?.length ?? 0;
  const hasMedia = mediaCount > 0;
  const totalPollVotes = post.poll?.options?.reduce((acc, opt) => acc + opt.votes, 0) || 0;
  const userPollVote = (currentUser?.id && post.poll?.voterIds) ? post.poll.voterIds[currentUser.id] : undefined;
  const visibleComments = showAllComments ? post.comments : post.comments.slice(-2);
  const longCaption = post.content.length > CAPTION_PREVIEW_CHARS;

  const goTo = (index: number) => setActiveMediaIndex(Math.max(0, Math.min(mediaCount - 1, index)));

  // Dois toques na foto curtem (nunca descurtem), como no Instagram
  const handleMediaTap = () => {
    const now = Date.now();
    if (now - lastTapAt.current < 300) {
      if (!post.likedByCurrentUser) toggleLikePost(post.id);
      setHeartBurst(true);
      setTimeout(() => setHeartBurst(false), 750);
      lastTapAt.current = 0;
    } else {
      lastTapAt.current = now;
    }
  };

  const handleSendComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentInput.trim()) return;
    addComment(post.id, commentInput);
    setCommentInput('');
  };

  const copyLink = () => {
    navigator.clipboard?.writeText(postLink(post.id)).catch(() => undefined);
    notify('Link da publicação copiado.');
    setShowMenu(false);
  };

  // Compartilhar: no celular abre o menu nativo (WhatsApp, Telegram...); no computador copia o link
  const sharePost = async () => {
    const url = postLink(post.id);
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: `Publicação de @${post.user.username} no Vybelog`, url });
        return;
      } catch (e) {
        if ((e as DOMException)?.name === 'AbortError') return; // a pessoa fechou o menu
      }
    }
    copyLink();
  };

  // Menu de opções fecha ao tocar fora ou com Esc
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!showMenu) return;
    const outside = (e: PointerEvent) => { if (!menuRef.current?.contains(e.target as Node)) setShowMenu(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setShowMenu(false); };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', esc); };
  }, [showMenu]);

  return (
    <article
      className="bg-[#120d20] border border-purple-900/30 rounded-3xl overflow-hidden shadow-xl mb-6"
      aria-label={`Publicação de @${post.user.username}`}
      aria-posinset={position}
      aria-setsize={total}
    >

      {/* Cabeçalho */}
      <div className="px-4 py-3 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setSelectedProfileId(post.userId)}
          className="flex items-center gap-3 cursor-pointer group text-left min-w-0"
        >
          <span className="relative shrink-0">
            <img
              src={post.user.avatarUrl}
              alt=""
              className="w-9 h-9 rounded-full object-cover border border-purple-500/50"
            />
            {post.user.isVerified && (
              <span className="absolute -bottom-1 -right-1 w-4 h-4 bg-purple-500 rounded-full flex items-center justify-center text-[10px] text-white">✓</span>
            )}
          </span>
          <span className="min-w-0">
            <span className="flex items-center gap-1.5">
              <span className="font-bold text-sm text-zinc-100 group-hover:text-purple-300 truncate">{post.user.username}</span>
              <span className="text-[11px] px-1.5 py-0.5 rounded bg-purple-950 text-purple-300 border border-purple-800/40 shrink-0">
                {post.user.profileType === 'couple' ? 'Casal' : post.user.profileType === 'polyamorous' ? 'Poli' : 'Solteiro(a)'}
              </span>
            </span>
            <span className="flex items-center gap-1 text-[11px] text-zinc-400 truncate">
              {(post.location || post.user.city) && <MapPin className="w-2.5 h-2.5 shrink-0" />}
              <span className="truncate">{post.location || post.user.city}</span>
            </span>
          </span>
        </button>

        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setShowMenu(!showMenu)}
            className="w-11 h-11 flex items-center justify-center text-zinc-400 hover:text-white rounded-full hover:bg-zinc-800/60 cursor-pointer"
            aria-label="Opções da publicação"
            aria-haspopup="menu"
            aria-expanded={showMenu}
          >
            <MoreHorizontal className="w-5 h-5" />
          </button>
          {showMenu && (
            <div className="absolute right-0 top-11 w-52 bg-[#19112a] border border-purple-800/50 rounded-2xl shadow-2xl py-1.5 z-20" role="menu">
              {isOwner ? (
                <button
                  type="button"
                  onClick={async () => {
                    setShowMenu(false);
                    if (await askConfirm({ title: 'Excluir publicação?', message: 'Ela será removida do seu perfil e do feed.', confirmLabel: 'Excluir', danger: true })) deletePost(post.id);
                  }}
                  role="menuitem"
                  className="w-full min-h-[44px] px-3 py-2 text-left text-sm text-rose-400 hover:bg-rose-950/40 flex items-center gap-2 cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" /> Excluir publicação
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setReportModalTarget({ targetType: 'post', targetId: post.id, reportedUserId: post.userId, reportedUserName: post.user.username });
                    setShowMenu(false);
                  }}
                  role="menuitem"
                  className="w-full min-h-[44px] px-3 py-2 text-left text-sm text-rose-400 hover:bg-rose-950/40 flex items-center gap-2 cursor-pointer"
                >
                  <ShieldAlert className="w-4 h-4" /> Denunciar
                </button>
              )}
              <button type="button" role="menuitem" onClick={copyLink} className="w-full min-h-[44px] px-3 py-2 text-left text-sm text-zinc-300 hover:bg-purple-950/50 flex items-center gap-2 cursor-pointer">
                <Link2 className="w-4 h-4" /> Copiar link
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Mídia: toque duplo curte, arrastar troca de foto */}
      {hasMedia && (
        <div
          className="relative aspect-[9/16] w-full max-w-[min(100%,calc(85svh*9/16))] mx-auto bg-black overflow-hidden group"
          onClick={handleMediaTap}
          onTouchStart={e => { touchStartX.current = e.touches[0].clientX; }}
          onTouchEnd={e => {
            if (touchStartX.current === null) return;
            const dx = e.changedTouches[0].clientX - touchStartX.current;
            if (Math.abs(dx) > 40) goTo(activeMediaIndex + (dx < 0 ? 1 : -1));
            touchStartX.current = null;
          }}
        >
          <div
            className="flex h-full transition-transform duration-300 ease-out"
            style={{ transform: `translateX(-${activeMediaIndex * 100}%)` }}
          >
            {post.mediaUrls.map((url, i) => (
              <img
                key={i}
                src={url}
                alt={`Foto ${mediaCount > 1 ? `${i + 1} de ${mediaCount} ` : ''}publicada por @${post.user.username}`}
                width={1080}
                height={1920}
                loading={priority && i === 0 ? 'eager' : 'lazy'}
                fetchPriority={priority && i === 0 ? 'high' : 'auto'}
                decoding="async"
                draggable={false}
                className="w-full h-full object-cover shrink-0 select-none"
              />
            ))}
          </div>

          {heartBurst && (
            <Heart className="absolute inset-0 m-auto w-24 h-24 fill-white text-white drop-shadow-2xl animate-ping pointer-events-none" />
          )}

          {mediaCount > 1 && (
            <>
              <span className="absolute top-3 right-3 px-2 py-0.5 rounded-full bg-black/60 text-white text-[11px] font-semibold">
                {activeMediaIndex + 1}/{mediaCount}
              </span>
              {activeMediaIndex > 0 && (
                <button
                  type="button"
                  onClick={e => { e.stopPropagation(); goTo(activeMediaIndex - 1); }}
                  className="absolute left-3 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-white/80 text-black opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                  aria-label="Foto anterior"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
              )}
              {activeMediaIndex < mediaCount - 1 && (
                <button
                  type="button"
                  onClick={e => { e.stopPropagation(); goTo(activeMediaIndex + 1); }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-white/80 text-black opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                  aria-label="Próxima foto"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              )}
            </>
          )}
        </div>
      )}

      {/* Publicação só de texto */}
      {!hasMedia && post.content && (
        <div className="px-4 pb-2">
          <p className="text-[15px] text-zinc-100 leading-relaxed whitespace-pre-line">{post.content}</p>
        </div>
      )}

      {/* Enquete */}
      {post.poll && (
        <div className="p-4 mx-4 my-2 rounded-2xl bg-zinc-950/60 border border-purple-900/30">
          <h4 className="text-xs font-bold text-zinc-200 mb-3 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-fuchsia-400" />
            {post.poll.question}
          </h4>
          <div className="space-y-2">
            {post.poll.options.map(opt => {
              const isSelected = userPollVote === opt.id;
              const percent = totalPollVotes > 0 ? Math.round((opt.votes / totalPollVotes) * 100) : 0;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => votePoll(post.id, opt.id)}
                  disabled={!!userPollVote}
                  className={`w-full relative overflow-hidden rounded-xl p-2.5 text-left border text-xs cursor-pointer ${
                    isSelected ? 'border-fuchsia-500 bg-fuchsia-950/30 text-white font-semibold' : 'border-zinc-800 bg-zinc-900/40 text-zinc-300 hover:border-purple-800/50'
                  }`}
                >
                  {userPollVote && <div className="absolute left-0 top-0 bottom-0 bg-purple-600/25 transition-all duration-500" style={{ width: `${percent}%` }} />}
                  <div className="relative z-10 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-fuchsia-400" />}
                      {opt.text}
                    </span>
                    {userPollVote && <span className="text-[11px] font-bold text-purple-300">{percent}% ({opt.votes})</span>}
                  </div>
                </button>
              );
            })}
          </div>
          <p className="text-[10px] text-zinc-500 mt-2 text-right">{totalPollVotes} {totalPollVotes === 1 ? 'voto' : 'votos'}</p>
        </div>
      )}

      {/* Ações (alvos de toque de 44px) */}
      <div className="px-2 pt-1 flex items-center justify-between">
        <div className="flex items-center">
          <button
            type="button"
            onClick={() => toggleLikePost(post.id)}
            className={`w-11 h-11 flex items-center justify-center cursor-pointer transition-transform active:scale-90 ${post.likedByCurrentUser ? 'text-rose-500' : 'text-zinc-200 hover:text-zinc-400'}`}
            aria-label={post.likedByCurrentUser ? 'Descurtir' : 'Curtir'}
            aria-pressed={post.likedByCurrentUser}
          >
            <Heart className={`w-6 h-6 ${post.likedByCurrentUser ? 'fill-rose-500' : ''}`} />
          </button>
          <button
            type="button"
            onClick={() => commentInputRef.current?.focus()}
            className="w-11 h-11 flex items-center justify-center text-zinc-200 hover:text-zinc-400 cursor-pointer"
            aria-label="Comentar"
          >
            <MessageCircle className="w-6 h-6" />
          </button>
          <button type="button" onClick={sharePost} className="w-11 h-11 flex items-center justify-center text-zinc-200 hover:text-zinc-400 cursor-pointer" aria-label="Compartilhar">
            <Send className="w-6 h-6" />
          </button>
        </div>

        {mediaCount > 1 && (
          <div className="flex items-center gap-1" aria-hidden="true">
            {post.mediaUrls.map((_, i) => (
              <span key={i} className={`w-1.5 h-1.5 rounded-full ${i === activeMediaIndex ? 'bg-fuchsia-400' : 'bg-zinc-600'}`} />
            ))}
          </div>
        )}

        <button
          type="button"
          onClick={() => toggleSavePost(post.id)}
          className={`w-11 h-11 flex items-center justify-center cursor-pointer ${post.savedByCurrentUser ? 'text-fuchsia-400' : 'text-zinc-200 hover:text-zinc-400'}`}
          aria-label={post.savedByCurrentUser ? 'Remover dos salvos' : 'Salvar'}
          aria-pressed={post.savedByCurrentUser}
        >
          <Bookmark className={`w-6 h-6 ${post.savedByCurrentUser ? 'fill-fuchsia-500' : ''}`} />
        </button>
      </div>

      <div className="px-4 pb-4 space-y-1.5">
        {post.likesCount > 0 ? (
          <p className="text-sm font-bold text-zinc-100">
            {post.likesCount} {post.likesCount === 1 ? 'curtida' : 'curtidas'}
          </p>
        ) : (
          <p className="text-sm text-zinc-400">Seja o primeiro a curtir</p>
        )}

        {/* Legenda (posts com foto) */}
        {hasMedia && post.content && (
          <p className="text-sm text-zinc-200 leading-snug whitespace-pre-line">
            <button type="button" onClick={() => setSelectedProfileId(post.userId)} className="font-bold text-zinc-100 mr-1.5 cursor-pointer">
              {post.user.username}
            </button>
            {longCaption && !captionExpanded ? `${post.content.slice(0, CAPTION_PREVIEW_CHARS).trimEnd()}… ` : post.content}
            {longCaption && !captionExpanded && (
              <button type="button" onClick={() => setCaptionExpanded(true)} className="text-zinc-400 cursor-pointer">mais</button>
            )}
          </p>
        )}

        {post.tags && post.tags.length > 0 && (
          <p className="flex flex-wrap gap-x-1.5 text-sm text-fuchsia-400">
            {post.tags.map(tag => <span key={tag}>#{tag}</span>)}
          </p>
        )}

        {post.commentsCount > 2 && !showAllComments && (
          <button type="button" onClick={() => setShowAllComments(true)} className="text-sm text-zinc-400 hover:text-zinc-300 cursor-pointer">
            Ver todos os {post.commentsCount} comentários
          </button>
        )}

        {visibleComments.length > 0 && (
          <div className={`space-y-1 ${showAllComments ? 'max-h-60 overflow-y-auto pr-1' : ''}`}>
            {visibleComments.map(c => (
              <p key={c.id} className="text-sm text-zinc-300 leading-snug">
                <button type="button" onClick={() => setSelectedProfileId(c.userId)} className="font-bold text-zinc-100 mr-1.5 cursor-pointer">
                  {c.username || c.userDisplayName}
                </button>
                {c.content}
              </p>
            ))}
          </div>
        )}

        <p className="text-[11px] uppercase tracking-wide text-zinc-500">{post.createdAt}</p>

        <form onSubmit={handleSendComment} className="flex items-center gap-2 pt-2 border-t border-purple-950/40">
          <img src={currentUser.avatarUrl} alt="" className="w-7 h-7 rounded-full object-cover" />
          <input
            ref={commentInputRef}
            type="text"
            placeholder="Adicione um comentário..."
            value={commentInput}
            onChange={e => setCommentInput(e.target.value)}
            aria-label="Comentário"
            className="flex-1 min-w-0 py-2 bg-transparent text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none"
          />
          {commentInput.trim() && (
            <button type="submit" className="text-sm font-bold text-fuchsia-400 hover:text-fuchsia-300 cursor-pointer">
              Publicar
            </button>
          )}
        </form>
      </div>
    </article>
  );
};
