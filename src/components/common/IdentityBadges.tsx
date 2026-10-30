import React from 'react';
import { UserProfile } from '../../types';

// Gênero e orientação ficam abertos para todos os membros (no perfil e nos cards da busca)

const SHORT_ORIENTATION: Record<string, string> = {
  Heterossexual: 'Hétero',
  Bissexual: 'Bi',
  Homossexual: 'Homo',
  Pansexual: 'Pan'
};

export interface IdentityEntry {
  who?: string;            // nome do parceiro, em perfis de casal / conjuntos
  gender?: string;
  orientation?: string;
}

export function identityEntries(profile: UserProfile): IdentityEntry[] {
  const partners = (profile.partners ?? []).filter(p => p.gender || p.orientation);
  if (profile.profileType !== 'single_female' && profile.profileType !== 'single_male' && partners.length > 0) {
    return partners.map(p => ({ who: p.name, gender: p.gender || undefined, orientation: p.orientation }));
  }
  return [{ gender: profile.gender, orientation: profile.orientation }];
}

const genderSymbol = (gender?: string) =>
  gender === 'Feminino' ? '♀' : gender === 'Masculino' ? '♂' : gender ? '⚧' : '';

// Texto curto para os cards: "♀ Bi" ou "Carlos ♂ Hétero · Marina ♀ Bi"
export function identityShortLabel(profile: UserProfile): string {
  return identityEntries(profile)
    .map(e => [e.who, genderSymbol(e.gender), e.orientation ? SHORT_ORIENTATION[e.orientation] ?? e.orientation : 'Orientação não informada']
      .filter(Boolean).join(' '))
    .join(' · ');
}

// Etiquetas completas no topo do perfil
export const IdentityBadges: React.FC<{ profile: UserProfile; className?: string }> = ({ profile, className = '' }) => (
  <div className={`flex flex-wrap items-center justify-center sm:justify-start gap-1.5 ${className}`}>
    {identityEntries(profile).map((e, i) => (
      <span
        key={i}
        className="text-[11px] px-2.5 py-1 rounded-full bg-rose-950/60 text-rose-200 border border-rose-800/40 font-semibold flex items-center gap-1"
      >
        {e.who && <span className="text-rose-300/80 font-normal">{e.who}:</span>}
        {e.gender && <span>{genderSymbol(e.gender)} {e.gender}</span>}
        {e.gender && <span className="text-rose-400/60">•</span>}
        <span>{e.orientation || 'Orientação não informada'}</span>
      </span>
    ))}
  </div>
);
