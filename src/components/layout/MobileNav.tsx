import React from 'react';
import { useApp } from '../../context/AppContext';
import { 
  Home, 
  Compass, 
  Users, 
  MessageSquare, 
  UserCheck, 
  Sparkles,
  ShieldAlert
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

  const unreadMsgs = conversations.reduce((acc, c) => acc + c.unreadCount, 0);

  const tabs = [
    { id: 'feed', label: 'Início', icon: Home },
    { id: 'discover', label: 'Descobrir', icon: Compass },
    { id: 'compatibility', label: 'Match', icon: Sparkles },
    { id: 'messages', label: 'Chat', icon: MessageSquare, badge: unreadMsgs },
    { id: 'profile', label: 'Perfil', icon: UserCheck },
  ];

  return (
    <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#09070f]/95 backdrop-blur-xl border-t border-purple-900/30 px-2 py-2">
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
              className={`flex flex-col items-center justify-center p-1.5 rounded-xl relative transition-all cursor-pointer ${
                isActive 
                  ? 'text-fuchsia-400 font-semibold' 
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <div className="relative">
                <Icon className={`w-5 h-5 ${isActive ? 'scale-110' : ''}`} />
                {tab.badge && tab.badge > 0 && (
                  <span className="absolute -top-1 -right-2 bg-rose-500 text-white text-[9px] font-bold px-1 rounded-full border border-[#09070f]">
                    {tab.badge}
                  </span>
                )}
              </div>
              <span className="text-[10px] mt-0.5">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
