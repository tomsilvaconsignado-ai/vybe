import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { 
  Heart, 
  MessageCircle, 
  Bookmark, 
  Share2, 
  MoreHorizontal, 
  ShieldAlert, 
  Send, 
  Sparkles,
  ChevronLeft,
  ChevronRight,
  MapPin,
  CheckCircle2,
  Trash2
} from 'lucide-react';
import { Post } from '../../types';

interface PostCardProps {
  post: Post;
}

export const PostCard: React.FC<PostCardProps> = ({ post }) => {
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
  const [showComments, setShowComments] = useState(false);
  const [commentInput, setCommentInput] = useState('');
  const [showMenu, setShowMenu] = useState(false);

  const isOwner = currentUser?.id ? post.userId === currentUser.id : false;
  const totalPollVotes = post.poll?.options?.reduce((acc, opt) => acc + opt.votes, 0) || 0;
  const userPollVote = (currentUser?.id && post.poll?.voterIds) ? post.poll.voterIds[currentUser.id] : undefined;

  const handleSendComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentInput.trim()) return;
    addComment(post.id, commentInput);
    setCommentInput('');
    setShowComments(true);
  };

  return (
    <article className="bg-[#120d20] border border-purple-900/30 rounded-3xl overflow-hidden shadow-xl mb-6 transition-all hover:border-purple-800/50">
      
      {/* Post Author Header */}
      <div className="p-4 flex items-center justify-between">
        <div 
          onClick={() => setSelectedProfileId(post.userId)}
          className="flex items-center gap-3 cursor-pointer group"
        >
          <div className="relative">
            <img
              src={post.user.avatarUrl}
              alt={post.user.displayName}
              className="w-10 h-10 rounded-full object-cover border border-purple-500/50 group-hover:scale-105 transition-transform"
            />
            {post.user.isVerified && (
              <span className="absolute -bottom-1 -right-1 w-4 h-4 bg-purple-500 rounded-full flex items-center justify-center text-[10px] text-white">
                ✓
              </span>
            )}
          </div>

          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-sm text-zinc-100 group-hover:text-purple-300 transition-colors">
                {post.user.displayName}
              </span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-950 text-purple-300 border border-purple-800/40 capitalize">
                {post.user.profileType === 'couple' ? 'Casal' : 'Solteiro(a)'}
              </span>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-zinc-400">
              <span>@{post.user.username}</span>
              <span>•</span>
              <span>{post.createdAt}</span>
              {post.location && (
                <>
                  <span>•</span>
                  <span className="flex items-center gap-0.5 text-zinc-400">
                    <MapPin className="w-2.5 h-2.5" />
                    {post.location}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Options dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="p-2 text-zinc-400 hover:text-white rounded-full hover:bg-zinc-800/60 transition-colors cursor-pointer"
          >
            <MoreHorizontal className="w-5 h-5" />
          </button>

          {showMenu && (
            <div className="absolute right-0 top-10 w-44 bg-[#19112a] border border-purple-800/50 rounded-2xl shadow-2xl py-1.5 z-20">
              {isOwner ? (
                <button
                  onClick={() => {
                    deletePost(post.id);
                    setShowMenu(false);
                  }}
                  className="w-full px-3 py-2 text-left text-xs text-rose-400 hover:bg-rose-950/40 flex items-center gap-2 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Excluir publicação
                </button>
              ) : (
                <button
                  onClick={() => {
                    setReportModalTarget({
                      targetType: 'post',
                      targetId: post.id,
                      reportedUserName: post.user.username
                    });
                    setShowMenu(false);
                  }}
                  className="w-full px-3 py-2 text-left text-xs text-rose-400 hover:bg-rose-950/40 flex items-center gap-2 cursor-pointer"
                >
                  <ShieldAlert className="w-3.5 h-3.5" />
                  Denunciar publicação
                </button>
              )}
              <button
                onClick={() => {
                  navigator.clipboard?.writeText(window.location.href);
                  alert('Link do post copiado!');
                  setShowMenu(false);
                }}
                className="w-full px-3 py-2 text-left text-xs text-zinc-300 hover:bg-purple-950/50 flex items-center gap-2 cursor-pointer"
              >
                <Share2 className="w-3.5 h-3.5" />
                Copiar link seguro
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Post Text Content */}
      <div className="px-4 pb-3">
        <p className="text-sm text-zinc-200 leading-relaxed whitespace-pre-line">
          {post.content}
        </p>

        {/* Tags */}
        {post.tags && post.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2.5">
            {post.tags.map(tag => (
              <span key={tag} className="text-xs text-fuchsia-400 hover:text-fuchsia-300 cursor-pointer">
                #{tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Media Carousel */}
      {post.mediaUrls && post.mediaUrls.length > 0 && (
        <div className="relative aspect-[4/3] sm:aspect-[16/10] bg-black overflow-hidden group">
          <img
            src={post.mediaUrls[activeMediaIndex]}
            alt="Mídia da publicação"
            className="w-full h-full object-cover select-none"
          />

          {/* Carousel arrows */}
          {post.mediaUrls.length > 1 && (
            <>
              <button
                onClick={() => setActiveMediaIndex(prev => (prev === 0 ? post.mediaUrls.length - 1 : prev - 1))}
                className="absolute left-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/60 text-white hover:bg-black/80 transition-all opacity-0 group-hover:opacity-100 cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setActiveMediaIndex(prev => (prev === post.mediaUrls.length - 1 ? 0 : prev + 1))}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/60 text-white hover:bg-black/80 transition-all opacity-0 group-hover:opacity-100 cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>

              {/* Dots */}
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 bg-black/50 px-2 py-1 rounded-full backdrop-blur-md">
                {post.mediaUrls.map((_, i) => (
                  <span
                    key={i}
                    className={`w-2 h-2 rounded-full transition-all ${
                      i === activeMediaIndex ? 'bg-fuchsia-400 w-4' : 'bg-white/40'
                    }`}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* Interactive Poll */}
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
                  onClick={() => votePoll(post.id, opt.id)}
                  disabled={!!userPollVote}
                  className={`w-full relative overflow-hidden rounded-xl p-2.5 text-left border text-xs transition-all cursor-pointer ${
                    isSelected 
                      ? 'border-fuchsia-500 bg-fuchsia-950/30 text-white font-semibold' 
                      : 'border-zinc-800 bg-zinc-900/40 text-zinc-300 hover:border-purple-800/50'
                  }`}
                >
                  {/* Progress background bar */}
                  {userPollVote && (
                    <div
                      className="absolute left-0 top-0 bottom-0 bg-purple-600/25 transition-all duration-500"
                      style={{ width: `${percent}%` }}
                    />
                  )}

                  <div className="relative z-10 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-fuchsia-400" />}
                      {opt.text}
                    </span>
                    {userPollVote && (
                      <span className="text-[11px] font-bold text-purple-300">
                        {percent}% ({opt.votes})
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
          <p className="text-[10px] text-zinc-500 mt-2 text-right">
            {totalPollVotes} votos anônimos contabilizados
          </p>
        </div>
      )}

      {/* Action Bar (Like, Comment, Save, Share) */}
      <div className="p-4 flex items-center justify-between border-t border-purple-950/40">
        <div className="flex items-center gap-4">
          <button
            onClick={() => toggleLikePost(post.id)}
            className={`flex items-center gap-1.5 text-xs font-semibold transition-colors cursor-pointer ${
              post.likedByCurrentUser ? 'text-rose-400' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Heart className={`w-5 h-5 ${post.likedByCurrentUser ? 'fill-rose-500 text-rose-500' : ''}`} />
            <span>{post.likesCount}</span>
          </button>

          <button
            onClick={() => setShowComments(!showComments)}
            className="flex items-center gap-1.5 text-xs font-semibold text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
          >
            <MessageCircle className="w-5 h-5" />
            <span>{post.commentsCount}</span>
          </button>

          <button
            onClick={() => {
              navigator.clipboard?.writeText(window.location.href);
              alert('Publicação compartilhada para a sua área de transferência!');
            }}
            className="text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
            title="Compartilhar"
          >
            <Share2 className="w-5 h-5" />
          </button>
        </div>

        <button
          onClick={() => toggleSavePost(post.id)}
          className={`text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer ${
            post.savedByCurrentUser ? 'text-fuchsia-400' : ''
          }`}
          title="Salvar nos Favoritos"
        >
          <Bookmark className={`w-5 h-5 ${post.savedByCurrentUser ? 'fill-fuchsia-500 text-fuchsia-500' : ''}`} />
        </button>
      </div>

      {/* Comments Drawer */}
      {showComments && (
        <div className="bg-[#0e091a] border-t border-purple-950/40 p-4 space-y-3">
          {post.comments && post.comments.length > 0 ? (
            <div className="space-y-3 max-h-48 overflow-y-auto pr-1">
              {post.comments.map(c => (
                <div key={c.id} className="flex items-start gap-2.5 text-xs">
                  <img
                    src={c.userAvatar}
                    alt={c.userDisplayName}
                    className="w-7 h-7 rounded-full object-cover shrink-0 border border-purple-500/30"
                  />
                  <div className="flex-1 bg-zinc-900/60 p-2.5 rounded-2xl border border-zinc-800">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-zinc-200">{c.userDisplayName}</span>
                      <span className="text-[10px] text-zinc-400">{c.createdAt}</span>
                    </div>
                    <p className="text-zinc-300">{c.content}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-zinc-400 text-center py-2">
              Seja a primeira pessoa a comentar com respeito e boa energia!
            </p>
          )}

          {/* Comment form */}
          <form onSubmit={handleSendComment} className="flex items-center gap-2 pt-1">
            <input
              type="text"
              placeholder="Adicionar um comentário elegante..."
              value={commentInput}
              onChange={e => setCommentInput(e.target.value)}
              className="flex-1 px-3.5 py-2 bg-zinc-900/90 border border-purple-900/40 rounded-full text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-purple-500"
            />
            <button
              type="submit"
              disabled={!commentInput.trim()}
              className="p-2 rounded-full bg-purple-600 hover:bg-purple-500 text-white disabled:opacity-40 transition-colors cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      )}

    </article>
  );
};
