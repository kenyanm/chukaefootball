import React, { useState, useEffect } from 'react';
import {
  Flame,
  Swords,
  Trophy,
  TrendingUp,
  Sun,
  Award,
  Crown,
  CreditCard,
  Search,
  MessageSquare,
  Radio,
  Share2,
  ShieldCheck,
  User,
  Plus,
  AlertTriangle,
  Flag,
  Trash2,
  ExternalLink,
  ChevronRight,
  Filter,
  CheckCircle2,
  X,
  Send,
  Ban,
  Clock,
  Check,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { socialService } from '../../services/socialService';
import { leagueService } from '../../services/leagueService';
import { gamificationService } from '../../services/gamificationService';
import { DailyFirstCard } from '../common/DailyFirstCard';
import { ResultSubmissionCard } from '../common/ResultSubmissionCard';
import { EmptyState } from '../common/EmptyState';
import {
  SocialActivity,
  CommunityPost,
  PublicPlayerSearchResult,
  DailyClaim,
  ChampionRecord,
  LeagueMatch,
  LeagueChallenge,
  LeagueMember,
} from '../../types';
import { PublicLeagueProfileModal } from '../league/PublicLeagueProfileModal';
import { LeagueCardModal } from '../league/LeagueCardModal';
import { ChallengePlayerModal } from '../league/ChallengePlayerModal';

interface CommunityViewProps {
  seasonId?: string;
  onNavigateTab?: (tab: string) => void;
}

export const CommunityView: React.FC<CommunityViewProps> = ({
  seasonId = 'SEASON_01',
  onNavigateTab,
}) => {
  const { currentUser, userProfile, isAdmin } = useAuth();
  const [activeSubTab, setActiveSubTab] = useState<'HOME' | 'DISCOVERY' | 'LOUNGE' | 'FEED'>('HOME');

  // Community Home Data
  const [liveMatches, setLiveMatches] = useState<LeagueMatch[]>([]);
  const [openChallenges, setOpenChallenges] = useState<LeagueChallenge[]>([]);
  const [recentResults, setRecentResults] = useState<LeagueMatch[]>([]);
  const [hotStreaks, setHotStreaks] = useState<LeagueMember[]>([]);
  const [biggestMovers, setBiggestMovers] = useState<LeagueMember[]>([]);
  const [todayFirst, setTodayFirst] = useState<DailyClaim | null>(null);
  const [recentActivities, setRecentActivities] = useState<SocialActivity[]>([]);
  const [champions, setChampions] = useState<ChampionRecord[]>([]);
  const [featuredMembers, setFeaturedMembers] = useState<LeagueMember[]>([]);
  const [isLoadingHome, setIsLoadingHome] = useState(false);
  const [challengeFilter, setChallengeFilter] = useState<'ALL' | 'MINE' | 'OPEN'>('ALL');
  const [isRespondingChallengeId, setIsRespondingChallengeId] = useState<string | null>(null);

  // Player Discovery Data
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<PublicPlayerSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Community Lounge Data
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [isLoadingPosts, setIsLoadingPosts] = useState(false);
  const [postContent, setPostContent] = useState('');
  const [postType, setPostType] = useState<CommunityPost['type']>('LOOKING_FOR_OPPONENT');
  const [isPublishingPost, setIsPublishingPost] = useState(false);
  const [postError, setPostError] = useState<string | null>(null);

  // Modals & Inspection State
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [selectedCardMember, setSelectedCardMember] = useState<LeagueMember | null>(null);
  const [isCardModalOpen, setIsCardModalOpen] = useState(false);
  const [challengeTargetPlayerId, setChallengeTargetPlayerId] = useState<string | null>(null);
  const [isChallengeModalOpen, setIsChallengeModalOpen] = useState(false);

  // Moderation / Report Modal
  const [reportingPost, setReportingPost] = useState<CommunityPost | null>(null);
  const [reportReason, setReportReason] = useState('SPAM');
  const [reportDescription, setReportDescription] = useState('');
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);

  // Load Community Home Data
  const loadHomeData = async () => {
    setIsLoadingHome(true);
    try {
      const [matches, challenges, members, firstClaim, acts, champs] = await Promise.all([
        leagueService.getLeagueMatches(seasonId),
        leagueService.getSeasonChallenges(seasonId),
        leagueService.getLeagueMembers(seasonId),
        gamificationService.getTodayFirstClaim(),
        socialService.getPublicActivityFeed(25),
        gamificationService.getChampionsList(),
      ]);

      // Live now: matches with PLAYING or ROOM_READY status
      setLiveMatches(matches.filter((m) => ['PLAYING', 'ROOM_READY'].includes(m.status)));

      // Open challenges: PENDING status
      setOpenChallenges(challenges.filter((c) => c.status === 'PENDING'));

      // Recent results: CONFIRMED matches sorted by date
      setRecentResults(
        matches.filter((m) => m.status === 'CONFIRMED').slice(0, 6)
      );

      // Verified members
      const verified = members.filter((m) => m.status === 'VERIFIED');

      // Hot streaks: currentStreak >= 2
      const streaks = [...verified]
        .filter((m) => (m.currentStreak || 0) >= 2)
        .sort((a, b) => (b.currentStreak || 0) - (a.currentStreak || 0))
        .slice(0, 6);
      setHotStreaks(streaks);

      // Biggest Movers: sort by positive ranking movement
      const movers = [...verified]
        .filter((m) => (m.previousPosition || 0) > (m.currentPosition || 0))
        .sort((a, b) => (b.previousPosition - b.currentPosition) - (a.previousPosition - a.currentPosition))
        .slice(0, 6);
      setBiggestMovers(movers);

      // Featured cards: top 6 by points
      setFeaturedMembers([...verified].sort((a, b) => b.points - a.points).slice(0, 6));

      setTodayFirst(firstClaim);
      setRecentActivities(acts);
      setChampions(champs);
    } catch (err) {
      console.warn('Error loading community home data:', err);
    } finally {
      setIsLoadingHome(false);
    }
  };

  const handleAcceptChallenge = async (challengeId: string) => {
    if (!currentUser?.uid) return;
    setIsRespondingChallengeId(challengeId);
    try {
      await leagueService.respondToChallenge({
        challengeId,
        response: 'ACCEPT',
        userUid: currentUser.uid,
        seasonId,
      });
      await loadHomeData();
    } catch (err: any) {
      console.error('Failed to accept challenge', err);
    } finally {
      setIsRespondingChallengeId(null);
    }
  };

  const handleDeclineChallenge = async (challengeId: string) => {
    if (!currentUser?.uid) return;
    setIsRespondingChallengeId(challengeId);
    try {
      await leagueService.respondToChallenge({
        challengeId,
        response: 'DECLINE',
        userUid: currentUser.uid,
        seasonId,
      });
      await loadHomeData();
    } catch (err: any) {
      console.error('Failed to decline challenge', err);
    } finally {
      setIsRespondingChallengeId(null);
    }
  };

  // Load Community Posts
  const loadPosts = async () => {
    setIsLoadingPosts(true);
    try {
      const list = await socialService.getCommunityPosts();
      setPosts(list);
    } catch (e) {
      console.warn('Error loading community posts:', e);
    } finally {
      setIsLoadingPosts(false);
    }
  };

  useEffect(() => {
    loadHomeData();
    loadPosts();
  }, [seasonId]);

  // Handle Search Input
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (!searchQuery.trim()) {
        setSearchResults([]);
        return;
      }
      setIsSearching(true);
      try {
        const results = await socialService.searchPlayers(searchQuery, seasonId);
        setSearchResults(results);
      } catch (err) {
        console.warn('Search error:', err);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, seasonId]);

  // Handle Submit Post
  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !userProfile?.playerId) {
      setPostError('You must be a registered player to share community posts.');
      return;
    }
    if (!postContent.trim()) return;

    setIsPublishingPost(true);
    setPostError(null);
    try {
      await socialService.createCommunityPost({
        authorUid: currentUser.uid,
        authorPlayerId: userProfile.playerId,
        authorUsername: userProfile.efootballUsername || userProfile.displayName,
        authorDisplayName: userProfile.displayName,
        type: postType,
        content: postContent.trim(),
      });
      setPostContent('');
      await loadPosts();
    } catch (err: any) {
      setPostError(err?.message || 'Failed to post message. Please ensure no personal phone numbers or payment details are included.');
    } finally {
      setIsPublishingPost(false);
    }
  };

  // Handle Submit Report
  const handleSubmitReport = async () => {
    if (!reportingPost || !currentUser) return;
    setIsSubmittingReport(true);
    try {
      await socialService.reportCommunityPost({
        postId: reportingPost.postId,
        reportedByUid: currentUser.uid,
        reason: reportReason as any,
        description: reportDescription,
      });
      setReportingPost(null);
      setReportDescription('');
      await loadPosts();
    } catch (e) {
      console.warn('Report error:', e);
    } finally {
      setIsSubmittingReport(false);
    }
  };

  // Handle Block Player
  const handleBlockUser = async (targetPlayerId: string) => {
    if (!currentUser) return;
    if (!window.confirm(`Block player ${targetPlayerId}? Their posts and match challenges will no longer appear.`)) return;
    await socialService.blockUser(currentUser.uid, targetPlayerId);
    await loadPosts();
  };

  // Handle Delete Post
  const handleDeletePost = async (postId: string) => {
    if (!window.confirm('Delete this post?')) return;
    await socialService.deleteCommunityPost(postId);
    setPosts((prev) => prev.filter((p) => p.postId !== postId));
  };

  const openPlayerProfile = (pId: string) => {
    setSelectedPlayerId(pId);
    setIsProfileOpen(true);
  };

  const openPlayerCard = (member: LeagueMember) => {
    setSelectedCardMember(member);
    setIsCardModalOpen(true);
  };

  const initiateChallenge = (targetPId: string) => {
    setChallengeTargetPlayerId(targetPId);
    setIsChallengeModalOpen(true);
  };

  return (
    <div id="community-hub" className="space-y-6 max-w-7xl mx-auto px-3 sm:px-6 py-4">
      {/* Brand Header */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-black/80 via-emerald-950/30 to-black/80 border border-emerald-500/20 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 font-mono font-bold text-[10px] uppercase tracking-wider flex items-center gap-1.5">
                <Radio className="w-3 h-3 text-emerald-400 animate-pulse" />
                OFFICIAL COMMUNITY & SOCIAL HUB
              </span>
              <span className="text-[10px] font-mono text-white/50">{seasonId}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-heading font-black text-white tracking-tight">
              CHUKA <span className="text-emerald-400">eFOOTBALL</span> COMMUNITY
            </h1>
            <p className="text-xs sm:text-sm text-white/70 max-w-2xl font-sans">
              Verified player activity, live challenges, real rivalries, achievements, and open
              opponent discovery. Built strictly on authoritative competitive records.
            </p>
          </div>

          {/* Quick Hub Navigation */}
          <div className="flex items-center gap-2 flex-wrap">
            {onNavigateTab && (
              <>
                <button
                  onClick={() => onNavigateTab('LEAGUE')}
                  className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white font-mono text-xs font-bold transition-all"
                >
                  Standings
                </button>
                <button
                  onClick={() => onNavigateTab('ARENA')}
                  className="px-3 py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 font-mono text-xs font-bold flex items-center gap-1.5 transition-all"
                >
                  <Radio className="w-3.5 h-3.5" />
                  Live Arena
                </button>
              </>
            )}
          </div>
        </div>

        {/* Sub-Navigation Tabs */}
        <div className="flex items-center gap-2 mt-6 pt-4 border-t border-white/10 overflow-x-auto scrollbar-none font-mono text-xs">
          <button
            id="tab-community-home"
            onClick={() => setActiveSubTab('HOME')}
            className={`px-4 py-2 rounded-xl transition-all whitespace-nowrap flex items-center gap-2 font-bold ${
              activeSubTab === 'HOME'
                ? 'bg-emerald-500 text-black shadow-lg shadow-emerald-500/20'
                : 'bg-white/5 text-white/70 hover:text-white hover:bg-white/10'
            }`}
          >
            <Flame className="w-3.5 h-3.5" />
            <span>Community Home</span>
          </button>

          <button
            id="tab-player-discovery"
            onClick={() => setActiveSubTab('DISCOVERY')}
            className={`px-4 py-2 rounded-xl transition-all whitespace-nowrap flex items-center gap-2 font-bold ${
              activeSubTab === 'DISCOVERY'
                ? 'bg-emerald-500 text-black shadow-lg shadow-emerald-500/20'
                : 'bg-white/5 text-white/70 hover:text-white hover:bg-white/10'
            }`}
          >
            <Search className="w-3.5 h-3.5" />
            <span>Player Discovery</span>
          </button>

          <button
            id="tab-community-lounge"
            onClick={() => setActiveSubTab('LOUNGE')}
            className={`px-4 py-2 rounded-xl transition-all whitespace-nowrap flex items-center gap-2 font-bold ${
              activeSubTab === 'LOUNGE'
                ? 'bg-emerald-500 text-black shadow-lg shadow-emerald-500/20'
                : 'bg-white/5 text-white/70 hover:text-white hover:bg-white/10'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Community Lounge</span>
            {posts.length > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-black/40 text-[10px]">
                {posts.length}
              </span>
            )}
          </button>

          <button
            id="tab-activity-feed"
            onClick={() => setActiveSubTab('FEED')}
            className={`px-4 py-2 rounded-xl transition-all whitespace-nowrap flex items-center gap-2 font-bold ${
              activeSubTab === 'FEED'
                ? 'bg-emerald-500 text-black shadow-lg shadow-emerald-500/20'
                : 'bg-white/5 text-white/70 hover:text-white hover:bg-white/10'
            }`}
          >
            <Radio className="w-3.5 h-3.5" />
            <span>Live Social Activity</span>
          </button>
        </div>
      </div>

      {/* ==================================================================== */}
      {/* 1. COMMUNITY HOME TAB (The 9 Public-First Sections)                   */}
      {/* ==================================================================== */}
      {activeSubTab === 'HOME' && (
        <div className="space-y-6 animate-in fade-in">
          {/* Section 1: 🔴 LIVE ARENA BANNER (Section 16) */}
          <div className="p-4 sm:p-5 rounded-2xl bg-[#07190f] border border-emerald-500/30 shadow-lg flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="relative flex h-3.5 w-3.5">
                <span
                  className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                    liveMatches.length > 0 ? 'bg-red-400' : 'bg-emerald-400'
                  }`}
                />
                <span
                  className={`relative inline-flex rounded-full h-3.5 w-3.5 ${
                    liveMatches.length > 0 ? 'bg-red-500' : 'bg-emerald-500'
                  }`}
                />
              </span>
              <div>
                <div className="font-heading font-black text-sm sm:text-base text-white tracking-wide">
                  {liveMatches.length > 0
                    ? `🔴 ${liveMatches.length} MATCH${liveMatches.length > 1 ? 'ES' : ''} IN PROGRESS RIGHT NOW`
                    : '🟢 ARENA READY · ISSUE A CHALLENGE'}
                </div>
                <div className="text-xs text-white/50 font-mono">
                  {liveMatches.length > 0
                    ? 'Live competitive fixtures currently battling in eFootball Mobile'
                    : 'Campus arena pitch is open for official rated head-to-head duels'}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                if (liveMatches.length > 0) {
                  onNavigateTab?.('ARENA');
                } else {
                  setActiveSubTab('DISCOVERY');
                }
              }}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-heading font-black text-xs uppercase tracking-wider transition-all shadow-md shadow-emerald-500/20 active:scale-98 shrink-0 flex items-center justify-center gap-1.5"
            >
              {liveMatches.length > 0 ? 'WATCH / FOLLOW' : 'ISSUE CHALLENGE'}
            </button>
          </div>

          {/* Section 2: ⚔️ ACTIVE CHALLENGES BOARD (Section 16) */}
          <div className="p-5 sm:p-6 rounded-3xl bg-[#080C09] border border-white/10 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-500/15 text-amber-400">
                  <Swords className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="font-heading font-black text-base text-white uppercase tracking-wider">
                    ACTIVE CHALLENGES BOARD
                  </h2>
                  <p className="text-[11px] font-mono text-white/50">
                    Official 1v1 head-to-head duels awaiting kickoff
                  </p>
                </div>
              </div>

              {/* Challenge Filters */}
              <div className="flex items-center gap-1.5">
                {(['ALL', 'MINE', 'OPEN'] as const).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setChallengeFilter(tab)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold uppercase transition-all ${
                      challengeFilter === tab
                        ? 'bg-amber-500 text-black shadow-sm shadow-amber-500/20'
                        : 'text-white/50 hover:text-white bg-white/5'
                    }`}
                  >
                    {tab === 'MINE' ? 'My Challenges' : tab === 'OPEN' ? 'Open to All' : 'All'}
                  </button>
                ))}
              </div>
            </div>

            {/* Filtered Challenges List */}
            {(() => {
              const filtered = openChallenges.filter((c) => {
                if (challengeFilter === 'MINE') {
                  return c.challengerUid === currentUser?.uid || c.challengedUid === currentUser?.uid;
                }
                return true;
              });

              if (filtered.length === 0) {
                return (
                  <div className="py-8 text-center space-y-2 border border-dashed border-white/10 rounded-2xl p-4">
                    <Swords className="w-8 h-8 text-white/20 mx-auto" />
                    <div className="font-mono text-xs text-white/50">No pending challenges.</div>
                    <p className="text-[11px] text-white/40 max-w-sm mx-auto">
                      Search any verified player in the Discovery tab and tap "Challenge Player" to launch a rated League match.
                    </p>
                  </div>
                );
              }

              return (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {filtered.map((c) => {
                    const isTarget = c.challengedUid === currentUser?.uid;
                    const isChallenger = c.challengerUid === currentUser?.uid;
                    const isPending = c.status === 'PENDING';
                    const isBusy = isRespondingChallengeId === c.id;

                    return (
                      <div
                        key={c.id}
                        className="p-4 rounded-2xl bg-black/40 border border-white/10 hover:border-amber-500/30 transition-all space-y-3"
                      >
                        <div className="flex items-center justify-between text-[10px] font-mono">
                          <span className="text-white/40">
                            {new Date(c.createdAt).toLocaleTimeString('en-KE', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-full font-bold uppercase ${
                              c.status === 'PENDING'
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                                : c.status === 'ACCEPTED'
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                : 'bg-red-500/20 text-red-300 border border-red-500/40'
                            }`}
                          >
                            {c.status}
                          </span>
                        </div>

                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <div className="text-xs font-heading font-black text-white truncate">
                              {c.challengerPlayerName}
                            </div>
                            <div className="text-[10px] font-mono text-emerald-400">
                              {c.challengerPlayerId}
                            </div>
                          </div>

                          <div className="font-heading font-black text-xs text-amber-400 px-2">
                            VS
                          </div>

                          <div className="min-w-0 text-right">
                            <div className="text-xs font-heading font-black text-white truncate">
                              {c.challengedPlayerName || 'OPEN TO ANYONE'}
                            </div>
                            <div className="text-[10px] font-mono text-white/50">
                              {c.challengedPlayerId || 'OPEN'}
                            </div>
                          </div>
                        </div>

                        {/* Action Buttons for Challenged Target */}
                        {isTarget && isPending && (
                          <div className="flex items-center gap-2 pt-2 border-t border-white/10">
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => handleAcceptChallenge(c.id)}
                              className="flex-1 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-heading font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1.5"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>ACCEPT</span>
                            </button>
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => handleDeclineChallenge(c.id)}
                              className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white/70 hover:text-white font-mono text-xs font-bold uppercase transition-all"
                            >
                              DECLINE
                            </button>
                          </div>
                        )}

                        {isChallenger && isPending && (
                          <div className="text-[11px] font-mono text-amber-400/80 pt-1 text-center">
                            Awaiting opponent response...
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>

          {/* Section 3: ☀️ TODAY'S FIRST HERO CARD (Section 13 & 16) */}
          <DailyFirstCard
            userProfile={userProfile}
            onViewProfile={(pId) => openPlayerProfile(pId)}
          />

          {/* Section 4: 🏆 RECENT RESULTS FEED (Section 16) */}
          <div className="p-5 sm:p-6 rounded-3xl bg-[#080C09] border border-white/10 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-emerald-500/15 text-emerald-400">
                  <Trophy className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="font-heading font-black text-base text-white uppercase tracking-wider">
                    RECENT RESULTS
                  </h2>
                  <p className="text-[11px] font-mono text-white/50">
                    Dual-confirmed official League fixtures
                  </p>
                </div>
              </div>
              <span className="text-xs font-mono text-emerald-400 font-bold hidden sm:block">
                DUAL VERIFIED
              </span>
            </div>

            {recentResults.length === 0 ? (
              <EmptyState
                icon={Trophy}
                title="NO RECENT RESULTS"
                description="Once players dual-confirm their scores with match screenshots, confirmed results will be broadcast here."
              />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {recentResults.map((m) => (
                  <ResultSubmissionCard
                    key={m.id}
                    match={m}
                    onOpenProfile={(pId) => openPlayerProfile(pId)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Row: Movers, Hot Streaks & Today's First */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Section 4: 📈 BIGGEST MOVERS */}
            <div className="p-5 rounded-3xl bg-[#080C09] border border-white/10 space-y-3">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-400" />
                <h3 className="font-heading font-black text-sm text-white">BIGGEST MOVERS</h3>
              </div>
              {biggestMovers.length === 0 ? (
                <div className="py-6 text-center text-xs font-mono text-white/40">
                  Ranking movements will calculate as match results are confirmed.
                </div>
              ) : (
                <div className="space-y-2 font-mono text-xs">
                  {biggestMovers.map((m) => (
                    <div
                      key={m.playerId}
                      onClick={() => openPlayerProfile(m.playerId)}
                      className="p-2.5 rounded-xl bg-black/40 border border-white/5 hover:border-emerald-500/30 flex items-center justify-between cursor-pointer transition-all"
                    >
                      <div className="truncate">
                        <span className="text-white font-bold">{m.efootballUsername}</span>
                        <span className="text-[10px] text-white/40 block">#{m.currentPosition} • {m.points} PTS</span>
                      </div>
                      <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 text-[10px] font-bold">
                        +{m.previousPosition - m.currentPosition} Ranks
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Section 5: 🔥 HOT STREAKS */}
            <div className="p-5 rounded-3xl bg-[#080C09] border border-white/10 space-y-3">
              <div className="flex items-center gap-2">
                <Flame className="w-4 h-4 text-orange-400" />
                <h3 className="font-heading font-black text-sm text-white">HOT STREAKS</h3>
              </div>
              {hotStreaks.length === 0 ? (
                <div className="py-6 text-center text-xs font-mono text-white/40">
                  No active 2+ win streaks currently recorded.
                </div>
              ) : (
                <div className="space-y-2 font-mono text-xs">
                  {hotStreaks.map((m) => (
                    <div
                      key={m.playerId}
                      onClick={() => openPlayerProfile(m.playerId)}
                      className="p-2.5 rounded-xl bg-black/40 border border-orange-500/20 hover:border-orange-500/40 flex items-center justify-between cursor-pointer transition-all"
                    >
                      <div className="truncate">
                        <span className="text-white font-bold">{m.efootballUsername}</span>
                        <span className="text-[10px] text-white/40 block">#{m.currentPosition} • {m.wins}W</span>
                      </div>
                      <span className="px-2 py-0.5 rounded-md bg-orange-500/20 text-orange-300 text-[10px] font-bold flex items-center gap-1">
                        <Flame className="w-3 h-3 text-orange-400 fill-orange-400" />
                        {m.currentStreak} Wins
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Section 6: 🌅 TODAY'S FIRST */}
            <div className="p-5 rounded-3xl bg-[#080C09] border border-white/10 space-y-3">
              <div className="flex items-center gap-2">
                <Sun className="w-4 h-4 text-amber-400" />
                <h3 className="font-heading font-black text-sm text-white">TODAY'S FIRST</h3>
              </div>
              {!todayFirst ? (
                <div className="py-6 text-center text-xs font-mono text-white/40 space-y-2">
                  <div>No player has checked in today yet!</div>
                  <p className="text-[10px] text-white/30">
                    Be the very first player to open CHUKA eFOOTBALL today to take this crown.
                  </p>
                </div>
              ) : (
                <div
                  onClick={() => openPlayerProfile(todayFirst.playerId)}
                  className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 hover:bg-amber-500/20 transition-all cursor-pointer space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono text-amber-400 font-bold uppercase">
                      #1 DAILY CHECK-IN
                    </span>
                    <span className="text-[10px] font-mono text-white/40">
                      {new Date(todayFirst.claimedAt).toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <div className="font-heading font-black text-base text-white truncate">
                    {todayFirst.efootballUsername || todayFirst.displayName}
                  </div>
                  <div className="text-[11px] font-mono text-amber-300 flex items-center gap-1">
                    <span>{todayFirst.playerId}</span>
                    <span className="text-white/40">• First to check in today</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Section 7 & 8: Champions & Featured Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Section 7: 👑 CHAMPIONS */}
            <div className="p-6 rounded-3xl bg-[#080C09] border border-white/10 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-amber-500/15 text-amber-400">
                    <Crown className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="font-heading font-black text-base text-white">CHAMPIONS</h2>
                    <p className="text-[11px] font-mono text-white/50">
                      Official Tournament & League titleholders
                    </p>
                  </div>
                </div>
                <span className="text-xs font-mono text-amber-400 font-bold">Hall of Fame</span>
              </div>

              {champions.length === 0 ? (
                <div className="py-8 text-center text-xs font-mono text-white/40 border border-dashed border-white/10 rounded-2xl">
                  Official champions will be immortalized here when seasons & tournaments conclude.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {champions.map((c) => (
                    <div
                      key={c.id}
                      onClick={() => c.winnerPlayerId && openPlayerProfile(c.winnerPlayerId)}
                      className="p-3.5 rounded-2xl bg-black/40 border border-amber-500/20 hover:border-amber-500/40 transition-all cursor-pointer space-y-1.5"
                    >
                      <div className="text-[10px] font-mono text-amber-400 font-bold uppercase">
                        {c.tournamentName}
                      </div>
                      <div className="font-heading font-black text-sm text-white truncate">
                        {c.winnerName}
                      </div>
                      <div className="text-[10px] font-mono text-white/50">
                        {c.winnerPlayerId || 'Chuka Champion'}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Section 8: 🎴 FEATURED PLAYER CARDS */}
            <div className="p-6 rounded-3xl bg-[#080C09] border border-white/10 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-emerald-500/15 text-emerald-400">
                    <CreditCard className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="font-heading font-black text-base text-white">FEATURED PLAYER CARDS</h2>
                    <p className="text-[11px] font-mono text-white/50">
                      Verified League contenders and badges
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setActiveSubTab('DISCOVERY')}
                  className="text-xs font-mono text-emerald-400 hover:underline"
                >
                  View All
                </button>
              </div>

              {featuredMembers.length === 0 ? (
                <div className="py-8 text-center text-xs font-mono text-white/40 border border-dashed border-white/10 rounded-2xl">
                  No verified League cards issued yet for Season 01.
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {featuredMembers.map((m) => (
                    <div
                      key={m.playerId}
                      onClick={() => openPlayerProfile(m.playerId)}
                      className="p-3 rounded-2xl bg-black/40 border border-white/10 hover:border-emerald-500/40 transition-all cursor-pointer space-y-2 text-center group"
                    >
                      <div className="w-12 h-12 rounded-xl bg-black/60 border border-white/10 mx-auto flex items-center justify-center overflow-hidden">
                        {m.squadImageUrl || m.photoURL ? (
                          <img
                            src={m.squadImageUrl || m.photoURL}
                            alt={m.displayName}
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <User className="w-6 h-6 text-white/40" />
                        )}
                      </div>
                      <div>
                        <div className="font-heading font-black text-xs text-white truncate group-hover:text-emerald-300">
                          {m.efootballUsername || m.displayName}
                        </div>
                        <div className="text-[10px] font-mono text-emerald-400 font-bold">
                          #{m.currentPosition} • {m.points} PTS
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 2. PLAYER DISCOVERY TAB                                              */}
      {/* ==================================================================== */}
      {activeSubTab === 'DISCOVERY' && (
        <div className="space-y-6 animate-in fade-in">
          {/* Search bar */}
          <div className="p-6 rounded-3xl bg-[#080C09] border border-white/10 space-y-4">
            <div className="max-w-xl">
              <h2 className="text-lg font-heading font-black text-white">FIND CHUKA CONTENDERS</h2>
              <p className="text-xs text-white/60">
                Search verified players by eFootball username, CHUKA Player ID (e.g. CHK-XXXX), or display name.
              </p>
            </div>

            <div className="relative max-w-2xl">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
              <input
                id="input-player-search"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Type eFootball username or CHK-ID (e.g. Messi, CHK-8821)..."
                className="w-full pl-12 pr-4 py-3.5 rounded-2xl bg-black/60 border border-white/15 text-white placeholder:text-white/30 text-sm font-mono focus:outline-none focus:border-emerald-500 transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Search Results */}
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs font-mono text-white/60">
              <span>
                {searchQuery ? `Search results for "${searchQuery}"` : 'Active League Contenders'}
              </span>
              <span>{searchResults.length} players found</span>
            </div>

            {isSearching ? (
              <div className="py-16 text-center space-y-2">
                <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
                <div className="text-xs font-mono text-white/50">Searching verified database...</div>
              </div>
            ) : searchResults.length === 0 ? (
              <div className="py-16 text-center space-y-3 p-6 rounded-3xl bg-[#080C09] border border-white/5">
                <Search className="w-10 h-10 text-white/20 mx-auto" />
                <div className="font-heading font-black text-sm text-white">No players found</div>
                <p className="text-xs text-white/50 max-w-sm mx-auto">
                  {searchQuery
                    ? 'No registered players match your search. Make sure spelling matches eFootball username or Player ID.'
                    : 'Start typing above to search the official registry.'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {searchResults.map((player) => (
                  <div
                    key={player.playerId}
                    className="p-4 rounded-2xl bg-[#080C09] border border-white/10 hover:border-emerald-500/40 transition-all space-y-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-black/60 border border-white/10 flex-shrink-0 overflow-hidden flex items-center justify-center">
                        {player.photoURL ? (
                          <img
                            src={player.photoURL}
                            alt={player.displayName}
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <User className="w-6 h-6 text-white/40" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-heading font-black text-sm text-white truncate">
                            {player.efootballUsername || player.displayName}
                          </span>
                          {player.isVerifiedMember && (
                            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                          )}
                        </div>
                        <div className="text-[11px] font-mono text-emerald-400 font-bold">
                          {player.playerId} • #{player.currentPosition} Rank
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-1.5 p-2 rounded-xl bg-black/40 text-center font-mono text-[11px]">
                      <div>
                        <div className="text-[9px] text-white/40 uppercase">PTS</div>
                        <div className="font-bold text-white">{player.points}</div>
                      </div>
                      <div>
                        <div className="text-[9px] text-white/40 uppercase">WIN RATE</div>
                        <div className="font-bold text-amber-300">{player.winRate}%</div>
                      </div>
                      <div>
                        <div className="text-[9px] text-white/40 uppercase">FORM</div>
                        <div className="font-bold text-emerald-400">
                          {player.currentStreak > 0 ? `+${player.currentStreak}` : player.currentStreak}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-1 font-mono text-xs">
                      <button
                        onClick={() => openPlayerProfile(player.playerId)}
                        className="flex-1 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white font-bold transition-all text-center"
                      >
                        Profile
                      </button>
                      {currentUser && userProfile?.playerId !== player.playerId && (
                        <button
                          onClick={() => initiateChallenge(player.playerId)}
                          className="px-3 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 font-bold flex items-center gap-1 transition-all"
                        >
                          <Swords className="w-3.5 h-3.5" />
                          <span>Challenge</span>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 3. COMMUNITY LOUNGE (Posts & Opponent Search)                        */}
      {/* ==================================================================== */}
      {activeSubTab === 'LOUNGE' && (
        <div className="space-y-6 animate-in fade-in">
          {/* Post Composer for Logged In Members */}
          {currentUser && userProfile?.playerId ? (
            <form
              onSubmit={handleCreatePost}
              className="p-5 rounded-3xl bg-[#080C09] border border-white/10 space-y-3"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-emerald-400" />
                  <span className="font-heading font-black text-sm text-white">COMMUNITY POST</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <select
                    value={postType}
                    onChange={(e) => setPostType(e.target.value as any)}
                    className="bg-black/60 border border-white/15 rounded-xl px-3 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value="LOOKING_FOR_OPPONENT">⚔️ Looking for Opponent</option>
                    <option value="MATCH_INVITATION">🎮 Match Invitation</option>
                    <option value="LEAGUE_DISCUSSION">⚽ League Discussion</option>
                    <option value="GENERAL">💬 General Note</option>
                  </select>
                </div>
              </div>

              <textarea
                value={postContent}
                onChange={(e) => setPostContent(e.target.value)}
                maxLength={500}
                rows={3}
                placeholder="Share a competitive note or challenge opponents (e.g. 'Online right now, ready for League fixture')..."
                className="w-full p-3 rounded-2xl bg-black/60 border border-white/10 text-white placeholder:text-white/30 text-sm font-sans focus:outline-none focus:border-emerald-500 transition-all resize-none"
              />

              {postError && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-mono flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  <span>{postError}</span>
                </div>
              )}

              <div className="flex items-center justify-between pt-1">
                <div className="text-[11px] font-mono text-white/40">
                  {postContent.length}/500 • Strict privacy filter enforced
                </div>
                <button
                  type="submit"
                  disabled={isPublishingPost || !postContent.trim()}
                  className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-black font-heading font-black text-xs uppercase flex items-center gap-1.5 transition-all shadow-lg shadow-emerald-500/20"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{isPublishingPost ? 'Publishing...' : 'Post to Lounge'}</span>
                </button>
              </div>
            </form>
          ) : (
            <div className="p-5 rounded-3xl bg-[#080C09] border border-white/10 flex items-center justify-between gap-4">
              <div>
                <div className="font-heading font-black text-sm text-white">JOIN THE CONVERSATION</div>
                <p className="text-xs text-white/60">
                  Sign in and register your official League profile to post in the community lounge.
                </p>
              </div>
            </div>
          )}

          {/* Posts Feed */}
          <div className="space-y-3">
            {isLoadingPosts ? (
              <div className="py-16 text-center space-y-2">
                <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
                <div className="text-xs font-mono text-white/50">Fetching community posts...</div>
              </div>
            ) : posts.length === 0 ? (
              <div className="py-16 text-center space-y-3 p-6 rounded-3xl bg-[#080C09] border border-white/5">
                <MessageSquare className="w-10 h-10 text-white/20 mx-auto" />
                <div className="font-heading font-black text-sm text-white">No community posts yet</div>
                <p className="text-xs text-white/50 max-w-sm mx-auto">
                  Be the first verified player to post an open match invitation or announcement!
                </p>
              </div>
            ) : (
              posts.map((p) => (
                <div
                  key={p.postId}
                  className="p-5 rounded-3xl bg-[#080C09] border border-white/10 space-y-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-black/60 border border-white/10 flex items-center justify-center font-bold text-xs text-white">
                        {p.authorUsername.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div
                          onClick={() => openPlayerProfile(p.authorPlayerId)}
                          className="font-heading font-black text-sm text-white hover:text-emerald-400 cursor-pointer flex items-center gap-1.5"
                        >
                          <span>{p.authorUsername}</span>
                          <span className="text-[10px] font-mono text-white/40">({p.authorPlayerId})</span>
                        </div>
                        <div className="text-[10px] font-mono text-white/40">
                          {new Date(p.createdAt).toLocaleDateString('en-KE', {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded-full bg-white/5 border border-white/10 text-[10px] font-mono text-white/70">
                        {p.type.replace(/_/g, ' ')}
                      </span>
                      {currentUser && currentUser.uid !== p.authorUid && (
                        <button
                          onClick={() => setReportingPost(p)}
                          className="p-1.5 rounded-lg text-white/40 hover:text-rose-400 transition-all"
                          title="Report post"
                        >
                          <Flag className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {(isAdmin || currentUser?.uid === p.authorUid) && (
                        <button
                          onClick={() => handleDeletePost(p.postId)}
                          className="p-1.5 rounded-lg text-white/40 hover:text-rose-400 transition-all"
                          title="Delete post"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  <p className="text-sm text-white/90 font-sans leading-relaxed whitespace-pre-wrap">
                    {p.content}
                  </p>

                  {/* Actions on post */}
                  <div className="flex items-center justify-between pt-2 border-t border-white/5 font-mono text-xs">
                    <button
                      onClick={() => openPlayerProfile(p.authorPlayerId)}
                      className="text-emerald-400 hover:underline flex items-center gap-1"
                    >
                      <span>View Contender Profile</span>
                      <ChevronRight className="w-3 h-3" />
                    </button>

                    <div className="flex items-center gap-2">
                      {currentUser && currentUser.uid !== p.authorUid && (
                        <>
                          <button
                            onClick={() => initiateChallenge(p.authorPlayerId)}
                            className="px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-bold flex items-center gap-1 transition-all"
                          >
                            <Swords className="w-3.5 h-3.5" />
                            <span>Challenge</span>
                          </button>
                          <button
                            onClick={() => handleBlockUser(p.authorPlayerId)}
                            className="p-1.5 rounded-lg text-white/30 hover:text-white/60 transition-all"
                            title="Block player"
                          >
                            <Ban className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 4. LIVE SOCIAL ACTIVITY FEED                                         */}
      {/* ==================================================================== */}
      {activeSubTab === 'FEED' && (
        <div className="space-y-4 animate-in fade-in">
          <div className="p-5 rounded-3xl bg-[#080C09] border border-white/10 flex items-center justify-between">
            <div>
              <h2 className="font-heading font-black text-base text-white">LIVE ACTIVITY STREAM</h2>
              <p className="text-xs text-white/60">
                System-generated competitive events as they occur across CHUKA eFOOTBALL.
              </p>
            </div>
            <button
              onClick={loadHomeData}
              className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-white font-mono text-xs transition-all"
            >
              Refresh
            </button>
          </div>

          {recentActivities.length === 0 ? (
            <div className="py-16 text-center space-y-2 p-6 rounded-3xl bg-[#080C09] border border-white/5 font-mono text-xs text-white/40">
              No recent activity events recorded yet.
            </div>
          ) : (
            <div className="space-y-2">
              {recentActivities.map((act) => (
                <div
                  key={act.activityId}
                  className="p-4 rounded-2xl bg-[#080C09] border border-white/10 flex items-center justify-between gap-4 font-mono text-xs"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-white/5 border border-white/10 text-emerald-400">
                      {act.type.includes('MATCH') ? (
                        <Trophy className="w-4 h-4" />
                      ) : act.type.includes('ACHIEVEMENT') ? (
                        <Award className="w-4 h-4 text-amber-400" />
                      ) : act.type.includes('STREAK') ? (
                        <Flame className="w-4 h-4 text-orange-400" />
                      ) : (
                        <Radio className="w-4 h-4" />
                      )}
                    </div>
                    <div>
                      <div className="text-white font-bold">{act.message}</div>
                      <div className="text-[10px] text-white/40">{act.playerId}</div>
                    </div>
                  </div>
                  <div className="text-[10px] text-white/40 text-right flex-shrink-0">
                    {new Date(act.createdAt).toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Report Modal */}
      {reportingPost && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-[#080C09] border border-white/15 rounded-3xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="font-heading font-black text-sm text-white flex items-center gap-2">
                <Flag className="w-4 h-4 text-rose-400" />
                <span>REPORT COMMUNITY POST</span>
              </div>
              <button onClick={() => setReportingPost(null)} className="text-white/50 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-white/70">
              Moderators will review this report promptly. Personal attacks, spam, or payment solicitations are strictly prohibited.
            </p>

            <div className="space-y-2">
              <label className="text-xs font-mono text-white/60">Reason:</label>
              <select
                value={reportReason}
                onChange={(e) => setReportReason(e.target.value)}
                className="w-full bg-black/60 border border-white/15 rounded-xl p-2.5 text-xs font-mono text-white focus:outline-none"
              >
                <option value="SPAM">Spam / Advertising</option>
                <option value="HARASSMENT">Harassment / Insults</option>
                <option value="PII_LEAK">Phone / Private Data Sharing</option>
                <option value="FAKE_SCORE">Fake Match Claims</option>
                <option value="OTHER">Other Violation</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-mono text-white/60">Details (optional):</label>
              <textarea
                value={reportDescription}
                onChange={(e) => setReportDescription(e.target.value)}
                rows={2}
                placeholder="Briefly describe the violation..."
                className="w-full p-2.5 rounded-xl bg-black/60 border border-white/10 text-white text-xs font-sans resize-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setReportingPost(null)}
                className="px-3 py-1.5 rounded-xl bg-white/5 text-white/60 text-xs font-mono"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitReport}
                disabled={isSubmittingReport}
                className="px-4 py-1.5 rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-mono text-xs font-bold transition-all"
              >
                {isSubmittingReport ? 'Submitting...' : 'Submit Report'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Public Profile Modal */}
      <PublicLeagueProfileModal
        playerId={selectedPlayerId}
        seasonId={seasonId}
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
        onOpenChallenge={(pId) => initiateChallenge(pId)}
      />

      {/* League Card Modal */}
      {selectedCardMember && (
        <LeagueCardModal
          isOpen={isCardModalOpen}
          onClose={() => setIsCardModalOpen(false)}
          member={selectedCardMember}
        />
      )}

      {/* Challenge Player Modal */}
      {challengeTargetPlayerId && (
        <ChallengePlayerModal
          isOpen={isChallengeModalOpen}
          onClose={() => setIsChallengeModalOpen(false)}
          targetPlayerId={challengeTargetPlayerId}
          seasonId={seasonId}
        />
      )}
    </div>
  );
};
