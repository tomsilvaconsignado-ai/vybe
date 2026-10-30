import React from 'react';
import { useApp } from '../../context/AppContext';

// Bolinha verde de "online agora" no canto do avatar (o pai precisa ser `relative`)
export const OnlineDot: React.FC<{ userId: string; size?: 'sm' | 'md' | 'lg'; className?: string }> = ({ userId, size = 'md', className = '' }) => {
  const { isOnline } = useApp();
  if (!isOnline(userId)) return null;
  const dimension = { sm: 'w-2.5 h-2.5 border-[1.5px]', md: 'w-3.5 h-3.5 border-2', lg: 'w-5 h-5 border-[3px]' }[size];
  return (
    <span
      className={`absolute rounded-full bg-emerald-500 border-[#120d20] ${dimension} ${className}`}
      title="Online agora"
      aria-label="Online agora"
    />
  );
};

// "há 5 min" -> "Ativo há 5 min"; data -> "Visto em 28/10/2026"
export function activityLabel(lastActive: string): string {
  if (lastActive === 'Modo discreto') return lastActive;
  if (lastActive === 'Agora mesmo') return 'Ativo há pouco';
  if (lastActive.startsWith('há ')) return `Ativo ${lastActive}`;
  return `Visto em ${lastActive}`;
}
