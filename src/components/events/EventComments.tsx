import React, { useEffect, useRef, useState } from 'react';
import { Send, Trash2, MessageCircle } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { EventComment, VybeEvent } from '../../types';
import { addEventComment, deleteEventComment, fetchEventComments } from '../../lib/events';
import { formatRelativeTime } from '../../lib/social';
import { notify, askConfirm } from '../common/Feedback';

const MAX_LENGTH = 1000;

// Comentários da arte do evento (qualquer membro comenta; o autor e o organizador apagam)
export const EventComments: React.FC<{ event: VybeEvent }> = ({ event }) => {
  const { currentUser, refreshEvents, setSelectedProfileId } = useApp();
  const [comments, setComments] = useState<EventComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const listEnd = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchEventComments(event.id).then(result => {
      if (cancelled) return;
      setComments(result.comments);
      setUnavailable(result.unavailable);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [event.id]);

  if (unavailable || event.status !== 'approved') return null;

  const isOrganizer = event.createdBy === currentUser.id;

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const content = text.trim();
    if (!content || sending) return;
    setSending(true);
    const { comment, error } = await addEventComment(currentUser.id, event.id, content);
    setSending(false);
    if (error || !comment) {
      notify('Não foi possível enviar o comentário. Tente novamente.', 'error');
      return;
    }
    setComments(prev => [...prev, comment]);
    setText('');
    refreshEvents();
    requestAnimationFrame(() => listEnd.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }));
  };

  const handleDelete = async (comment: EventComment) => {
    if (!(await askConfirm({ title: 'Apagar comentário?', message: 'O comentário sai do evento para todos.', confirmLabel: 'Apagar', danger: true }))) return;
    const error = await deleteEventComment(comment.id);
    if (error) {
      notify('Não foi possível apagar o comentário.', 'error');
      return;
    }
    setComments(prev => prev.filter(c => c.id !== comment.id));
    refreshEvents();
  };

  const openProfile = (userId: string) => setSelectedProfileId(userId === currentUser.id ? null : userId);

  return (
    <section className="pt-4 border-t border-purple-900/30 space-y-3">
      <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
        <MessageCircle className="w-4 h-4 text-fuchsia-400" />
        Comentários {comments.length > 0 && <span className="text-zinc-500 font-normal">({comments.length})</span>}
      </h3>

      <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
        {loading && <p className="text-xs text-zinc-500">Carregando comentários...</p>}
        {!loading && comments.length === 0 && (
          <p className="text-xs text-zinc-500">Ninguém comentou ainda. Tire uma dúvida ou diga se vai!</p>
        )}
        {comments.map(c => (
          <div key={c.id} className="flex items-start gap-2.5 group">
            <button type="button" onClick={() => openProfile(c.userId)} className="shrink-0 cursor-pointer" aria-label={`Abrir perfil de ${c.displayName}`}>
              <img src={c.avatarUrl} alt="" className="w-8 h-8 rounded-full object-cover" />
            </button>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-zinc-200 break-words">
                <button type="button" onClick={() => openProfile(c.userId)} className="font-bold text-white mr-1.5 cursor-pointer hover:underline">
                  {c.username || c.displayName}
                </button>
                {c.content}
              </p>
              <p className="text-[10px] text-zinc-500 mt-0.5">
                {formatRelativeTime(c.createdAt)}
                {c.userId === event.createdBy && <span className="ml-1.5 text-fuchsia-400 font-semibold">organizador</span>}
              </p>
            </div>
            {(c.userId === currentUser.id || isOrganizer) && (
              <button
                type="button"
                onClick={() => handleDelete(c)}
                className="p-1 text-zinc-600 hover:text-rose-400 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity cursor-pointer"
                aria-label="Apagar comentário"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        ))}
        <div ref={listEnd} />
      </div>

      <form onSubmit={handleSend} className="flex items-center gap-2">
        <img src={currentUser.avatarUrl} alt="" className="w-8 h-8 rounded-full object-cover shrink-0" />
        <input
          type="text"
          value={text}
          maxLength={MAX_LENGTH}
          enterKeyHint="send"
          onChange={e => setText(e.target.value)}
          placeholder="Adicione um comentário..."
          className="flex-1 min-w-0 px-3.5 py-2 bg-zinc-900 border border-zinc-800 rounded-full text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-purple-500"
        />
        <button
          type="submit"
          disabled={!text.trim() || sending}
          className="p-2 rounded-full text-fuchsia-400 hover:text-fuchsia-300 disabled:opacity-30 cursor-pointer"
          aria-label="Enviar comentário"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </section>
  );
};
