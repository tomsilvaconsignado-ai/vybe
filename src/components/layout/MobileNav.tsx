import React from 'react';
import { useApp } from '../../context/AppContext';
import { 
  Home, 
  Compass, 
  Users, 
  MessageSquare, 
  UserCheck, 
  Sparkles,
  ShieldAlert,
  CalendarHeart
} from 'lucide-react';

export const MobileNav: React.FC = () => {
  const { 
    activeTab, 
    setActiveTab, 
    conversations, 
    isAdminMode, 
    setIsAdminMode,
    isLoggedIn 
  } = useApp();

  if (!isLoggedIn) return null;

  const unreadMsgs = Array.isArray(conversations) ? conversations.reduce((acc, c) => acc + (c?.unreadCount || 0), 0) : 0;

  const tabs = [
    { id: 'feed', label: 'Início', icon: Home },
    { id: 'discover', label: 'Descobrir', icon: Compass },
    { id: 'events', label: 'Eventos', icon: CalendarHeart },
    { id: 'messages', label: 'Chat', icon: MessageSquare, badge: unreadMsgs },
    { id: 'profile', label: 'Perfil', icon: UserCheck },
  ];

  return (
    <nav aria-label="Navegação principal" className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#09070f]/95 backdrop-blur-xl border-t border-purple-900/30 px-1 pt-1 pb-[max(0.25rem,env(safe-area-inset-bottom))]">
      <div className="flex items-center justify-around">
        {tabs.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id && !isAdminMode;
          return (
            <button
              key={tab.id}
              onClick={() => {
                setIsAdminMode(false);
                setActiveTab(tab.id);
              }}
              aria-current={isActive ? 'page' : undefined}
              className={`flex-1 min-h-[52px] flex flex-col items-center justify-center rounded-xl relative transition-colors cursor-pointer active:bg-purple-950/40 ${
                isActive 
                  ? 'text-fuchsia-400 font-semibold' 
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <div className="relative">
                <Icon className="w-6 h-6" strokeWidth={isActive ? 2.4 : 1.8} />
                {!!tab.badge && tab.badge > 0 && (
                  <span className="absolute -top-1.5 -right-2.5 min-w-[18px] h-[18px] bg-rose-500 text-white text-[10px] font-bold px-1 rounded-full border-2 border-[#09070f] flex items-center justify-center">
                    {tab.badge > 99 ? '99+' : tab.badge}
                  </span>
                )}
              </div>
              <span className="text-[11px] mt-0.5">{tab.label}</span>
              {isActive && <span className="absolute top-0 w-8 h-0.5 rounded-full bg-fuchsia-400" />}
            </button>
          );
        })}
      </div>
    </nav>
  );
};
