import { supabase } from './supabase';
import { CompatibilityPreferences, JointPartner, UserProfile } from '../types';

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
      lifestyleTags: prefs.lifestyle_tags,
      extras: prefs.extras ?? {}
    } : DEFAULT_PREFS,
    albums: [],
    interests: row.interests ?? [],
    lastActive: 'Agora mesmo',
    statusText: row.status_text ?? undefined,
    discreetModeEnabled: row.discreet_mode_enabled,
    showOnlineStatus: row.show_online_status ?? true
  };
}

export async function fetchOwnProfile(userId: string): Promise<UserProfile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*, joint_partners(*), compatibility_preferences(*), profile_private(email, city, state, birthdate)')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    console.error('[Vybelog] Falha ao carregar perfil:', error.message);
    return null;
  }
  if (!data) return null;
  const profile = mapProfileRow(data);
  // Em profiles a localização já vem mascarada; a real (só para o dono) fica em profile_private
  const priv = one<any>(data.profile_private);
  if (priv && priv.city !== null) {
    profile.city = priv.city ?? '';
    profile.state = priv.state ?? '';
  }
  profile.birthdate = priv?.birthdate ?? undefined;
  return profile;
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
  profileType: 'profile_type',
  bio: 'bio',
  locationPrivacy: 'location_privacy',
  avatarUrl: 'avatar_url',
  coverUrl: 'cover_url',
  statusText: 'status_text',
  discreetModeEnabled: 'discreet_mode_enabled',
  showOnlineStatus: 'show_online_status',
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
  // Cidade e estado reais vão para profile_private; o banco recalcula o que o perfil exibe
  const location: Record<string, string> = {};
  if (updates.city !== undefined) location.city = updates.city;
  if (updates.state !== undefined) location.state = updates.state;
  if (Object.keys(location).length > 0) {
    const { error } = await supabase.from('profile_private').update(location).eq('user_id', userId);
    if (error) return error.message;
  }
  if (Object.keys(row).length === 0) return null;

  const { error } = await supabase.from('profiles').update(row).eq('id', userId);
  if (error?.message.includes('links externos')) return 'Envie a foto pelo app; links externos não são aceitos.';
  return error ? error.message : null;
}

// Preferências de compatibilidade (cadastro + aba opcional do perfil)
export async function saveOwnPreferences(userId: string, prefs: CompatibilityPreferences): Promise<string | null> {
  const { error } = await supabase.from('compatibility_preferences').upsert({
    profile_id: userId,
    objectives: prefs.objectives,
    interested_in: prefs.interestedIn,
    age_range_min: prefs.ageRange[0],
    age_range_max: prefs.ageRange[1],
    max_distance_km: prefs.maxDistanceKm,
    meeting_preference: prefs.meetingPreference,
    pace_preference: prefs.pacePreference,
    discretion_level: prefs.discretionLevel,
    group_readiness: prefs.groupReadiness,
    personal_limits: prefs.personalLimits,
    lifestyle_tags: prefs.lifestyleTags,
    extras: prefs.extras ?? {},
    updated_at: new Date().toISOString()
  });
  return error ? error.message : null;
}

// Parceiros do perfil conjunto: atualiza os existentes, cria os novos (id vazio) e apaga os removidos
export async function saveOwnPartners(userId: string, partners: JointPartner[], previous: JointPartner[]): Promise<string | null> {
  const keptIds = new Set(partners.filter(p => p.id).map(p => p.id));
  const removed = previous.filter(p => !keptIds.has(p.id)).map(p => p.id);
  if (removed.length > 0) {
    const { error } = await supabase.from('joint_partners').delete().in('id', removed).eq('profile_id', userId);
    if (error) return error.message;
  }
  for (const p of partners) {
    const row = { name: p.name.trim(), age: p.age, gender: p.gender, orientation: p.orientation || null };
    const { error } = p.id
      ? await supabase.from('joint_partners').update(row).eq('id', p.id).eq('profile_id', userId)
      : await supabase.from('joint_partners').insert({ ...row, profile_id: userId, consent_confirmed: p.consentConfirmed });
    if (error) return error.message;
  }
  return null;
}

// O @usuário só muda pela RPC (formato, nomes reservados e intervalo de 7 dias são checados no banco)
export async function changeOwnUsername(username: string): Promise<{ username: string | null; error: string | null }> {
  const { data, error } = await supabase.rpc('change_username', { new_username: username });
  if (error) {
    if (error.code === 'PGRST202') return { username: null, error: 'A troca de @usuário ainda não está disponível. Tente mais tarde.' };
    return { username: null, error: error.message };
  }
  return { username: data as string, error: null };
}
