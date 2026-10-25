import React from 'react';
import { useApp } from '../../context/AppContext';
import { 
  Bell, 
  Heart, 
  MessageCircle, 
  Key, 
  ShieldCheck, 
  Users, 
  CheckCheck,
  Lock,
  EyeOff
} from 'lucide-react';

export const NotificationsView: React.FC = () => {
  const { 
    notifications, 
    markNotificationAsRead, 
    markAllNotificationsAsRead, 
    setSelectedProfileId,
    setActiveTab,
    currentUser,
    updateCurrentUser
  } = useApp();

  const getIcon = (type: string) => {
    switch (type) {
      case 'vault_access_request':
      case 'vault_access_granted':
        return <Key className="w-4 h-4 text-fuchsia-400" />;
      case 'like':
        return <Heart className="w-4 h-4 text-rose-500 fill-rose-500" />;
      case 'connection_request':
      case 'connection_accepted':
        return <Users className="w-4 h-4 text-purple-400" />;
      case 'system_safety':
        return <ShieldCheck className="w-4 h-4 text-emerald-400" />;
      default:
        return <Bell className="w-4 h-4 text-purple-400" />;
    }
  };

  return (
    <div className="max-w-2xl mx-auto py-6 px-4">
      
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-white flex items-center gap-2">
            <span>Central de Notificações</span>
          </h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            Avisos de interações, aprovações de cofre íntimo e segurança.
          </p>
        </div>

        <button
          onClick={markAllNotificationsAsRead}
          className="text-xs font-semibold text-purple-400 hover:text-purple-300 flex items-center gap-1 cursor-pointer"
        >
          <CheckCheck className="w-4 h-4" />
          <span>Marcar todas como lidas</span>
        </button>
      </div>

      {/* Discreet Mode Notification Card */}
      <div className="p-4 bg-gradient-to-r from-purple-950/40 via-zinc-900/80 to-purple-950/40 border border-purple-900/30 rounded-2xl mb-6 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <EyeOff className="w-5 h-5 text-fuchsia-400 shrink-0" />
          <div>
            <h4 className="text-xs font-bold text-white">Modo Discreto de Notificações</h4>
            <p className="text-[11px] text-zinc-400">
              Oculta prévias ou textos sensíveis que possam aparecer na tela bloqueada ou no ambiente de trabalho.
            </p>
          </div>
        </div>
        <button
          onClick={() => updateCurrentUser({ discreetModeEnabled: !currentUser.discreetModeEnabled })}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            currentUser.discreetModeEnabled 
              ? 'bg-emerald-600 text-white' 
              : 'bg-zinc-800 text-zinc-400'
          }`}
        >
          {currentUser.discreetModeEnabled ? 'Ativado' : 'Desativado'}
        </button>
      </div>

      {/* Notifications List */}
      <div className="space-y-3">
        {notifications.map(n => (
          <div
            key={n.id}
            onClick={() => {
              markNotificationAsRead(n.id);
              if (n.type.includes('vault')) {
                setActiveTab('profile');
              } else if (n.actor?.id && n.actor.id !== 'sys') {
                setSelectedProfileId(n.actor.id);
              }
            }}
            className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-start gap-3.5 ${
              !n.read 
                ? 'bg-[#160e28] border-purple-600/50 shadow-md shadow-purple-950/30' 
                : 'bg-[#120d20] border-purple-900/20 hover:border-purple-800/40'
            }`}
          >
            {/* Avatar or Icon */}
            <div className="relative shrink-0">
              {n.actor.avatarUrl ? (
                <img
                  src={n.actor.avatarUrl}
                  alt={n.actor.displayName}
                  className="w-11 h-11 rounded-full object-cover border border-purple-500/40"
                />
              ) : (
                <div className="w-11 h-11 rounded-full bg-purple-950 border border-purple-500/40 flex items-center justify-center text-sm font-bold text-purple-300">
                  {n.actor.displayName.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-zinc-950 border border-zinc-800 flex items-center justify-center">
                {getIcon(n.type)}
              </div>
            </div>

            {/* Notification Text */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2 mb-0.5">
                <h4 className="text-xs font-bold text-white truncate">
                  {n.title}
                </h4>
                <span className="text-[10px] text-zinc-400 shrink-0">{n.createdAt}</span>
              </div>
              <p className="text-xs text-zinc-300 leading-snug">
                {currentUser.discreetModeEnabled && n.type.includes('vault')
                  ? <><strong className="text-purple-300">{n.actor.displayName}</strong> enviou uma solicitação confidencial.</>
                  : n.message}
              </p>
            </div>

            {!n.read && (
              <span className="w-2 h-2 rounded-full bg-fuchsia-500 mt-2 shrink-0" />
            )}
          </div>
        ))}

        {notifications.length === 0 && (
          <div className="p-8 text-center text-xs text-zinc-400 bg-[#120d20] rounded-3xl border border-purple-900/20">
            Nenhuma notificação recente.
          </div>
        )}
      </div>

    </div>
  );
};
