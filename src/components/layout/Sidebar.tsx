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
  Gift, 
  ShieldCheck,
  Lock,
  LogOut,
  Flame,
  Award,
  ChevronRight,
  CalendarHeart
} from 'lucide-react';

export const Sidebar: React.FC = () => {
  const { 
    activeTab, 
    setActiveTab, 
    notifications, 
    incomingConnectionRequests,
    conversations, 
    currentUser, 
    isAdminMode, 
    setIsAdminMode,
    isAuthorizedAdmin,
    logout 
  } = useApp();

  const unreadNotifs = Array.isArray(notifications) ? notifications.filter(n => !n.read).length : 0;
  const unreadMsgs = Array.isArray(conversations) ? conversations.reduce((acc, c) => acc + (c?.unreadCount || 0), 0) : 0;

  const navItems = [
    { id: 'feed', label: 'Início', icon: Home, badge: null },
    { id: 'discover', label: 'Descobrir Pessoas', icon: Compass, badge: null },
    { id: 'couples', label: 'Casais Liberais', icon: Users, badge: null },
    { id: 'singles', label: 'Pessoas Solteiras', icon: Flame, badge: null },
    { id: 'compatibility', label: 'Compatibilidade', icon: Sparkles, badge: null },
    { id: 'events', label: 'Eventos', icon: CalendarHeart, badge: null },
    { id: 'communities', label: 'Comunidades', icon: Hash, badge: null },
    { id: 'invite', label: 'Convide e Ganhe', icon: Gift, badge: null },
    { id: 'connections', label: 'Conexões', icon: HeartHandshake, badge: incomingConnectionRequests.length > 0 ? `${incomingConnectionRequests.length}` : null },
    { id: 'messages', label: 'Mensagens', icon: MessageSquare, badge: unreadMsgs > 0 ? `${unreadMsgs}` : null },
    { id: 'notifications', label: 'Notificações', icon: Bell, badge: unreadNotifs > 0 ? `${unreadNotifs}` : null },
    { id: 'profile', label: 'Meu Perfil', icon: UserCheck, badge: null },
    { id: 'settings', label: 'Configurações', icon: Settings, badge: null },
  ];

  return (
    <aside className="w-64 shrink-0 hidden lg:flex flex-col justify-between py-5 px-3 bg-fundo border-r border-white/[0.06] h-[calc(100dvh-57px)] sticky top-[57px] overflow-y-auto no-scrollbar">

      {/* Navegação (como no Instagram: ícone grande, a aba ativa em negrito) */}
      <nav aria-label="Navegação" className="space-y-0.5">
        {navItems.map(item => {
          const Icon = item.icon;
          const isActive = (activeTab === item.id || (item.id === 'feed' && activeTab === 'following')) && !isAdminMode;
          return (
            <button
              key={item.id}
              onClick={() => {
                setIsAdminMode(false);
                setActiveTab(item.id);
              }}
              aria-current={isActive ? 'page' : undefined}
              className={`group relative w-full flex items-center justify-between pl-3 pr-2.5 py-2.5 rounded-xl text-[15px] transition-colors cursor-pointer ${
                isActive ? 'text-white font-bold bg-white/[0.05]' : 'text-zinc-300 font-medium hover:bg-white/[0.04] hover:text-white'
              }`}
            >
              {isActive && <span className="luz-ativa absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-full" aria-hidden />}
              <span className="flex items-center gap-3.5">
                <Icon className="w-[22px] h-[22px] transition-transform group-hover:scale-105" strokeWidth={isActive ? 2.4 : 1.8} />
                <span>{item.label}</span>
              </span>

              {item.badge && (
                <span className="min-w-5 h-5 px-1.5 rounded-full fundo-neon text-[11px] font-bold text-white flex items-center justify-center">
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
      </nav>

      {/* Sua conta: foto, nome e sair */}
      <div className="pt-4 mt-6 border-t border-white/[0.06]">
        <div className="flex items-center gap-3 px-2">
          <button type="button" onClick={() => setActiveTab('profile')} className="flex items-center gap-3 min-w-0 flex-1 text-left cursor-pointer group">
            <img src={currentUser.avatarUrl} alt="" className="w-9 h-9 rounded-full object-cover ring-1 ring-white/15" />
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-zinc-100 truncate group-hover:text-white">{currentUser.username}</span>
              <span className="flex items-center gap-1 text-xs text-zinc-500 whitespace-nowrap"><Lock className="w-3 h-3 shrink-0" />Conta protegida</span>
            </span>
          </button>
          <button
            onClick={logout}
            className="w-9 h-9 shrink-0 rounded-full text-zinc-400 hover:text-rose-300 hover:bg-white/5 flex items-center justify-center cursor-pointer"
            title="Sair da conta"
            aria-label="Sair da conta"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

    </aside>
  );
};
