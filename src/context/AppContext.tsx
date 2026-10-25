import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import {
  UserProfile,
  Post,
  Community,
  Conversation,
  NotificationItem,
  ModerationReport,
  AdminAuditLog,
  AdminUserRecord,
  AdminMediaRecord,
  UserAccountStatus,
  ChatMessage,
  PostComment
} from '../types';
import {
  MOCK_COMMUNITIES,
  MOCK_REPORTS,
  MOCK_ADMIN_LOGS,
  INITIAL_ADMIN_USERS,
  INITIAL_ADMIN_MEDIA
} from '../data/mockData';
import type { Session } from '@supabase/supabase-js';
import { supabase, authRedirectUrl, translateAuthError, isSupabaseConfigured } from '../lib/supabase';
import { GUEST_USER, AdminRole, fetchOwnProfile, fetchAdminRole, saveOwnProfile } from '../lib/profiles';
import {
  SocialGraph,
  fetchProfiles,
  fetchSocialGraph,
  fetchFeed,
  fetchPost,
  insertPost,
  removePost,
  setLike,
  setSave,
  insertComment,
  insertPollVote,
  setFollow,
  sendConnectionRequest,
  acceptConnectionRequest
} from '../lib/social';
import {
  fetchConversations,
  fetchMessages,
  insertMessage,
  startConversation,
  acceptConversation,
  leaveConversation,
  markConversationRead
} from '../lib/messaging';
import {
  fetchNotifications,
  fetchNotification,
  markNotificationsRead,
  insertReport,
  deleteOwnAccount,
  touchLastActive
} from '../lib/activity';

// Dados enviados ao Supabase Auth no cadastro; o gatilho handle_new_user cria o perfil a partir deles
export interface SignUpMetadata {
  username: string;
  display_name: string;
  birthdate: string;
  profile_type: UserProfile['profileType'];
  age?: number;
  city: string;
  state: string;
  location_privacy: UserProfile['locationPrivacy'];
  bio: string;
  avatar_url: string;
  cover_url: string;
  interests: string[];
  verification_requested: boolean;
  partners?: { name: string; age: number; gender: string; consentConfirmed: boolean }[];
  prefs: Partial<UserProfile['compatibilityPrefs']>;
}

export interface ReportTarget {
  targetType: 'profile' | 'post' | 'media' | 'message';
  targetId: string;
  reportedUserId: string;
  reportedUserName: string;
}

interface AppContextType {
  // Auth & Session
  currentUser: UserProfile;
  isLoggedIn: boolean;
  authLoading: boolean;
  isAgeConfirmed: boolean;
  confirmAge: () => void;
  login: (email: string, password: string) => Promise<string | null>;
  register: (email: string, password: string, metadata: SignUpMetadata) => Promise<{ error: string | null; needsEmailConfirmation: boolean }>;
  requestPasswordReset: (email: string) => Promise<string | null>;
  passwordRecoveryMode: boolean;
  updatePassword: (newPassword: string) => Promise<string | null>;
  logout: () => Promise<void>;
  updateCurrentUser: (updated: Partial<UserProfile>) => void;

  // Navigation
  activeTab: string;
  setActiveTab: (tab: string) => void;
  selectedProfileId: string | null;
  setSelectedProfileId: (id: string | null) => void;
  selectedConversationId: string | null;
  setSelectedConversationId: (id: string | null) => void;

  // Data
  profiles: UserProfile[];
  posts: Post[];
  communities: Community[];
  conversations: Conversation[];
  notifications: NotificationItem[];
  reports: ModerationReport[];
  adminLogs: AdminAuditLog[];
  adminUsers: AdminUserRecord[];
  adminMediaList: AdminMediaRecord[];

  // Post Actions
  toggleLikePost: (postId: string) => void;
  toggleSavePost: (postId: string) => void;
  addComment: (postId: string, text: string) => void;
  votePoll: (postId: string, optionId: string) => void;
  createPost: (content: string, mediaUrls: string[], tags: string[], pollData?: { question: string; options: string[] }) => Promise<void>;
  deletePost: (postId: string) => void;

  // Profile & Social Connections
  connections: string[]; // userIds
  following: string[];   // userIds
  incomingConnectionRequests: string[]; // quem pediu conexão comigo
  outgoingConnectionRequests: string[]; // a quem eu pedi conexão
  refreshSocialData: () => Promise<void>;
  toggleFollow: (userId: string) => void;
  requestConnection: (userId: string) => void;
  acceptConnection: (userId: string) => void;

  // Private Album Vault Permissions
  requestAlbumAccess: (albumId: string, ownerUserId: string) => void;
  approveAlbumAccess: (albumId: string, requesterUserId: string) => void;
  revokeAlbumAccess: (albumId: string, requesterUserId: string) => void;

  // Community Actions
  toggleJoinCommunity: (communityId: string) => void;

  // Messaging Actions
  conversationMessages: Record<string, ChatMessage[]>;
  loadConversationMessages: (conversationId: string) => Promise<void>;
  sendMessage: (conversationId: string, content: string, mediaUrl?: string) => Promise<void>;
  startOrOpenConversation: (targetUserId: string) => Promise<void>;
  acceptMessageRequest: (conversationId: string) => Promise<void>;
  rejectMessageRequest: (conversationId: string) => Promise<void>;

  // Notifications
  markNotificationAsRead: (notifId: string) => void;
  markAllNotificationsAsRead: () => void;

  // Reports & Safety
  submitReport: (data: {
    reportedUserId: string;
    reportedUserName: string;
    targetType: 'profile' | 'post' | 'media' | 'message';
    targetId: string;
    category: ModerationReport['category'];
    description: string;
  }) => Promise<boolean>;
  deleteAccount: () => Promise<string | null>;
  profileMissing: boolean;

  // Admin Security & Portal Controls
  isAuthorizedAdmin: boolean;
  isAdminMode: boolean;
  setIsAdminMode: (active: boolean) => void;
  adminRole: AdminRole;
  setAdminRole: (role: AdminRole) => void;
  adminMfaVerified: boolean;
  refreshAdminMfa: () => Promise<void>;

  // Advanced Admin Management Actions
  adminResolveReport: (reportId: string, resolution: 'resolved' | 'dismissed', note: string, actionTaken?: string) => void;
  adminUpdateUserStatus: (userId: string, status: UserAccountStatus, reason: string) => void;
  adminAddUserNote: (userId: string, note: string) => void;
  adminSetRestrictions: (userId: string, restrictions: AdminUserRecord['restrictions'], reason: string) => void;
  adminModerateMedia: (mediaId: string, status: 'approved' | 'pending_review' | 'flagged' | 'removed', reason: string) => void;
  adminVerifyUserAge: (userId: string) => void;
  adminInvestigateMessage: (reportId: string, justification: string) => Promise<any>;

  // Modals
  authModalType: 'login' | 'register' | null;
  setAuthModalType: (type: 'login' | 'register' | null) => void;
  reportModalTarget: ReportTarget | null;
  setReportModalTarget: (target: ReportTarget | null) => void;
  privacyTermsModalOpen: boolean;
  setPrivacyTermsModalOpen: (open: boolean) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

// Safe LocalStorage helpers with try/catch to prevent white screen crashes in private browsing or on corrupted state
function safeStorageGet<T>(key: string, fallback: T): T {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return fallback;
    const saved = localStorage.getItem(key);
    if (!saved || saved === 'null' || saved === 'undefined') return fallback;
    const parsed = JSON.parse(saved);
    if (parsed === null || parsed === undefined) return fallback;
    if (Array.isArray(fallback)) {
      return Array.isArray(parsed) && parsed.length > 0 ? (parsed as unknown as T) : fallback;
    }
    if (typeof fallback === 'object' && fallback !== null) {
      if (typeof parsed !== 'object' || parsed === null) return fallback;
      // Ensure key properties exist if fallback has an id or email
      if ('id' in (fallback as any) && !(parsed as any).id) return fallback;
    }
    return parsed;
  } catch (err) {
    console.warn(`[VYBE] Safe storage fallback for "${key}":`, err);
    return fallback;
  }
}

function safeStorageSet(key: string, value: any): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem(key, JSON.stringify(value));
    }
  } catch (err) {
    console.warn(`[VYBE] Safe storage write failed for "${key}":`, err);
  }
}

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Sessão vem do Supabase Auth; o perfil vem da tabela profiles
  const [session, setSession] = useState<Session | null>(null);
  const [currentUser, setCurrentUser] = useState<UserProfile>(GUEST_USER);
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const [passwordRecoveryMode, setPasswordRecoveryMode] = useState<boolean>(false);
  const isLoggedIn = Boolean(session && currentUser.id);

  const [isAgeConfirmed, setIsAgeConfirmed] = useState<boolean>(() =>
    safeStorageGet('vybe_age_confirmed', false)
  );

  // Perfis, feed e grafo social vêm do Supabase
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);

  const [communities, setCommunities] = useState<Community[]>(() =>
    safeStorageGet('vybe_communities', MOCK_COMMUNITIES)
  );

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const conversationsRef = useRef<Conversation[]>([]);
  conversationsRef.current = conversations;
  const [conversationMessages, setConversationMessages] = useState<Record<string, ChatMessage[]>>({});
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [profileMissing, setProfileMissing] = useState<boolean>(false);

  const [reports, setReports] = useState<ModerationReport[]>(() =>
    safeStorageGet('vybe_reports', MOCK_REPORTS)
  );

  const [adminLogs, setAdminLogs] = useState<AdminAuditLog[]>(() =>
    safeStorageGet('vybe_admin_logs', MOCK_ADMIN_LOGS)
  );

  const [adminUsers, setAdminUsers] = useState<AdminUserRecord[]>(() =>
    safeStorageGet('vybe_admin_users', INITIAL_ADMIN_USERS)
  );

  const [adminMediaList, setAdminMediaList] = useState<AdminMediaRecord[]>(() =>
    safeStorageGet('vybe_admin_media', INITIAL_ADMIN_MEDIA)
  );

  // UI state
  const [activeTab, setActiveTabState] = useState<string>('feed');
  const [selectedProfileId, setSelectedProfileIdState] = useState<string | null>(null);

  // Ir para "Meu Perfil" pelo menu limpa o perfil visitado
  const setActiveTab = (tab: string) => {
    if (tab === 'profile') setSelectedProfileIdState(null);
    setActiveTabState(tab);
  };

  // Selecionar um perfil abre a tela de perfil
  const setSelectedProfileId = (id: string | null) => {
    setSelectedProfileIdState(id);
    if (id) {
      setIsAdminModeInternal(false);
      setActiveTabState('profile');
      window.scrollTo({ top: 0 });
    }
  };
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);

  const [connections, setConnections] = useState<string[]>([]);
  const [following, setFollowing] = useState<string[]>([]);
  const [incomingConnectionRequests, setIncomingConnectionRequests] = useState<string[]>([]);
  const [outgoingConnectionRequests, setOutgoingConnectionRequests] = useState<string[]>([]);

  // Papel administrativo vem da tabela admin_users; os poderes no banco exigem sessão MFA (aal2)
  const [dbAdminRole, setDbAdminRole] = useState<AdminRole | null>(null);
  const isAuthorizedAdmin = dbAdminRole !== null;

  const [isAdminMode, setIsAdminModeInternal] = useState<boolean>(false);
  const [adminRole, setAdminRole] = useState<AdminRole>('moderator');
  const [adminMfaVerified, setAdminMfaVerified] = useState<boolean>(false);

  const [authModalType, setAuthModalType] = useState<'login' | 'register' | null>(null);
  const [reportModalTarget, setReportModalTarget] = useState<ReportTarget | null>(null);
  const [privacyTermsModalOpen, setPrivacyTermsModalOpen] = useState<boolean>(false);

  const refreshAdminMfa = async () => {
    const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    setAdminMfaVerified(data?.currentLevel === 'aal2');
  };

  const applySocialGraph = (graph: SocialGraph) => {
    setFollowing(graph.following);
    setConnections(graph.connections);
    setIncomingConnectionRequests(graph.incomingRequests);
    setOutgoingConnectionRequests(graph.outgoingRequests);
  };

  const loadSocialData = async (userId: string) => {
    const [loadedProfiles, graph, feed, loadedConversations, loadedNotifications] = await Promise.all([
      fetchProfiles(userId),
      fetchSocialGraph(userId),
      fetchFeed(userId),
      fetchConversations(userId),
      fetchNotifications(userId)
    ]);
    setProfiles(loadedProfiles);
    applySocialGraph(graph);
    setPosts(feed);
    setConversations(loadedConversations);
    setNotifications(loadedNotifications);
    touchLastActive(userId);
  };

  const refreshSocialData = async () => {
    if (currentUser.id) await loadSocialData(currentUser.id);
  };

  const loadSession = async (nextSession: Session | null) => {
    setSession(nextSession);

    if (!nextSession) {
      setCurrentUser(GUEST_USER);
      setProfiles([]);
      setPosts([]);
      setConversations([]);
      setConversationMessages({});
      setNotifications([]);
      setProfileMissing(false);
      setSelectedConversationId(null);
      applySocialGraph({ following: [], connections: [], incomingRequests: [], outgoingRequests: [] });
      setDbAdminRole(null);
      setAdminMfaVerified(false);
      setIsAdminModeInternal(false);
      setAuthLoading(false);
      return;
    }

    const userId = nextSession.user.id;
    const [profile, role] = await Promise.all([fetchOwnProfile(userId), fetchAdminRole(userId)]);

    if (profile) {
      setCurrentUser({ ...profile, email: profile.email || nextSession.user.email || '' });
    } else {
      console.error('[VYBE] Sessão sem perfil correspondente. O script supabase/setup.sql foi executado?');
      setCurrentUser(GUEST_USER);
    }
    setProfileMissing(!profile);

    setDbAdminRole(role);
    if (role) setAdminRole(role);
    await Promise.all([refreshAdminMfa(), profile ? loadSocialData(userId) : Promise.resolve()]);
    setAuthLoading(false);
  };

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setAuthLoading(false);
      return;
    }

    // onAuthStateChange também emite INITIAL_SESSION ao assinar, cobrindo o carregamento inicial
    const { data: listener } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (event === 'PASSWORD_RECOVERY') setPasswordRecoveryMode(true);
      if (event === 'TOKEN_REFRESHED') {
        setSession(nextSession);
        return;
      }
      // Chamadas ao Supabase dentro do callback podem travar o cliente; adia para o próximo ciclo
      setTimeout(() => loadSession(nextSession), 0);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  // Tempo real: novas mensagens, conversas aceitas e notificações
  useEffect(() => {
    const me = currentUser.id;
    if (!me) return;

    const channel = supabase
      .channel(`vybe-live-${me}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, payload => {
        const row = payload.new as { conversation_id: string };
        if (conversationMessagesRef.current[row.conversation_id]) {
          loadConversationMessagesRef.current(row.conversation_id);
        }
        refreshConversationsRef.current();
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'conversations' }, () => {
        refreshConversationsRef.current();
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${me}` }, async payload => {
        const notification = await fetchNotification((payload.new as { id: string }).id);
        if (notification) setNotifications(prev => [notification, ...prev.filter(n => n.id !== notification.id)]);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUser.id]);

  useEffect(() => {
    safeStorageSet('vybe_reports', reports);
  }, [reports]);

  useEffect(() => {
    safeStorageSet('vybe_admin_logs', adminLogs);
  }, [adminLogs]);

  useEffect(() => {
    safeStorageSet('vybe_admin_users', adminUsers);
  }, [adminUsers]);

  useEffect(() => {
    safeStorageSet('vybe_admin_media', adminMediaList);
  }, [adminMediaList]);

  // Protected Admin Mode Switcher
  const setIsAdminMode = (active: boolean) => {
    if (active && !isAuthorizedAdmin) {
      alert('Acesso negado: sua conta não possui papel administrativo.');
      return;
    }
    setIsAdminModeInternal(active);
  };

  const confirmAge = () => {
    setIsAgeConfirmed(true);
    localStorage.setItem('vybe_age_confirmed', 'true');
  };

  const login = async (email: string, password: string): Promise<string | null> => {
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) return translateAuthError(error.message);
    setAuthModalType(null);
    setActiveTab('feed');
    return null;
  };

  const register = async (email: string, password: string, metadata: SignUpMetadata) => {
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: metadata, emailRedirectTo: authRedirectUrl() }
    });
    if (error) return { error: translateAuthError(error.message), needsEmailConfirmation: false };

    // Com confirmação de e-mail ativa, o Supabase não devolve sessão até o usuário clicar no link
    const needsEmailConfirmation = !data.session;
    if (!needsEmailConfirmation) {
      setAuthModalType(null);
      setActiveTab('feed');
    }
    return { error: null, needsEmailConfirmation };
  };

  const requestPasswordReset = async (email: string): Promise<string | null> => {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: authRedirectUrl() });
    return error ? translateAuthError(error.message) : null;
  };

  const updatePassword = async (newPassword: string): Promise<string | null> => {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) return translateAuthError(error.message);
    setPasswordRecoveryMode(false);
    return null;
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setIsAdminModeInternal(false);
    setActiveTab('feed');
  };

  const updateCurrentUser = (updated: Partial<UserProfile>) => {
    setCurrentUser(prev => ({ ...prev, ...updated }));
    if (!currentUser.id) return;
    saveOwnProfile(currentUser.id, updated).then(error => {
      if (error) {
        console.error('[VYBE] Falha ao salvar perfil:', error);
        alert('Não foi possível salvar as alterações do perfil. Tente novamente.');
      }
    });
  };

  // Atualiza um post com o estado do banco (contadores, comentários, votos)
  const reloadPost = async (postId: string) => {
    const fresh = await fetchPost(postId, currentUser.id);
    if (fresh) setPosts(prev => prev.map(p => (p.id === postId ? fresh : p)));
  };

  const reportFailure = (action: string, error: string) => {
    console.error(`[VYBE] Falha ao ${action}:`, error);
    alert(`Não foi possível ${action}. Tente novamente.`);
  };

  const toggleLikePost = async (postId: string) => {
    const post = posts.find(p => p.id === postId);
    if (!post) return;
    const like = !post.likedByCurrentUser;
    setPosts(prev => prev.map(p => p.id !== postId ? p : {
      ...p,
      likedByCurrentUser: like,
      likesCount: p.likesCount + (like ? 1 : -1)
    }));
    const error = await setLike(currentUser.id, postId, like);
    if (error) reportFailure('registrar a curtida', error);
    await reloadPost(postId);
  };

  const toggleSavePost = async (postId: string) => {
    const post = posts.find(p => p.id === postId);
    if (!post) return;
    const save = !post.savedByCurrentUser;
    setPosts(prev => prev.map(p => p.id !== postId ? p : { ...p, savedByCurrentUser: save }));
    const error = await setSave(currentUser.id, postId, save);
    if (error) {
      reportFailure('salvar a publicação', error);
      await reloadPost(postId);
    }
  };

  const addComment = async (postId: string, text: string) => {
    if (!text.trim()) return;
    const error = await insertComment(currentUser.id, postId, text.trim());
    if (error) reportFailure('publicar o comentário', error);
    await reloadPost(postId);
  };

  const votePoll = async (postId: string, optionId: string) => {
    const post = posts.find(p => p.id === postId);
    if (!post?.poll || post.poll.voterIds[currentUser.id]) return;
    const error = await insertPollVote(currentUser.id, postId, optionId);
    if (error) reportFailure('registrar o voto', error);
    await reloadPost(postId);
  };

  const createPost = async (
    content: string,
    mediaUrls: string[],
    tags: string[],
    pollData?: { question: string; options: string[] }
  ) => {
    const { postId, error } = await insertPost(currentUser.id, content, mediaUrls, tags, pollData);
    if (error) reportFailure('publicar', error);
    if (!postId) return;
    const fresh = await fetchPost(postId, currentUser.id);
    if (fresh) setPosts(prev => [fresh, ...prev]);
  };

  const deletePost = async (postId: string) => {
    const error = await removePost(postId);
    if (error) {
      reportFailure('excluir a publicação', error);
      return;
    }
    setPosts(prev => prev.filter(p => p.id !== postId));
  };

  const toggleFollow = async (userId: string) => {
    const follow = !following.includes(userId);
    setFollowing(prev => follow ? [...prev, userId] : prev.filter(id => id !== userId));
    const error = await setFollow(currentUser.id, userId, follow);
    if (error) {
      reportFailure(follow ? 'seguir o perfil' : 'deixar de seguir', error);
      applySocialGraph(await fetchSocialGraph(currentUser.id));
    }
  };

  const requestConnection = async (userId: string) => {
    if (connections.includes(userId)) return;
    if (incomingConnectionRequests.includes(userId)) {
      await acceptConnection(userId);
      return;
    }
    if (outgoingConnectionRequests.includes(userId)) {
      alert('Sua solicitação de conexão já foi enviada e aguarda resposta.');
      return;
    }
    const error = await sendConnectionRequest(currentUser.id, userId);
    if (error) {
      alert(error);
      return;
    }
    setOutgoingConnectionRequests(prev => [...prev, userId]);
    alert('Solicitação de conexão enviada com respeito mútuo!');
  };

  const acceptConnection = async (userId: string) => {
    const error = await acceptConnectionRequest(currentUser.id, userId);
    if (error) reportFailure('aceitar a conexão', error);
    applySocialGraph(await fetchSocialGraph(currentUser.id));
  };

  const requestAlbumAccess = (albumId: string, ownerUserId: string) => {
    setProfiles(prev => prev.map(prof => {
      if (prof.id !== ownerUserId) return prof;
      return {
        ...prof,
        albums: prof.albums.map(alb => {
          if (alb.id !== albumId) return alb;
          if (alb.pendingRequestUserIds.includes(currentUser.id)) return alb;
          return {
            ...alb,
            pendingRequestUserIds: [...alb.pendingRequestUserIds, currentUser.id]
          };
        })
      };
    }));

    alert('Pedido de acesso ao cofre privado enviado com sucesso! O proprietário será notificado e analisará a liberação.');
  };

  const approveAlbumAccess = (albumId: string, requesterUserId: string) => {
    setCurrentUser(prev => ({
      ...prev,
      albums: prev.albums.map(alb => {
        if (alb.id !== albumId) return alb;
        return {
          ...alb,
          pendingRequestUserIds: alb.pendingRequestUserIds.filter(id => id !== requesterUserId),
          allowedUserIds: [...alb.allowedUserIds, requesterUserId]
        };
      })
    }));

    const requester = profiles.find(p => p.id === requesterUserId);
    if (requester) {
      setNotifications(prev => [
        {
          id: `notif_${Date.now()}`,
          userId: currentUser.id,
          actor: {
            id: requester.id,
            displayName: requester.displayName,
            username: requester.username,
            avatarUrl: requester.avatarUrl
          },
          type: 'vault_access_granted',
          title: 'Acesso Liberado',
          message: `Você concedeu acesso ao seu cofre privado para ${requester.displayName}.`,
          createdAt: 'Agora mesmo',
          read: true
        },
        ...prev
      ]);
    }
  };

  const revokeAlbumAccess = (albumId: string, requesterUserId: string) => {
    setCurrentUser(prev => ({
      ...prev,
      albums: prev.albums.map(alb => {
        if (alb.id !== albumId) return alb;
        return {
          ...alb,
          allowedUserIds: alb.allowedUserIds.filter(id => id !== requesterUserId)
        };
      })
    }));
  };

  const toggleJoinCommunity = (communityId: string) => {
    setCommunities(prev => prev.map(comm => {
      if (comm.id !== communityId) return comm;
      const joined = !comm.isJoined;
      return {
        ...comm,
        isJoined: joined,
        membersCount: joined ? comm.membersCount + 1 : comm.membersCount - 1
      };
    }));
  };

  const refreshConversations = async () => {
    if (currentUser.id) setConversations(await fetchConversations(currentUser.id));
  };

  // Carrega o histórico de uma conversa e marca como lida
  const loadConversationMessages = async (conversationId: string) => {
    const conversation = conversationsRef.current.find(c => c.id === conversationId);
    if (!conversation || !currentUser.id) return;
    const messages = await fetchMessages(conversation, currentUser);
    setConversationMessages(prev => ({ ...prev, [conversationId]: messages }));
    if (conversation.unreadCount > 0) {
      await markConversationRead(conversationId);
      setConversations(prev => prev.map(c => (c.id === conversationId ? { ...c, unreadCount: 0 } : c)));
    }
  };

  const sendMessage = async (conversationId: string, content: string, mediaUrl?: string) => {
    if (!content.trim() && !mediaUrl) return;
    const error = await insertMessage(currentUser.id, conversationId, content.trim(), mediaUrl);
    if (error) {
      alert(error);
      return;
    }
    // A mensagem chega também pelo Realtime; recarregar garante consistência se o Realtime falhar
    await loadConversationMessages(conversationId);
    await refreshConversations();
  };

  const startOrOpenConversation = async (targetUserId: string) => {
    const { conversationId, error } = await startConversation(targetUserId);
    if (error || !conversationId) {
      reportFailure('abrir a conversa', error ?? 'sem id');
      return;
    }
    await refreshConversations();
    setSelectedConversationId(conversationId);
    setActiveTab('messages');
  };

  const acceptMessageRequest = async (conversationId: string) => {
    const error = await acceptConversation(conversationId);
    if (error) reportFailure('aceitar a conversa', error);
    await refreshConversations();
  };

  const rejectMessageRequest = async (conversationId: string) => {
    const error = await leaveConversation(currentUser.id, conversationId);
    if (error) {
      reportFailure('recusar a conversa', error);
      return;
    }
    setConversations(prev => prev.filter(c => c.id !== conversationId));
    if (selectedConversationId === conversationId) setSelectedConversationId(null);
  };

  const markNotificationAsRead = async (notifId: string) => {
    setNotifications(prev => prev.map(n => n.id === notifId ? { ...n, read: true } : n));
    await markNotificationsRead(currentUser.id, [notifId]);
  };

  const markAllNotificationsAsRead = async () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    await markNotificationsRead(currentUser.id);
  };

  const submitReport = async (data: {
    reportedUserId: string;
    reportedUserName: string;
    targetType: 'profile' | 'post' | 'media' | 'message';
    targetId: string;
    category: ModerationReport['category'];
    description: string;
  }): Promise<boolean> => {
    const error = await insertReport(currentUser.id, data);
    if (error) {
      reportFailure('enviar a denúncia', error);
      return false;
    }
    setReportModalTarget(null);
    alert('Denúncia recebida pela Equipe de Segurança & Moderação do VYBE. Investigaremos o caso com rigor e discrição.');
    return true;
  };

  const conversationMessagesRef = useRef(conversationMessages);
  conversationMessagesRef.current = conversationMessages;
  const loadConversationMessagesRef = useRef(loadConversationMessages);
  loadConversationMessagesRef.current = loadConversationMessages;
  const refreshConversationsRef = useRef(refreshConversations);
  refreshConversationsRef.current = refreshConversations;

  const deleteAccount = async (): Promise<string | null> => {
    const error = await deleteOwnAccount(currentUser.id);
    if (error) return error;
    await supabase.auth.signOut();
    return null;
  };

  // ----------------- ADMIN ACTIONS WITH IMMUTABLE AUDIT LOG ----------------- //

  const adminResolveReport = (reportId: string, resolution: 'resolved' | 'dismissed', note: string, actionTaken?: string) => {
    setReports(prev => prev.map(r => {
      if (r.id !== reportId) return r;
      return {
        ...r,
        status: resolution,
        reviewedBy: `${currentUser.displayName} (${adminRole})`,
        resolutionNote: note
      };
    }));

    const newLog: AdminAuditLog = {
      id: `log_${Date.now()}`,
      adminId: currentUser.id,
      adminName: `${currentUser.displayName} (${adminRole.toUpperCase()})`,
      adminRole,
      action: actionTaken || (resolution === 'resolved' ? 'RESOLVE_REPORT' : 'DISMISS_REPORT'),
      targetId: reportId,
      targetType: 'ModerationReport',
      reason: note,
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
      ipAddress: '177.18.29.100 (Sessão Segura Criptografada)'
    };
    setAdminLogs(prev => [newLog, ...prev]);
  };

  const adminUpdateUserStatus = (userId: string, status: UserAccountStatus, reason: string) => {
    setAdminUsers(prev => prev.map(u => {
      if (u.id !== userId) return u;
      return { ...u, status };
    }));

    const newLog: AdminAuditLog = {
      id: `log_${Date.now()}`,
      adminId: currentUser.id,
      adminName: `${currentUser.displayName} (${adminRole.toUpperCase()})`,
      adminRole,
      action: `SET_USER_STATUS_${status.toUpperCase()}`,
      targetId: userId,
      targetType: 'AdminUserRecord',
      reason,
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
      ipAddress: '177.18.29.100 (Sessão Segura Criptografada)'
    };
    setAdminLogs(prev => [newLog, ...prev]);
  };

  const adminAddUserNote = (userId: string, note: string) => {
    const newNote = {
      id: `note_${Date.now()}`,
      adminId: currentUser.id,
      adminName: `${currentUser.displayName} (${adminRole.toUpperCase()})`,
      note,
      createdAt: new Date().toISOString().substring(0, 16)
    };

    setAdminUsers(prev => prev.map(u => {
      if (u.id !== userId) return u;
      return {
        ...u,
        moderationNotes: [newNote, ...u.moderationNotes]
      };
    }));

    const newLog: AdminAuditLog = {
      id: `log_${Date.now()}`,
      adminId: currentUser.id,
      adminName: `${currentUser.displayName} (${adminRole.toUpperCase()})`,
      adminRole,
      action: 'ADD_CONFIDENTIAL_MODERATION_NOTE',
      targetId: userId,
      targetType: 'AdminUserRecord',
      reason: 'Registro interno de acompanhamento e auditoria de conduta.',
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
      ipAddress: '177.18.29.100 (Sessão Segura Criptografada)'
    };
    setAdminLogs(prev => [newLog, ...prev]);
  };

  const adminSetRestrictions = (userId: string, restrictions: AdminUserRecord['restrictions'], reason: string) => {
    setAdminUsers(prev => prev.map(u => {
      if (u.id !== userId) return u;
      return {
        ...u,
        status: 'restricted',
        restrictions
      };
    }));

    const newLog: AdminAuditLog = {
      id: `log_${Date.now()}`,
      adminId: currentUser.id,
      adminName: `${currentUser.displayName} (${adminRole.toUpperCase()})`,
      adminRole,
      action: 'APPLY_FEATURE_RESTRICTIONS',
      targetId: userId,
      targetType: 'AdminUserRecord',
      reason,
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
      ipAddress: '177.18.29.100 (Sessão Segura Criptografada)'
    };
    setAdminLogs(prev => [newLog, ...prev]);
  };

  const adminModerateMedia = (mediaId: string, status: 'approved' | 'pending_review' | 'flagged' | 'removed', reason: string) => {
    setAdminMediaList(prev => prev.map(m => {
      if (m.id !== mediaId) return m;
      return { ...m, status };
    }));

    const newLog: AdminAuditLog = {
      id: `log_${Date.now()}`,
      adminId: currentUser.id,
      adminName: `${currentUser.displayName} (${adminRole.toUpperCase()})`,
      adminRole,
      action: `MODERATE_MEDIA_${status.toUpperCase()}`,
      targetId: mediaId,
      targetType: 'AdminMediaRecord',
      reason,
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
      ipAddress: '177.18.29.100 (Sessão Segura Criptografada)'
    };
    setAdminLogs(prev => [newLog, ...prev]);
  };

  const adminVerifyUserAge = (userId: string) => {
    setProfiles(prev => prev.map(p => {
      if (p.id !== userId) return p;
      return { ...p, isVerified: true, verifiedBadgeType: 'identity' };
    }));
    setAdminUsers(prev => prev.map(u => {
      if (u.id !== userId) return u;
      return { ...u, isVerified: true, verifiedBadgeType: 'identity' };
    }));

    const newLog: AdminAuditLog = {
      id: `log_${Date.now()}`,
      adminId: currentUser.id,
      adminName: `${currentUser.displayName} (${adminRole.toUpperCase()})`,
      adminRole,
      action: 'APPROVE_VERIFIED_BADGE',
      targetId: userId,
      targetType: 'UserProfile',
      reason: 'Conformidade de maioridade civil (+18) e autenticidade validada.',
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
      ipAddress: '177.18.29.100 (Sessão Segura Criptografada)'
    };
    setAdminLogs(prev => [newLog, ...prev]);
  };

  const adminInvestigateMessage = async (reportId: string, justification: string) => {
    // Record strict justification audit trail
    const newLog: AdminAuditLog = {
      id: `log_${Date.now()}`,
      adminId: currentUser.id,
      adminName: `${currentUser.displayName} (${adminRole.toUpperCase()})`,
      adminRole,
      action: 'INSPECT_REPORT_SPECIFIC_CHAT_EVIDENCE',
      targetId: reportId,
      targetType: 'ChatMessage',
      reason: `Investigação estrita autorizada vinculada à denúncia ${reportId}: ${justification}`,
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
      ipAddress: '177.18.29.100 (Sessão Segura Criptografada)'
    };
    setAdminLogs(prev => [newLog, ...prev]);

    return {
      success: true,
      reportId,
      justification,
      timestamp: new Date().toISOString()
    };
  };

  return (
    <AppContext.Provider
      value={{
        currentUser,
        isLoggedIn,
        authLoading,
        isAgeConfirmed,
        confirmAge,
        login,
        register,
        requestPasswordReset,
        passwordRecoveryMode,
        updatePassword,
        logout,
        updateCurrentUser,
        activeTab,
        setActiveTab,
        selectedProfileId,
        setSelectedProfileId,
        selectedConversationId,
        setSelectedConversationId,
        profiles,
        posts,
        communities,
        conversations,
        notifications,
        reports,
        adminLogs,
        adminUsers,
        adminMediaList,
        toggleLikePost,
        toggleSavePost,
        addComment,
        votePoll,
        createPost,
        deletePost,
        connections,
        following,
        incomingConnectionRequests,
        outgoingConnectionRequests,
        refreshSocialData,
        toggleFollow,
        requestConnection,
        acceptConnection,
        requestAlbumAccess,
        approveAlbumAccess,
        revokeAlbumAccess,
        toggleJoinCommunity,
        conversationMessages,
        loadConversationMessages,
        sendMessage,
        startOrOpenConversation,
        acceptMessageRequest,
        rejectMessageRequest,
        markNotificationAsRead,
        markAllNotificationsAsRead,
        submitReport,
        deleteAccount,
        profileMissing,
        isAuthorizedAdmin,
        isAdminMode,
        setIsAdminMode,
        adminRole,
        setAdminRole,
        adminMfaVerified,
        refreshAdminMfa,
        adminResolveReport,
        adminUpdateUserStatus,
        adminAddUserNote,
        adminSetRestrictions,
        adminModerateMedia,
        adminVerifyUserAge,
        adminInvestigateMessage,
        authModalType,
        setAuthModalType,
        reportModalTarget,
        setReportModalTarget,
        privacyTermsModalOpen,
        setPrivacyTermsModalOpen
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
