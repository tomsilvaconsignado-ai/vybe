import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useApp } from '../../context/AppContext';
import {
  MessageSquare,
  Send,
  ShieldAlert,
  Lock,
  Check,
  CheckCheck,
  ChevronLeft,
  Ban,
  Smile,
  X,
  Loader2,
  Search,
  Plus,
  EyeOff,
  Eye
} from 'lucide-react';
import { ChatMessage } from '../../types';
import { askConfirm, notify } from '../common/Feedback';
import { OnlineDot, activityLabel } from '../common/OnlineDot';
import { EmojiPicker, isEmojiOnly } from '../common/EmojiPicker';
import { CHAT_MEDIA_ACCEPT, uploadChatMedia, searchMyMessages, type MessageSearchHit } from '../../lib/messaging';
import { useEstadoSalvo } from '../../lib/estadoSalvo';
import { GravadorDeAudio, MidiaDaMensagem, tipoDaMidia, useAlturaVisivel, useDigitando } from './ChatExtras';

/** Celular (abaixo de md): a conversa aberta ocupa a tela inteira */
function useCelular() {
  const consulta = '(max-width: 767px)';
  const [celular, setCelular] = useState(() => typeof window !== 'undefined' && window.matchMedia(consulta).matches);
  useEffect(() => {
    const m = window.matchMedia(consulta);
    const mudou = () => setCelular(m.matches);
    m.addEventListener('change', mudou);
    return () => m.removeEventListener('change', mudou);
  }, []);
  return celular;
}

const STATUS_LABEL: Record<string, string> = { read: 'Visualizada', delivered: 'Entregue', sent: 'Enviada' };

const Confirmacao: React.FC<{ status: ChatMessage['status']; claro?: boolean }> = ({ status, claro }) =>
  status === 'read'
    ? <CheckCheck className={`w-3.5 h-3.5 ${claro ? 'text-sky-200' : 'text-fuchsia-400'}`} aria-label="Visualizada" />
    : status === 'delivered'
      ? <CheckCheck className={`w-3.5 h-3.5 ${claro ? 'text-white/60' : 'text-zinc-500'}`} aria-label="Entregue" />
      : <Check className={`w-3.5 h-3.5 ${claro ? 'text-white/60' : 'text-zinc-500'}`} aria-label="Enviada" />;

export const MessagesView: React.FC = () => {
  const {
    conversations,
    selectedConversationId,
    setSelectedConversationId,
    currentUser,
    sendMessage,
    acceptMessageRequest,
    rejectMessageRequest,
    setReportModalTarget,
    setSelectedProfileId,
    conversationMessages,
    loadConversationMessages,
    blockUser,
    isOnline,
    canSeeActivity
  } = useApp();

  const [inputText, setInputText] = useState('');
  const [activeTab, setActiveTab] = useEstadoSalvo<'chats' | 'requests'>('mensagens.aba', 'chats');
  const [discreetBlur, setDiscreetBlur] = useState(false);
  const celular = useCelular();

  // Pedidos que EU recebi ficam em "Solicitações"; os que eu enviei aparecem nas conversas como "aguardando"
  const isIncomingRequest = (c: { isPendingRequest: boolean; createdBy?: string }) =>
    c.isPendingRequest && c.createdBy !== currentUser.id;
  const activeConversations = conversations.filter(c => !isIncomingRequest(c));
  const pendingRequests = conversations.filter(isIncomingRequest);

  const activeConv = conversations.find(c => c.id === selectedConversationId) || (activeTab === 'chats' ? activeConversations[0] : pendingRequests[0]);
  const otherParticipant = activeConv?.participants[0];
  const messages = activeConv ? conversationMessages[activeConv.id] ?? [] : [];
  const awaitingMyAcceptance = activeConv ? isIncomingRequest(activeConv) : false;
  const awaitingTheirAcceptance = Boolean(activeConv?.isPendingRequest && !awaitingMyAcceptance);
  // O pedido de conversa aceita só a mensagem de apresentação; depois dela, aguarda o aceite
  const introAlreadySent = awaitingTheirAcceptance && messages.some(m => m.senderId === currentUser.id);
  const inputLocked = awaitingMyAcceptance || introAlreadySent;

  // Conversa em tela cheia no celular (sem a barra de navegação), acompanhando o teclado
  const telaCheia = celular && Boolean(selectedConversationId && activeConv);
  const alturaVisivel = useAlturaVisivel(telaCheia);
  // no celular a conversa é desenhada direto no <body>: nenhuma camada da página (cabeçalho, menu) fica por cima
  const emTelaCheia = (n: React.ReactElement) => (telaCheia ? createPortal(n, document.body) : n);
  useEffect(() => {
    if (!telaCheia) return;
    const antes = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = antes; };
  }, [telaCheia]);

  const [isSending, setIsSending] = useState(false);
  const [gravando, setGravando] = useState(false);
  const { outroDigitando, avisarDigitando, avisarParou } = useDigitando(activeConv?.id ?? null, currentUser.id);
  const [busca, setBusca] = useState('');
  const [achados, setAchados] = useState<MessageSearchHit[]>([]);
  useEffect(() => {
    if (busca.trim().length < 2) { setAchados([]); return; }
    const t = setTimeout(() => searchMyMessages(busca).then(setAchados), 300);
    return () => clearTimeout(t);
  }, [busca]);
  const nomeBate = (c: typeof conversations[number]) => {
    const q = busca.trim().toLowerCase();
    return !q || c.participants.some(p => p.displayName.toLowerCase().includes(q) || p.username.toLowerCase().includes(q));
  };
  const resumoMidia = (url?: string) => !url ? '' : tipoDaMidia(url) === 'audio' ? '🎤 Áudio' : tipoDaMidia(url) === 'video' ? '🎬 Vídeo' : '📷 Foto';
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [showEmoji, setShowEmoji] = useState(false);
  const [attachment, setAttachment] = useState<{ file: File; preview: string } | null>(null);
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);
  // Fotos, vídeos e áudios só depois que a conversa for aceita (o pedido aceita só a apresentação em texto)
  const mediaLocked = inputLocked || Boolean(activeConv?.isPendingRequest);

  const clearAttachment = () => {
    setAttachment(prev => {
      if (prev) URL.revokeObjectURL(prev.preview);
      return null;
    });
    if (fileRef.current) fileRef.current.value = '';
  };

  // Troca de conversa descarta o anexo ainda não enviado
  useEffect(() => {
    clearAttachment();
    setShowEmoji(false);
  }, [activeConv?.id]);

  // Campo cresce com o texto (até ~5 linhas) e volta ao tamanho de uma linha depois do envio
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, [inputText]);

  const handlePickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!CHAT_MEDIA_ACCEPT.split(',').includes(file.type)) {
      notify('Envie uma foto (JPG, PNG, WebP), GIF ou vídeo (MP4/MOV).');
      e.target.value = '';
      return;
    }
    clearAttachment();
    setAttachment({ file, preview: URL.createObjectURL(file) });
  };

  const insertEmoji = (emoji: string) => {
    const el = inputRef.current;
    const start = el?.selectionStart ?? inputText.length;
    const end = el?.selectionEnd ?? inputText.length;
    setInputText(inputText.slice(0, start) + emoji + inputText.slice(end));
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(start + emoji.length, start + emoji.length);
    });
  };

  useEffect(() => {
    if (activeConv) loadConversationMessages(activeConv.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeConv?.id]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages.length, activeConv?.id, outroDigitando, alturaVisivel]);

  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if ((!inputText.trim() && !attachment) || !activeConv || isSending) return;
    setIsSending(true);
    let mediaPath: string | undefined;
    if (attachment) {
      const { path, error } = await uploadChatMedia(activeConv.id, currentUser.id, attachment.file);
      if (error || !path) {
        notify(error ?? 'Não foi possível enviar o arquivo.');
        setIsSending(false);
        return;
      }
      mediaPath = path;
    }
    await sendMessage(activeConv.id, inputText, mediaPath);
    avisarParou();
    setIsSending(false);
    setInputText('');
    clearAttachment();
    setShowEmoji(false);
    inputRef.current?.focus();
  };

  const enviarAudio = async (arquivo: File) => {
    if (!activeConv) return;
    setIsSending(true);
    const { path, error } = await uploadChatMedia(activeConv.id, currentUser.id, arquivo);
    if (error || !path) notify(error ?? 'Não foi possível enviar o áudio.');
    else await sendMessage(activeConv.id, '', path);
    setIsSending(false);
  };

  // Enter envia; Shift+Enter quebra a linha (no celular, o botão Enviar do teclado também envia)
  const aoTeclar = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing && !celular) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const temConteudo = Boolean(inputText.trim() || attachment);
  const ultimaMinha = [...messages].reverse().find(m => m.senderId === currentUser.id)?.id;

  const ItemConversa: React.FC<{ conv: typeof conversations[number]; pedido?: boolean }> = ({ conv, pedido }) => {
    const part = conv.participants[0];
    const isSelected = conv.id === activeConv?.id && Boolean(selectedConversationId);
    const naoLidas = conv.unreadCount > 0;
    return (
      <button
        type="button"
        onClick={() => setSelectedConversationId(conv.id)}
        className={`w-full text-left px-4 py-3 flex items-center gap-3 cursor-pointer transition-colors ${isSelected ? 'bg-purple-950/50' : 'hover:bg-zinc-900/50 active:bg-zinc-900/70'}`}
      >
        <div className="relative shrink-0">
          <img src={part.avatarUrl} alt="" className="w-12 h-12 rounded-full object-cover bg-zinc-800" />
          <OnlineDot userId={part.id} className="bottom-0 right-0" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h4 className={`text-sm truncate ${naoLidas ? 'font-extrabold text-white' : 'font-semibold text-zinc-100'}`}>
              {part.displayName}{part.isVerified && <span className="text-purple-400 text-xs ml-1">✓</span>}
            </h4>
            {pedido
              ? <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-950 text-rose-300 shrink-0">Nova</span>
              : <span className={`text-[10px] shrink-0 ${naoLidas ? 'text-fuchsia-300 font-bold' : 'text-zinc-500'}`}>{conv.lastMessage?.createdAt || ''}</span>}
          </div>
          <div className="flex items-center justify-between gap-2 mt-0.5">
            <p className={`text-xs truncate ${naoLidas ? 'text-zinc-200 font-medium' : 'text-zinc-500'}`}>
              {conv.lastMessage?.content || resumoMidia(conv.lastMessage?.mediaUrl) || (pedido ? 'Solicitou mensagem' : 'Iniciar conversa...')}
            </p>
            {naoLidas && (
              <span className="min-w-5 h-5 px-1.5 rounded-full bg-fuchsia-600 text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                {conv.unreadCount}
              </span>
            )}
          </div>
        </div>
      </button>
    );
  };

  const listaVisivel = activeTab === 'chats' ? activeConversations.filter(nomeBate) : pendingRequests.filter(nomeBate);

  return (
    <div className="max-w-6xl mx-auto md:py-6 md:px-4">
      <div className="bg-[#120d20] md:border border-purple-900/30 md:rounded-3xl overflow-hidden shadow-2xl h-[calc(100dvh-9.6rem-env(safe-area-inset-top)-env(safe-area-inset-bottom))] md:h-[78vh] flex flex-col md:flex-row">

        {/* Lista de conversas */}
        <div className={`w-full md:w-80 shrink-0 md:border-r border-purple-900/30 flex flex-col bg-[#0e0918] min-h-0 ${selectedConversationId ? 'hidden md:flex' : 'flex'}`}>
          <div className="px-4 pt-4 pb-3 space-y-3">
            <h2 className="text-2xl font-extrabold text-white">Mensagens</h2>
            <label className="flex items-center gap-2 px-3.5 h-10 rounded-full bg-zinc-900/80 border border-purple-900/30 focus-within:border-purple-500">
              <Search className="w-4 h-4 text-zinc-500 shrink-0" />
              <input
                type="search"
                value={busca}
                onChange={e => setBusca(e.target.value)}
                placeholder="Buscar pessoas ou mensagens"
                aria-label="Buscar nas conversas"
                className="flex-1 min-w-0 bg-transparent text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none"
              />
            </label>
            {achados.length > 0 && (
              <ul className="max-h-56 overflow-y-auto rounded-2xl border border-purple-900/30 divide-y divide-purple-950/30 bg-zinc-950/50">
                {achados.map(h => {
                  const conv = conversations.find(c => c.id === h.conversation_id);
                  return (
                    <li key={h.message_id}>
                      <button type="button" onClick={() => { setSelectedConversationId(h.conversation_id); setBusca(''); }} className="w-full text-left px-3.5 py-2.5 hover:bg-zinc-900/60 cursor-pointer">
                        <p className="text-xs font-bold text-zinc-200">{conv?.participants[0]?.displayName ?? 'Conversa'}</p>
                        <p className="text-xs text-zinc-400 truncate">{h.content}</p>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
            <div className="flex bg-zinc-900/80 p-1 rounded-full" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'chats'}
                onClick={() => setActiveTab('chats')}
                className={`flex-1 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${activeTab === 'chats' ? 'bg-purple-600 text-white shadow' : 'text-zinc-400 hover:text-white'}`}
              >
                Conversas ({activeConversations.length})
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'requests'}
                onClick={() => setActiveTab('requests')}
                className={`flex-1 py-1.5 rounded-full text-xs font-bold transition-all relative cursor-pointer ${activeTab === 'requests' ? 'bg-purple-600 text-white shadow' : 'text-zinc-400 hover:text-white'}`}
              >
                Solicitações ({pendingRequests.length})
                {pendingRequests.length > 0 && <span className="w-2 h-2 rounded-full bg-rose-500 absolute top-1.5 right-3" />}
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {listaVisivel.length > 0 ? (
              listaVisivel.map(conv => <ItemConversa key={conv.id} conv={conv} pedido={activeTab === 'requests'} />)
            ) : (
              <div className="p-8 text-center text-xs text-zinc-500">
                {busca ? 'Nenhuma conversa encontrada.' : activeTab === 'chats' ? 'Nenhuma conversa ativa no momento.' : 'Nenhuma solicitação pendente. Seu inbox está protegido contra spam.'}
              </div>
            )}
          </div>
        </div>

        {/* Conversa aberta: no celular vira tela cheia por cima de tudo */}
        {activeConv && otherParticipant ? emTelaCheia(
          <div
            className={`flex-1 min-w-0 min-h-0 flex flex-col bg-[#120d20] ${selectedConversationId ? 'flex' : 'hidden md:flex'} ${telaCheia ? 'fixed inset-x-0 top-0 z-[45]' : ''}`}
            style={telaCheia ? { height: alturaVisivel ? `${alturaVisivel}px` : '100dvh' } : undefined}
          >
            {/* Cabeçalho */}
            <div className="shrink-0 px-2 sm:px-4 py-2.5 border-b border-purple-900/30 flex items-center gap-1 bg-[#150e24]" style={telaCheia ? { paddingTop: 'max(0.625rem, env(safe-area-inset-top))' } : undefined}>
              <button
                type="button"
                onClick={() => setSelectedConversationId(null)}
                className="md:hidden w-10 h-10 shrink-0 rounded-full text-zinc-300 hover:text-white flex items-center justify-center cursor-pointer"
                aria-label="Voltar para as conversas"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>

              <button type="button" onClick={() => setSelectedProfileId(otherParticipant.id)} className="flex-1 min-w-0 flex items-center gap-2.5 text-left cursor-pointer group">
                <div className="relative shrink-0">
                  <img src={otherParticipant.avatarUrl} alt="" className="w-10 h-10 rounded-full object-cover bg-zinc-800" />
                  <OnlineDot userId={otherParticipant.id} className="bottom-0 right-0" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-white truncate group-hover:text-purple-300 transition-colors">
                    {otherParticipant.displayName}{otherParticipant.isVerified && <span className="text-purple-400 text-xs ml-1">✓</span>}
                  </h3>
                  <p className="text-[12px] text-zinc-400 truncate">
                    {outroDigitando ? (
                      <span className="text-fuchsia-300 font-semibold">digitando…</span>
                    ) : isOnline(otherParticipant.id) ? (
                      <span className="text-emerald-400 font-semibold">Online agora</span>
                    ) : otherParticipant.lastActive && canSeeActivity({}) ? (
                      activityLabel(otherParticipant.lastActive)
                    ) : `@${otherParticipant.username}`}
                  </p>
                </div>
              </button>

              <div className="flex items-center shrink-0">
                <button
                  type="button"
                  onClick={() => setDiscreetBlur(!discreetBlur)}
                  className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors cursor-pointer ${discreetBlur ? 'text-fuchsia-300 bg-purple-950' : 'text-zinc-400 hover:text-white hover:bg-zinc-800'}`}
                  title="Modo discreto: desfoca as mensagens na tela"
                  aria-label={discreetBlur ? 'Desligar modo discreto' : 'Ligar modo discreto'}
                  aria-pressed={discreetBlur}
                >
                  {discreetBlur ? <EyeOff className="w-[18px] h-[18px]" /> : <Eye className="w-[18px] h-[18px]" />}
                </button>
                <button
                  type="button"
                  onClick={() => setReportModalTarget({
                    targetType: 'message',
                    targetId: activeConv.id,
                    reportedUserId: otherParticipant.id,
                    reportedUserName: otherParticipant.username
                  })}
                  className="w-10 h-10 rounded-full text-zinc-400 hover:text-rose-400 hover:bg-zinc-800 flex items-center justify-center transition-colors cursor-pointer"
                  title="Denunciar conversa"
                  aria-label="Denunciar conversa"
                >
                  <ShieldAlert className="w-[18px] h-[18px]" />
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    if (await askConfirm({ title: `Bloquear ${otherParticipant.displayName}?`, message: 'A pessoa não poderá mais enviar mensagens nem ver seu perfil. A conversa continua guardada caso você queira denunciá-la depois.', confirmLabel: 'Bloquear', danger: true })) {
                      await blockUser(otherParticipant.id);
                    }
                  }}
                  className="w-10 h-10 rounded-full text-zinc-400 hover:text-rose-400 hover:bg-zinc-800 flex items-center justify-center transition-colors cursor-pointer"
                  title="Bloquear pessoa"
                  aria-label="Bloquear pessoa"
                >
                  <Ban className="w-[18px] h-[18px]" />
                </button>
              </div>
            </div>

            {awaitingTheirAcceptance && (
              <div className="shrink-0 px-4 py-2.5 bg-purple-950/40 border-b border-purple-800/40 text-xs text-purple-200 flex items-start gap-2">
                <Lock className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
                <span>
                  <strong>Aguardando aceite:</strong> você pode enviar uma única mensagem de apresentação em texto. Novas mensagens, mídias e respostas são liberadas quando {otherParticipant.displayName} aceitar.
                </span>
              </div>
            )}

            {awaitingMyAcceptance && (
              <div className="shrink-0 px-4 py-3 bg-amber-950/40 border-b border-amber-800/40 space-y-2.5">
                <p className="text-xs text-amber-200 flex items-start gap-2">
                  <Lock className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <span><strong>Solicitação de mensagem:</strong> aceite para liberar a conversa e o envio de mídias.</span>
                </p>
                <div className="flex gap-2">
                  <button type="button" onClick={() => rejectMessageRequest(activeConv.id)} className="flex-1 py-2 rounded-full text-xs font-semibold text-zinc-200 bg-zinc-800 cursor-pointer">
                    Recusar
                  </button>
                  <button type="button" onClick={() => acceptMessageRequest(activeConv.id)} className="flex-1 py-2 rounded-full text-xs font-bold text-white bg-purple-600 hover:bg-purple-500 shadow cursor-pointer">
                    Aceitar conversa
                  </button>
                </div>
              </div>
            )}

            {/* Mensagens */}
            <div ref={scrollRef} className="flex-1 min-h-0 px-3 sm:px-4 py-4 overflow-y-auto overscroll-contain">
              <div className="text-center pb-4">
                <span className="text-[10px] uppercase font-bold tracking-widest px-3 py-1 rounded-full bg-purple-950/60 text-purple-300 border border-purple-900/30">
                  🔒 Conversa privada
                </span>
              </div>

              {messages.length === 0 && (
                <p className="text-center text-xs text-zinc-500 py-6">Nenhuma mensagem ainda. Comece com respeito e boa energia.</p>
              )}

              {messages.map((msg, i) => {
                const isMine = msg.senderId === currentUser.id;
                const proxima = messages[i + 1];
                const fimDoBloco = !proxima || proxima.senderId !== msg.senderId;
                const bigEmoji = !msg.mediaUrl && isEmojiOnly(msg.content);
                const desfoque = discreetBlur ? 'blur-sm hover:blur-none transition' : '';
                return (
                  <div key={msg.id} className={`flex items-end gap-2 ${isMine ? 'justify-end' : 'justify-start'} ${fimDoBloco ? 'mb-3' : 'mb-1'}`}>
                    {!isMine && (
                      fimDoBloco
                        ? <img src={otherParticipant.avatarUrl} alt="" className="w-7 h-7 rounded-full object-cover shrink-0 bg-zinc-800" />
                        : <span className="w-7 shrink-0" />
                    )}
                    <div className={`flex flex-col max-w-[78%] sm:max-w-md ${isMine ? 'items-end' : 'items-start'}`}>
                      {bigEmoji ? (
                        <div className={desfoque}>
                          <p className="text-4xl leading-tight">{msg.content}</p>
                          <span className="text-[10px] text-zinc-500 flex items-center justify-end gap-1">
                            {msg.createdAt}{isMine && <Confirmacao status={msg.status} />}
                          </span>
                        </div>
                      ) : (
                        <div className={`px-3 pt-2 pb-1.5 text-sm leading-relaxed whitespace-pre-wrap break-words [overflow-wrap:anywhere] ${
                          isMine
                            ? `bg-gradient-to-br from-purple-600 to-fuchsia-600 text-white rounded-2xl ${fimDoBloco ? 'rounded-br-md' : ''}`
                            : `bg-zinc-800/90 text-zinc-100 rounded-2xl ${fimDoBloco ? 'rounded-bl-md' : ''}`
                        } ${desfoque}`}>
                          {msg.mediaUrl && <MidiaDaMensagem url={msg.mediaUrl} temTexto={!!msg.content} aoAmpliar={setViewerUrl} />}
                          {msg.content && <p>{msg.content}</p>}
                          <span className={`mt-0.5 flex items-center justify-end gap-1 text-[10px] ${isMine ? 'text-white/70' : 'text-zinc-400'}`}>
                            {msg.createdAt}{isMine && <Confirmacao status={msg.status} claro />}
                          </span>
                        </div>
                      )}
                      {isMine && msg.id === ultimaMinha && (
                        <span className="text-[10px] text-zinc-500 mt-1 mr-1">{STATUS_LABEL[msg.status] ?? ''}</span>
                      )}
                    </div>
                  </div>
                );
              })}

              {outroDigitando && (
                <div className="flex items-end gap-2">
                  <img src={otherParticipant.avatarUrl} alt="" className="w-7 h-7 rounded-full object-cover shrink-0 bg-zinc-800" />
                  <div className="flex items-center gap-1 px-3.5 py-3 rounded-2xl rounded-bl-md bg-zinc-800/90" aria-label="digitando">
                    {[0, 1, 2].map(i => <span key={i} className="w-1.5 h-1.5 rounded-full bg-zinc-400 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />)}
                  </div>
                </div>
              )}
            </div>

            {/* Anexo pronto para enviar */}
            {attachment && (
              <div className="shrink-0 px-3 pt-3 border-t border-purple-900/30 bg-[#150e24] flex items-center gap-3">
                <div className="relative shrink-0">
                  {attachment.file.type.startsWith('video/')
                    ? <video src={attachment.preview} muted playsInline className="h-16 w-16 rounded-xl object-cover border border-purple-700/50" />
                    : <img src={attachment.preview} alt="Imagem a enviar" className="h-16 w-16 rounded-xl object-cover border border-purple-700/50" />}
                  <button
                    type="button"
                    onClick={clearAttachment}
                    className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-zinc-900 border border-zinc-700 text-zinc-300 hover:text-white flex items-center justify-center cursor-pointer"
                    aria-label="Remover anexo"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <span className="text-xs text-zinc-400 min-w-0">
                  {attachment.file.type === 'image/gif' ? 'GIF pronto para enviar' : attachment.file.type.startsWith('video/') ? 'Vídeo pronto para enviar' : 'Foto pronta para enviar'}. Escreva uma legenda se quiser.
                </span>
              </div>
            )}

            {/* Barra de digitação: [anexo] [campo + emoji] [microfone | enviar] */}
            <form
              onSubmit={handleSendMessage}
              className={`shrink-0 relative px-2 sm:px-3 pt-2 bg-[#150e24] flex items-end gap-2 ${attachment ? '' : 'border-t border-purple-900/30'}`}
              style={{ paddingBottom: telaCheia ? 'max(0.5rem, env(safe-area-inset-bottom))' : '0.5rem' }}
            >
              {showEmoji && <EmojiPicker onPick={insertEmoji} onClose={() => setShowEmoji(false)} />}
              <input ref={fileRef} type="file" accept={CHAT_MEDIA_ACCEPT} onChange={handlePickFile} className="hidden" />

              {!gravando && (
                <>
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    disabled={mediaLocked || isSending}
                    className="w-10 h-10 shrink-0 rounded-full text-zinc-300 bg-zinc-900 hover:text-fuchsia-300 flex items-center justify-center transition-colors cursor-pointer disabled:opacity-40"
                    title={mediaLocked ? 'Fotos, vídeos e áudios são liberados depois que a conversa for aceita' : 'Enviar foto, GIF ou vídeo'}
                    aria-label="Enviar foto, GIF ou vídeo"
                  >
                    <Plus className="w-5 h-5" />
                  </button>

                  <div className="flex-1 min-w-0 flex items-end rounded-3xl bg-zinc-900/90 border border-purple-900/40 focus-within:border-purple-500 transition-colors">
                    <textarea
                      ref={inputRef}
                      rows={1}
                      placeholder={
                        awaitingMyAcceptance ? 'Aceite a conversa para responder'
                          : introAlreadySent ? 'Aguarde o aceite para continuar'
                          : 'Mensagem…'
                      }
                      disabled={inputLocked}
                      value={inputText}
                      onChange={e => { setInputText(e.target.value); if (e.target.value) avisarDigitando(); }}
                      onKeyDown={aoTeclar}
                      enterKeyHint="send"
                      aria-label="Escreva uma mensagem"
                      className="flex-1 min-w-0 resize-none bg-transparent pl-4 pr-1 py-2.5 text-sm leading-5 text-zinc-100 placeholder-zinc-500 focus:outline-none max-h-[120px] disabled:opacity-60"
                    />
                    <button
                      type="button"
                      onClick={() => setShowEmoji(v => !v)}
                      disabled={inputLocked}
                      className={`w-10 h-10 shrink-0 rounded-full flex items-center justify-center transition-colors cursor-pointer disabled:opacity-40 ${showEmoji ? 'text-amber-300' : 'text-zinc-400 hover:text-amber-300'}`}
                      title="Emojis"
                      aria-label="Emojis"
                    >
                      <Smile className="w-5 h-5" />
                    </button>
                  </div>
                </>
              )}

              {temConteudo || inputLocked ? (
                <button
                  type="submit"
                  disabled={!temConteudo || isSending || inputLocked}
                  className="w-10 h-10 shrink-0 rounded-full bg-gradient-to-br from-fuchsia-600 via-pink-600 to-orange-600 hover:from-fuchsia-500 hover:via-pink-500 hover:to-orange-500 text-white flex items-center justify-center disabled:opacity-40 shadow transition-all cursor-pointer"
                  aria-label="Enviar mensagem"
                >
                  {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-[18px] h-[18px] -ml-0.5" />}
                </button>
              ) : (
                <GravadorDeAudio desabilitado={mediaLocked || isSending} aoGravar={enviarAudio} aoMudarEstado={setGravando} />
              )}
            </form>
          </div>
        ) : (
          <div className="flex-1 hidden md:flex flex-col items-center justify-center p-8 text-center bg-[#120d20]">
            <MessageSquare className="w-12 h-12 text-purple-400 opacity-50 mb-3" />
            <h3 className="text-base font-bold text-white mb-1">Selecione uma conversa</h3>
            <p className="text-xs text-zinc-400 max-w-sm">
              Converse com outros membros respeitando o consentimento e os limites acordados.
            </p>
          </div>
        )}
      </div>

      {viewerUrl && (
        <div
          className="fixed inset-0 z-[55] bg-black/90 flex items-center justify-center p-4 cursor-zoom-out"
          onClick={() => setViewerUrl(null)}
          role="dialog"
          aria-label="Imagem em tamanho real"
        >
          <img src={viewerUrl} alt="Imagem enviada" className="max-w-full max-h-full object-contain rounded-xl" />
          <button
            type="button"
            onClick={() => setViewerUrl(null)}
            className="absolute top-4 right-4 p-2 rounded-full bg-zinc-900/80 text-white cursor-pointer"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      )}
    </div>
  );
};
