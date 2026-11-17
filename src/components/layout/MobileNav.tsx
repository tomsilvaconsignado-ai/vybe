import React from 'react';
import { useApp } from '../../context/AppContext';
import { Home, Compass, MessageCircle, CalendarHeart } from 'lucide-react';

// Barra de baixo do celular: só ícones (como no Instagram). A aba ativa ganha o ícone cheio
// e um ponto de luz em gradiente; o perfil aparece com a sua foto.
export const MobileNav: React.FC = () => {
  const {
    activeTab,
    setActiveTab,
    conversations,
    isAdminMode,
    setIsAdminMode,
    isLoggedIn,
    currentUser
  } = useApp();

  if (!isLoggedIn) return null;

  const unreadMsgs = Array.isArray(conversations) ? conversations.reduce((acc, c) => acc + (c?.unreadCount || 0), 0) : 0;

  const tabs = [
    { id: 'feed', label: 'Início', icon: Home },
    { id: 'discover', label: 'Descobrir', icon: Compass },
    { id: 'events', label: 'Eventos', icon: CalendarHeart },
    { id: 'messages', label: 'Mensagens', icon: MessageCircle, badge: unreadMsgs },
    { id: 'profile', label: 'Meu perfil', icon: null },
  ];

  return (
    <nav aria-label="Navegação principal" className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-fundo/85 backdrop-blur-xl backdrop-saturate-150 border-t border-white/[0.06] pb-[env(safe-area-inset-bottom)]">
      <div className="flex items-stretch justify-around h-[54px]">
        {tabs.map(tab => {
          const Icon = tab.icon;
          const isActive = (activeTab === tab.id || (tab.id === 'feed' && activeTab === 'following')) && !isAdminMode;
          const rotulo = tab.badge ? `${tab.label} (${tab.badge} não lidas)` : tab.label;
          return (
            <button
              key={tab.id}
              onClick={() => {
                setIsAdminMode(false);
                setActiveTab(tab.id);
              }}
              aria-current={isActive ? 'page' : undefined}
              aria-label={rotulo}
              title={tab.label}
              className={`flex-1 flex items-center justify-center relative cursor-pointer transition-colors ${isActive ? 'text-white' : 'text-zinc-400 active:text-zinc-200'}`}
            >
              <span className="relative">
                {Icon ? (
                  <Icon className="w-[26px] h-[26px]" strokeWidth={isActive ? 2.6 : 1.8} />
                ) : (
                  <span className={`block w-[28px] h-[28px] rounded-full p-[2px] ${isActive ? 'fundo-neon' : 'bg-transparent'}`}>
                    <img src={currentUser?.avatarUrl} alt="" className="w-full h-full rounded-full object-cover ring-1 ring-fundo" />
                  </span>
                )}
                {!!tab.badge && tab.badge > 0 && (
                  <span className="absolute -top-1.5 -right-2.5 min-w-[18px] h-[18px] fundo-neon text-white text-[10px] font-bold px-1 rounded-full ring-2 ring-fundo flex items-center justify-center">
                    {tab.badge > 99 ? '99+' : tab.badge}
                  </span>
                )}
              </span>
              {isActive && <span className="luz-ativa absolute bottom-1.5 w-1 h-1 rounded-full" aria-hidden />}
            </button>
          );
        })}
      </div>
    </nav>
  );
};
