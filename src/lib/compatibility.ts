import { supabase } from './supabase';
import { CompatibilityBreakdown } from '../utils/compatibility';

// Converte o JSON devolvido pelas funções do banco no formato usado na interface.
function toBreakdown(j: any): CompatibilityBreakdown | null {
  if (!j) return null;
  return {
    score: j.score,
    tier: j.tier,
    color: j.color,
    reasons: j.reasons ?? [],
    sharedObjectives: j.sharedObjectives ?? [],
    sharedInterests: j.sharedInterests ?? [],
    sharedLifestyleTags: j.sharedLifestyleTags ?? [],
    distanceKm: j.distanceKm ?? null,
    isMutualTargetMatch: j.isMutualTargetMatch ?? false
  };
}

// Score em lote (aba Descobrir e sugestões): um round-trip para vários perfis.
// Se a função ainda não existir no banco, devolve um mapa vazio e o app recai
// no cálculo local (getCompatibility, no AppContext).
export async function fetchCompatibilityMap(targetIds: string[]): Promise<Map<string, CompatibilityBreakdown>> {
  const map = new Map<string, CompatibilityBreakdown>();
  if (targetIds.length === 0) return map;
  const { data, error } = await supabase.rpc('compatibility_scores', { targets: targetIds });
  if (error) {
    console.warn('[Vybelog] compatibility_scores indisponível; usando cálculo local:', error.message);
    return map;
  }
  for (const row of (data ?? []) as { target: string; breakdown: any }[]) {
    const b = toBreakdown(row.breakdown);
    if (b) map.set(row.target, b);
  }
  return map;
}

// Score de um perfil específico (ex.: perfil aberto fora da lista de descoberta).
export async function fetchCompatibility(targetId: string): Promise<CompatibilityBreakdown | null> {
  const { data, error } = await supabase.rpc('compatibility_with', { target: targetId });
  if (error) {
    console.warn('[Vybelog] compatibility_with indisponível:', error.message);
    return null;
  }
  return toBreakdown(data);
}
