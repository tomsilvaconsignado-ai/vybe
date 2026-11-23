import React, { useEffect, useRef, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { linkDaPublicacao } from '../../lib/rotas';
import { comConvite } from '../../lib/convite';
import { meuCodigo } from '../../lib/crescimento';
import { compartilharComImagem } from '../../lib/compartilhar';
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
  BadgeCheck,
  CheckCircle2,
  Trash2,
  Link2
} from 'lucide-react';
import { Post } from '../../types';
import { notify, askConfirm } from '../common/Feedback';
import { FEED_WIDTH, feedVersionUrl } from '../../lib/media';
import { TextoComMencoes } from '../common/TextoComMencoes';
import { posterOf, withFirstFrame } from '../../lib/videoPoster';

interface PostCardProps {
  post: Post;
  /** primeira publicação da tela: a foto carrega com prioridade (melhora o tempo até o conteúdo aparecer) */
  priority?: boolean;
  /** posição no feed, para leitores de tela */
  position?: number;
  total?: number;
  /** comentário a destacar (link de notificação de resposta/menção) */
  highlightCommentId?: string | null;
}

const CAPTION_PREVIEW_CHARS = 140;

/** Link direto da publicação (abre a publicação ao entrar no Vybelog) */
export const postLink = (postId: string) => linkDaPublicacao(window.location.origin, postId);

export const PostCard: React.FC<PostCardProps> = ({ post, priority = false, position, total, highlightCommentId = null }) => {
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
  const [showAllComments, setShowAllComments] = useState(!!highlightCommentId);
  const [replyTo, setReplyTo] = useState<{ id: string; username: string } | null>(null);
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
  // Comentários em um nível de respostas (como no Instagram): principais e, embaixo, as respostas
  const principais = post.comments.filter(c => !c.parentId || !post.comments.some(p => p.id === c.parentId));
  const respostasDe = (id: string) => post.comments.filter(c => c.parentId === id);
  const visibleComments = showAllComments ? principais : principais.slice(-2);
  const isVideo = post.mediaType === 'video';

  // Destaque do comentário vindo de notificação: rola até ele
  useEffect(() => {
    if (!highlightCommentId) return;
    const t = setTimeout(() => document.getElementById('comentario-' + highlightCommentId)?.scrollIntoView({ block: 'center', behavior: 'smooth' }), 400);
    return () => clearTimeout(t);
  }, [highlightCommentId, post.comments.length]);
  const longCaption = post.content.length > CAPTION_PREVIEW_CHARS;

  const goTo = (index: number) => setActiveMediaIndex(Math.max(0, Math.min(mediaCount - 1, index)));

  // Dois toques na foto curtem (nunca descurtem), como no Instagram
  const handleMediaTap = () => {
    const now = Date.now();
    if (now - lastTapAt.current < 300) {
      if (!post.likedByCurrentUser) toggleLikePost(post.id);
      setHeartBurst(true);
      setTimeout(() => setHeartBurst(false), 900);
      lastTapAt.current = 0;
    } else {
      lastTapAt.current = now;
    }
  };

  const handleSendComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentInput.trim()) return;
    addComment(post.id, commentInput, replyTo?.id);
    setCommentInput('');
    setReplyTo(null);
  };

  const copyLink = () => {
    navigator.clipboard?.writeText(postLink(post.id)).catch(() => undefined);
    notify('Link da publicação copiado.');
    setShowMenu(false);
  };

  // Compartilhar: no celular abre o menu nativo (WhatsApp, Telegram...); no computador copia o link
  const sharePost = async () => {
    // leva a imagem do Vybelog e o código de convite de quem compartilha
    const url = comConvite(postLink(post.id), currentUser?.id ? await meuCodigo(currentUser.id) : null);
    const r = await compartilharComImagem({ titulo: `Publicação de @${post.user.username} no Vybelog`, texto: `Veja esta publicação de @${post.user.username} no Vybelog:`, url });
    if (r === 'copiado') notify('Link copiado.');
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
      className="border-b border-white/[0.06] sm:border sm:rounded-2xl sm:overflow-hidden sm:bg-white/[0.015]"
      aria-label={`Publicação de @${post.user.username}`}
      aria-posinset={position}
      aria-setsize={total}
    >

      {/* Cabeçalho */}
      <div className="pl-3 pr-1 py-2 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setSelectedProfileId(post.userId)}
          className="flex items-center gap-2.5 cursor-pointer group text-left min-w-0"
        >
          <img
            src={post.user.avatarUrl}
            alt=""
            className="w-9 h-9 shrink-0 rounded-full object-cover ring-1 ring-white/10"
          />
          <span className="min-w-0">
            <span className="flex items-center gap-1">
              <span className="font-semibold text-[14px] text-zinc-50 group-hover:text-white truncate">{post.user.username}</span>
              {post.user.isVerified && <BadgeCheck className="w-4 h-4 shrink-0 text-white fill-fuchsia-500" aria-label="Perfil verificado" />}
              <span className="text-[13px] text-zinc-500 shrink-0">· {post.createdAt}</span>
            </span>
            <span className="flex items-center gap-1 text-xs text-zinc-400 truncate">
              <span>{post.user.profileType === 'couple' ? 'Casal' : post.user.profileType === 'polyamorous' ? 'Poliamor' : post.user.profileType === 'joint_profile' ? 'Perfil conjunto' : 'Solteiro(a)'}</span>
              {(post.location || post.user.city) && <><span aria-hidden>·</span><span className="truncate">{post.location || post.user.city}</span></>}
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
            <div className="absolute right-0 top-11 w-52 bg-painel-alto border border-purple-800/50 rounded-2xl shadow-2xl py-1.5 z-20" role="menu">
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
          className="relative aspect-[4/5] w-full bg-black overflow-hidden group select-none"
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
            {isVideo ? (
              <video
                src={withFirstFrame(post.mediaUrls[0])}
                poster={posterOf(post.mediaUrls[0])}
                controls
                playsInline
                preload="metadata"
                className="w-full h-full object-contain bg-black shrink-0"
                aria-label={`Vídeo publicado por @${post.user.username}`}
                onClick={e => e.stopPropagation()}
              />
            ) : post.mediaUrls.map((url, i) => (
              <img
                key={i}
                src={feedVersionUrl(url) ?? url}
                // versão leve (810px) nas telas comuns; a original (1080px) nas telas grandes ou de alta densidade
                srcSet={feedVersionUrl(url) ? `${feedVersionUrl(url)} ${FEED_WIDTH}w, ${url} 1080w` : undefined}
                sizes={feedVersionUrl(url) ? '(max-width: 672px) 100vw, 640px' : undefined}
                onError={e => { const img = e.currentTarget; if (img.src !== url) { img.srcset = ''; img.src = url; } }}
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
            <span className="absolute inset-0 flex items-center justify-center pointer-events-none" aria-hidden>
              <svg viewBox="0 0 24 24" className="coracao-explode w-28 h-28 drop-shadow-[0_10px_30px_rgba(236,72,153,0.6)]">
                <defs>
                  <linearGradient id={`neon-${post.id}`} x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0" stopColor="#e879f9" /><stop offset="0.5" stopColor="#f472b6" /><stop offset="1" stopColor="#fb923c" />
                  </linearGradient>
                </defs>
                <path fill={`url(#neon-${post.id})`} d="M12 21s-7.5-4.6-9.6-9.2C.9 8.3 3 4.5 6.7 4.5c2 0 3.6 1.1 5.3 3 1.7-1.9 3.3-3 5.3-3 3.7 0 5.8 3.8 4.3 7.3C19.5 16.4 12 21 12 21z" />
              </svg>
              {[0, 45, 90, 135, 180, 225, 270, 315].map(a => (
                <span
                  key={a}
                  className="faisca absolute w-2 h-2 rounded-full"
                  style={{
                    background: a % 90 === 0 ? '#f472b6' : '#fb923c',
                    ['--dx' as string]: `${Math.round(Math.cos((a * Math.PI) / 180) * 90)}px`,
                    ['--dy' as string]: `${Math.round(Math.sin((a * Math.PI) / 180) * 90)}px`,
                  } as React.CSSProperties}
                />
              ))}
            </span>
          )}

          {mediaCount > 1 && (
            <>
              <span className="absolute top-3 right-3 px-2 py-0.5 rounded-full bg-black/55 backdrop-blur text-white text-xs font-semibold">
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
          <p className="text-[15px] text-zinc-100 leading-relaxed whitespace-pre-line"><TextoComMencoes texto={post.content} /></p>
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
                    {userPollVote && <span className="text-[12px] font-bold text-purple-300">{percent}% ({opt.votes})</span>}
                  </div>
                </button>
              );
            })}
          </div>
          <p className="text-[10px] text-zinc-500 mt-2 text-right">{totalPollVotes} {totalPollVotes === 1 ? 'voto' : 'votos'}</p>
        </div>
      )}

      {/* Ações (alvos de toque de 44px) */}
      <div className="relative px-1.5 pt-0.5 flex items-center justify-between">
        <div className="flex items-center">
          <button
            type="button"
            onClick={() => toggleLikePost(post.id)}
            className={`w-11 h-11 flex items-center justify-center cursor-pointer ${post.likedByCurrentUser ? 'text-pink-500' : 'text-zinc-100 hover:text-zinc-400'}`}
            aria-label={post.likedByCurrentUser ? 'Descurtir' : 'Curtir'}
            aria-pressed={post.likedByCurrentUser}
          >
            <Heart key={String(post.likedByCurrentUser)} className={`w-[26px] h-[26px] ${post.likedByCurrentUser ? 'fill-pink-500 curtida-pulo' : ''}`} strokeWidth={1.9} />
          </button>
          <button
            type="button"
            onClick={() => commentInputRef.current?.focus()}
            className="w-11 h-11 flex items-center justify-center text-zinc-100 hover:text-zinc-400 cursor-pointer"
            aria-label="Comentar"
          >
            <MessageCircle className="w-[26px] h-[26px] -scale-x-100" strokeWidth={1.9} />
          </button>
          <button type="button" onClick={sharePost} className="w-11 h-11 flex items-center justify-center text-zinc-100 hover:text-zinc-400 cursor-pointer" aria-label="Compartilhar">
            <Send className="w-[24px] h-[24px]" strokeWidth={1.9} />
          </button>
        </div>

        {mediaCount > 1 && (
          <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-1" aria-hidden="true">
            {post.mediaUrls.map((_, i) => (
              <span key={i} className={`h-1.5 rounded-full transition-all duration-300 ${i === activeMediaIndex ? 'w-4 fundo-neon' : 'w-1.5 bg-zinc-600'}`} />
            ))}
          </div>
        )}

        <button
          type="button"
          onClick={() => toggleSavePost(post.id)}
          className="w-11 h-11 flex items-center justify-center cursor-pointer text-zinc-100 hover:text-zinc-400"
          aria-label={post.savedByCurrentUser ? 'Remover dos salvos' : 'Salvar'}
          aria-pressed={post.savedByCurrentUser}
        >
          <Bookmark key={String(post.savedByCurrentUser)} className={`w-[25px] h-[25px] ${post.savedByCurrentUser ? 'fill-current curtida-pulo' : ''}`} strokeWidth={1.9} />
        </button>
      </div>

      <div className="px-3.5 pb-4 space-y-1">
        {post.likesCount > 0 ? (
          <p className="text-[14px] font-bold text-zinc-50">
            {post.likesCount.toLocaleString('pt-BR')} {post.likesCount === 1 ? 'curtida' : 'curtidas'}
          </p>
        ) : (
          <p className="text-[14px] text-zinc-400">Seja o primeiro a curtir</p>
        )}

        {/* Legenda (posts com foto) */}
        {hasMedia && post.content && (
          <p className="text-sm text-zinc-200 leading-snug whitespace-pre-line">
            <button type="button" onClick={() => setSelectedProfileId(post.userId)} className="font-bold text-zinc-100 mr-1.5 cursor-pointer">
              {post.user.username}
            </button>
            <TextoComMencoes texto={longCaption && !captionExpanded ? `${post.content.slice(0, CAPTION_PREVIEW_CHARS).trimEnd()}… ` : post.content} />
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
              <div key={c.id}>
                {[c, ...respostasDe(c.id)].map(item => (
                  <div key={item.id} id={`comentario-${item.id}`}
                    className={`${item.id !== c.id ? 'ml-6 mt-1 pl-3 border-l border-purple-900/40' : ''} ${highlightCommentId === item.id ? 'rounded-lg bg-fuchsia-500/10 ring-1 ring-fuchsia-500/40 px-2 py-1' : ''}`}>
                    <p className="text-sm text-zinc-300 leading-snug">
                      <button type="button" onClick={() => setSelectedProfileId(item.userId)} className="font-bold text-zinc-100 mr-1.5 cursor-pointer">
                        {item.username || item.userDisplayName}
                      </button>
                      <TextoComMencoes texto={item.content} />
                    </p>
                    <button type="button" onClick={() => {
                      setReplyTo({ id: c.id, username: item.username });
                      setCommentInput(item.userId !== currentUser.id && item.username ? `@${item.username} ` : '');
                      commentInputRef.current?.focus();
                    }} className="text-[12px] font-semibold text-zinc-500 hover:text-zinc-300 cursor-pointer">Responder</button>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}


        {replyTo && (
          <p className="flex items-center justify-between text-[12px] text-zinc-400 pt-1">
            <span>Respondendo a <b className="text-zinc-200">@{replyTo.username}</b></span>
            <button type="button" onClick={() => { setReplyTo(null); setCommentInput(''); }} className="text-zinc-500 hover:text-zinc-300 cursor-pointer">Cancelar</button>
          </p>
        )}
        <form onSubmit={handleSendComment} className="flex items-center gap-2 pt-1">
          <img src={currentUser.avatarUrl} alt="" className="w-6 h-6 rounded-full object-cover" />
          <input
            ref={commentInputRef}
            type="text"
            placeholder={replyTo ? 'Escreva sua resposta...' : 'Adicione um comentário...'}
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
