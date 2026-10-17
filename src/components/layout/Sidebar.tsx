import React from 'react';
import { useApp } from '../../context/AppContext';
import { 
  Home, 
  Compass, 
  Users, 
  User, 
  Sparkles, 
  Hash, 
  HeartHandshake, 
  MessageSquare, 
  Bell, 
  UserCheck, 
  Settings, 
  ShieldCheck,
  Lock,
  LogOut,
  Flame,
  Award,
  ChevronRight
} from 'lucide-react';

export const Sidebar: React.FC = () => {
  const { 
    activeTab, 
    setActiveTab, 
    notifications, 
    conversations, 
    currentUser, 
    isAdminMode, 
    setIsAdminMode,
    isAuthorizedAdmin,
    logout 
  } = useApp();

  const unreadNotifs = notifications.filter(n => !n.read).length;
  const unreadMsgs = conversations.reduce((acc, c) => acc + c.unreadCount, 0);

  const navItems = [
    { id: 'feed', label: 'Início', icon: Home, badge: null },
    { id: 'discover', label: 'Descobrir Pessoas', icon: Compass, badge: null },
    { id: 'couples', label: 'Casais Liberais', icon: Users, badge: 'Popular' },
    { id: 'singles', label: 'Pessoas Solteiras', icon: Flame, badge: null },
    { id: 'compatibility', label: 'Compatibilidade', icon: Sparkles, badge: 'IA' },
    { id: 'communities', label: 'Comunidades', icon: Hash, badge: null },
    { id: 'connections', label: 'Curtidas e Conexões', icon: HeartHandshake, badge: null },
    { id: 'messages', label: 'Mensagens', icon: MessageSquare, badge: unreadMsgs > 0 ? `${unreadMsgs}` : null },
    { id: 'notifications', label: 'Notificações', icon: Bell, badge: unreadNotifs > 0 ? `${unreadNotifs}` : null },
    { id: 'profile', label: 'Meu Perfil', icon: UserCheck, badge: null },
    { id: 'settings', label: 'Configurações', icon: Settings, badge: null },
  ];

  return (
    <aside className="w-64 shrink-0 hidden lg:flex flex-col justify-between py-6 px-4 bg-[#0a0712] border-r border-purple-950/40 min-h-[calc(100vh-65px)] sticky top-[65px]">
      
      {/* Navigation Links */}
      <div className="space-y-1">
        <div className="px-3 mb-2">
          <p className="text-[11px] uppercase tracking-wider font-bold text-zinc-400">
            Explorar Plataforma
          </p>
        </div>

        {navItems.map(item => {
          const Icon = item.icon;
          const isActive = activeTab === item.id && !isAdminMode;
          return (
            <button
              key={item.id}
              onClick={() => {
                setIsAdminMode(false);
                setActiveTab(item.id);
              }}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl font-medium text-sm transition-all cursor-pointer ${
                isActive
                  ? 'bg-gradient-to-r from-purple-900/60 to-purple-800/20 text-white border-l-4 border-fuchsia-500 shadow-md shadow-purple-950/40 font-semibold'
                  : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900/60'
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon className={`w-4 h-4 ${isActive ? 'text-fuchsia-400' : 'text-zinc-400'}`} />
                <span>{item.label}</span>
              </div>

              {item.badge && (
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  item.badge === 'IA' 
                    ? 'bg-fuchsia-500/20 text-fuchsia-400 border border-fuchsia-500/30'
                    : item.badge === 'Popular'
                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                    : 'bg-gradient-to-r from-purple-500 to-rose-500 text-white'
                }`}>
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}

        {/* Separator & Admin shortcut - strictly displayed for authorized administrator */}
        {isAuthorizedAdmin && (
          <div className="pt-4 border-t border-zinc-900 mt-4">
            <button
              onClick={() => setIsAdminMode(!isAdminMode)}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl font-medium text-sm transition-all cursor-pointer ${
                isAdminMode
                  ? 'bg-amber-950/40 text-amber-300 border border-amber-500/40'
                  : 'text-amber-400/90 hover:text-amber-300 hover:bg-amber-950/20'
              }`}
            >
              <div className="flex items-center gap-3">
                <ShieldCheck className="w-4 h-4 text-amber-400" />
                <span>Painel Administrativo</span>
              </div>
              <ChevronRight className="w-4 h-4 text-amber-500/50" />
            </button>
          </div>
        )}
      </div>

      {/* User Footer Profile & Privacy Pill */}
      <div className="pt-4 mt-6 border-t border-purple-950/40">
        <div className="p-3 rounded-2xl bg-gradient-to-b from-purple-950/30 to-zinc-900/80 border border-purple-900/30">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] uppercase font-bold text-emerald-400 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              Conexão Segura
            </span>
            <span className="text-[10px] text-zinc-400 font-medium">LGPD Ativa</span>
          </div>
          
          <div className="flex items-center gap-2 mb-3">
            <img 
              src={currentUser.avatarUrl} 
              alt={currentUser.displayName} 
              className="w-9 h-9 rounded-full object-cover border border-purple-500/40"
            />
            <div className="truncate">
              <p className="text-xs font-bold text-zinc-200 truncate">{currentUser.displayName}</p>
              <p className="text-[11px] text-purple-400">@{currentUser.username}</p>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-purple-900/20">
            <button
              onClick={() => setActiveTab('settings')}
              className="text-[11px] text-zinc-400 hover:text-zinc-200 flex items-center gap-1 cursor-pointer"
            >
              <Lock className="w-3 h-3 text-purple-400" />
              Privacidade
            </button>
            <button
              onClick={logout}
              className="text-[11px] text-rose-400 hover:text-rose-300 flex items-center gap-1 cursor-pointer"
            >
              <LogOut className="w-3 h-3" />
              Sair
            </button>
          </div>
        </div>
      </div>

    </aside>
  );
};
