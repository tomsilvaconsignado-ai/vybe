import React, { useEffect, useState } from 'react';
import { useApp } from '../../context/AppContext';
import logoUrl from '../../assets/logo.png';
import logoTextoUrl from '../../assets/logo-texto.png';
import { 
  ShieldCheck,
  Heart,
  MessageCircle,
  Search,
  UserCheck, Gift,
  ChevronDown,
  Lock
} from 'lucide-react';

// Saída rápida: troca a página atual por um site neutro (sem deixar o app no "voltar")
const QUICK_EXIT_URL = 'https://www.google.com/search?q=previs%C3%A3o+do+tempo';
const quickExit = () => window.location.replace(QUICK_EXIT_URL);

export const Header: React.FC = () => {
  const { 
    currentUser, 
    isLoggedIn, 
    logout, 
    notifications, 
    conversations, 
    setActiveTab,
    discoverSearch,
    setDiscoverSearch,
    activeTab,
    isAdminMode, 
    setIsAdminMode,
    isAuthorizedAdmin,
    setAuthModalType
  } = useApp();

  const [showAccountDropdown, setShowAccountDropdown] = useState(false);

  // Esc duas vezes seguidas (menos de 0,7 s) aciona a saída rápida
  useEffect(() => {
    if (!isLoggedIn) return;
    let lastEsc = 0;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      const now = Date.now();
      if (now - lastEsc < 700) quickExit();
      lastEsc = now;
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isLoggedIn]);

  const unreadNotifications = Array.isArray(notifications) ? notifications.filter(n => !n.read).length : 0;
  const unreadMessages = Array.isArray(conversations) ? conversations.reduce((acc, c) => acc + (c?.unreadCount || 0), 0) : 0;

  return (
    <header className="sticky top-0 z-40 bg-fundo/80 backdrop-blur-xl backdrop-saturate-150 border-b border-white/[0.06] px-3 sm:px-4 lg:px-8 py-2 pt-[max(0.5rem,env(safe-area-inset-top))] transition-all">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
        
        {/* Brand Logo */}
        <div className="flex items-center gap-3">
          <button 
            onClick={() => {
              setIsAdminMode(false);
              setActiveTab('feed');
            }}
            className="flex items-center gap-2 group text-left cursor-pointer focus:outline-none"
          >
            <img
              src={logoUrl}
              alt=""
              className="w-9 h-9 sm:w-10 sm:h-10 object-contain drop-shadow-[0_0_12px_rgba(208,23,189,0.35)] group-hover:scale-105 transition-transform"
            />
            <img src={logoTextoUrl} alt="Vybelog" draggable={false} className="h-[22px] sm:h-6 w-auto select-none" />
            {!isLoggedIn && (
              <span className="hidden sm:inline text-[11px] font-bold px-1.5 py-0.5 rounded-md bg-rose-500/15 text-rose-300 border border-rose-500/25">
                +18
              </span>
            )}
          </button>
        </div>

        {/* Search Bar (Fast Explore) */}
        {isLoggedIn && !isAdminMode && (
          <div className="hidden md:flex flex-1 max-w-md mx-4">
            <div className="relative w-full">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
              <input
                type="text"
                placeholder="Buscar por nome, cidade ou interesse..."
                aria-label="Buscar pessoas"
                value={discoverSearch}
                onChange={e => {
                  setDiscoverSearch(e.target.value);
                  if (!['discover', 'couples', 'singles'].includes(activeTab)) setActiveTab('discover');
                }}
                className="w-full pl-10 pr-4 py-2 bg-white/[0.06] border border-transparent rounded-xl text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:bg-white/[0.08] focus:border-purple-500/50 transition-all"
              />
            </div>
          </div>
        )}

        {/* Right Action Icons & User Status */}
        <div className="flex items-center gap-1 sm:gap-2">

          {/* EXCLUSIVE ADMIN PANEL BUTTON - ONLY DISPLAYED FOR ACCOUNTS IN admin_users */}
          {isLoggedIn && isAuthorizedAdmin && (
            <button
              onClick={() => setIsAdminMode(!isAdminMode)}
              className={`p-2 sm:px-3.5 sm:py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 border transition-all cursor-pointer ${
                isAdminMode 
                  ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-black border-amber-400 shadow-lg shadow-amber-950/40' 
                  : 'bg-amber-950/40 text-amber-300 border-amber-500/50 hover:bg-amber-900/50 hover:text-white'
              }`}
              title="Alternar entre Portal Social e Painel Administrativo"
              aria-label={isAdminMode ? "Voltar ao Portal Social" : "Abrir Painel Administrativo"}
            >
              <ShieldCheck className="w-4 h-4 text-amber-300" />
              <span className="hidden sm:inline">
                {isAdminMode ? 'Voltar ao Portal Social' : 'Painel Administrativo'}
              </span>
            </button>
          )}

          {isLoggedIn ? (
            <>
              {/* Notificações (coração, como no Instagram) */}
              <button
                onClick={() => {
                  setIsAdminMode(false);
                  setActiveTab('notifications');
                }}
                className={`relative w-10 h-10 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
                  activeTab === 'notifications' && !isAdminMode ? 'text-white' : 'text-zinc-300 hover:text-white hover:bg-white/5'
                }`}
                title="Notificações"
                aria-label={unreadNotifications > 0 ? `Notificações (${unreadNotifications} novas)` : 'Notificações'}
              >
                <Heart className="w-6 h-6" strokeWidth={activeTab === 'notifications' && !isAdminMode ? 2.4 : 1.9} fill={activeTab === 'notifications' && !isAdminMode ? 'currentColor' : 'none'} />
                {unreadNotifications > 0 && (
                  <span className="absolute top-1 right-1 min-w-[18px] h-[18px] px-1 fundo-neon text-[10px] font-bold text-white rounded-full flex items-center justify-center ring-2 ring-fundo">
                    {unreadNotifications > 9 ? '9+' : unreadNotifications}
                  </span>
                )}
              </button>

              {/* Direct */}
              <button
                onClick={() => {
                  setIsAdminMode(false);
                  setActiveTab('messages');
                }}
                className={`relative w-10 h-10 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
                  activeTab === 'messages' && !isAdminMode ? 'text-white' : 'text-zinc-300 hover:text-white hover:bg-white/5'
                }`}
                title="Direct"
                aria-label={unreadMessages > 0 ? `Mensagens (${unreadMessages} não lidas)` : 'Mensagens'}
              >
                <MessageCircle className="w-6 h-6" strokeWidth={activeTab === 'messages' && !isAdminMode ? 2.4 : 1.9} />
                {unreadMessages > 0 && (
                  <span className="absolute top-1 right-1 min-w-[18px] h-[18px] px-1 fundo-neon text-[10px] font-bold text-white rounded-full flex items-center justify-center ring-2 ring-fundo">
                    {unreadMessages > 9 ? '9+' : unreadMessages}
                  </span>
                )}
              </button>

              {/* User Avatar & Account Switcher Dropdown */}
              <div className="relative">
                <button
                  onClick={() => setShowAccountDropdown(!showAccountDropdown)}
                  aria-label="Sua conta"
                  aria-expanded={showAccountDropdown}
                  className="flex items-center gap-2 p-1 sm:pl-1 sm:pr-3 rounded-full hover:bg-white/5 transition-all cursor-pointer group"
                >
                  <div className="relative">
                    <img
                      src={currentUser?.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200'}
                      alt={currentUser?.displayName || 'Usuário'}
                      className="w-8 h-8 rounded-full object-cover ring-1 ring-white/15"
                    />
                    {currentUser?.isVerified && (
                      <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-purple-500 rounded-full flex items-center justify-center text-[10px] text-white">
                        ✓
                      </span>
                    )}
                  </div>
                  <div className="hidden sm:block text-left">
                    <span className="text-xs font-semibold text-zinc-200 group-hover:text-purple-300 block leading-tight truncate max-w-[120px]">
                      {currentUser?.displayName || 'Usuário'}
                    </span>
                    <span className="text-[10px] text-purple-400">
                      {isAuthorizedAdmin ? '👑 Administração' : '@' + (currentUser?.username || 'usuario')}
                    </span>
                  </div>
                  <ChevronDown className="hidden sm:block w-3.5 h-3.5 text-zinc-400" />
                </button>

                {/* Account Switcher & Context Dropdown */}
                {showAccountDropdown && (
                  <div className="absolute right-0 top-12 w-64 bg-painel-alto border border-purple-800/50 rounded-2xl shadow-2xl p-2 z-50 animate-in fade-in">
                    
                    <div className="p-2.5 border-b border-purple-900/40 mb-1">
                      <p className="text-xs font-bold text-white truncate">{currentUser.displayName}</p>
                      <p className="text-[12px] text-zinc-400 truncate">{currentUser.email}</p>
                      <span className={`inline-block mt-1 text-[10px] font-bold px-1.5 py-0.5 rounded ${
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
                          setActiveTab('invite');
                          setShowAccountDropdown(false);
                        }}
                        className="w-full text-left px-3 py-2 rounded-xl text-xs text-zinc-300 hover:bg-purple-950/50 flex items-center gap-2 cursor-pointer"
                      >
                        <Gift className="w-4 h-4 text-fuchsia-400" />
                        <span>Convide e Ganhe</span>
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
                        <button
                          onClick={quickExit}
                          className="w-full text-left px-3 py-2 rounded-xl text-xs text-zinc-400 hover:bg-purple-950/50 cursor-pointer"
                          title="Troca o Vybelog por uma página neutra (ou aperte Esc duas vezes)"
                        >
                          Saída rápida (Esc 2x)
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
                className="px-4 py-2 text-sm font-semibold text-white bg-gradient-to-r from-fuchsia-600 via-pink-600 to-orange-600 hover:from-fuchsia-500 hover:via-pink-500 hover:to-orange-500 rounded-full shadow-lg shadow-purple-950/50 transition-all cursor-pointer"
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
