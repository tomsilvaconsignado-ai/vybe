import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { 
  ShieldCheck, 
  Bell, 
  MessageCircle, 
  Search, 
  UserCheck, 
  ChevronDown,
  Lock,
  Compass,
  ArrowRightLeft
} from 'lucide-react';

export const Header: React.FC = () => {
  const { 
    currentUser, 
    isLoggedIn, 
    logout, 
    notifications, 
    conversations, 
    setActiveTab, 
    activeTab, 
    isAdminMode, 
    setIsAdminMode,
    isAuthorizedAdmin,
    switchUserAccount,
    setAuthModalType
  } = useApp();

  const [showAccountDropdown, setShowAccountDropdown] = useState(false);

  const unreadNotifications = notifications.filter(n => !n.read).length;
  const unreadMessages = conversations.reduce((acc, c) => acc + c.unreadCount, 0);

  return (
    <header className="sticky top-0 z-40 bg-[#09070f]/90 backdrop-blur-xl border-b border-purple-900/20 px-4 lg:px-8 py-3 transition-all">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        
        {/* Brand Logo */}
        <div className="flex items-center gap-3">
          <button 
            onClick={() => {
              setIsAdminMode(false);
              setActiveTab('feed');
            }}
            className="flex items-center gap-2 group text-left cursor-pointer focus:outline-none"
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-purple-700 via-fuchsia-600 to-rose-500 p-[2px] shadow-lg shadow-purple-900/30 group-hover:scale-105 transition-transform">
              <div className="w-full h-full bg-[#0d0a17] rounded-[10px] flex items-center justify-center">
                <span className="font-extrabold text-xl tracking-tighter bg-gradient-to-r from-purple-400 via-pink-400 to-rose-400 bg-clip-text text-transparent">
                  V
                </span>
              </div>
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-2xl tracking-wider text-white group-hover:text-purple-300 transition-colors">
                  VYBE
                </span>
                <span className="text-[10px] uppercase font-bold tracking-widest px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-400 border border-rose-500/30">
                  +18
                </span>
              </div>
              <p className="text-[11px] text-zinc-400 hidden sm:block tracking-wide font-medium">
                Sua conexão. Suas regras.
              </p>
            </div>
          </button>
        </div>

        {/* Search Bar (Fast Explore) */}
        {isLoggedIn && !isAdminMode && (
          <div className="hidden md:flex flex-1 max-w-md mx-4">
            <div className="relative w-full">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
              <input
                type="text"
                placeholder="Buscar casais, solteiras, cidades (#Jardins, SP)..."
                onFocus={() => setActiveTab('discover')}
                className="w-full pl-10 pr-4 py-2 bg-zinc-900/80 border border-purple-900/30 rounded-full text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-purple-500/60 focus:ring-1 focus:ring-purple-500/30 transition-all"
              />
            </div>
          </div>
        )}

        {/* Right Action Icons & User Status */}
        <div className="flex items-center gap-2 sm:gap-3">
          
          {/* EXCLUSIVE ADMIN PANEL BUTTON - ONLY DISPLAYED FOR AUTHORIZED ADMIN (tomsilvaconsignado@gmail.com) */}
          {isLoggedIn && isAuthorizedAdmin && (
            <button
              onClick={() => setIsAdminMode(!isAdminMode)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 border transition-all cursor-pointer ${
                isAdminMode 
                  ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-black border-amber-400 shadow-lg shadow-amber-950/40' 
                  : 'bg-amber-950/40 text-amber-300 border-amber-500/50 hover:bg-amber-900/50 hover:text-white'
              }`}
              title="Alternar entre Portal Social e Painel Administrativo"
            >
              <ShieldCheck className="w-4 h-4 text-amber-300" />
              <span>
                {isAdminMode ? 'Voltar ao Portal Social' : 'Painel Administrativo'}
              </span>
            </button>
          )}

          {isLoggedIn ? (
            <>
              {/* Messages button */}
              <button
                onClick={() => {
                  setIsAdminMode(false);
                  setActiveTab('messages');
                }}
                className={`relative p-2 rounded-xl transition-colors cursor-pointer ${
                  activeTab === 'messages' && !isAdminMode
                    ? 'bg-purple-950/70 text-purple-300 border border-purple-500/30' 
                    : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
                }`}
                title="Mensagens Privadas"
              >
                <MessageCircle className="w-5 h-5" />
                {unreadMessages > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-gradient-to-r from-rose-500 to-pink-500 text-[10px] font-bold text-white rounded-full flex items-center justify-center border-2 border-[#09070f] animate-pulse">
                    {unreadMessages}
                  </span>
                )}
              </button>

              {/* Notifications */}
              <button
                onClick={() => {
                  setIsAdminMode(false);
                  setActiveTab('notifications');
                }}
                className={`relative p-2 rounded-xl transition-colors cursor-pointer ${
                  activeTab === 'notifications' && !isAdminMode
                    ? 'bg-purple-950/70 text-purple-300 border border-purple-500/30' 
                    : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
                }`}
                title="Notificações"
              >
                <Bell className="w-5 h-5" />
                {unreadNotifications > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-gradient-to-r from-purple-500 to-rose-500 text-[10px] font-bold text-white rounded-full flex items-center justify-center border-2 border-[#09070f]">
                    {unreadNotifications}
                  </span>
                )}
              </button>

              {/* User Avatar & Account Switcher Dropdown */}
              <div className="relative">
                <button
                  onClick={() => setShowAccountDropdown(!showAccountDropdown)}
                  className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-full bg-zinc-900/80 border border-purple-900/30 hover:border-purple-600/50 transition-all cursor-pointer group"
                >
                  <div className="relative">
                    <img
                      src={currentUser.avatarUrl}
                      alt={currentUser.displayName}
                      className="w-7 h-7 rounded-full object-cover border border-purple-500/40"
                    />
                    {currentUser.isVerified && (
                      <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-purple-500 rounded-full flex items-center justify-center text-[9px] text-white">
                        ✓
                      </span>
                    )}
                  </div>
                  <div className="hidden sm:block text-left">
                    <span className="text-xs font-semibold text-zinc-200 group-hover:text-purple-300 block leading-tight truncate max-w-[120px]">
                      {currentUser.displayName}
                    </span>
                    <span className="text-[10px] text-purple-400">
                      {isAuthorizedAdmin ? '👑 SuperAdmin' : '@' + currentUser.username}
                    </span>
                  </div>
                  <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
                </button>

                {/* Account Switcher & Context Dropdown */}
                {showAccountDropdown && (
                  <div className="absolute right-0 top-12 w-64 bg-[#140d24] border border-purple-800/50 rounded-2xl shadow-2xl p-2 z-50 animate-in fade-in">
                    
                    <div className="p-2.5 border-b border-purple-900/40 mb-1">
                      <p className="text-xs font-bold text-white truncate">{currentUser.displayName}</p>
                      <p className="text-[11px] text-zinc-400 truncate">{currentUser.email}</p>
                      <span className={`inline-block mt-1 text-[9px] font-bold px-1.5 py-0.5 rounded ${
                        isAuthorizedAdmin 
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' 
                          : 'bg-zinc-800 text-zinc-400'
                      }`}>
                        {isAuthorizedAdmin ? 'Conta com Autorização Administrativa' : 'Conta de Usuário Social'}
                      </span>
                    </div>

                    <div className="space-y-1">
                      {isAuthorizedAdmin && (
                        <button
                          onClick={() => {
                            setIsAdminMode(!isAdminMode);
                            setShowAccountDropdown(false);
                          }}
                          className="w-full text-left px-3 py-2 rounded-xl text-xs font-semibold text-amber-300 hover:bg-amber-950/40 flex items-center gap-2 cursor-pointer"
                        >
                          <ShieldCheck className="w-4 h-4 text-amber-400" />
                          <span>{isAdminMode ? 'Voltar ao Portal Social' : 'Abrir Painel Administrativo'}</span>
                        </button>
                      )}

                      <button
                        onClick={() => {
                          setIsAdminMode(false);
                          setActiveTab('profile');
                          setShowAccountDropdown(false);
                        }}
                        className="w-full text-left px-3 py-2 rounded-xl text-xs text-zinc-300 hover:bg-purple-950/50 flex items-center gap-2 cursor-pointer"
                      >
                        <UserCheck className="w-4 h-4 text-purple-400" />
                        <span>Ver Meu Perfil</span>
                      </button>

                      <button
                        onClick={() => {
                          setIsAdminMode(false);
                          setActiveTab('settings');
                          setShowAccountDropdown(false);
                        }}
                        className="w-full text-left px-3 py-2 rounded-xl text-xs text-zinc-300 hover:bg-purple-950/50 flex items-center gap-2 cursor-pointer"
                      >
                        <Lock className="w-4 h-4 text-purple-400" />
                        <span>Configurações & Privacidade</span>
                      </button>

                      {/* Quick Demonstration Account Switcher */}
                      <div className="pt-1.5 border-t border-purple-900/30 mt-1">
                        <span className="text-[10px] uppercase font-bold text-zinc-400 px-3 block mb-1">
                          Testar Papéis (Alternar Conta):
                        </span>

                        <button
                          onClick={() => {
                            switchUserAccount('admin');
                            setShowAccountDropdown(false);
                          }}
                          className={`w-full text-left px-3 py-1.5 rounded-lg text-[11px] font-semibold flex items-center justify-between cursor-pointer ${
                            isAuthorizedAdmin
                              ? 'bg-amber-950/50 text-amber-300 font-bold'
                              : 'text-zinc-400 hover:bg-zinc-900 hover:text-white'
                          }`}
                        >
                          <span>Tom Silva (SuperAdmin)</span>
                          {isAuthorizedAdmin && <span className="text-[9px]">Ativo</span>}
                        </button>

                        <button
                          onClick={() => {
                            switchUserAccount('regular');
                            setShowAccountDropdown(false);
                          }}
                          className={`w-full text-left px-3 py-1.5 rounded-lg text-[11px] font-semibold flex items-center justify-between cursor-pointer ${
                            !isAuthorizedAdmin
                              ? 'bg-purple-950/50 text-purple-300 font-bold'
                              : 'text-zinc-400 hover:bg-zinc-900 hover:text-white'
                          }`}
                        >
                          <span>Leo & Luana (Usuário Comum)</span>
                          {!isAuthorizedAdmin && <span className="text-[9px]">Ativo</span>}
                        </button>
                      </div>

                      <div className="pt-1 border-t border-purple-900/30">
                        <button
                          onClick={() => {
                            logout();
                            setShowAccountDropdown(false);
                          }}
                          className="w-full text-left px-3 py-2 rounded-xl text-xs text-rose-400 hover:bg-rose-950/40 cursor-pointer"
                        >
                          Encerrar Sessão
                        </button>
                      </div>

                    </div>

                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setAuthModalType('login')}
                className="px-4 py-2 text-sm font-semibold text-zinc-300 hover:text-white hover:bg-zinc-900 rounded-full transition-colors cursor-pointer"
              >
                Entrar
              </button>
              <button
                onClick={() => setAuthModalType('register')}
                className="px-4 py-2 text-sm font-semibold text-white bg-gradient-to-r from-purple-600 to-rose-600 hover:from-purple-500 hover:to-rose-500 rounded-full shadow-lg shadow-purple-950/50 transition-all cursor-pointer"
              >
                Criar Conta
              </button>
            </div>
          )}

        </div>
      </div>
    </header>
  );
};
