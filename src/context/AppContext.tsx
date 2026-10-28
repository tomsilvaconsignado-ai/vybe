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
  PostComment,
  StoryGroup,
  VybeEvent,
  Ad,
  ProfileType
} from '../types';
import type { Session } from '@supabase/supabase-js';
import { supabase, authRedirectUrl, authLinkError, translateAuthError, isSupabaseConfigured } from '../lib/supabase';
import { GUEST_USER, AdminRole, fetchOwnProfile, fetchAdminRole, saveOwnProfile } from '../lib/profiles';
import { calculateCompatibility, CompatibilityBreakdown } from '../utils/compatibility';
import { fetchCompatibilityMap } from '../lib/compatibility';
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
  acceptConnectionRequest,
  fetchCommunities,
  setCommunityMembership,
  BlockedUser,
  fetchBlockedUsers,
  blockUser as blockUserRequest,
  unblockUser as unblockUserRequest
} from '../lib/social';
import {
  fetchConversations,
  fetchMessages,
  insertMessage,
  startConversation,
  acceptConversation,
  declineConversation,
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
import * as adminApi from '../lib/admin';
import { requestVaultAccess, grantVaultAccess, removeVaultAccess } from '../lib/albums';
import { fetchStoryGroups } from '../lib/stories';
import { fetchEvents, fetchActiveAds, setEventRsvp } from '../lib/events';
import type { EvidenceMessage } from '../lib/admin';

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
  resendConfirmationEmail: (email: string) => Promise<string | null>;
  passwordRecoveryMode: boolean;
  updatePassword: (newPassword: string) => Promise<string | null>;
  logout: () => Promise<void>;
  updateCurrentUser: (updated: Partial<UserProfile>) => void;

  // Navigation
  activeTab: string;
  setActiveTab: (tab: string) => void;
  selectedProfileId: string | null;
  discoverSearch: string;
  setDiscoverSearch: (query: string) => void;
  setSelectedProfileId: (id: string | null) => void;
  selectedConversationId: string | null;
  setSelectedConversationId: (id: string | null) => void;

  // Data
  profiles: UserProfile[];
  getCompatibility: (profile: UserProfile) => CompatibilityBreakdown;
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
  postCache: Record<string, Post>;
  cachePosts: (list: Post[]) => void;

  // Profile & Social Connections
  connections: string[]; // userIds
  following: string[];   // userIds
  incomingConnectionRequests: string[]; // quem pediu conexão comigo
  outgoingConnectionRequests: string[]; // a quem eu pedi conexão
  refreshSocialData: () => Promise<void>;
  toggleFollow: (userId: string) => void;
  requestConnection: (userId: string) => void;
  acceptConnection: (userId: string) => void;

  // Bloqueio (a pessoa bloqueada não vê mais o perfil nem consegue interagir)
  blockedUsers: BlockedUser[];
  blockUser: (userId: string) => Promise<boolean>;
  unblockUser: (userId: string) => Promise<void>;

  // Private Album Vault Permissions
  requestAlbumAccess: (albumId: string, ownerUserId: string) => Promise<boolean>;
  approveAlbumAccess: (albumId: string, requesterUserId: string) => Promise<boolean>;
  revokeAlbumAccess: (albumId: string, requesterUserId: string) => Promise<boolean>;

  // Community Actions
  toggleJoinCommunity: (communityId: string) => void;

  // Stories, eventos e publicidade
  storyGroups: StoryGroup[];
  refreshStories: () => Promise<void>;
  events: VybeEvent[];
  refreshEvents: () => Promise<void>;
  rsvpEvent: (eventId: string, status: 'going' | 'interested' | null) => Promise<void>;
  ads: Ad[];

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
  adminResolveReport: (reportId: string, resolution: 'resolved' | 'dismissed', note: string, actionTaken?: string) => Promise<boolean>;
  adminUpdateUserStatus: (userId: string, status: UserAccountStatus, reason: string) => Promise<boolean>;
  adminAddUserNote: (userId: string, note: string) => Promise<boolean>;
  adminSetRestrictions: (userId: string, restrictions: AdminUserRecord['restrictions'], reason: string) => Promise<boolean>;
  adminModerateMedia: (mediaId: string, status: 'approved' | 'pending_review' | 'flagged' | 'removed', reason: string) => Promise<boolean>;
  adminVerifyUserAge: (userId: string, reason?: string) => Promise<boolean>;
  adminSetUserRole: (userId: string, role: AdminRole | null, reason: string) => Promise<boolean>;
  adminInvestigateMessage: (reportId: string, justification: string) => Promise<{ messages: EvidenceMessage[]; error: string | null }>;
  refreshAdminData: () => Promise<void>;

  // Modals
  authModalType: 'login' | 'register' | null;
  setAuthModalType: (type: 'login' | 'register' | null) => void;
  registerProfileType: ProfileType | null;
  setRegisterProfileType: (type: ProfileType | null) => void;
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
    console.warn(`[Vybelog] Safe storage fallback for "${key}":`, err);
    return fallback;
  }
}

function safeStorageSet(key: string, value: any): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem(key, JSON.stringify(value));
    }
  } catch (err) {
    console.warn(`[Vybelog] Safe storage write failed for "${key}":`, err);
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
  // Scores de compatibilidade calculados no banco (RPC). Chave: id do perfil.
  const [compatibilityMap, setCompatibilityMap] = useState<Map<string, CompatibilityBreakdown>>(new Map());
  const [posts, setPosts] = useState<Post[]>([]);
  const [postCache, setPostCache] = useState<Record<string, Post>>({});

  const [communities, setCommunities] = useState<Community[]>([]);
  const [storyGroups, setStoryGroups] = useState<StoryGroup[]>([]);
  const [events, setEvents] = useState<VybeEvent[]>([]);
  const [ads, setAds] = useState<Ad[]>([]);

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const conversationsRef = useRef<Conversation[]>([]);
  conversationsRef.current = conversations;
  const [conversationMessages, setConversationMessages] = useState<Record<string, ChatMessage[]>>({});
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [profileMissing, setProfileMissing] = useState<boolean>(false);

  // Dados do painel: carregados apenas para a equipe com MFA
  const [reports, setReports] = useState<ModerationReport[]>([]);
  const [adminLogs, setAdminLogs] = useState<AdminAuditLog[]>([]);
  const [adminUsers, setAdminUsers] = useState<AdminUserRecord[]>([]);
  const [adminMediaList, setAdminMediaList] = useState<AdminMediaRecord[]>([]);

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
  const [discoverSearch, setDiscoverSearch] = useState<string>('');

  const [connections, setConnections] = useState<string[]>([]);
  const [following, setFollowing] = useState<string[]>([]);
  const [incomingConnectionRequests, setIncomingConnectionRequests] = useState<string[]>([]);
  const [outgoingConnectionRequests, setOutgoingConnectionRequests] = useState<string[]>([]);
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);

  // Papel administrativo vem da tabela admin_users; os poderes no banco exigem sessão MFA (aal2)
  const [dbAdminRole, setDbAdminRole] = useState<AdminRole | null>(null);
  const isAuthorizedAdmin = dbAdminRole !== null;

  const [isAdminMode, setIsAdminModeInternal] = useState<boolean>(false);
  const [adminRole, setAdminRole] = useState<AdminRole>('moderator');
  const [adminMfaVerified, setAdminMfaVerified] = useState<boolean>(false);

  const [authModalType, setAuthModalType] = useState<'login' | 'register' | null>(null);
  // Tipo de perfil escolhido no card da página inicial, usado como padrão no cadastro
  const [registerProfileType, setRegisterProfileType] = useState<ProfileType | null>(null);
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
    const [loadedProfiles, graph, feed, loadedConversations, loadedNotifications, loadedCommunities, blocked] = await Promise.all([
      fetchProfiles(userId),
      fetchSocialGraph(userId),
      fetchFeed(userId),
      fetchConversations(userId),
      fetchNotifications(userId),
      fetchCommunities(userId),
      fetchBlockedUsers(userId)
    ]);
    setCommunities(loadedCommunities);
    setBlockedUsers(blocked);
    // Stories, eventos e anúncios não bloqueiam a abertura do app
    fetchStoryGroups(userId).then(setStoryGroups);
    fetchEvents(userId).then(setEvents);
    fetchActiveAds().then(setAds);
    // Quem eu bloqueei continua visível no banco (para a lista de desbloqueio), mas não na descoberta
    const blockedIds = new Set(blocked.map(b => b.id));
    const visibleProfiles = loadedProfiles.filter(p => !blockedIds.has(p.id));
    setProfiles(visibleProfiles);
    // Pré-calcula os scores no banco; se a RPC não existir ainda, o mapa fica
    // vazio e getCompatibility recai no cálculo local.
    fetchCompatibilityMap(visibleProfiles.map(p => p.id)).then(setCompatibilityMap);
    applySocialGraph(graph);
    setPosts(feed);
    setConversations(loadedConversations);
    setNotifications(loadedNotifications);
    touchLastActive(userId);
  };

  const refreshSocialData = async () => {
    if (currentUser.id) await loadSocialData(currentUser.id);
  };

  // Score de compatibilidade: usa o valor vindo do banco (RPC) e, enquanto ele
  // não chega (ou a RPC não existe), recai no cálculo local — assim nada quebra
  // durante a migração nem antes de trancar o RLS das preferências.
  const getCompatibility = (profile: UserProfile): CompatibilityBreakdown =>
    compatibilityMap.get(profile.id) ?? calculateCompatibility(currentUser, profile);

  const loadSession = async (nextSession: Session | null) => {
    setSession(nextSession);

    if (!nextSession) {
      setCurrentUser(GUEST_USER);
      setProfiles([]);
      setPosts([]);
      setConversations([]);
      setConversationMessages({});
      setCommunities([]);
      setStoryGroups([]);
      setEvents([]);
      setAds([]);
      setReports([]);
      setAdminLogs([]);
      setAdminUsers([]);
      setAdminMediaList([]);
      setNotifications([]);
      setProfileMissing(false);
      setSelectedConversationId(null);
      applySocialGraph({ following: [], connections: [], incomingRequests: [], outgoingRequests: [] });
      setBlockedUsers([]);
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
      console.error('[Vybelog] Sessão sem perfil correspondente. O script supabase/setup.sql foi executado?');
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

    if (authLinkError) {
      alert(authLinkError);
      setAuthModalType('login');
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

  // Ao voltar para o app (aba ou celular), atualiza feed, perfis e comunidades — no máximo 1x por minuto
  useEffect(() => {
    const me = currentUser.id;
    if (!me) return;
    let lastRefresh = Date.now();
    const onVisible = () => {
      if (document.visibilityState !== 'visible' || Date.now() - lastRefresh < 60_000) return;
      lastRefresh = Date.now();
      loadSocialData(me);
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser.id]);

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

  const resendConfirmationEmail = async (email: string): Promise<string | null> => {
    const { error } = await supabase.auth.resend({ type: 'signup', email: email.trim(), options: { emailRedirectTo: authRedirectUrl() } });
    return error ? translateAuthError(error.message) : null;
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
    // Continua no Vybelog, na tela de login
    setAuthModalType('login');
  };

  const updateCurrentUser = (updated: Partial<UserProfile>) => {
    setCurrentUser(prev => ({ ...prev, ...updated }));
    if (!currentUser.id) return;
    saveOwnProfile(currentUser.id, updated).then(error => {
      if (error) {
        console.error('[Vybelog] Falha ao salvar perfil:', error);
        alert('Não foi possível salvar as alterações do perfil. Tente novamente.');
      }
    });
  };

  // Posts fora do feed (ex.: abertos pelo perfil) ficam neste cache para as ações funcionarem neles também
  const findPost = (postId: string) => posts.find(p => p.id === postId) ?? postCache[postId];

  const updatePost = (postId: string, change: (p: Post) => Post) => {
    setPosts(prev => prev.map(p => (p.id === postId ? change(p) : p)));
    setPostCache(prev => (prev[postId] ? { ...prev, [postId]: change(prev[postId]) } : prev));
  };

  const cachePosts = (list: Post[]) => {
    setPostCache(prev => ({ ...prev, ...Object.fromEntries(list.map(p => [p.id, p])) }));
  };

  // Atualiza um post com o estado do banco (contadores, comentários, votos)
  const reloadPost = async (postId: string) => {
    const fresh = await fetchPost(postId, currentUser.id);
    if (fresh) updatePost(postId, () => fresh);
  };

  const reportFailure = (action: string, error: string) => {
    console.error(`[Vybelog] Falha ao ${action}:`, error);
    alert(`Não foi possível ${action}. Tente novamente.`);
  };

  const toggleLikePost = async (postId: string) => {
    const post = findPost(postId);
    if (!post) return;
    const like = !post.likedByCurrentUser;
    updatePost(postId, p => ({ ...p, likedByCurrentUser: like, likesCount: p.likesCount + (like ? 1 : -1) }));
    const error = await setLike(currentUser.id, postId, like);
    if (error) reportFailure('registrar a curtida', error);
    await reloadPost(postId);
  };

  const toggleSavePost = async (postId: string) => {
    const post = findPost(postId);
    if (!post) return;
    const save = !post.savedByCurrentUser;
    updatePost(postId, p => ({ ...p, savedByCurrentUser: save }));
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
    const post = findPost(postId);
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
    setPostCache(prev => {
      const { [postId]: _removed, ...rest } = prev;
      return rest;
    });
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

  const blockUser = async (userId: string) => {
    const error = await blockUserRequest(userId);
    if (error) {
      reportFailure('bloquear o perfil', error);
      return false;
    }
    // O banco já desfez seguir/conexão e escondeu posts, stories e conversas; recarrega tudo
    if (selectedProfileId === userId) setSelectedProfileIdState(null);
    if (conversations.some(c => c.id === selectedConversationId && c.participantIds.includes(userId))) {
      setSelectedConversationId(null);
    }
    await loadSocialData(currentUser.id);
    return true;
  };

  const unblockUser = async (userId: string) => {
    const error = await unblockUserRequest(currentUser.id, userId);
    if (error) {
      reportFailure('desbloquear o perfil', error);
      return;
    }
    await loadSocialData(currentUser.id);
  };

  // Cofres: o banco notifica o dono (pedido) e quem pediu (aprovação)
  const requestAlbumAccess = async (albumId: string, _ownerUserId: string) => {
    const error = await requestVaultAccess(currentUser.id, albumId);
    if (error) {
      alert(error);
      return false;
    }
    alert('Pedido de acesso enviado. O dono do cofre será notificado e decidirá se libera.');
    return true;
  };

  const approveAlbumAccess = async (albumId: string, requesterUserId: string) => {
    const error = await grantVaultAccess(albumId, requesterUserId);
    if (error) reportFailure('liberar o acesso', error);
    return !error;
  };

  const revokeAlbumAccess = async (albumId: string, requesterUserId: string) => {
    const error = await removeVaultAccess(albumId, requesterUserId);
    if (error) reportFailure('remover o acesso', error);
    return !error;
  };

  const refreshStories = async () => {
    if (currentUser.id) setStoryGroups(await fetchStoryGroups(currentUser.id));
  };

  const refreshEvents = async () => {
    if (currentUser.id) setEvents(await fetchEvents(currentUser.id));
  };

  const rsvpEvent = async (eventId: string, status: 'going' | 'interested' | null) => {
    const previous = events.find(e => e.id === eventId)?.myStatus ?? null;
    if (previous === status) return;
    // Atualização otimista dos contadores
    setEvents(prev => prev.map(e => {
      if (e.id !== eventId) return e;
      const delta = (s: 'going' | 'interested') => (status === s ? 1 : 0) - (previous === s ? 1 : 0);
      return {
        ...e,
        myStatus: status ?? undefined,
        goingCount: Math.max(0, e.goingCount + delta('going')),
        interestedCount: Math.max(0, e.interestedCount + delta('interested'))
      };
    }));
    const error = await setEventRsvp(currentUser.id, eventId, status);
    if (error) {
      reportFailure('confirmar presença', error);
      await refreshEvents();
    }
  };

  const toggleJoinCommunity = async (communityId: string) => {
    const community = communities.find(c => c.id === communityId);
    if (!community) return;
    const join = !community.isJoined;
    setCommunities(prev => prev.map(c => c.id !== communityId ? c : {
      ...c,
      isJoined: join,
      membersCount: Math.max(0, c.membersCount + (join ? 1 : -1))
    }));
    const error = await setCommunityMembership(currentUser.id, communityId, join);
    if (error) {
      alert(error);
      setCommunities(await fetchCommunities(currentUser.id));
    }
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
    const error = await declineConversation(conversationId);
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
    alert('Denúncia recebida pela Equipe de Segurança & Moderação do Vybelog. Investigaremos o caso com rigor e discrição.');
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

  // ----------------- ADMIN (Supabase; cada ação é validada e auditada no banco) ----------------- //

  const refreshAdminData = async () => {
    const [users, loadedReports, logs, media] = await Promise.all([
      adminApi.fetchAdminUsers(),
      adminApi.fetchAdminReports(),
      adminApi.fetchAdminLogs(),
      adminApi.fetchAdminMedia()
    ]);
    setAdminUsers(users);
    setReports(loadedReports);
    setAdminLogs(logs);
    setAdminMediaList(media);
  };

  useEffect(() => {
    if (isAuthorizedAdmin && adminMfaVerified) refreshAdminData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthorizedAdmin, adminMfaVerified]);

  const runAdminAction = async (action: () => Promise<string | null>): Promise<boolean> => {
    const error = await action();
    if (error) {
      alert(`Ação não realizada: ${error}`);
      return false;
    }
    await refreshAdminData();
    return true;
  };

  const adminResolveReport = (reportId: string, resolution: 'resolved' | 'dismissed', note: string) =>
    runAdminAction(() => adminApi.adminResolveReport(reportId, resolution, note));

  const adminUpdateUserStatus = (userId: string, status: UserAccountStatus, reason: string) =>
    runAdminAction(() => adminApi.adminSetUserStatus(userId, status, reason));

  const adminAddUserNote = (userId: string, note: string) =>
    runAdminAction(() => adminApi.adminAddNote(userId, note));

  const adminSetRestrictions = (userId: string, restrictions: AdminUserRecord['restrictions'], reason: string) =>
    runAdminAction(() => adminApi.adminSetRestrictions(userId, restrictions, reason));

  const adminModerateMedia = (mediaId: string, status: 'approved' | 'pending_review' | 'flagged' | 'removed', reason: string) =>
    runAdminAction(() => adminApi.adminModeratePost(mediaId, status, reason));

  const adminVerifyUserAge = (userId: string, reason = 'Identidade e maioridade conferidas pela moderação.') =>
    runAdminAction(() => adminApi.adminSetVerified(userId, true, reason));

  const adminSetUserRole = (userId: string, role: AdminRole | null, reason: string) =>
    runAdminAction(() => adminApi.adminSetRole(userId, role, reason));

  const adminInvestigateMessage = async (reportId: string, justification: string) => {
    const result = await adminApi.adminReportEvidence(reportId, justification);
    if (!result.error) refreshAdminData();
    return result;
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
        resendConfirmationEmail,
        passwordRecoveryMode,
        updatePassword,
        logout,
        updateCurrentUser,
        activeTab,
        setActiveTab,
        selectedProfileId,
        discoverSearch,
        setDiscoverSearch,
        setSelectedProfileId,
        selectedConversationId,
        setSelectedConversationId,
        profiles,
        getCompatibility,
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
        blockedUsers,
        blockUser,
        unblockUser,
        postCache,
        cachePosts,
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
        storyGroups,
        refreshStories,
        events,
        refreshEvents,
        rsvpEvent,
        ads,
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
        adminSetUserRole,
        refreshAdminData,
        authModalType,
        setAuthModalType,
        registerProfileType,
        setRegisterProfileType,
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
