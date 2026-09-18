import React, { useState, useEffect } from 'react';
import {
  Home,
  Calendar,
  Trophy,
  Users,
  Swords,
  User as UserIcon,
  ShieldAlert,
  LogOut,
  MessageSquare,
  Award,
  AlertTriangle,
  ExternalLink,
  X,
  Bell,
  Radio,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { ChukaCrestLogo } from './ChukaCrestLogo';
import { GoogleSignInButton } from './GoogleSignInButton';
import { EfootballLogo } from './EfootballLogo';
import { AuthNoticeBanner } from './AuthNoticeBanner';
import { NotificationsModal } from './social/NotificationsModal';
import { socialService } from '../services/socialService';
import { PWAInstallButton } from './pwa/PWAInstallButton';

export type NavTab =
  | 'HOME'
  | 'COMMUNITY'
  | 'ARENA'
  | 'LEAGUE'
  | 'TOURNAMENTS'
  | 'KNOCKOUT'
  | 'BRACKETS'
  | 'PLAYERS'
  | 'CHAMPIONS'
  | 'MY_MATCHES'
  | 'PROFILE'
  | 'ADMIN';

interface NavigationProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  onOpenWhatsApp?: () => void;
}

const WHATSAPP_LINK = 'https://chat.whatsapp.com/DYZn4PtKAp1AeANEuPVffk';

export const Navigation: React.FC<NavigationProps> = ({ currentTab, onSelectTab }) => {
  const {
    currentUser,
    userProfile,
    isAdmin,
    loginWithGoogle,
    logout,
    isSigningIn,
    authErrorNotice,
    clearAuthErrorNotice,
  } = useAuth();

  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!currentUser) {
      setUnreadCount(0);
      return;
    }

    const checkNotifications = async () => {
      try {
        const notifs = await socialService.getNotifications(currentUser.uid);
        const unread = notifs.filter((n) => !n.isRead).length;
        setUnreadCount(unread);
      } catch (e) {
        // silent fail
      }
    };

    checkNotifications();
    const interval = setInterval(checkNotifications, 45000);
    return () => clearInterval(interval);
  }, [currentUser]);

  const isKnockoutActive =
    currentTab === 'KNOCKOUT' ||
    currentTab === 'TOURNAMENTS' ||
    currentTab === 'BRACKETS' ||
    currentTab === 'CHAMPIONS';

  const isArenaActive = currentTab === 'ARENA' || currentTab === 'COMMUNITY';

  const isProfileActive =
    currentTab === 'PROFILE' ||
    currentTab === 'MY_MATCHES' ||
    currentTab === 'PLAYERS';

  const navItems: {
    tab: NavTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: string;
    isActive: boolean;
  }[] = [
    { tab: 'HOME', label: 'Home', icon: Home, isActive: currentTab === 'HOME' },
    { tab: 'LEAGUE', label: 'League', icon: Trophy, badge: 'KSh 50', isActive: currentTab === 'LEAGUE' },
    { tab: 'KNOCKOUT', label: 'Knockout', icon: Swords, badge: 'KSh 20', isActive: isKnockoutActive },
    { tab: 'ARENA', label: 'Arena', icon: Radio, badge: 'Live', isActive: isArenaActive },
    { tab: 'PROFILE', label: 'Profile', icon: UserIcon, isActive: isProfileActive },
  ];

  return (
    <>
      {/* Dynamic Auth Error / Network / Popup Guidance Banner */}
      {!currentUser && authErrorNotice && (
        <AuthNoticeBanner
          notice={authErrorNotice}
          onRetry={() => loginWithGoogle(true)}
          onDismiss={clearAuthErrorNotice}
          variant="banner"
        />
      )}

      {/* Top Desktop & Mobile Header */}
      <header
        id="app-header"
        className="sticky top-0 z-40 w-full border-b border-white/10 bg-[#070b09]/90 backdrop-blur-xl transition-all"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 md:h-20 flex items-center justify-between gap-4">
          {/* Logo & Brand Identity */}
          <div
            id="brand-logo"
            onClick={() => onSelectTab('HOME')}
            className="flex items-center gap-3 cursor-pointer group select-none"
          >
            {/* Chuka University Official Crest */}
            <ChukaCrestLogo
              size="md"
              withBorder={true}
              className="group-hover:scale-105 transition-transform shrink-0"
            />

            <div>
              <div className="flex items-center gap-2">
                <span className="font-heading font-black text-base md:text-xl text-white tracking-wider flex items-center gap-1.5">
                  CHUKA <span className="text-emerald-400">eFOOTBALL</span>
                </span>
                <EfootballLogo size="sm" variant="badge" className="hidden sm:inline-flex" />
              </div>
              <p className="text-[10px] md:text-xs text-white/50 font-medium tracking-wide">
                Chuka University Official Tournament Platform
              </p>
            </div>
          </div>

          {/* Desktop Nav Links */}
          <nav id="desktop-nav" className="hidden lg:flex items-center gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = item.isActive;
              return (
                <button
                  key={item.tab}
                  id={`nav-link-${item.tab.toLowerCase()}`}
                  onClick={() => onSelectTab(item.tab)}
                  className={`relative flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-semibold transition-all ${
                    isActive
                      ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shadow-sm'
                      : 'text-white/70 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                  {item.badge && (
                    <span className="px-1.5 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[9px] font-mono font-bold leading-none">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}

            {isAdmin && (
              <button
                id="nav-link-admin"
                onClick={() => onSelectTab('ADMIN')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ml-1 ${
                  currentTab === 'ADMIN'
                    ? 'bg-orange-500 text-white shadow-md shadow-orange-500/30'
                    : 'bg-orange-500/20 text-orange-400 border border-orange-500/30 hover:bg-orange-500/30'
                }`}
              >
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>Command Center</span>
              </button>
            )}
          </nav>

          {/* Right Action buttons */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Mobile Admin Command Center Button */}
            {isAdmin && (
              <button
                id="header-mobile-btn-admin"
                onClick={() => onSelectTab('ADMIN')}
                className={`lg:hidden flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[11px] font-bold uppercase tracking-wider transition-all ${
                  currentTab === 'ADMIN'
                    ? 'bg-orange-500 text-white shadow-md shadow-orange-500/30'
                    : 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                }`}
              >
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>Admin</span>
              </button>
            )}
            {/* Desktop / Header PWA Install Button */}
            <PWAInstallButton className="hidden md:inline-flex" />

            {/* WhatsApp Community CTA (Header) */}
            <a
              id="header-btn-whatsapp"
              href={WHATSAPP_LINK}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/40 text-emerald-300 text-xs font-bold uppercase tracking-wider transition-all active:scale-95"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>WhatsApp</span>
            </a>

            {/* In-App Notifications Bell */}
            {currentUser && (
              <button
                id="btn-header-notifications"
                onClick={() => setIsNotificationsOpen(true)}
                className="relative p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 hover:text-white transition-all"
                title="Notifications"
                aria-label="Notifications"
              >
                <Bell className="w-4 h-4" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 text-black text-[9px] font-mono font-bold flex items-center justify-center">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>
            )}

            {/* Auth status */}
            {currentUser && userProfile ? (
              <div className="flex items-center gap-2">
                <button
                  id="btn-nav-profile-chip"
                  onClick={() => onSelectTab('PROFILE')}
                  className="flex items-center gap-2 p-1.5 pr-3 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 transition-all text-left"
                >
                  {userProfile.photoURL ? (
                    <img
                      src={userProfile.photoURL}
                      alt={userProfile.displayName}
                      className="w-7 h-7 rounded-full object-cover border border-emerald-400/50"
                    />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-emerald-600 flex items-center justify-center text-white text-xs font-bold">
                      {userProfile.displayName.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="hidden sm:block leading-none">
                    <div className="text-xs font-bold text-white truncate max-w-[90px]">
                      {userProfile.displayName.split(' ')[0]}
                    </div>
                    <div className="text-[10px] text-emerald-400 font-mono font-medium">
                      {userProfile.playerId}
                    </div>
                  </div>
                </button>

                <button
                  id="btn-header-logout"
                  onClick={logout}
                  title="Log out"
                  className="p-2 rounded-xl text-white/50 hover:text-white hover:bg-white/5 transition-all"
                  aria-label="Log out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <GoogleSignInButton
                id="btn-header-login"
                onClick={loginWithGoogle}
                loading={isSigningIn}
                disabled={isSigningIn}
                size="sm"
                text="signin_with"
                theme="light"
                className="font-medium hover:scale-[1.02]"
              />
            )}
          </div>
        </div>
      </header>

      {/* Bottom Navigation for Mobile */}
      <nav
        id="mobile-bottom-nav"
        className="lg:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-white/[0.08] bg-[#060907]/95 backdrop-blur-xl px-2 py-1.5 pb-safe"
      >
        <div className="grid grid-cols-5 items-center justify-around gap-1 max-w-md mx-auto">
          {/* 1. HOME */}
          <button
            id="mobile-nav-home"
            onClick={() => onSelectTab('HOME')}
            className={`flex flex-col items-center justify-center py-1 rounded-xl transition-all touch-target ${
              currentTab === 'HOME'
                ? 'text-emerald-400 font-bold bg-emerald-500/10'
                : 'text-white/60 hover:text-white'
            }`}
          >
            <Home className={`w-5 h-5 ${currentTab === 'HOME' ? 'text-emerald-400 scale-105' : ''}`} />
            <span className="text-[10px] mt-0.5 tracking-tight">Home</span>
          </button>

          {/* 2. LEAGUE */}
          <button
            id="mobile-nav-league"
            onClick={() => onSelectTab('LEAGUE')}
            className={`relative flex flex-col items-center justify-center py-1 rounded-xl transition-all touch-target ${
              currentTab === 'LEAGUE'
                ? 'text-emerald-400 font-bold bg-emerald-500/10'
                : 'text-white/60 hover:text-white'
            }`}
          >
            <Trophy className={`w-5 h-5 ${currentTab === 'LEAGUE' ? 'text-emerald-400 scale-105' : ''}`} />
            <span className="text-[10px] mt-0.5 tracking-tight">League</span>
            <span className="absolute top-0.5 right-1 px-1 py-0.2 rounded-full bg-amber-500 text-black text-[7px] font-mono font-black">
              50
            </span>
          </button>

          {/* 3. KNOCKOUT */}
          <button
            id="mobile-nav-knockout"
            onClick={() => onSelectTab('KNOCKOUT')}
            className={`relative flex flex-col items-center justify-center py-1 rounded-xl transition-all touch-target ${
              isKnockoutActive
                ? 'text-emerald-400 font-bold bg-emerald-500/10'
                : 'text-white/60 hover:text-white'
            }`}
          >
            <Swords className={`w-5 h-5 ${isKnockoutActive ? 'text-emerald-400 scale-105' : ''}`} />
            <span className="text-[10px] mt-0.5 tracking-tight">Knockout</span>
            <span className="absolute top-0.5 right-1 px-1 py-0.2 rounded-full bg-amber-500 text-black text-[7px] font-mono font-black">
              20
            </span>
          </button>

          {/* 4. ARENA */}
          <button
            id="mobile-nav-arena"
            onClick={() => onSelectTab('ARENA')}
            className={`relative flex flex-col items-center justify-center py-1 rounded-xl transition-all touch-target ${
              isArenaActive
                ? 'text-emerald-400 font-bold bg-emerald-500/10'
                : 'text-white/60 hover:text-white'
            }`}
          >
            <Radio className={`w-5 h-5 ${isArenaActive ? 'text-emerald-400 scale-105' : ''}`} />
            <span className="text-[10px] mt-0.5 tracking-tight">Arena</span>
          </button>

          {/* 5. PROFILE */}
          <button
            id="mobile-nav-profile"
            onClick={() => onSelectTab('PROFILE')}
            className={`flex flex-col items-center justify-center py-1 rounded-xl transition-all touch-target ${
              isProfileActive
                ? 'text-emerald-400 font-bold bg-emerald-500/10'
                : 'text-white/60 hover:text-white'
            }`}
          >
            {currentUser && userProfile?.photoURL ? (
              <img
                src={userProfile.photoURL}
                alt="Profile"
                className={`w-5 h-5 rounded-full object-cover border ${
                  isProfileActive ? 'border-emerald-400' : 'border-white/30'
                }`}
              />
            ) : (
              <UserIcon className={`w-5 h-5 ${isProfileActive ? 'text-emerald-400 scale-105' : ''}`} />
            )}
            <span className="text-[10px] mt-0.5 tracking-tight">Profile</span>
          </button>
        </div>
      </nav>

      {/* In-App Notifications Modal */}
      <NotificationsModal
        isOpen={isNotificationsOpen}
        onClose={() => {
          setIsNotificationsOpen(false);
          if (currentUser) {
            socialService.getNotifications(currentUser.uid).then((n) => {
              setUnreadCount(n.filter((item) => !item.isRead).length);
            });
          }
        }}
        onNavigateTab={(tab) => onSelectTab(tab as NavTab)}
      />
    </>
  );
};
