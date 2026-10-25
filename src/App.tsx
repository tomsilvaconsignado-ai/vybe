/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Header } from './components/layout/Header';
import { Sidebar } from './components/layout/Sidebar';
import { MobileNav } from './components/layout/MobileNav';
import { AgeGateModal } from './components/layout/AgeGateModal';
import { ReportModal } from './components/modals/ReportModal';
import { TermsPrivacyModal } from './components/modals/TermsPrivacyModal';
import { LandingPage } from './components/auth/LandingPage';
import { LoginModal } from './components/auth/LoginModal';
import { RegisterWizard } from './components/auth/RegisterWizard';
import { ResetPasswordModal } from './components/auth/ResetPasswordModal';

// Main Views
import { FeedView } from './components/feed/FeedView';
import { DiscoverView } from './components/discover/DiscoverView';
import { CompatibilityView } from './components/compatibility/CompatibilityView';
import { CommunitiesView } from './components/communities/CommunitiesView';
import { ConnectionsView } from './components/connections/ConnectionsView';
import { MessagesView } from './components/messages/MessagesView';
import { NotificationsView } from './components/notifications/NotificationsView';
import { ProfileView } from './components/profile/ProfileView';
import { SettingsView } from './components/settings/SettingsView';
import { AdminPortal } from './components/admin/AdminPortal';

const AppContent: React.FC = () => {
  const {
    isLoggedIn,
    authLoading,
    passwordRecoveryMode,
    profileMissing,
    logout,
    activeTab,
    isAdminMode,
    authModalType
  } = useApp();

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#08060c] flex items-center justify-center">
        <div className="w-10 h-10 rounded-full border-2 border-purple-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  if (passwordRecoveryMode) {
    return (
      <div className="min-h-screen bg-[#08060c]">
        <ResetPasswordModal />
      </div>
    );
  }

  // Sessão válida mas sem perfil no banco (ex.: cadastro feito antes de rodar supabase/setup.sql)
  if (profileMissing) {
    return (
      <div className="min-h-screen bg-[#08060c] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-[#110c1c] border border-purple-800/40 rounded-3xl p-8 text-center space-y-4">
          <h2 className="text-xl font-bold text-white">Não encontramos seu perfil</h2>
          <p className="text-xs text-zinc-400">
            Sua conta existe, mas o perfil não foi criado. Tente novamente em alguns minutos.
            Se o problema continuar, fale com o suporte.
          </p>
          <button
            onClick={logout}
            className="w-full py-3 rounded-xl font-bold text-xs text-white bg-gradient-to-r from-purple-600 to-rose-600 cursor-pointer"
          >
            Sair
          </button>
        </div>
      </div>
    );
  }

  // If not authenticated, show modern landing page
  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-[#08060c] text-zinc-100 flex flex-col font-sans">
        <Header />
        <main className="flex-1">
          <LandingPage />
        </main>
        {authModalType === 'login' && <LoginModal />}
        {authModalType === 'register' && <RegisterWizard />}
        <AgeGateModal />
        <TermsPrivacyModal />
      </div>
    );
  }

  // If Admin Portal mode is toggled
  if (isAdminMode) {
    return (
      <div className="min-h-screen bg-[#08060c] text-zinc-100 flex flex-col font-sans">
        <Header />
        <main className="flex-1 pb-16">
          <AdminPortal />
        </main>
        <ReportModal />
        <TermsPrivacyModal />
        <AgeGateModal />
      </div>
    );
  }

  // Authenticated Member Area
  const renderMainView = () => {
    switch (activeTab) {
      case 'feed':
        return <FeedView />;
      case 'discover':
        return <DiscoverView initialFilter="all" />;
      case 'couples':
        return <DiscoverView initialFilter="couples" />;
      case 'singles':
        return <DiscoverView initialFilter="singles" />;
      case 'compatibility':
        return <CompatibilityView />;
      case 'communities':
        return <CommunitiesView />;
      case 'connections':
        return <ConnectionsView />;
      case 'messages':
        return <MessagesView />;
      case 'notifications':
        return <NotificationsView />;
      case 'profile':
        return <ProfileView />;
      case 'settings':
        return <SettingsView />;
      default:
        return <FeedView />;
    }
  };

  return (
    <div className="min-h-screen bg-[#08060c] text-zinc-100 flex flex-col font-sans">
      <Header />
      
      <div className="flex-1 max-w-7xl w-full mx-auto flex">
        <Sidebar />
        <main className="flex-1 pb-20 lg:pb-10 min-w-0">
          {renderMainView()}
        </main>
      </div>

      <MobileNav />
      
      {/* Global Modals */}
      <ReportModal />
      <TermsPrivacyModal />
      <AgeGateModal />
      {authModalType === 'login' && <LoginModal />}
      {authModalType === 'register' && <RegisterWizard />}
    </div>
  );
};

export default function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}
