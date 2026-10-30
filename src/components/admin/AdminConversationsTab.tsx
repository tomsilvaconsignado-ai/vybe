import React, { useState } from 'react';
import { Lock, Search, X, MessageSquare, ShieldAlert } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { adminListConversations, adminReadConversation, AdminConversationSummary, EvidenceMessage } from '../../lib/admin';
import { AdminThumb } from './AdminImageViewer';

// Todas as conversas da plataforma (somente superadmin com MFA). A justificativa digitada
// vale para a sessão desta aba e acompanha cada registro na auditoria.
export const AdminConversationsTab: React.FC = () => {
  const { adminRole } = useApp();
  const [justification, setJustification] = useState('');
  const [unlocked, setUnlocked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [conversations, setConversations] = useState<AdminConversationSummary[]>([]);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState<AdminConversationSummary | null>(null);
  const [messages, setMessages] = useState<EvidenceMessage[]>([]);
  const [reading, setReading] = useState(false);

  if (adminRole !== 'superadmin') {
    return (
      <div className="p-8 text-center text-xs text-zinc-400 bg-zinc-950/60 border border-zinc-800 rounded-2xl">
        <Lock className="w-6 h-6 mx-auto mb-2 text-zinc-500" />
        Somente o superadministrador pode acessar as conversas dos usuários.
      </div>
    );
  }

  const load = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    const result = await adminListConversations(justification.trim());
    setLoading(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setConversations(result.conversations);
    setUnlocked(true);
  };

  const openConversation = async (conversation: AdminConversationSummary) => {
    setOpen(conversation);
    setMessages([]);
    setReading(true);
    const result = await adminReadConversation(conversation.id, justification.trim());
    setReading(false);
    if (result.error) {
      setError(result.error);
      setOpen(null);
      return;
    }
    setMessages(result.messages);
  };

  const term = query.trim().toLowerCase();
  const visible = term
    ? conversations.filter(c => c.participants.some(p => p.username.toLowerCase().includes(term) || p.displayName.toLowerCase().includes(term)))
    : conversations;

  const names = (c: AdminConversationSummary) => c.participants.map(p => p.displayName).join(' ↔ ') || 'Participantes removidos';

  if (!unlocked) {
    return (
      <form onSubmit={load} className="max-w-lg mx-auto p-6 bg-zinc-950/60 border border-amber-800/40 rounded-2xl space-y-4">
        <div className="flex items-start gap-3">
          <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-white">Acesso às conversas privadas</h3>
            <p className="text-xs text-zinc-400">
              Informe o motivo do acesso. Ele fica registrado no livro de auditoria junto com cada conversa aberta.
            </p>
          </div>
        </div>
        <textarea
          rows={2}
          value={justification}
          onChange={e => setJustification(e.target.value)}
          placeholder="Ex.: verificação de denúncia recebida por e-mail sobre assédio"
          className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500"
        />
        {error && <p className="text-xs text-rose-400">{error}</p>}
        <button
          type="submit"
          disabled={justification.trim().length < 10 || loading}
          className="w-full py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold disabled:opacity-40 cursor-pointer"
        >
          {loading ? 'Carregando...' : 'Registrar acesso e ver conversas'}
        </button>
      </form>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
        <p className="text-xs text-zinc-400">
          {conversations.length} conversas · motivo registrado: <span className="text-amber-300">{justification}</span>
        </p>
        <div className="relative sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input
            type="search"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Filtrar por nome ou @usuário"
            className="w-full pl-9 pr-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-white focus:outline-none"
          />
        </div>
      </div>
      {error && <p className="text-xs text-rose-400">{error}</p>}

      <div className="divide-y divide-zinc-800/60 bg-zinc-950/60 border border-purple-900/30 rounded-2xl">
        {visible.length === 0 && <p className="p-6 text-center text-xs text-zinc-500">Nenhuma conversa encontrada.</p>}
        {visible.map(c => (
          <button
            key={c.id}
            type="button"
            onClick={() => openConversation(c)}
            className="w-full flex items-center gap-3 p-3 text-left hover:bg-purple-950/30 cursor-pointer"
          >
            <div className="flex -space-x-3 shrink-0">
              {c.participants.slice(0, 2).map(p => (
                <img key={p.id} src={p.avatarUrl} alt="" className="w-9 h-9 rounded-full object-cover border-2 border-[#120d20]" />
              ))}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-white truncate">{names(c)}</p>
              <p className="text-[11px] text-zinc-500 truncate">
                {c.participants.map(p => `@${p.username}`).join(' · ')}
              </p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-[11px] text-zinc-300 flex items-center gap-1 justify-end">
                <MessageSquare className="w-3 h-3" /> {c.messageCount}
              </p>
              <p className="text-[10px] text-zinc-500">{c.lastMessageAt}</p>
              {c.isPending && <span className="text-[9px] px-1.5 rounded bg-amber-950 text-amber-400">pedido</span>}
            </div>
          </button>
        ))}
      </div>

      {open && (
        <div className="fixed inset-0 z-[60] bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4">
          <div className="w-full max-w-2xl bg-[#120d20] border border-purple-800/40 rounded-3xl shadow-2xl flex flex-col max-h-[90vh]">
            <div className="flex items-center gap-3 p-4 border-b border-purple-900/30">
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-bold text-white truncate">{names(open)}</h3>
                <p className="text-[11px] text-amber-300/80">Acesso registrado na auditoria</p>
              </div>
              <button type="button" onClick={() => setOpen(null)} className="p-1 text-zinc-400 hover:text-white cursor-pointer" aria-label="Fechar">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
              {reading && <p className="text-center text-xs text-zinc-500 py-6">Carregando mensagens...</p>}
              {!reading && messages.length === 0 && <p className="text-center text-xs text-zinc-500 py-6">Conversa sem mensagens.</p>}
              {messages.map(m => {
                const isFirst = m.senderId === open.participants[0]?.id;
                return (
                  <div key={m.id} className={`flex ${isFirst ? 'justify-start' : 'justify-end'}`}>
                    <div className={`max-w-[80%] rounded-2xl px-3 py-2 space-y-1.5 ${isFirst ? 'bg-zinc-800 text-zinc-100' : 'bg-purple-800/70 text-white'}`}>
                      <p className="text-[10px] font-bold opacity-70">{m.senderName}</p>
                      {m.mediaUrl && (
                        <AdminThumb src={m.mediaUrl} label={`Mídia enviada por ${m.senderName}`} className="max-h-48 rounded-xl object-cover" />
                      )}
                      {m.content && <p className="text-xs whitespace-pre-wrap break-words">{m.content}</p>}
                      <p className="text-[9px] opacity-60 text-right">{m.createdAt}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
