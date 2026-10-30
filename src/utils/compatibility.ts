import { UserProfile } from '../types';

export interface CompatibilityBreakdown {
  score: number; // 0 - 100
  tier: 'Altíssima Sintonia' | 'Boa Sintonia' | 'Sintonia Parcial' | 'Baixa Sintonia';
  color: string;
  reasons: string[];
  sharedObjectives: string[];
  sharedInterests: string[];
  sharedLifestyleTags: string[];
  distanceKm: number | null;   // nula quando não há localização dos dois
  isMutualTargetMatch: boolean;
}

export function calculateCompatibility(userA: UserProfile, userB: UserProfile): CompatibilityBreakdown {
  const reasons: string[] = [];
  let rawPoints = 0;
  const maxPoints = 100;

  // 1. Mutual Profile Type & Interest in Gender/Profile Formats (30 pts)
  // Check if User A is interested in User B's profile type, and vice versa
  const matchAtoB = isInterestedIn(userA, userB);
  const matchBtoA = isInterestedIn(userB, userA);

  const isMutualTargetMatch = matchAtoB && matchBtoA;

  if (isMutualTargetMatch) {
    rawPoints += 30;
    reasons.push('Interesse recíproco no formato de perfil');
  } else if (matchAtoB || matchBtoA) {
    rawPoints += 12;
    reasons.push('Interesse parcial no perfil');
  } else {
    // If neither matches the fundamental preference
    rawPoints += 4;
  }

  // 2. Shared Objectives (25 pts)
  const prefsA = userA.compatibilityPrefs.objectives || [];
  const prefsB = userB.compatibilityPrefs.objectives || [];
  const sharedObjectives = prefsA.filter(obj => prefsB.includes(obj));

  if (sharedObjectives.length >= 3) {
    rawPoints += 25;
    reasons.push(`Forte alinhamento de intenções (${sharedObjectives.length} objetivos mútuos)`);
  } else if (sharedObjectives.length >= 1) {
    rawPoints += 15;
    reasons.push(`Objetivos compatíveis em comum`);
  } else {
    rawPoints += 2;
  }

  // 3. Shared Interests & Lifestyle Tags (20 pts)
  const interestsA = userA.interests || [];
  const interestsB = userB.interests || [];
  const sharedInterests = interestsA.filter(item => 
    interestsB.some(b => b.toLowerCase() === item.toLowerCase())
  );

  const tagsA = userA.compatibilityPrefs.lifestyleTags || [];
  const tagsB = userB.compatibilityPrefs.lifestyleTags || [];
  const sharedLifestyleTags = tagsA.filter(item =>
    tagsB.some(b => b.toLowerCase() === item.toLowerCase())
  );

  const combinedSharedCount = sharedInterests.length + sharedLifestyleTags.length;
  if (combinedSharedCount >= 4) {
    rawPoints += 20;
    reasons.push(`Altíssima afinidade cultural e de estilo de vida`);
  } else if (combinedSharedCount >= 2) {
    rawPoints += 14;
    reasons.push(`Gostos e afinidades em comum`);
  } else if (combinedSharedCount >= 1) {
    rawPoints += 8;
  }

  // 4. Distance & Location Compatibility (15 pts)
  const distanceKm = userB.approximateDistanceKm ?? 30;
  const maxAcceptableDist = Math.max(userA.compatibilityPrefs.maxDistanceKm, userB.compatibilityPrefs.maxDistanceKm);

  if (distanceKm <= 30) {
    rawPoints += 15;
    reasons.push('Mesma região metropolitana / proximidade geográfica');
  } else if (distanceKm <= maxAcceptableDist) {
    rawPoints += 10;
    reasons.push('Distância dentro da faixa desejada');
  } else {
    rawPoints += 3;
    reasons.push('Perfis em cidades diferentes (conexão virtual ou viagens)');
  }

  // 5. Pace & Discretion Alignment (10 pts)
  const paceA = userA.compatibilityPrefs.pacePreference;
  const paceB = userB.compatibilityPrefs.pacePreference;
  const discA = userA.compatibilityPrefs.discretionLevel;
  const discB = userB.compatibilityPrefs.discretionLevel;

  if (paceA === paceB) {
    rawPoints += 5;
    reasons.push('Mesmo ritmo de aproximação desejado');
  }
  if (discA === discB || discA === 'high' && discB === 'high') {
    rawPoints += 5;
    reasons.push('Nível de discrição e privacidade harmonizado');
  }

  const finalScore = Math.min(Math.max(rawPoints, 18), 98); // Realistically bounded

  let tier: CompatibilityBreakdown['tier'] = 'Baixa Sintonia';
  let color = '#ef4444';

  if (finalScore >= 80) {
    tier = 'Altíssima Sintonia';
    color = '#10b981'; // vibrant emerald
  } else if (finalScore >= 65) {
    tier = 'Boa Sintonia';
    color = '#a855f7'; // vibrant purple
  } else if (finalScore >= 45) {
    tier = 'Sintonia Parcial';
    color = '#f59e0b'; // amber
  }

  return {
    score: finalScore,
    tier,
    color,
    reasons,
    sharedObjectives,
    sharedInterests,
    sharedLifestyleTags,
    distanceKm: userB.approximateDistanceKm ?? null,
    isMutualTargetMatch
  };
}

function isInterestedIn(seeker: UserProfile, target: UserProfile): boolean {
  const lookingFor = seeker.compatibilityPrefs.interestedIn || [];
  if (lookingFor.includes('all')) return true;

  if (target.profileType === 'couple' && lookingFor.includes('couples')) return true;
  if (target.profileType === 'single_female' && lookingFor.includes('singles_female')) return true;
  if (target.profileType === 'single_male' && lookingFor.includes('singles_male')) return true;
  if (target.profileType === 'joint_profile' && lookingFor.includes('couples')) return true;
  if (target.profileType === 'polyamorous') return true;

  return false;
}

export const OBJECTIVE_LABELS: Record<string, string> = {
  'conhecer_casais': 'Conhecer outros casais',
  'amizades': 'Amizades & jantares',
  'conhecer_terceira_pessoa': 'Conhecer uma terceira pessoa',
  'jantares_sociais': 'Encontros sociais e festas',
  'conhecer_solteiro': 'Encontrar solteiro(a) compatível',
  'conversar_primeiro': 'Conversar e conhecer primeiro',
  'explorar_consenso': 'Explorar novas formas consensuais'
};
