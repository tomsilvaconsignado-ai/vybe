import { supabase } from './supabase';
import { CompatibilityPreferences, UserProfile } from '../types';

export type AdminRole = 'superadmin' | 'moderator' | 'support' | 'auditor';

const DEFAULT_PREFS: CompatibilityPreferences = {
  objectives: [],
  interestedIn: [],
  ageRange: [18, 60],
  maxDistanceKm: 50,
  meetingPreference: 'virtual_first',
  pacePreference: 'slow_chat',
  discretionLevel: 'high',
  groupReadiness: 'curious',
  personalLimits: [],
  lifestyleTags: []
};

// Usuário vazio usado enquanto ninguém está logado
export const GUEST_USER: UserProfile = {
  id: '',
  username: '',
  displayName: '',
  email: '',
  profileType: 'couple',
  city: '',
  state: '',
  locationPrivacy: 'approximate_region',
  age: 18,
  bio: '',
  avatarUrl: '',
  coverUrl: '',
  isVerified: false,
  followersCount: 0,
  followingCount: 0,
  connectionsCount: 0,
  compatibilityPrefs: DEFAULT_PREFS,
  albums: [],
  interests: [],
  lastActive: ''
};

// Avatar padrão (SVG com a inicial) para quem ainda não enviou foto
export function defaultAvatar(name: string): string {
  const initial = (name.trim().charAt(0) || 'V').toUpperCase().replace(/[<>&"']/g, '');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7c3aed"/><stop offset="1" stop-color="#e11d48"/></linearGradient></defs><rect width="200" height="200" fill="url(#g)"/><text x="50%" y="54%" font-family="Arial, sans-serif" font-size="96" font-weight="bold" fill="#fff" text-anchor="middle" dominant-baseline="middle">${initial}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export const DEFAULT_COVER = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="400"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1e1033"/><stop offset=".5" stop-color="#4c1d95"/><stop offset="1" stop-color="#881337"/></linearGradient></defs><rect width="1200" height="400" fill="url(#g)"/></svg>'
)}`;

export const avatarOrDefault = (url: string | null | undefined, name: string) => url || defaultAvatar(name);

// PostgREST devolve relações 1:1 como objeto, mas pode devolver array dependendo da detecção
const one = <T,>(value: T | T[] | null | undefined): T | null =>
  Array.isArray(value) ? value[0] ?? null : value ?? null;

export function mapProfileRow(row: any): UserProfile {
  const prefs = one<any>(row.compatibility_preferences);
  const priv = one<any>(row.profile_private);

  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    email: priv?.email ?? '',
    profileType: row.profile_type,
    partners: (row.joint_partners ?? []).map((p: any) => ({
      id: p.id,
      name: p.name,
      age: p.age,
      gender: p.gender,
      orientation: p.orientation ?? undefined,
      consentConfirmed: p.consent_confirmed,
      avatarUrl: p.avatar_url ?? undefined,
      bio: p.bio ?? undefined
    })),
    city: row.city,
    state: row.state,
    locationPrivacy: row.location_privacy,
    age: row.age,
    gender: row.gender ?? undefined,
    orientation: row.orientation ?? undefined,
    bio: row.bio,
    avatarUrl: avatarOrDefault(row.avatar_url, row.display_name),
    coverUrl: row.cover_url || DEFAULT_COVER,
    isVerified: row.is_verified,
    verifiedBadgeType: row.verified_badge_type ?? undefined,
    followersCount: row.followers_count,
    followingCount: row.following_count,
    connectionsCount: row.connections_count,
    compatibilityPrefs: prefs ? {
      objectives: prefs.objectives,
      interestedIn: prefs.interested_in,
      ageRange: [prefs.age_range_min, prefs.age_range_max],
      maxDistanceKm: prefs.max_distance_km,
      meetingPreference: prefs.meeting_preference,
      pacePreference: prefs.pace_preference,
      discretionLevel: prefs.discretion_level,
      groupReadiness: prefs.group_readiness,
      personalLimits: prefs.personal_limits,
      lifestyleTags: prefs.lifestyle_tags
    } : DEFAULT_PREFS,
    albums: [],
    interests: row.interests ?? [],
    lastActive: 'Agora mesmo',
    statusText: row.status_text ?? undefined,
    discreetModeEnabled: row.discreet_mode_enabled
  };
}

export async function fetchOwnProfile(userId: string): Promise<UserProfile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*, joint_partners(*), compatibility_preferences(*), profile_private(email)')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    console.error('[VYBE] Falha ao carregar perfil:', error.message);
    return null;
  }
  return data ? mapProfileRow(data) : null;
}

export async function fetchAdminRole(userId: string): Promise<AdminRole | null> {
  const { data, error } = await supabase
    .from('admin_users')
    .select('role')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) return null;
  return (data?.role as AdminRole) ?? null;
}

// Campos que o próprio usuário pode alterar (os demais são protegidos no banco)
const EDITABLE_COLUMNS: Partial<Record<keyof UserProfile, string>> = {
  displayName: 'display_name',
  bio: 'bio',
  city: 'city',
  state: 'state',
  locationPrivacy: 'location_privacy',
  avatarUrl: 'avatar_url',
  coverUrl: 'cover_url',
  statusText: 'status_text',
  discreetModeEnabled: 'discreet_mode_enabled',
  interests: 'interests',
  gender: 'gender',
  orientation: 'orientation'
};

export async function saveOwnProfile(userId: string, updates: Partial<UserProfile>): Promise<string | null> {
  const row: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(updates)) {
    const column = EDITABLE_COLUMNS[key as keyof UserProfile];
    // Avatar/capa padrão são gerados no app (data:); no banco fica vazio
    if (column) row[column] = typeof value === 'string' && value.startsWith('data:') ? '' : value ?? null;
  }
  if (Object.keys(row).length === 0) return null;

  const { error } = await supabase.from('profiles').update(row).eq('id', userId);
  return error ? error.message : null;
}
