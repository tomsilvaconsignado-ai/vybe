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
  Eye,
  CornerUpLeft,
  SmilePlus,
  BadgeCheck,
  Camera,
  ChevronDown,
  Dices
} from 'lucide-react';
import { ChatMessage } from '../../types';
import { MatchDesejos } from './MatchDesejos';
import { askConfirm, notify } from '../common/Feedback';
import { OnlineDot, activityLabel } from '../common/OnlineDot';
import { EmojiPicker, isEmojiOnly } from '../common/EmojiPicker';
import { CHAT_MEDIA_ACCEPT, uploadChatMedia, searchMyMessages, type MessageSearchHit } from '../../lib/messaging';
import { useEstadoSalvo } from '../../lib/estadoSalvo';
import { GravadorDeAudio, MidiaDaMensagem, tipoDaMidia, useAlturaVisivel, useDigitando } from './ChatExtras';
import {
  BarraDeResposta, BotaoResponderTrecho, CitacaoNaBolha, EscolherTrecho, MenuDaMensagem, ReacoesDaBolha, useGestosDaBolha, useSelecaoNasBolhas,
  type Resposta,
} from './Interacoes';

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

// Separador de dia da conversa: Hoje, Ontem, dia da semana (até 6 dias) ou a data
const DIAS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
function rotuloDoDia(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const zero = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const dias = Math.round((zero(new Date()) - zero(d)) / 864e5);
  if (dias === 0) return 'Hoje';
  if (dias === 1) return 'Ontem';
  if (dias > 1 && dias < 7) return DIAS[d.getDay()]!.replace(/^./, c => c.toUpperCase());
  return d.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', ...(d.getFullYear() !== new Date().getFullYear() ? { year: 'numeric' } : {}) });
}

interface LinhaProps {
  entra?: boolean;
  msg: ChatMessage; isMine: boolean; fimDoBloco: boolean; avatarDoOutro: string; desfoque: string; eUltimaMinha: boolean; eu: string;
  nomeDoOutro: string; original?: ChatMessage; podeInteragir: boolean; destacada: boolean; celular: boolean;
  aoMenu: (m: ChatMessage) => void; aoResponder: (m: ChatMessage) => void; aoReagir: (m: ChatMessage, emoji: string) => void;
  aoIrPara: (id: string) => void; aoAmpliar: (url: string) => void; aoAbrirJogo: (id: string) => void;
}

// Uma mensagem da conversa (componente próprio: cada bolha tem o seu gesto de segurar/arrastar)
const LinhaDaMensagem: React.FC<LinhaProps> = ({
  entra,
  msg, isMine, fimDoBloco, avatarDoOutro, desfoque, eUltimaMinha, eu, nomeDoOutro, original, podeInteragir, destacada, celular,
  aoMenu, aoResponder, aoReagir, aoIrPara, aoAmpliar, aoAbrirJogo,
}) => {
  const { desloc, handlers } = useGestosDaBolha({ aoSegurar: () => aoMenu(msg), aoArrastar: () => aoResponder(msg), ativo: podeInteragir });
  const bigEmoji = !msg.mediaUrl && !msg.replyToId && isEmojiOnly(msg.content);
  const reacoes = msg.reactions ?? [];
  const autorOriginal = original ? (original.senderId === eu ? 'Você' : nomeDoOutro) : nomeDoOutro;
  const acoes = podeInteragir && !celular && (
    <div className="self-center flex items-center gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
      <button type="button" onClick={() => aoMenu(msg)} className="w-8 h-8 rounded-full text-zinc-400 hover:text-amber-300 hover:bg-zinc-800 flex items-center justify-center cursor-pointer" title="Reagir" aria-label="Reagir à mensagem">
        <SmilePlus className="w-4 h-4" />
      </button>
      <button type="button" onClick={() => aoResponder(msg)} className="w-8 h-8 rounded-full text-zinc-400 hover:text-fuchsia-300 hover:bg-zinc-800 flex items-center justify-center cursor-pointer" title="Responder" aria-label="Responder a mensagem">
        <CornerUpLeft className="w-4 h-4" />
      </button>
    </div>
  );
  return (
    <div
      id={`msg-${msg.id}`}
      className={`group relative flex items-end gap-2 rounded-2xl ${isMine ? 'justify-end' : 'justify-start'} ${fimDoBloco || reacoes.length ? 'mb-3' : 'mb-1'} ${destacada ? 'mensagem-destacada' : ''} ${entra ? 'msg-entra' : ''}`}
      onContextMenu={e => { if (podeInteragir || msg.content) { e.preventDefault(); aoMenu(msg); } }}
      {...(celular ? handlers : {})}
    >
      {desloc > 0 && (
        <span className="absolute left-1 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-zinc-800 text-fuchsia-300 flex items-center justify-center" style={{ opacity: Math.min(1, desloc / 60) }} aria-hidden>
          <CornerUpLeft className="w-4 h-4" />
        </span>
      )}
      {!isMine && (
        fimDoBloco
          ? <img src={avatarDoOutro} alt="" className="w-7 h-7 rounded-full object-cover shrink-0 bg-zinc-800" />
          : <span className="w-7 shrink-0" />
      )}
      {isMine && acoes}
      <div className={`flex flex-col max-w-[78%] sm:max-w-md ${isMine ? 'items-end' : 'items-start'}`} style={desloc ? { transform: `translateX(${desloc}px)` } : undefined}>
        {bigEmoji ? (
          <div className={desfoque}>
            <p className="text-4xl leading-tight">{msg.content}</p>
            <span className="text-[10px] text-zinc-500 flex items-center justify-end gap-1">
              {msg.createdAt}{isMine && <Confirmacao status={msg.status} />}
            </span>
          </div>
        ) : (
          <div className={`px-3.5 pt-2 pb-1.5 text-[15px] leading-[1.4] whitespace-pre-wrap break-words [overflow-wrap:anywhere] ${
            isMine
              ? `fundo-neon text-white rounded-[22px] shadow-[0_6px_18px_-10px_rgba(236,72,153,0.9)] ${fimDoBloco ? 'rounded-br-md' : ''}`
              : `bg-[#241c31] text-zinc-50 rounded-[22px] ${fimDoBloco ? 'rounded-bl-md' : ''}`
          } ${desfoque} ${celular ? 'select-none [-webkit-touch-callout:none]' : ''}`}>
            {msg.replyToId && (
              <CitacaoNaBolha original={original} trecho={msg.replyQuote} autor={autorOriginal} minha={isMine} aoAbrir={() => aoIrPara(msg.replyToId!)} />
            )}
            {msg.mediaUrl && <MidiaDaMensagem url={msg.mediaUrl} temTexto={!!msg.content} aoAmpliar={aoAmpliar} />}
            {msg.content && <p data-texto-msg={msg.id}>{msg.content}</p>}
            {msg.gameId && (
              <button type="button" onClick={() => aoAbrirJogo(msg.gameId!)}
                className={`mt-2 mb-1 w-full min-h-[40px] rounded-xl px-3 text-[13px] font-bold flex items-center justify-center gap-1.5 cursor-pointer ${isMine ? 'bg-white/20 hover:bg-white/30' : 'fundo-neon'}`}>
                <Dices className="w-4 h-4" /> {isMine ? 'Abrir o jogo' : 'Jogar agora'}
              </button>
            )}
            <span className={`mt-0.5 flex items-center justify-end gap-1 text-[10px] ${isMine ? 'text-white/70' : 'text-zinc-400'}`}>
              {msg.createdAt}{isMine && <Confirmacao status={msg.status} claro />}
            </span>
          </div>
        )}
        <ReacoesDaBolha reacoes={reacoes} eu={eu} nomeDoOutro={nomeDoOutro} minha={isMine} aoTocar={e => { if (podeInteragir) aoReagir(msg, e); }} />
        {isMine && eUltimaMinha && (
          <span className="text-[10px] text-zinc-500 mt-1 mr-1">{STATUS_LABEL[msg.status] ?? ''}</span>
        )}
      </div>
      {!isMine && acoes}
    </div>
  );
};

export const MessagesView: React.FC = () => {
  const {
    conversations,
    selectedConversationId,
    setSelectedConversationId,
    currentUser,
    sendMessage,
    reactMessage,
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
  // Match de Desejos aberto: id do jogo (convite tocado) ou null (escolher o baralho para desafiar)
  const [jogoAberto, setJogoAberto] = useState<{ id: string | null } | null>(null);
  // responder / reagir
  const [resposta, setResposta] = useState<Resposta | null>(null);
  const [menuDe, setMenuDe] = useState<ChatMessage | null>(null);
  const [trechoDe, setTrechoDe] = useState<ChatMessage | null>(null);
  const [destacada, setDestacada] = useState<string | null>(null);
  const podeInteragir = Boolean(activeConv && !activeConv.isPendingRequest);
  const [selecao, setSelecao] = useSelecaoNasBolhas(scrollRef, podeInteragir && !celular);
  const responder = (m: ChatMessage, trecho?: string) => {
    if (!podeInteragir) return;
    setResposta({ msg: m, trecho: trecho?.trim() || undefined });
    window.getSelection()?.removeAllRanges();
    setSelecao(null);
    requestAnimationFrame(() => inputRef.current?.focus());
  };
  const reagir = (m: ChatMessage, emoji: string) => { if (activeConv && podeInteragir) reactMessage(activeConv.id, m.id, emoji); };
  // leva até a mensagem respondida (mesmo que esteja bem lá atrás) e pisca para mostrar onde está
  const irPara = (id: string) => {
    const el = document.getElementById(`msg-${id}`);
    if (!el) { notify('Essa mensagem é antiga e não está carregada nesta conversa.'); return; }
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setDestacada(null);
    requestAnimationFrame(() => setDestacada(id));
    window.setTimeout(() => setDestacada(atual => (atual === id ? null : atual)), 1700);
  };
  const nomeDe = (m?: ChatMessage) => (m?.senderId === currentUser.id ? 'Você' : otherParticipant?.displayName ?? '');
  const porId = new Map(messages.map(m => [m.id, m]));
  const respostaParaEnvio = resposta ? { id: resposta.msg.id, trecho: resposta.trecho } : null;
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
    setResposta(null);
    setMenuDe(null);
    setTrechoDe(null);
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

  // Rolagem inteligente: só desce sozinha se você já está no fim (ou se a mensagem é sua).
  // Lendo mensagens antigas, as novas viram um contador no botão "descer".
  const longeRef = useRef(false);
  const [longeDoFim, setLongeDoFim] = useState(false);
  const [novasAbaixo, setNovasAbaixo] = useState(0);
  const conversaRolada = useRef<string | undefined>(undefined);
  const totalAnterior = useRef(0);
  const aoRolar = () => {
    const el = scrollRef.current;
    if (!el) return;
    const longe = el.scrollHeight - el.scrollTop - el.clientHeight > 160;
    longeRef.current = longe;
    setLongeDoFim(longe);
    if (!longe) setNovasAbaixo(0);
  };
  const descer = (suave = true) => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: suave ? 'smooth' : 'auto' });
    setNovasAbaixo(0);
  };
  useEffect(() => {
    const trocou = conversaRolada.current !== activeConv?.id;
    conversaRolada.current = activeConv?.id;
    const chegaram = trocou ? 0 : messages.length - totalAnterior.current;
    totalAnterior.current = messages.length;
    const ultima = messages[messages.length - 1];
    if (trocou || !longeRef.current || (chegaram > 0 && ultima?.senderId === currentUser.id)) {
      descer(!trocou && chegaram > 0);
      longeRef.current = false;
      setLongeDoFim(false);
    } else if (chegaram > 0) {
      setNovasAbaixo(n => n + chegaram);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length, activeConv?.id, outroDigitando, alturaVisivel]);

  // Mensagens que chegam com a conversa aberta entram com uma animação curta (as que já estavam, não)
  const vistas = useRef<{ conv?: string; pronto: boolean; ids: Set<string> }>({ pronto: false, ids: new Set() });
  if (vistas.current.conv !== activeConv?.id) vistas.current = { conv: activeConv?.id, pronto: messages.length > 0, ids: new Set(messages.map(m => m.id)) };
  else if (!vistas.current.pronto && messages.length > 0) vistas.current = { ...vistas.current, pronto: true, ids: new Set(messages.map(m => m.id)) };
  const entra = (id: string) => vistas.current.pronto && !vistas.current.ids.has(id);
  useEffect(() => { messages.forEach(m => vistas.current.ids.add(m.id)); });

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
    const enviou = await sendMessage(activeConv.id, inputText, mediaPath, respostaParaEnvio);
    avisarParou();
    setIsSending(false);
    if (!enviou) return;
    setResposta(null);
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
    else if (await sendMessage(activeConv.id, '', path, respostaParaEnvio)) setResposta(null);
    setIsSending(false);
  };

  // Enter envia; Shift+Enter quebra a linha (no celular, o botão Enviar do teclado também envia)
  const aoTeclar = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Escape' && resposta) { e.preventDefault(); setResposta(null); return; }
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
    const minhaUltima = conv.lastMessage?.senderId === currentUser.id;
    const previa = conv.lastMessage?.content || resumoMidia(conv.lastMessage?.mediaUrl) || (pedido ? 'Quer conversar com você' : 'Diga oi 👋');
    return (
      <button
        type="button"
        onClick={() => setSelectedConversationId(conv.id)}
        className={`w-full text-left px-4 py-2.5 flex items-center gap-3.5 cursor-pointer transition-colors ${isSelected ? 'bg-white/[0.06]' : 'hover:bg-white/[0.03] active:bg-white/[0.05]'}`}
      >
        <div className="relative shrink-0">
          <img src={part.avatarUrl} alt="" className="w-14 h-14 rounded-full object-cover bg-zinc-800" />
          <OnlineDot userId={part.id} className="bottom-0.5 right-0.5" />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className={`flex items-center gap-1 text-[15px] ${naoLidas ? 'font-bold text-white' : 'font-medium text-zinc-100'}`}>
            <span className="truncate">{part.displayName}</span>
            {part.isVerified && <BadgeCheck className="w-4 h-4 shrink-0 text-white fill-fuchsia-500" aria-label="Verificado" />}
          </h4>
          <p className={`flex items-center gap-1 text-[13px] ${naoLidas ? 'text-white font-semibold' : 'text-zinc-500'}`}>
            <span className="truncate">{minhaUltima && !pedido ? `Você: ${previa}` : previa}</span>
            {!pedido && conv.lastMessage?.createdAt && <span className="shrink-0">· {conv.lastMessage.createdAt}</span>}
          </p>
        </div>
        {pedido ? (
          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-300 shrink-0">Nova</span>
        ) : naoLidas ? (
          <span className="min-w-[22px] h-[22px] px-1.5 rounded-full fundo-neon text-white text-[11px] font-bold flex items-center justify-center shrink-0 shadow-[0_0_14px_-2px_rgba(236,72,153,0.8)]">
            {conv.unreadCount}
          </span>
        ) : null}
      </button>
    );
  };

  // Quem está online agora (entre as suas conversas): toque para abrir
  const onlineAgora = activeConversations.filter(c => isOnline(c.participants[0]?.id ?? ''));

  const listaVisivel = activeTab === 'chats' ? activeConversations.filter(nomeBate) : pendingRequests.filter(nomeBate);

  return (
    <div className="max-w-6xl mx-auto md:py-6 md:px-4">
      <div className="bg-fundo md:border border-white/[0.07] md:rounded-3xl overflow-hidden md:shadow-[0_30px_80px_-40px_rgba(192,38,211,0.45)] h-[calc(100dvh-8.6rem-env(safe-area-inset-top)-env(safe-area-inset-bottom))] md:h-[80vh] flex flex-col md:flex-row">

        {/* Lista de conversas */}
        {/* no celular a lista ocupa a altura disponível e rola por dentro (flex-1 + min-h-0); no computador é a coluna fixa da esquerda */}
        <div className={`w-full md:w-[360px] flex-1 md:flex-none min-h-0 md:border-r border-white/[0.07] flex-col ${selectedConversationId ? 'hidden md:flex' : 'flex'}`}>
          <div className="px-4 pt-4 pb-2 space-y-3">
            <h2 className="text-[22px] font-extrabold tracking-tight text-white">Mensagens</h2>
            <label className="flex items-center gap-2 px-3.5 h-10 rounded-xl bg-white/[0.06] border border-transparent focus-within:border-purple-500/60">
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
          </div>

          {/* Online agora: quem está com o app aberto, entre as suas conversas */}
          {!busca && onlineAgora.length > 0 && (
            <div className="pt-1 pb-2" aria-label="Online agora">
              <p className="px-4 pb-2 text-[13px] font-semibold text-zinc-400">Online agora</p>
              <div className="flex gap-3 overflow-x-auto no-scrollbar px-4">
                {onlineAgora.map(c => {
                  const p = c.participants[0]!;
                  return (
                    <button key={c.id} type="button" onClick={() => setSelectedConversationId(c.id)} className="w-[68px] shrink-0 flex flex-col items-center gap-1 cursor-pointer group" aria-label={`Abrir conversa com ${p.displayName} (online)`}>
                      <span className="relative">
                        <img src={p.avatarUrl} alt="" className="w-16 h-16 rounded-full object-cover ring-2 ring-emerald-400/70 ring-offset-2 ring-offset-fundo transition-transform group-active:scale-95" />
                        <span className="absolute bottom-0.5 right-0.5 w-4 h-4 rounded-full bg-emerald-400 ring-[3px] ring-fundo">
                          <span className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-60 motion-reduce:hidden" />
                        </span>
                      </span>
                      <span className="text-xs text-zinc-300 truncate max-w-full">{p.displayName.split(' ')[0]}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Conversas e solicitações: abas com a luz embaixo */}
          <div className="relative grid grid-cols-2 border-b border-white/[0.07]" role="tablist">
            {([['chats', 'Conversas', activeConversations.length], ['requests', 'Solicitações', pendingRequests.length]] as const).map(([id, rotulo, qtd]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={activeTab === id}
                onClick={() => setActiveTab(id)}
                className={`h-11 text-[14px] cursor-pointer transition-colors ${activeTab === id ? 'text-white font-bold' : 'text-zinc-500 font-semibold hover:text-zinc-300'}`}
              >
                {rotulo}
                {qtd > 0 && <span className={`ml-1.5 text-xs ${id === 'requests' ? 'px-1.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300 font-bold' : 'text-zinc-500 font-medium'}`}>{qtd}</span>}
              </button>
            ))}
            <span aria-hidden className="luz-ativa absolute bottom-0 h-[2px] w-[22%] rounded-full transition-[left] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]" style={{ left: activeTab === 'chats' ? '14%' : '64%' }} />
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain pt-1" aria-label="Lista de conversas">
            {listaVisivel.length > 0 ? (
              listaVisivel.map(conv => <ItemConversa key={conv.id} conv={conv} pedido={activeTab === 'requests'} />)
            ) : (
              <div className="px-8 py-12 text-center">
                <MessageSquare className="w-10 h-10 mx-auto mb-3 text-zinc-600" strokeWidth={1.5} />
                <p className="text-sm text-zinc-400">
                  {busca ? 'Nenhuma conversa encontrada.' : activeTab === 'chats' ? 'Suas conversas aparecem aqui. Abra um perfil e toque em Mensagem para começar.' : 'Nenhuma solicitação. Pedidos de quem você não conhece chegam aqui primeiro.'}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Conversa aberta: no celular vira tela cheia por cima de tudo */}
        {activeConv && otherParticipant ? emTelaCheia(
          <div
            className={`flex-1 min-w-0 min-h-0 flex flex-col bg-fundo ${selectedConversationId ? 'flex' : 'hidden md:flex'} ${telaCheia ? 'fixed inset-x-0 top-0 z-[45]' : 'relative'}`}
            style={telaCheia ? { height: alturaVisivel ? `${alturaVisivel}px` : '100dvh' } : undefined}
          >
            {/* luz ambiente atrás da conversa */}
            <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(60%_100%_at_50%_0%,rgba(192,38,211,0.16),transparent)]" />
            {/* Cabeçalho */}
            <div className="relative z-10 shrink-0 px-2 sm:px-4 py-2 border-b border-white/[0.07] flex items-center gap-1 bg-fundo/70 backdrop-blur-xl" style={telaCheia ? { paddingTop: 'max(0.5rem, env(safe-area-inset-top))' } : undefined}>
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
                  <h3 className="flex items-center gap-1 text-[15px] font-bold text-white">
                    <span className="truncate">{otherParticipant.displayName}</span>
                    {otherParticipant.isVerified && <BadgeCheck className="w-4 h-4 shrink-0 text-white fill-fuchsia-500" aria-label="Verificado" />}
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
                {!activeConv.isPendingRequest && (
                  <button
                    type="button"
                    onClick={() => setJogoAberto({ id: null })}
                    className="h-10 px-3 mr-0.5 rounded-full text-[13px] font-bold text-white fundo-neon flex items-center gap-1.5 cursor-pointer shadow-[0_6px_18px_-8px_rgba(236,72,153,0.9)]"
                    title="Jogos a dois: Quiz do Kama Sutra e Match de Desejos"
                    aria-label={`Jogar com ${otherParticipant.displayName}`}
                  >
                    <Dices className="w-[18px] h-[18px]" /><span className="hidden sm:inline">Jogar</span>
                  </button>
                )}
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
            <div ref={scrollRef} onScroll={aoRolar} className="relative flex-1 min-h-0 px-3 sm:px-5 py-4 overflow-y-auto overscroll-contain">
              {/* começo da conversa: quem é a pessoa */}
              <div className="flex flex-col items-center text-center pt-4 pb-8">
                <img src={otherParticipant.avatarUrl} alt="" className="w-20 h-20 rounded-full object-cover ring-1 ring-white/10" />
                <p className="mt-3 text-lg font-bold text-white">{otherParticipant.displayName}</p>
                <p className="text-sm text-zinc-500">@{otherParticipant.username}</p>
                <button type="button" onClick={() => setSelectedProfileId(otherParticipant.id)} className="mt-3 h-8 px-4 rounded-lg bg-white/[0.08] hover:bg-white/[0.12] text-[13px] font-semibold text-zinc-100 cursor-pointer">
                  Ver perfil
                </button>
                <p className="mt-4 flex items-center gap-1.5 text-xs text-zinc-500"><Lock className="w-3 h-3" />Conversa privada: só vocês dois veem</p>
              </div>

              {messages.length === 0 && (
                <p className="text-center text-xs text-zinc-500 py-6">Nenhuma mensagem ainda. Comece com respeito e boa energia.</p>
              )}

              {messages.map((msg, i) => {
                const proxima = messages[i + 1];
                const dia = rotuloDoDia(msg.sentAt);
                const novoDia = dia && dia !== rotuloDoDia(messages[i - 1]?.sentAt);
                return (
                  <React.Fragment key={msg.id}>
                  {novoDia && (
                    <div className="flex justify-center my-4" role="separator" aria-label={dia}>
                      <span className="text-xs font-semibold text-zinc-500">{dia}</span>
                    </div>
                  )}
                  <LinhaDaMensagem
                    entra={entra(msg.id)}
                    msg={msg}
                    isMine={msg.senderId === currentUser.id}
                    fimDoBloco={!proxima || proxima.senderId !== msg.senderId}
                    avatarDoOutro={otherParticipant.avatarUrl}
                    desfoque={discreetBlur ? 'blur-sm hover:blur-none transition' : ''}
                    eUltimaMinha={msg.id === ultimaMinha}
                    eu={currentUser.id}
                    nomeDoOutro={otherParticipant.displayName}
                    original={msg.replyToId ? porId.get(msg.replyToId) : undefined}
                    podeInteragir={podeInteragir}
                    destacada={destacada === msg.id}
                    celular={celular}
                    aoMenu={setMenuDe}
                    aoResponder={m => responder(m)}
                    aoReagir={reagir}
                    aoIrPara={irPara}
                    aoAmpliar={setViewerUrl}
                    aoAbrirJogo={id => setJogoAberto({ id })}
                  />
                  </React.Fragment>
                );
              })}

              {outroDigitando && (
                <div className="msg-entra flex items-end gap-2">
                  <img src={otherParticipant.avatarUrl} alt="" className="w-7 h-7 rounded-full object-cover shrink-0 bg-zinc-800" />
                  <div className="flex items-center gap-1 px-4 py-3.5 rounded-[22px] rounded-bl-md bg-[#241c31]" aria-label="digitando">
                    {[0, 1, 2].map(i => <span key={i} className="w-1.5 h-1.5 rounded-full bg-zinc-400 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />)}
                  </div>
                </div>
              )}
            </div>

            {/* Descer para o fim (com as mensagens novas que chegaram enquanto você lia as antigas) */}
            {longeDoFim && (
              <button
                type="button"
                onClick={() => descer()}
                className="msg-entra absolute right-4 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] md:bottom-20 z-10 h-10 min-w-10 px-2.5 rounded-full bg-[#241c31]/95 backdrop-blur border border-white/10 text-zinc-100 shadow-xl flex items-center justify-center gap-1 cursor-pointer"
                aria-label={novasAbaixo > 0 ? `${novasAbaixo} mensagens novas: descer` : 'Descer para a última mensagem'}
              >
                {novasAbaixo > 0 && <span className="min-w-5 h-5 px-1 rounded-full fundo-neon text-[11px] font-bold flex items-center justify-center">{novasAbaixo}</span>}
                <ChevronDown className="w-5 h-5" />
              </button>
            )}

            {resposta && (
              <BarraDeResposta resposta={resposta} autor={nomeDe(resposta.msg)} aoCancelar={() => setResposta(null)} />
            )}

            {/* Anexo pronto para enviar */}
            {attachment && (
              <div className="shrink-0 px-3 pt-3 border-t border-white/[0.07] bg-fundo flex items-center gap-3">
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
              className="shrink-0 relative px-2 sm:px-3 pt-2 bg-fundo flex items-end gap-2"
              style={{ paddingBottom: telaCheia ? 'max(0.5rem, env(safe-area-inset-bottom))' : '0.6rem' }}
            >
              {showEmoji && <EmojiPicker onPick={insertEmoji} onClose={() => setShowEmoji(false)} />}
              <input ref={fileRef} type="file" accept={CHAT_MEDIA_ACCEPT} onChange={handlePickFile} className="hidden" />

              {!gravando && (
                <div className="flex-1 min-w-0 flex items-end gap-1 rounded-[24px] bg-white/[0.07] border border-transparent focus-within:border-purple-500/50 transition-colors p-1">
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    disabled={mediaLocked || isSending}
                    className="w-9 h-9 shrink-0 rounded-full fundo-neon text-white flex items-center justify-center transition-transform active:scale-90 cursor-pointer disabled:opacity-40 disabled:grayscale"
                    title={mediaLocked ? 'Fotos, vídeos e áudios são liberados depois que a conversa for aceita' : 'Enviar foto, GIF ou vídeo'}
                    aria-label="Enviar foto, GIF ou vídeo"
                  >
                    <Camera className="w-[18px] h-[18px]" />
                  </button>
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
                      className="flex-1 min-w-0 resize-none bg-transparent pl-2 pr-1 py-2 text-[15px] leading-5 text-zinc-100 placeholder-zinc-500 focus:outline-none max-h-[120px] disabled:opacity-60"
                    />
                    <button
                      type="button"
                      onClick={() => setShowEmoji(v => !v)}
                      disabled={inputLocked}
                      className={`w-9 h-9 shrink-0 rounded-full flex items-center justify-center transition-colors cursor-pointer disabled:opacity-40 ${showEmoji ? 'text-amber-300' : 'text-zinc-400 hover:text-amber-300'}`}
                      title="Emojis"
                      aria-label="Emojis"
                    >
                      <Smile className="w-[22px] h-[22px]" />
                    </button>
                </div>
              )}

              {temConteudo || inputLocked ? (
                <button
                  type="submit"
                  disabled={!temConteudo || isSending || inputLocked}
                  className="w-11 h-11 shrink-0 rounded-full fundo-neon text-white flex items-center justify-center disabled:opacity-40 shadow-[0_6px_20px_-6px_rgba(236,72,153,0.9)] transition-transform active:scale-90 cursor-pointer"
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
          <div className="flex-1 hidden md:flex flex-col items-center justify-center p-8 text-center bg-[radial-gradient(50%_60%_at_50%_40%,rgba(192,38,211,0.10),transparent)]">
            <span className="w-20 h-20 rounded-full border-2 border-zinc-200/80 flex items-center justify-center mb-4">
              <Send className="w-9 h-9 text-zinc-100 -ml-1" strokeWidth={1.6} />
            </span>
            <h3 className="text-xl font-bold text-white mb-1">Suas mensagens</h3>
            <p className="text-sm text-zinc-400 max-w-xs">
              Escolha uma conversa ao lado. Mensagens privadas, com reações e respostas.
            </p>
          </div>
        )}
      </div>

      {menuDe && (
        <MenuDaMensagem
          msg={menuDe}
          minhaReacao={menuDe.reactions?.find(r => r.userId === currentUser.id)?.emoji}
          podeInteragir={podeInteragir}
          aoReagir={e => reagir(menuDe, e)}
          aoResponder={() => responder(menuDe)}
          aoResponderTrecho={() => setTrechoDe(menuDe)}
          aoFechar={() => setMenuDe(null)}
        />
      )}
      {trechoDe && (
        <EscolherTrecho
          msg={trechoDe}
          autor={nomeDe(trechoDe)}
          aoEscolher={t => { const m = trechoDe; setTrechoDe(null); responder(m, t); }}
          aoFechar={() => setTrechoDe(null)}
        />
      )}
      {selecao && (
        <BotaoResponderTrecho
          selecao={selecao}
          aoResponder={() => { const m = porId.get(selecao.msgId); if (m) responder(m, selecao.texto); }}
        />
      )}

      {jogoAberto && activeConv && otherParticipant && (
        <MatchDesejos
          key={jogoAberto.id ?? 'novo'}
          outro={{ id: otherParticipant.id, nome: otherParticipant.displayName }}
          jogoId={jogoAberto.id}
          aoFechar={() => setJogoAberto(null)}
        />
      )}

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
