import { supabase } from './supabase';

// Busca por distância. O GPS do aparelho só é lido com a permissão do usuário; o banco guarda
// a posição já arredondada (~2 km) e devolve as distâncias arredondadas, respeitando a
// privacidade de localização de cada perfil (ver set_my_location / nearby_profiles no setup.sql).

const NOT_INSTALLED = ['PGRST202', 'PGRST205', '42P01'];

export function getDevicePosition(): Promise<{ lat: number; lng: number } | { error: string }> {
  return new Promise(resolve => {
    if (!('geolocation' in navigator)) {
      resolve({ error: 'Seu navegador não permite usar a localização.' });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      pos => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      err => resolve({
        error: err.code === err.PERMISSION_DENIED
          ? 'Permissão de localização negada. Libere a localização do site nas configurações do navegador.'
          : 'Não foi possível obter sua localização agora. Tente de novo.'
      }),
      // Precisão de cidade basta (o banco arredonda para ~2 km): mais rápido e gasta menos bateria
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 10 * 60 * 1000 }
    );
  });
}

// O navegador já autorizou antes? (permite atualizar a posição sem perguntar de novo)
export async function locationPermissionGranted(): Promise<boolean> {
  try {
    const status = await navigator.permissions?.query({ name: 'geolocation' as PermissionName });
    return status?.state === 'granted';
  } catch {
    return false;
  }
}

export async function saveMyLocation(lat: number, lng: number): Promise<string | null> {
  const { error } = await supabase.rpc('set_my_location', { p_lat: lat, p_lng: lng });
  if (!error) return null;
  if (NOT_INSTALLED.includes(error.code ?? '')) return 'A busca por distância ainda não está disponível.';
  return error.message;
}

export async function clearMyLocation(): Promise<string | null> {
  const { error } = await supabase.rpc('clear_my_location');
  return error ? error.message : null;
}

export async function fetchMyLocationStatus(me: string): Promise<{ hasLocation: boolean; updatedAt: string | null }> {
  const { data, error } = await supabase.from('user_geo').select('updated_at').eq('user_id', me).maybeSingle();
  if (error || !data) return { hasLocation: false, updatedAt: null };
  return { hasLocation: true, updatedAt: data.updated_at };
}

export async function fetchProfileDistances(ids: string[]): Promise<Map<string, number>> {
  if (ids.length === 0) return new Map();
  const { data, error } = await supabase.rpc('profile_distances', { ids: ids.slice(0, 500) });
  if (error) return new Map();
  return new Map(((data ?? []) as any[]).filter(r => r.distance_km !== null).map(r => [r.profile_id, r.distance_km]));
}

export async function fetchNearbyProfiles(maxKm: number): Promise<{ id: string; km: number }[]> {
  const { data, error } = await supabase.rpc('nearby_profiles', { max_km: Math.round(maxKm) });
  if (error) {
    if (!NOT_INSTALLED.includes(error.code ?? '')) console.error('[Vybelog] Falha na busca por distância:', error.message);
    return [];
  }
  return ((data ?? []) as any[]).map(r => ({ id: r.profile_id, km: r.distance_km }));
}
