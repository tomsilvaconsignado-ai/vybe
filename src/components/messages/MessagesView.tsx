import React, { useEffect, useRef, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { 
  MessageSquare, 
  Send, 
  ShieldAlert, 
  Lock, 
  Image, 
  Check, 
  CheckCheck, 
  Key, 
  UserX, 
  Sparkles,
  ChevronLeft,
  Info,
  Ban
} from 'lucide-react';
import { ChatMessage } from '../../types';
import { askConfirm } from '../common/Feedback';

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
    blockUser
  } = useApp();

  const [inputText, setInputText] = useState('');
  const [activeTab, setActiveTab] = useState<'chats' | 'requests'>('chats');
  const [discreetBlur, setDiscreetBlur] = useState(false);

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

  const [isSending, setIsSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (activeConv) loadConversationMessages(activeConv.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeConv?.id]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages.length, activeConv?.id]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !activeConv || isSending) return;
    setIsSending(true);
    await sendMessage(activeConv.id, inputText);
    setIsSending(false);
    setInputText('');
  };

  return (
    <div className="max-w-6xl mx-auto md:py-6 md:px-4">
      
      {/* Container */}
      <div className="bg-[#120d20] md:border border-purple-900/30 md:rounded-3xl overflow-hidden shadow-2xl h-[calc(100dvh-9.6rem-env(safe-area-inset-top)-env(safe-area-inset-bottom))] md:h-[78vh] flex flex-col md:flex-row">
        
        {/* Left Side: Conversations & Requests Drawer */}
        <div className={`w-full md:w-80 shrink-0 border-r border-purple-900/30 flex flex-col bg-[#0e0918] ${
          selectedConversationId ? 'hidden md:flex' : 'flex'
        }`}>
          
          {/* Header */}
          <div className="p-4 border-b border-purple-900/30">
            <h2 className="text-lg font-extrabold text-white mb-3">Mensagens Privadas</h2>
            
            <div className="flex bg-zinc-900/80 p-1 rounded-xl">
              <button
                onClick={() => setActiveTab('chats')}
                className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'chats' ? 'bg-purple-600 text-white shadow' : 'text-zinc-400 hover:text-white'
                }`}
              >
                Ativas ({activeConversations.length})
              </button>
              <button
                onClick={() => setActiveTab('requests')}
                className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all relative cursor-pointer ${
                  activeTab === 'requests' ? 'bg-purple-600 text-white shadow' : 'text-zinc-400 hover:text-white'
                }`}
              >
                Solicitações ({pendingRequests.length})
                {pendingRequests.length > 0 && (
                  <span className="w-2 h-2 rounded-full bg-rose-500 absolute top-1.5 right-2" />
                )}
              </button>
            </div>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto divide-y divide-purple-950/20">
            {activeTab === 'chats' ? (
              activeConversations.length > 0 ? (
                activeConversations.map(conv => {
                  const part = conv.participants[0];
                  const isSelected = conv.id === activeConv?.id;

                  return (
                    <div
                      key={conv.id}
                      onClick={() => setSelectedConversationId(conv.id)}
                      className={`p-3.5 flex items-center gap-3 cursor-pointer transition-colors ${
                        isSelected ? 'bg-purple-950/60 border-l-4 border-purple-500' : 'hover:bg-zinc-900/50'
                      }`}
                    >
                      <div className="relative shrink-0">
                        <img
                          src={part.avatarUrl}
                          alt={part.displayName}
                          className="w-12 h-12 rounded-full object-cover border border-purple-500/40"
                        />
                        {part.isVerified && (
                          <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-purple-500 rounded-full flex items-center justify-center text-[8px] text-white">
                            ✓
                          </span>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-bold text-white truncate">{part.displayName}</h4>
                          <span className="text-[10px] text-zinc-400">{conv.lastMessage?.createdAt || ''}</span>
                        </div>
                        <p className="text-[11px] text-zinc-400 truncate mt-0.5">
                          {conv.lastMessage?.content || 'Iniciar conversa...'}
                        </p>
                      </div>

                      {conv.unreadCount > 0 && (
                        <span className="w-5 h-5 rounded-full bg-fuchsia-600 text-white text-[10px] font-bold flex items-center justify-center">
                          {conv.unreadCount}
                        </span>
                      )}
                    </div>
                  );
                })
              ) : (
                <div className="p-6 text-center text-xs text-zinc-400">
                  Nenhuma conversa ativa no momento.
                </div>
              )
            ) : (
              pendingRequests.length > 0 ? (
                pendingRequests.map(conv => {
                  const part = conv.participants[0];
                  const isSelected = conv.id === activeConv?.id;

                  return (
                    <div
                      key={conv.id}
                      onClick={() => setSelectedConversationId(conv.id)}
                      className={`p-3.5 flex items-center gap-3 cursor-pointer transition-colors ${
                        isSelected ? 'bg-purple-950/60 border-l-4 border-purple-500' : 'hover:bg-zinc-900/50'
                      }`}
                    >
                      <img
                        src={part.avatarUrl}
                        alt={part.displayName}
                        className="w-12 h-12 rounded-full object-cover border border-purple-500/40"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-bold text-white truncate">{part.displayName}</h4>
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-rose-950 text-rose-300">Nova</span>
                        </div>
                        <p className="text-[11px] text-zinc-400 truncate mt-0.5">
                          {conv.lastMessage?.content || 'Solicitou mensagem'}
                        </p>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="p-6 text-center text-xs text-zinc-400">
                  Nenhuma solicitação pendente. Seu inbox está protegido contra spam.
                </div>
              )
            )}
          </div>

        </div>

        {/* Right Side: Active Chat Window */}
        {activeConv && otherParticipant ? (
          <div className="flex-1 flex flex-col bg-[#120d20]">
            
            {/* Chat Header */}
            <div className="p-4 border-b border-purple-900/30 flex items-center justify-between bg-[#150e24]">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setSelectedConversationId(null)}
                  className="md:hidden text-zinc-400 hover:text-white p-1"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>

                <div 
                  onClick={() => setSelectedProfileId(otherParticipant.id)}
                  className="flex items-center gap-2.5 cursor-pointer group"
                >
                  <img
                    src={otherParticipant.avatarUrl}
                    alt={otherParticipant.displayName}
                    className="w-10 h-10 rounded-full object-cover border border-purple-500/40 group-hover:scale-105 transition-transform"
                  />
                  <div>
                    <h3 className="text-sm font-bold text-white group-hover:text-purple-300 transition-colors flex items-center gap-1.5">
                      <span>{otherParticipant.displayName}</span>
                      {otherParticipant.isVerified && <span className="text-purple-400 text-xs">✓</span>}
                    </h3>
                    <p className="text-[11px] text-zinc-400">
                      @{otherParticipant.username} • {otherParticipant.lastActive}
                    </p>
                  </div>
                </div>
              </div>

              {/* Chat Actions */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setReportModalTarget({
                    targetType: 'message',
                    targetId: activeConv.id,
                    reportedUserId: otherParticipant.id,
                    reportedUserName: otherParticipant.username
                  })}
                  className="p-2 rounded-xl text-zinc-400 hover:text-rose-400 hover:bg-zinc-800 transition-colors cursor-pointer"
                  title="Denunciar conversa"
                  aria-label="Denunciar conversa"
                >
                  <ShieldAlert className="w-4 h-4" />
                </button>
                <button
                  onClick={async () => {
                    if (await askConfirm({ title: `Bloquear ${otherParticipant.displayName}?`, message: "A pessoa não poderá mais enviar mensagens nem ver seu perfil. A conversa continua guardada caso você queira denunciá-la depois.", confirmLabel: "Bloquear", danger: true })) {
                      await blockUser(otherParticipant.id);
                    }
                  }}
                  className="p-2 rounded-xl text-zinc-400 hover:text-rose-400 hover:bg-zinc-800 transition-colors cursor-pointer"
                  title="Bloquear pessoa"
                  aria-label="Bloquear pessoa"
                >
                  <Ban className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Pending Request Gate Warning */}
            {awaitingTheirAcceptance && (
              <div className="p-3 bg-purple-950/40 border-b border-purple-800/40 text-xs text-purple-200 flex items-center gap-2">
                <Lock className="w-4 h-4 text-purple-400 shrink-0" />
                <span>
                  <strong>Aguardando aceite:</strong> você pode enviar uma única mensagem de apresentação em texto. Novas mensagens, mídias e respostas são liberadas quando {otherParticipant.displayName} aceitar.
                </span>
              </div>
            )}

            {awaitingMyAcceptance && (
              <div className="p-3 bg-amber-950/40 border-b border-amber-800/40 flex items-center justify-between gap-4">
                <div className="text-xs text-amber-200 flex items-center gap-2">
                  <Lock className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>
                    <strong>Solicitação de Mensagem:</strong> Aceite para liberar a conversa e permitir envio mútuo de mídias.
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => rejectMessageRequest(activeConv.id)}
                    className="px-3 py-1 rounded-xl text-xs font-semibold text-zinc-300 hover:text-white bg-zinc-800 cursor-pointer"
                  >
                    Recusar
                  </button>
                  <button
                    onClick={() => acceptMessageRequest(activeConv.id)}
                    className="px-3 py-1 rounded-xl text-xs font-bold text-white bg-purple-600 hover:bg-purple-500 shadow cursor-pointer"
                  >
                    Aceitar Conversa
                  </button>
                </div>
              </div>
            )}

            {/* Messages Scroll Area */}
            <div ref={scrollRef} className="flex-1 p-4 overflow-y-auto space-y-4">
              
              <div className="text-center py-2">
                <span className="text-[10px] uppercase font-bold tracking-widest px-3 py-1 rounded-full bg-purple-950/60 text-purple-300 border border-purple-900/30">
                  🔒 Conversa privada
                </span>
              </div>

              {messages.length === 0 && (
                <p className="text-center text-xs text-zinc-500 py-6">Nenhuma mensagem ainda. Comece com respeito e boa energia.</p>
              )}

              {messages.map(msg => {
                const isMine = msg.senderId === currentUser.id;
                return (
                  <div key={msg.id} className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}>
                    <div className={`max-w-sm sm:max-w-md p-3.5 rounded-2xl text-xs leading-relaxed whitespace-pre-wrap break-words ${
                      isMine
                        ? 'bg-gradient-to-r from-purple-600 to-rose-600 text-white rounded-br-none shadow-md'
                        : 'bg-zinc-900 text-zinc-200 border border-purple-900/30 rounded-bl-none'
                    } ${discreetBlur ? 'blur-sm hover:blur-none transition' : ''}`}>
                      {msg.mediaUrl && (
                        <img src={msg.mediaUrl} alt="" className="rounded-xl mb-2 max-h-64 object-cover" />
                      )}
                      {msg.content && <p>{msg.content}</p>}
                    </div>
                    <span className="text-[10px] text-zinc-400 mt-1 flex items-center gap-1">
                      {msg.createdAt}
                      {isMine && (msg.status === 'read'
                        ? <><span>• Lida</span><CheckCheck className="w-3 h-3 text-purple-400" /></>
                        : <Check className="w-3 h-3 text-zinc-500" />)}
                    </span>
                  </div>
                );
              })}

            </div>

            {/* Message Input Box */}
            <form onSubmit={handleSendMessage} className="p-3 border-t border-purple-900/30 bg-[#150e24] flex items-center gap-2">
              
              <button
                type="button"
                onClick={() => setDiscreetBlur(!discreetBlur)}
                className={`p-2.5 rounded-xl transition-colors cursor-pointer ${
                  discreetBlur ? 'bg-purple-950 text-fuchsia-400 border border-fuchsia-500/50' : 'text-zinc-400 hover:text-white'
                }`}
                title="Modo discreto: desfoca as mensagens na tela"
              >
                <Lock className="w-5 h-5" />
              </button>

              <input
                type="text"
                placeholder={
                  awaitingMyAcceptance ? 'Aceite a conversa para responder'
                    : introAlreadySent ? 'Apresentação enviada. Aguarde o aceite para continuar'
                    : 'Escreva uma mensagem com respeito e boa energia...'
                }
                disabled={inputLocked}
                value={inputText}
                onChange={e => setInputText(e.target.value)}
                enterKeyHint="send"
                className="flex-1 px-4 py-2.5 bg-zinc-900/90 border border-purple-900/40 rounded-full text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-purple-500"
              />

              <button
                type="submit"
                disabled={!inputText.trim() || isSending || inputLocked}
                className="p-2.5 rounded-full bg-gradient-to-r from-purple-600 to-rose-600 hover:from-purple-500 hover:to-rose-500 text-white disabled:opacity-40 shadow transition-all cursor-pointer"
              >
                <Send className="w-4 h-4" />
              </button>

            </form>

          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-[#120d20]">
            <MessageSquare className="w-12 h-12 text-purple-400 opacity-50 mb-3" />
            <h3 className="text-base font-bold text-white mb-1">Selecione uma conversa</h3>
            <p className="text-xs text-zinc-400 max-w-sm">
              Converse com outros membros respeitando o consentimento e os limites acordados.
            </p>
          </div>
        )}

      </div>

    </div>
  );
};
