import React, { useState, useEffect } from 'react';
import {
  User as UserIcon,
  Trophy,
  ShieldCheck,
  Calendar,
  LogOut,
  Swords,
  Award,
  ExternalLink,
  MessageSquare,
  Sparkles,
  Zap,
  Flame,
  Smartphone,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { registrationService } from '../services/registrationService';
import { matchService } from '../services/matchService';
import { TournamentEntry, MatchFixture, Tournament } from '../types';
import { WhatsAppBanner } from '../components/WhatsAppBanner';
import { NavTab } from '../components/Navigation';
import { GoogleSignInButton } from '../components/GoogleSignInButton';
import { ChukaCrestLogo } from '../components/ChukaCrestLogo';
import { EfootballLogo } from '../components/EfootballLogo';
import { MyRegistrationsList } from '../components/MyRegistrationsList';
import { RegistrationModal } from '../components/RegistrationModal';
import { PlayerIdentitySection } from '../components/PlayerIdentitySection';
import { AuthNoticeBanner } from '../components/AuthNoticeBanner';

interface ProfileViewProps {
  onNavigate: (tab: NavTab) => void;
}

export const ProfileView: React.FC<ProfileViewProps> = ({ onNavigate }) => {
  const { currentUser, userProfile, loginWithGoogle, logout, isSigningIn, authErrorNotice, clearAuthErrorNotice } = useAuth();
  const [entries, setEntries] = useState<TournamentEntry[]>([]);
  const [myMatches, setMyMatches] = useState<MatchFixture[]>([]);
  const [loading, setLoading] = useState(true);
  const [resubmittingTournament, setResubmittingTournament] = useState<Tournament | null>(null);

  useEffect(() => {
    if (!currentUser) {
      setLoading(false);
      return;
    }

    const loadData = async () => {
      setLoading(true);
      try {
        const [userEntries, matches] = await Promise.all([
          registrationService.getUserTournamentEntries(currentUser.uid),
          matchService.getUserMatches(currentUser.uid),
        ]);
        setEntries(userEntries);
        setMyMatches(matches);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [currentUser]);

  if (!currentUser || !userProfile) {
    return (
      <div className="max-w-lg mx-auto my-8 sm:my-14 p-6 sm:p-9 text-center rounded-3xl efootball-card-bg relative overflow-hidden shadow-2xl space-y-6">
        {/* Stadium lighting glow */}
        <div className="absolute -top-16 left-1/2 -translate-x-1/2 w-64 h-32 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-16 right-0 w-48 h-32 bg-cyan-500/10 rounded-full blur-2xl pointer-events-none" />

        {/* Dual brand insignia */}
        <div className="flex items-center justify-center gap-4 relative z-10">
          <ChukaCrestLogo size="lg" withBorder={true} />
          <div className="h-8 w-[1px] bg-white/20" />
          <EfootballLogo size="lg" variant="badge" />
        </div>

        <div className="relative z-10 space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-400/30 text-emerald-400 text-[11px] font-mono font-bold uppercase tracking-wider">
            <Smartphone className="w-3.5 h-3.5" />
            <span>eFootball™ Mobile Athlete Card</span>
          </div>

          <h2 className="font-heading font-black text-2xl sm:text-3xl text-white uppercase tracking-tight">
            Claim Your Player Card
          </h2>

          <p className="text-xs sm:text-sm text-white/70 max-w-md mx-auto leading-relaxed">
            Sign in with Google to receive your official <strong className="text-emerald-400 font-mono">CHUKA-XXXXXX</strong> Player ID, register for weekly knockout cups, coordinate 1v1 match rooms, and build your hall-of-fame legacy.
          </p>
        </div>

        {/* Preview Card Showcase */}
        <div className="relative z-10 p-4 rounded-2xl bg-black/60 border border-emerald-500/30 text-left flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500/30 to-cyan-500/20 border border-emerald-400/40 flex items-center justify-center font-heading font-black text-emerald-400 text-lg">
              95
            </div>
            <div>
              <div className="font-heading font-black text-sm text-white uppercase flex items-center gap-1.5">
                <span>Chuka Competitor</span>
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono">CF</span>
              </div>
              <div className="text-[11px] text-emerald-400/90 font-mono">CHUKA-0000XX • Ready</div>
            </div>
          </div>
          <div className="text-right text-[10px] text-white/50 font-mono">
            <div>1v1 Knockouts</div>
            <div className="text-emerald-400 font-bold">10 Min • Extra Time</div>
          </div>
        </div>

        {/* Official Google Sign-In Button */}
        <div className="relative z-10 pt-1 flex flex-col items-center justify-center gap-2">
          <GoogleSignInButton
            onClick={() => loginWithGoogle()}
            loading={isSigningIn}
            disabled={isSigningIn}
            size="lg"
            text="signin_with"
            theme="light"
            className="w-full justify-center shadow-xl hover:shadow-2xl hover:scale-[1.01]"
          />
          {authErrorNotice && (
            <AuthNoticeBanner
              notice={authErrorNotice}
              onRetry={() => loginWithGoogle(true)}
              onDismiss={clearAuthErrorNotice}
              variant="inline"
            />
          )}
          <p className="text-[10px] text-white/40 font-mono">
            Fast, secure authentication via Google Identity &amp; Firebase
          </p>
        </div>
      </div>
    );
  }

  const totalMatches = (userProfile.wins || 0) + (userProfile.losses || 0);
  const winRate = totalMatches > 0 ? Math.round(((userProfile.wins || 0) / totalMatches) * 100) : 0;
  
  // Calculate authentic eFootball OVR (Overall Rating)
  const baseRating = 78;
  const ratingBoost = Math.min(21, (userProfile.wins || 0) * 3 + (userProfile.championships || 0) * 5);
  const calculatedOvr = Math.min(99, baseRating + ratingBoost);
  const cardRarity = userProfile.championships && userProfile.championships > 0
    ? 'EPIC CHAMPION'
    : (userProfile.wins || 0) >= 5
    ? 'SHOWTIME ATHLETE'
    : 'HIGHLIGHT PLAYER';

  return (
    <div id="profile-view-container" className="space-y-6 pb-16 max-w-4xl mx-auto">
      {/* Authentic eFootball™ Player Card */}
      <div className="relative overflow-hidden p-6 sm:p-8 rounded-3xl efootball-card-bg border border-emerald-400/40 shadow-2xl">
        {/* Dynamic Card Stadium Atmosphere */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-10 -left-10 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute inset-0 efootball-diagonal-stripes pointer-events-none opacity-40" />

        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            {/* Player Avatar & eFootball Card Framing */}
            <div className="relative">
              {userProfile.efootballAccountImageUrl || userProfile.photoURL ? (
                <img
                  src={userProfile.efootballAccountImageUrl || userProfile.photoURL}
                  alt={userProfile.displayName}
                  referrerPolicy="no-referrer"
                  className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl object-cover border-2 border-emerald-400 shadow-xl shadow-emerald-950/60"
                />
              ) : (
                <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-gradient-to-br from-emerald-600 via-emerald-800 to-[#002d18] flex items-center justify-center text-white font-heading font-black text-3xl border-2 border-emerald-400 shadow-xl">
                  {userProfile.displayName.charAt(0)}
                </div>
              )}
              {/* OVR Rating Badge on Card */}
              <div className="absolute -top-2.5 -left-2.5 px-2 py-0.5 rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 border border-amber-300 text-black font-heading font-black text-xs shadow-md">
                {calculatedOvr}
              </div>
              <div className="absolute -bottom-2 -right-2">
                <ChukaCrestLogo size="sm" withBorder={true} />
              </div>
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-2 mb-1.5">
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-mono font-bold uppercase">
                  <Zap className="w-3 h-3 text-cyan-400" />
                  <span>{cardRarity}</span>
                </span>
                <EfootballLogo size="sm" variant="badge" />
                {userProfile.efootballUsername && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-500/30 text-[10px] font-mono font-bold">
                    🎮 {userProfile.efootballUsername}
                  </span>
                )}
              </div>

              <h1 className="font-heading font-black text-2xl sm:text-3xl text-white uppercase tracking-tight">
                {userProfile.displayName}
              </h1>

              <div className="flex items-center gap-2 mt-0.5">
                <span className="font-mono text-amber-400 text-sm font-bold tracking-wider">
                  {userProfile.playerId}
                </span>
                <span className="text-white/40 text-xs">•</span>
                <span className="text-xs text-white/50">
                  Joined {new Date(userProfile.registeredAt).toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={logout}
            className="self-start sm:self-center px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 hover:text-white border border-white/10 text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2 active:scale-95"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>

        {/* eFootball Match Performance Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-6 mt-6 border-t border-white/10 text-center relative z-10">
          <div className="p-3.5 rounded-2xl bg-black/50 border border-emerald-500/20">
            <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 flex items-center justify-center gap-1">
              <span>Wins</span>
            </div>
            <div className="font-heading font-black text-2xl sm:text-3xl text-white mt-1">
              {userProfile.wins || 0}
            </div>
            <div className="text-[9px] text-white/40 font-mono mt-0.5">MATCH VICTORIES</div>
          </div>

          <div className="p-3.5 rounded-2xl bg-black/50 border border-white/5">
            <div className="text-[10px] font-bold uppercase tracking-wider text-white/40">Losses</div>
            <div className="font-heading font-black text-2xl sm:text-3xl text-white/70 mt-1">
              {userProfile.losses || 0}
            </div>
            <div className="text-[9px] text-white/40 font-mono mt-0.5">DEFEATS</div>
          </div>

          <div className="p-3.5 rounded-2xl bg-black/50 border border-orange-500/20">
            <div className="text-[10px] font-bold uppercase tracking-wider text-orange-400">Win Rate</div>
            <div className="font-heading font-black text-2xl sm:text-3xl text-orange-300 mt-1">
              {winRate}%
            </div>
            <div className="text-[9px] text-white/40 font-mono mt-0.5">COMPETITIVE ACCURACY</div>
          </div>

          <div className="p-3.5 rounded-2xl bg-black/50 border border-amber-500/30">
            <div className="text-[10px] font-bold uppercase tracking-wider text-amber-400 flex items-center justify-center gap-1">
              <Trophy className="w-3 h-3 text-amber-400" />
              <span>Championships</span>
            </div>
            <div className="font-heading font-black text-2xl sm:text-3xl text-amber-400 mt-1">
              {userProfile.championships || 0}
            </div>
            <div className="text-[9px] text-amber-400/60 font-mono mt-0.5">TITLES EARNED</div>
          </div>
        </div>
      </div>

      {/* WhatsApp Banner */}
      <WhatsAppBanner compact />

      {/* eFootball Mobile Identity & Knockout WhatsApp Communication */}
      <PlayerIdentitySection userProfile={userProfile} />

      {/* MY REGISTRATIONS Section (Production Requirement) */}
      <MyRegistrationsList
        userProfile={userProfile}
        onNavigate={onNavigate}
        onOpenRegister={(t) => setResubmittingTournament(t)}
      />

      {/* Registration / Re-submission Modal */}
      {resubmittingTournament && (
        <RegistrationModal
          tournament={resubmittingTournament}
          isOpen={true}
          onClose={() => setResubmittingTournament(null)}
          onRegisteredSuccess={() => {
            setResubmittingTournament(null);
          }}
        />
      )}
    </div>
  );
};
