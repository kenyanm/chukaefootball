import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { Navigation, NavTab } from './components/Navigation';
import { HomeView } from './views/HomeView';
import { TournamentsView } from './views/TournamentsView';
import { BracketsView } from './views/BracketsView';
import { PlayersView } from './views/PlayersView';
import { MyMatchesView } from './views/MyMatchesView';
import { ProfileView } from './views/ProfileView';
import { ChampionsView } from './views/ChampionsView';
import { LeagueView } from './views/LeagueView';
import { CommunityView } from './components/social/CommunityView';
import { AdminPanel } from './components/AdminPanel';
import { Shield, ExternalLink, Heart, Swords, Trophy } from 'lucide-react';
import { ChukaCrestLogo } from './components/ChukaCrestLogo';
import { WhatsAppLogo } from './components/WhatsAppLogo';
import { OfflineBar } from './components/pwa/OfflineBar';

const WHATSAPP_LINK = 'https://chat.whatsapp.com/DYZn4PtKAp1AeANEuPVffk';

function AppContent() {
  const [currentTab, setCurrentTab] = useState<NavTab>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('tab')?.toUpperCase() === 'LEAGUE' || params.get('player')) {
        return 'LEAGUE';
      }
    }
    return 'HOME';
  });
  const [selectedTournamentForBracket, setSelectedTournamentForBracket] = useState<string>('');
  const { userProfile, isAdmin } = useAuth();

  const handleNavigate = (tab: NavTab) => {
    setCurrentTab(tab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSelectTournamentForBracket = (tournamentId: string) => {
    setSelectedTournamentForBracket(tournamentId);
    setCurrentTab('BRACKETS');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#050806] text-white selection:bg-emerald-500 selection:text-black">
      {/* PWA Offline Bar */}
      <OfflineBar />

      {/* Top Header & Bottom Mobile Navigation */}
      <Navigation
        currentTab={currentTab}
        onSelectTab={handleNavigate}
      />

      {/* Main View Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-6 md:pt-8 pb-20 lg:pb-12">
        {currentTab === 'HOME' && (
          <HomeView onNavigate={handleNavigate} />
        )}

        {(currentTab === 'COMMUNITY' || currentTab === 'ARENA') && (
          <CommunityView seasonId="SEASON_01" onNavigateTab={handleNavigate} />
        )}

        {currentTab === 'LEAGUE' && (
          <LeagueView currentUserProfile={userProfile} isAdmin={isAdmin} />
        )}

        {(currentTab === 'TOURNAMENTS' || currentTab === 'KNOCKOUT') && (
          <TournamentsView
            onNavigate={handleNavigate}
            onSelectTournamentForBracket={handleSelectTournamentForBracket}
          />
        )}

        {currentTab === 'BRACKETS' && (
          <BracketsView
            selectedTournamentId={selectedTournamentForBracket}
            onNavigate={handleNavigate}
          />
        )}

        {currentTab === 'CHAMPIONS' && (
          <ChampionsView onNavigate={handleNavigate} />
        )}

        {currentTab === 'PLAYERS' && (
          <PlayersView />
        )}

        {currentTab === 'MY_MATCHES' && (
          <MyMatchesView onNavigate={handleNavigate} />
        )}

        {currentTab === 'PROFILE' && (
          <ProfileView onNavigate={handleNavigate} />
        )}

        {currentTab === 'ADMIN' && (
          <AdminPanel />
        )}
      </main>

      {/* Footer */}
      <footer id="app-footer" className="border-t border-white/10 bg-[#030604] py-10 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto space-y-8">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 pb-8 border-b border-white/5">
            {/* Left Brand Identity */}
            <div className="space-y-2 max-w-md">
              <div className="flex items-center gap-3">
                <ChukaCrestLogo size="sm" />
                <span className="font-heading font-black text-lg text-white tracking-wider">
                  CHUKA <span className="text-emerald-400">eFOOTBALL</span>
                </span>
              </div>
              <p className="font-heading font-bold text-xs text-amber-400 uppercase tracking-wide">
                Compete. Connect. Become Champion.
              </p>
              <p className="text-xs text-white/50 leading-relaxed">
                The official mobile eFootball tournament and community platform for Chuka University students.
                All matches played 1v1 on eFootball Mobile.
              </p>
            </div>

            {/* Quick Links & WhatsApp */}
            <div className="flex flex-wrap items-center gap-4">
              <a
                href={WHATSAPP_LINK}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 text-xs font-bold uppercase tracking-wider transition-all"
              >
                <WhatsAppLogo className="w-4 h-4" size={16} />
                <span>Join Official WhatsApp</span>
                <ExternalLink className="w-3.5 h-3.5 opacity-70" />
              </a>

              {isAdmin && (
                <button
                  onClick={() => handleNavigate('ADMIN')}
                  className="px-4 py-2.5 rounded-xl bg-orange-500/20 hover:bg-orange-500/30 border border-orange-500/40 text-orange-300 text-xs font-bold uppercase tracking-wider transition-all"
                >
                  Admin Command Desk
                </button>
              )}
            </div>
          </div>

          {/* Rules and Fair Play Notice */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-white/50">
            <div className="space-y-1">
              <div className="font-bold text-white uppercase text-[11px] flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-emerald-400" />
                <span>Official Ruleset</span>
              </div>
              <p className="text-[11px] leading-relaxed">
                Standard 10-minute 1v1 mobile matches with Extra Time and Penalties enabled. HOME player hosts the room and AWAY player joins.
              </p>
            </div>

            <div className="space-y-1">
              <div className="font-bold text-white uppercase text-[11px] flex items-center gap-1.5">
                <Swords className="w-3.5 h-3.5 text-orange-400" />
                <span>Fair Play &amp; Verification</span>
              </div>
              <p className="text-[11px] leading-relaxed">
                All tournament entrants must be verified before bracket seeding. Match screenshot evidence is automatically purged upon result confirmation.
              </p>
            </div>

            <div className="space-y-1">
              <div className="font-bold text-white uppercase text-[11px] flex items-center gap-1.5">
                <Trophy className="w-3.5 h-3.5 text-amber-400" />
                <span>Weekly Knockout Cup</span>
              </div>
              <p className="text-[11px] leading-relaxed">
                Each weekly edition is an independent tournament. Past championships and records are permanently immortalized in the Hall of Fame.
              </p>
            </div>
          </div>

          {/* Copyright */}
          <div className="pt-4 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-white/40">
            <div>
              &copy; {new Date().getFullYear()} CHUKA eFOOTBALL. Chuka University Mobile Esports Platform.
            </div>
            <div>
              Powered by eFootball Mobile &bull; All match rooms coordinated directly between players.
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ToastProvider>
  );
}
