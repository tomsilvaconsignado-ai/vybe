export type ProfileType = 
  | 'couple'             // Casal
  | 'single_female'      // Mulher solteira
  | 'single_male'        // Homem solteiro
  | 'joint_profile'      // Perfil conjunto (dupla/trio consensual)
  | 'polyamorous';       // Poliamor / Outro formato consensual

export type LocationPrivacy = 'city' | 'approximate_region' | 'hidden';

export type AlbumVisibility = 'public' | 'connections_only' | 'private_vault';

export interface JointPartner {
  id: string;
  name: string;
  age: number;
  gender: string;
  orientation?: string;
  consentConfirmed: boolean;
  avatarUrl?: string;
  bio?: string;
}

export interface CompatibilityPreferences {
  objectives: string[];              // e.g. ['conhecer_casais', 'amizades', 'conhecer_terceira_pessoa']
  interestedIn: ('couples' | 'singles_female' | 'singles_male' | 'all')[];
  ageRange: [number, number];        // e.g. [25, 45]
  maxDistanceKm: number;             // e.g. 50
  meetingPreference: 'in_person' | 'virtual_first' | 'undecided';
  pacePreference: 'slow_chat' | 'spontaneous' | 'flexible';
  discretionLevel: 'high' | 'medium' | 'relaxed';
  groupReadiness: 'open' | 'curious' | 'only_duo';
  personalLimits: string[];          // e.g. ['Sem fotos sem consentimento', 'Respeito ao não', 'Discrição no trabalho']
  lifestyleTags: string[];           // e.g. ['BDSM leve', 'Vinho & Jantar', 'Baladas liberais', 'Praia', 'Resort liberal']
}

export interface MediaItem {
  id: string;
  url: string;
  type: 'image' | 'video';
  albumId?: string;
  visibility: AlbumVisibility;
  caption?: string;
  blurPreview?: boolean;
  createdAt: string;
}

export interface MediaAlbum {
  id: string;
  userId: string;
  title: string;
  description: string;
  coverUrl: string;
  visibility: AlbumVisibility;
  mediaCount: number;
  allowedUserIds: string[];          // Who has explicit permission to view this private vault
  pendingRequestUserIds: string[];   // Who requested access
  items: MediaItem[];
  createdAt: string;
}

export interface UserProfile {
  id: string;
  username: string;
  displayName: string;
  email: string;
  profileType: ProfileType;
  partners?: JointPartner[];          // Details if couple/joint
  city: string;
  state: string;
  locationPrivacy: LocationPrivacy;
  approximateDistanceKm?: number;
  age: number;                        // Primary age or average
  gender?: string;
  orientation?: string;
  bio: string;
  avatarUrl: string;
  coverUrl: string;
  isVerified: boolean;
  verifiedBadgeType?: 'selfie_age' | 'curated_couple' | 'identity';
  followersCount: number;
  followingCount: number;
  connectionsCount: number;
  compatibilityPrefs: CompatibilityPreferences;
  albums: MediaAlbum[];
  interests: string[];
  isPremium?: boolean;
  lastActive: string;
  statusText?: string;
  discreetModeEnabled?: boolean;
}

export interface PostComment {
  id: string;
  postId: string;
  userId: string;
  username: string;
  userDisplayName: string;
  userAvatar: string;
  isVerified: boolean;
  content: string;
  createdAt: string;
  likesCount: number;
}

export interface PostPoll {
  question: string;
  options: { id: string; text: string; votes: number }[];
  voterIds: { [userId: string]: string }; // userId -> optionId
}

export interface Post {
  id: string;
  userId: string;
  user: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string;
    profileType: ProfileType;
    isVerified: boolean;
    city: string;
  };
  content: string;
  mediaUrls: string[];
  mediaType?: 'image' | 'video';
  tags: string[];
  location?: string;
  poll?: PostPoll;
  likesCount: number;
  likedByCurrentUser: boolean;
  commentsCount: number;
  savedByCurrentUser: boolean;
  comments: PostComment[];
  createdAt: string;
  visibility: 'public' | 'connections_only';
  communityId?: string;
}

export interface Community {
  id: string;
  name: string;
  slug: string;
  description: string;
  coverUrl: string;
  iconUrl: string;
  category: 'regional' | 'lifestyle' | 'beginners' | 'events' | 'discussions';
  rules: string[];
  membersCount: number;
  isJoined: boolean;
  isPrivate: boolean;
  postsCount: number;
  moderators: string[];
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  senderAvatar: string;
  content: string;
  mediaUrl?: string;
  mediaAlbumReference?: {
    albumId: string;
    albumTitle: string;
    grantedAccess: boolean;
  };
  createdAt: string;
  status: 'sent' | 'delivered' | 'read';
  isDiscreet?: boolean;
}

export interface Conversation {
  id: string;
  createdBy?: string; // quem iniciou; só o destinatário pode aceitar o pedido
  participantIds: string[];
  participants: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string;
    profileType: ProfileType;
    isVerified: boolean;
    lastActive: string;
  }[];
  lastMessage?: ChatMessage;
  unreadCount: number;
  isPendingRequest: boolean; // Message request gate
  isMuted?: boolean;
  isArchived?: boolean;
}

export interface NotificationItem {
  id: string;
  userId: string;
  actor: {
    id: string;
    displayName: string;
    username: string;
    avatarUrl: string;
  };
  type: 
    | 'like' 
    | 'comment' 
    | 'connection_request' 
    | 'connection_accepted' 
    | 'vault_access_request' 
    | 'vault_access_granted' 
    | 'system_safety' 
    | 'community_invite';
  title: string;
  message: string;
  referenceId?: string;
  createdAt: string;
  read: boolean;
}

export type UserAccountStatus = 'active' | 'warned' | 'restricted' | 'suspended' | 'blocked';

export interface AdminModerationNote {
  id: string;
  adminId: string;
  adminName: string;
  note: string;
  createdAt: string;
}

export interface AdminUserRecord {
  id: string;
  username: string;
  displayName: string;
  email: string;
  profileType: ProfileType;
  city: string;
  state: string;
  age: number;
  status: UserAccountStatus;
  isVerified: boolean;
  verifiedBadgeType?: 'selfie_age' | 'curated_couple' | 'identity';
  avatarUrl: string;
  coverUrl: string;
  createdAt: string;
  lastActive: string;
  reportsReceivedCount: number;
  moderationNotes: AdminModerationNote[];
  restrictions?: {
    cannotPost?: boolean;
    cannotMessage?: boolean;
    cannotRequestVault?: boolean;
    until?: string;
  };
  adminRole?: 'superadmin' | 'moderator' | 'support' | 'auditor';
  verificationRequested?: boolean;
  birthdate?: string;
  // Safe administrative metadata (excluding tokens/passwords)
  birthdateVerified: boolean;
  consentConfirmed: boolean;
  albumsCount: number;
  postsCount: number;
}

export interface AdminMediaRecord {
  id: string;
  userId: string;
  userName: string;
  userAvatar: string;
  url: string;
  type: 'image' | 'video';
  visibility: AlbumVisibility;
  albumTitle?: string;
  caption?: string;
  status: 'approved' | 'pending_review' | 'flagged' | 'removed';
  reportId?: string;
  flagReason?: string;
  createdAt: string;
  isPrivateVaultItem?: boolean;
}

export interface ModerationReport {
  id: string;
  reporterUserId: string;
  reporterName: string;
  reportedUserId: string;
  reportedUserName: string;
  targetType: 'profile' | 'post' | 'media' | 'message';
  targetId: string;
  category: 'unsolicited_explicit' | 'underage_suspicion' | 'fake_profile' | 'harassment' | 'non_consensual' | 'scam';
  description: string;
  status: 'pending' | 'under_review' | 'resolved' | 'dismissed';
  priority: 'urgent' | 'high' | 'medium' | 'low';
  createdAt: string;
  reviewedBy?: string;
  resolutionNote?: string;
  evidenceSnapshot?: string;
}

export interface AdminAuditLog {
  id: string;
  adminId: string;
  adminName: string;
  adminRole: 'superadmin' | 'moderator' | 'support' | 'auditor';
  action: string;
  targetId: string;
  targetType: string;
  reason: string;
  timestamp: string;
  ipAddress?: string;
}

