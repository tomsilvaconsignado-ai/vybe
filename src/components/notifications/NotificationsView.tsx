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
  EyeOff,
  UserPlus,
  Camera,
  Settings2,
  Megaphone,
  AtSign,
  Reply,
  Hash,
  CalendarHeart,
  Gift,
  Flame,
  Dices
} from 'lucide-react';

export const NotificationsView: React.FC = () => {
  const { 
    notifications, 
    markNotificationAsRead, 
    markAllNotificationsAsRead, 
    setSelectedProfileId,
    setActiveTab,
    abrirEndereco,
    currentUser,
    updateCurrentUser,
    following,
    toggleFollow
  } = useApp();

  const getIcon = (type: string) => {
    switch (type) {
      case 'vault_access_request':
      case 'vault_access_granted':
        return <Key className="w-4 h-4 text-fuchsia-400" />;
      case 'like':
        return <Heart className="w-4 h-4 text-rose-500 fill-rose-500" />;
      case 'comment':
      case 'event_comment':
        return <MessageCircle className="w-4 h-4 text-sky-400" />;
      case 'connection_request':
      case 'connection_accepted':
        return <Users className="w-4 h-4 text-purple-400" />;
      case 'system_safety':
        return <ShieldCheck className="w-4 h-4 text-emerald-400" />;
      case 'follow':
        return <UserPlus className="w-4 h-4 text-fuchsia-400" />;
      case 'profile_photo_reminder':
        return <Camera className="w-4 h-4 text-amber-400" />;
      case 'admin_broadcast':
        return <Megaphone className="w-4 h-4 text-amber-300" />;
      case 'mention':
        return <AtSign className="w-4 h-4 text-sky-400" />;
      case 'comment_reply':
        return <Reply className="w-4 h-4 text-sky-400" />;
      case 'group_join_request':
      case 'group_request_approved':
      case 'group_invite':
      case 'group_role':
        return <Hash className="w-4 h-4 text-fuchsia-400" />;
      case 'growth_reward':
      case 'growth_referral_valid':
      case 'growth_founder':
      case 'growth_ambassador':
        return <Gift className="w-4 h-4 text-amber-300" />;
      case 'event_invite':
        return <CalendarHeart className="w-4 h-4 text-rose-400" />;
      case 'mission':
        return <Flame className="w-4 h-4 text-orange-400" />;
      case 'desire_game':
        return <Dices className="w-4 h-4 text-fuchsia-400" />;
      default:
        return <Bell className="w-4 h-4 text-purple-400" />;
    }
  };

  const abrir = (n: typeof notifications[number]) => {
    markNotificationAsRead(n.id);
    // destino exato gravado pelo banco (publicação, perfil, conversa, evento...)
    if (n.link && n.link !== '/notificacoes') {
      abrirEndereco(n.link);
    } else if (n.type.includes('vault') || n.type === 'profile_photo_reminder') {
      setActiveTab('profile');
    } else if (n.type === 'event_comment') {
      setActiveTab('events');
    } else if (n.actor?.id && n.actor.id !== 'sys') {
      setSelectedProfileId(n.actor.id);
    }
  };
  const novas = notifications.filter(n => !n.read);
  const anteriores = notifications.filter(n => n.read);

  const Linha: React.FC<{ n: typeof notifications[number] }> = ({ n }) => (
    <li>
      <div
        role="button"
        tabIndex={0}
        onClick={() => abrir(n)}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); abrir(n); } }}
        className={`relative px-4 py-3 flex items-center gap-3.5 cursor-pointer transition-colors ${!n.read ? 'bg-fuchsia-500/[0.06] hover:bg-fuchsia-500/[0.1]' : 'hover:bg-white/[0.03]'}`}
      >
        {!n.read && <span aria-hidden className="luz-ativa absolute left-0 top-3 bottom-3 w-[3px] rounded-r-full" />}
        <div className="relative shrink-0">
          {n.actor.avatarUrl ? (
            <img src={n.actor.avatarUrl} alt="" className="w-11 h-11 rounded-full object-cover" />
          ) : (
            <div className="w-11 h-11 rounded-full fundo-neon flex items-center justify-center text-sm font-bold text-white">
              {n.actor.displayName.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="absolute -bottom-1 -right-1 w-[22px] h-[22px] rounded-full bg-fundo ring-2 ring-fundo flex items-center justify-center">
            {getIcon(n.type)}
          </div>
        </div>

        <p className="flex-1 min-w-0 text-[14px] leading-snug text-zinc-200">
          {currentUser.discreetModeEnabled && n.type.includes('vault')
            ? <><span className="font-semibold text-white">{n.actor.displayName}</span> enviou uma solicitação confidencial.</>
            : n.actor.displayName && n.message.startsWith(n.actor.displayName)
              ? <><span className="font-semibold text-white">{n.actor.displayName}</span>{n.message.slice(n.actor.displayName.length)}</>
              : <><span className="font-semibold text-white">{n.title}:</span> {n.message}</>}{' '}
          <span className="text-zinc-500 whitespace-nowrap">{n.createdAt}</span>
        </p>

        {n.type === 'follow' && n.actor?.id && (
          <button
            type="button"
            onClick={e => {
              e.stopPropagation();
              markNotificationAsRead(n.id);
              toggleFollow(n.actor.id);
            }}
            className={`h-8 px-4 rounded-lg text-[13px] font-semibold shrink-0 cursor-pointer transition-colors ${
              following.includes(n.actor.id) ? 'bg-white/[0.09] text-white hover:bg-white/[0.14]' : 'fundo-neon text-white'
            }`}
          >
            {following.includes(n.actor.id) ? 'Seguindo' : 'Seguir de volta'}
          </button>
        )}
      </div>
    </li>
  );

  return (
    <div className="max-w-[600px] mx-auto pt-4 sm:pt-6 pb-6">

      {/* Título e ações */}
      <div className="px-4 flex items-center justify-between gap-3 mb-3">
        <h1 className="text-[22px] font-extrabold tracking-tight text-white">Notificações</h1>
        <div className="flex items-center gap-1">
          {novas.length > 0 && (
            <button
              onClick={markAllNotificationsAsRead}
              className="h-9 px-3 rounded-full text-[13px] font-semibold text-zinc-300 hover:text-white hover:bg-white/5 flex items-center gap-1.5 cursor-pointer"
            >
              <CheckCheck className="w-4 h-4" />
              <span className="hidden min-[400px]:inline">Marcar como lidas</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => setActiveTab('notification-prefs')}
            className="w-9 h-9 rounded-full text-zinc-300 hover:text-white hover:bg-white/5 flex items-center justify-center cursor-pointer"
            title="Preferências de notificação"
            aria-label="Preferências de notificação"
          >
            <Settings2 className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Modo discreto: um interruptor */}
      <label className="mx-4 mb-4 px-3.5 py-3 rounded-2xl border border-white/[0.08] flex items-center gap-3 cursor-pointer">
        <EyeOff className="w-5 h-5 text-fuchsia-300 shrink-0" />
        <span className="flex-1 min-w-0">
          <span className="block text-[14px] font-semibold text-white">Modo discreto</span>
          <span className="block text-[13px] text-zinc-400 leading-snug">Esconde textos sensíveis na tela bloqueada e no trabalho.</span>
        </span>
        <input
          type="checkbox"
          role="switch"
          className="sr-only peer"
          checked={!!currentUser.discreetModeEnabled}
          onChange={() => updateCurrentUser({ discreetModeEnabled: !currentUser.discreetModeEnabled })}
        />
        <span aria-hidden className="relative w-11 h-6 shrink-0 rounded-full bg-zinc-700 peer-checked:bg-fuchsia-600 peer-focus-visible:ring-2 peer-focus-visible:ring-fuchsia-400 transition-colors after:absolute after:top-0.5 after:left-0.5 after:w-5 after:h-5 after:rounded-full after:bg-white after:transition-transform peer-checked:after:translate-x-5" />
      </label>

      {novas.length > 0 && (
        <section aria-label="Novas">
          <h2 className="px-4 pt-2 pb-1 text-[15px] font-bold text-white">Novas</h2>
          <ul>{novas.map(n => <Linha key={n.id} n={n} />)}</ul>
        </section>
      )}
      {anteriores.length > 0 && (
        <section aria-label="Anteriores" className={novas.length > 0 ? 'mt-3 pt-2 border-t border-white/[0.06]' : ''}>
          <h2 className="px-4 pt-2 pb-1 text-[15px] font-bold text-white">Anteriores</h2>
          <ul>{anteriores.map(n => <Linha key={n.id} n={n} />)}</ul>
        </section>
      )}

      {notifications.length === 0 && (
        <div className="px-8 py-16 text-center">
          <span className="w-16 h-16 mx-auto mb-4 rounded-full border-2 border-zinc-300/70 flex items-center justify-center">
            <Bell className="w-7 h-7 text-zinc-200" strokeWidth={1.6} />
          </span>
          <p className="text-[15px] font-semibold text-white">Tudo em dia</p>
          <p className="text-sm text-zinc-400 mt-1">Curtidas, comentários e novos seguidores aparecem aqui.</p>
        </div>
      )}

    </div>
  );
};
