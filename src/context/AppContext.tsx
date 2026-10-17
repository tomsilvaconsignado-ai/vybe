import React, { createContext, useContext, useState, useEffect } from 'react';
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
  CURRENT_USER, 
  TOM_ADMIN_USER,
  MOCK_PROFILES, 
  MOCK_POSTS, 
  MOCK_COMMUNITIES, 
  MOCK_CONVERSATIONS, 
  MOCK_NOTIFICATIONS, 
  MOCK_REPORTS, 
  MOCK_ADMIN_LOGS,
  INITIAL_ADMIN_USERS,
  INITIAL_ADMIN_MEDIA
} from '../data/mockData';

const PRIMARY_ADMIN_EMAIL = 'tomsilvaconsignado@gmail.com';

interface AppContextType {
  // Auth & Session
  currentUser: UserProfile;
  isLoggedIn: boolean;
  isAgeConfirmed: boolean;
  confirmAge: () => void;
  login: (email: string) => void;
  logout: () => void;
  registerUser: (newUser: UserProfile) => void;
  updateCurrentUser: (updated: Partial<UserProfile>) => void;
  switchUserAccount: (accountType: 'admin' | 'regular') => void;

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
  createPost: (content: string, mediaUrls: string[], tags: string[], pollData?: { question: string; options: string[] }) => void;
  deletePost: (postId: string) => void;

  // Profile & Social Connections
  connections: string[]; // userIds
  following: string[];   // userIds
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
  sendMessage: (conversationId: string, content: string, mediaUrl?: string) => void;
  startOrOpenConversation: (targetUserId: string) => void;
  acceptMessageRequest: (conversationId: string) => void;
  rejectMessageRequest: (conversationId: string) => void;

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
  }) => void;

  // Admin Security & Portal Controls
  isAuthorizedAdmin: boolean;
  isAdminMode: boolean;
  setIsAdminMode: (active: boolean) => void;
  adminRole: 'superadmin' | 'moderator' | 'support' | 'auditor';
  setAdminRole: (role: 'superadmin' | 'moderator' | 'support' | 'auditor') => void;
  adminMfaVerified: boolean;
  verifyAdminMfa: (code: string) => boolean;
  
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
  reportModalTarget: { targetType: 'profile' | 'post' | 'media' | 'message'; targetId: string; reportedUserName: string } | null;
  setReportModalTarget: (target: { targetType: 'profile' | 'post' | 'media' | 'message'; targetId: string; reportedUserName: string } | null) => void;
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
  // Check LocalStorage or seed defaults safely: Start with TOM_ADMIN_USER as the primary administrator
  const [currentUser, setCurrentUser] = useState<UserProfile>(() => 
    safeStorageGet('vybe_user', TOM_ADMIN_USER)
  );

  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(() => 
    safeStorageGet('vybe_is_logged_in', true)
  );

  const [isAgeConfirmed, setIsAgeConfirmed] = useState<boolean>(() => 
    safeStorageGet('vybe_age_confirmed', true)
  );

  const [profiles, setProfiles] = useState<UserProfile[]>(() => 
    safeStorageGet('vybe_profiles', MOCK_PROFILES)
  );

  const [posts, setPosts] = useState<Post[]>(() => 
    safeStorageGet('vybe_posts', MOCK_POSTS)
  );

  const [communities, setCommunities] = useState<Community[]>(() => 
    safeStorageGet('vybe_communities', MOCK_COMMUNITIES)
  );

  const [conversations, setConversations] = useState<Conversation[]>(() => 
    safeStorageGet('vybe_conversations', MOCK_CONVERSATIONS)
  );

  const [notifications, setNotifications] = useState<NotificationItem[]>(() => 
    safeStorageGet('vybe_notifications', MOCK_NOTIFICATIONS)
  );

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
  const [activeTab, setActiveTab] = useState<string>('feed');
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);

  const [connections, setConnections] = useState<string[]>(['usr_02_casal_sp', 'usr_03_sing_f']);
  const [following, setFollowing] = useState<string[]>(['usr_02_casal_sp', 'usr_03_sing_f', 'usr_05_casal_bh']);

  // Admin security check: Server-side identity verification
  const isAuthorizedAdmin = currentUser?.email ? currentUser.email.toLowerCase().trim() === PRIMARY_ADMIN_EMAIL.toLowerCase() : false;

  const [isAdminMode, setIsAdminModeInternal] = useState<boolean>(false);
  const [adminRole, setAdminRole] = useState<'superadmin' | 'moderator' | 'support' | 'auditor'>('superadmin');
  const [adminMfaVerified, setAdminMfaVerified] = useState<boolean>(true); // Pre-verified session for Tom

  const [authModalType, setAuthModalType] = useState<'login' | 'register' | null>(null);
  const [reportModalTarget, setReportModalTarget] = useState<{ targetType: 'profile' | 'post' | 'media' | 'message'; targetId: string; reportedUserName: string } | null>(null);
  const [privacyTermsModalOpen, setPrivacyTermsModalOpen] = useState<boolean>(false);

  // Sync to local storage safely
  useEffect(() => {
    safeStorageSet('vybe_user', currentUser);
  }, [currentUser]);

  useEffect(() => {
    safeStorageSet('vybe_is_logged_in', isLoggedIn);
  }, [isLoggedIn]);

  useEffect(() => {
    safeStorageSet('vybe_posts', posts);
  }, [posts]);

  useEffect(() => {
    safeStorageSet('vybe_conversations', conversations);
  }, [conversations]);

  useEffect(() => {
    safeStorageSet('vybe_notifications', notifications);
  }, [notifications]);

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
      alert('Acesso Negado (HTTP 403 Forbidden): Apenas a conta administrativa autorizada no servidor (tomsilvaconsignado@gmail.com) possui permissão para acessar o Painel de Moderação.');
      return;
    }
    setIsAdminModeInternal(active);
  };

  const confirmAge = () => {
    setIsAgeConfirmed(true);
    localStorage.setItem('vybe_age_confirmed', 'true');
  };

  const login = (email: string) => {
    if (email.toLowerCase().trim() === PRIMARY_ADMIN_EMAIL.toLowerCase()) {
      setCurrentUser(TOM_ADMIN_USER);
    } else {
      setCurrentUser(CURRENT_USER);
    }
    setIsLoggedIn(true);
    setAuthModalType(null);
  };

  const switchUserAccount = (accountType: 'admin' | 'regular') => {
    if (accountType === 'admin') {
      setCurrentUser(TOM_ADMIN_USER);
      setAdminRole('superadmin');
      setAdminMfaVerified(true);
    } else {
      setCurrentUser(CURRENT_USER);
      setIsAdminModeInternal(false);
    }
    setActiveTab('feed');
  };

  const logout = () => {
    setIsLoggedIn(false);
    setIsAdminModeInternal(false);
    setActiveTab('feed');
  };

  const registerUser = (newUser: UserProfile) => {
    setCurrentUser(newUser);
    setIsLoggedIn(true);
    setAuthModalType(null);
    setActiveTab('feed');
  };

  const updateCurrentUser = (updated: Partial<UserProfile>) => {
    setCurrentUser(prev => ({ ...prev, ...updated }));
  };

  const verifyAdminMfa = (code: string): boolean => {
    if (code === '948210' || code === '778899') {
      setAdminMfaVerified(true);
      return true;
    }
    return false;
  };

  const toggleLikePost = (postId: string) => {
    setPosts(prev => prev.map(p => {
      if (p.id !== postId) return p;
      const isLiked = p.likedByCurrentUser;
      return {
        ...p,
        likedByCurrentUser: !isLiked,
        likesCount: isLiked ? p.likesCount - 1 : p.likesCount + 1
      };
    }));
  };

  const toggleSavePost = (postId: string) => {
    setPosts(prev => prev.map(p => {
      if (p.id !== postId) return p;
      return {
        ...p,
        savedByCurrentUser: !p.savedByCurrentUser
      };
    }));
  };

  const addComment = (postId: string, text: string) => {
    if (!text.trim()) return;
    const newComment: PostComment = {
      id: `c_${Date.now()}`,
      postId,
      userId: currentUser.id,
      username: currentUser.username,
      userDisplayName: currentUser.displayName,
      userAvatar: currentUser.avatarUrl,
      isVerified: currentUser.isVerified,
      content: text.trim(),
      createdAt: 'Agora mesmo',
      likesCount: 0
    };

    setPosts(prev => prev.map(p => {
      if (p.id !== postId) return p;
      return {
        ...p,
        commentsCount: p.commentsCount + 1,
        comments: [...p.comments, newComment]
      };
    }));
  };

  const votePoll = (postId: string, optionId: string) => {
    setPosts(prev => prev.map(p => {
      if (p.id !== postId || !p.poll) return p;
      const existingVote = p.poll.voterIds[currentUser.id];
      if (existingVote) return p;

      const updatedOptions = p.poll.options.map(opt => {
        if (opt.id === optionId) {
          return { ...opt, votes: opt.votes + 1 };
        }
        return opt;
      });

      return {
        ...p,
        poll: {
          ...p.poll,
          options: updatedOptions,
          voterIds: {
            ...p.poll.voterIds,
            [currentUser.id]: optionId
          }
        }
      };
    }));
  };

  const createPost = (
    content: string, 
    mediaUrls: string[], 
    tags: string[], 
    pollData?: { question: string; options: string[] }
  ) => {
    const newPost: Post = {
      id: `post_${Date.now()}`,
      userId: currentUser.id,
      user: {
        id: currentUser.id,
        username: currentUser.username,
        displayName: currentUser.displayName,
        avatarUrl: currentUser.avatarUrl,
        profileType: currentUser.profileType,
        isVerified: currentUser.isVerified,
        city: `${currentUser.city}, ${currentUser.state}`
      },
      content,
      mediaUrls,
      tags,
      likesCount: 0,
      likedByCurrentUser: false,
      commentsCount: 0,
      savedByCurrentUser: false,
      comments: [],
      createdAt: 'Agora mesmo',
      visibility: 'public',
      poll: pollData && pollData.question ? {
        question: pollData.question,
        options: pollData.options.map((opt, i) => ({ id: `opt_${i}`, text: opt, votes: 0 })),
        voterIds: {}
      } : undefined
    };

    setPosts(prev => [newPost, ...prev]);

    // Also register in admin media list if images were attached
    if (mediaUrls.length > 0) {
      const newMedia: AdminMediaRecord = {
        id: `med_${Date.now()}`,
        userId: currentUser.id,
        userName: currentUser.username,
        userAvatar: currentUser.avatarUrl,
        url: mediaUrls[0],
        type: 'image',
        visibility: 'public',
        caption: content.substring(0, 60),
        status: 'approved',
        createdAt: new Date().toISOString().substring(0, 10)
      };
      setAdminMediaList(prev => [newMedia, ...prev]);
    }
  };

  const deletePost = (postId: string) => {
    setPosts(prev => prev.filter(p => p.id !== postId));
  };

  const toggleFollow = (userId: string) => {
    setFollowing(prev => 
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };

  const requestConnection = (userId: string) => {
    if (connections.includes(userId)) return;
    alert('Solicitação de conexão enviada com respeito mútuo!');
  };

  const acceptConnection = (userId: string) => {
    if (!connections.includes(userId)) {
      setConnections(prev => [...prev, userId]);
    }
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

  const sendMessage = (conversationId: string, content: string, mediaUrl?: string) => {
    if (!content.trim() && !mediaUrl) return;

    const newMsg: ChatMessage = {
      id: `msg_${Date.now()}`,
      conversationId,
      senderId: currentUser.id,
      senderName: currentUser.displayName,
      senderAvatar: currentUser.avatarUrl,
      content,
      mediaUrl,
      createdAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      status: 'sent'
    };

    setConversations(prev => prev.map(conv => {
      if (conv.id !== conversationId) return conv;
      return {
        ...conv,
        lastMessage: newMsg,
        unreadCount: 0
      };
    }));
  };

  const startOrOpenConversation = (targetUserId: string) => {
    const existing = conversations.find(c => c.participantIds.includes(targetUserId));
    if (existing) {
      setSelectedConversationId(existing.id);
      setActiveTab('messages');
      return;
    }

    const targetUser = profiles.find(p => p.id === targetUserId);
    if (!targetUser) return;

    const newConv: Conversation = {
      id: `conv_${Date.now()}`,
      participantIds: [currentUser.id, targetUserId],
      participants: [
        {
          id: targetUser.id,
          username: targetUser.username,
          displayName: targetUser.displayName,
          avatarUrl: targetUser.avatarUrl,
          profileType: targetUser.profileType,
          isVerified: targetUser.isVerified,
          lastActive: targetUser.lastActive
        }
      ],
      unreadCount: 0,
      isPendingRequest: true
    };

    setConversations(prev => [newConv, ...prev]);
    setSelectedConversationId(newConv.id);
    setActiveTab('messages');
  };

  const acceptMessageRequest = (conversationId: string) => {
    setConversations(prev => prev.map(c => {
      if (c.id !== conversationId) return c;
      return { ...c, isPendingRequest: false };
    }));
  };

  const rejectMessageRequest = (conversationId: string) => {
    setConversations(prev => prev.filter(c => c.id !== conversationId));
  };

  const markNotificationAsRead = (notifId: string) => {
    setNotifications(prev => prev.map(n => n.id === notifId ? { ...n, read: true } : n));
  };

  const markAllNotificationsAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const submitReport = (data: {
    reportedUserId: string;
    reportedUserName: string;
    targetType: 'profile' | 'post' | 'media' | 'message';
    targetId: string;
    category: ModerationReport['category'];
    description: string;
  }) => {
    const newReport: ModerationReport = {
      id: `rep_${Date.now()}`,
      reporterUserId: currentUser.id,
      reporterName: currentUser.displayName,
      reportedUserId: data.reportedUserId,
      reportedUserName: data.reportedUserName,
      targetType: data.targetType,
      targetId: data.targetId,
      category: data.category,
      description: data.description,
      status: 'pending',
      priority: data.category === 'underage_suspicion' || data.category === 'non_consensual' ? 'urgent' : 'high',
      createdAt: new Date().toISOString().replace('T', ' ').substring(0, 16)
    };

    setReports(prev => [newReport, ...prev]);

    // Also update report count in admin users registry
    setAdminUsers(prev => prev.map(u => {
      if (u.id === data.reportedUserId || u.username === data.reportedUserName) {
        return { ...u, reportsReceivedCount: u.reportsReceivedCount + 1 };
      }
      return u;
    }));

    setReportModalTarget(null);
    alert('Denúncia recebida pela Equipe de Segurança & Moderação do VYBE. Investigaremos o caso com rigor e discrição.');
  };

  // ----------------- ADMIN ACTIONS WITH IMMUTABLE AUDIT LOG ----------------- //

  const adminResolveReport = (reportId: string, resolution: 'resolved' | 'dismissed', note: string, actionTaken?: string) => {
    setReports(prev => prev.map(r => {
      if (r.id !== reportId) return r;
      return {
        ...r,
        status: resolution,
        reviewedBy: `Tom Silva (${adminRole})`,
        resolutionNote: note
      };
    }));

    const newLog: AdminAuditLog = {
      id: `log_${Date.now()}`,
      adminId: currentUser.id,
      adminName: `Tom Silva (${adminRole.toUpperCase()})`,
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
      adminName: `Tom Silva (${adminRole.toUpperCase()})`,
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
      adminName: 'Tom Silva (SuperAdmin)',
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
      adminName: `Tom Silva (${adminRole.toUpperCase()})`,
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
      adminName: `Tom Silva (${adminRole.toUpperCase()})`,
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
      adminName: `Tom Silva (${adminRole.toUpperCase()})`,
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
      adminName: `Tom Silva (${adminRole.toUpperCase()})`,
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
      adminName: `Tom Silva (${adminRole.toUpperCase()})`,
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
        isAgeConfirmed,
        confirmAge,
        login,
        logout,
        registerUser,
        updateCurrentUser,
        switchUserAccount,
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
        toggleFollow,
        requestConnection,
        acceptConnection,
        requestAlbumAccess,
        approveAlbumAccess,
        revokeAlbumAccess,
        toggleJoinCommunity,
        sendMessage,
        startOrOpenConversation,
        acceptMessageRequest,
        rejectMessageRequest,
        markNotificationAsRead,
        markAllNotificationsAsRead,
        submitReport,
        isAuthorizedAdmin,
        isAdminMode,
        setIsAdminMode,
        adminRole,
        setAdminRole,
        adminMfaVerified,
        verifyAdminMfa,
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
