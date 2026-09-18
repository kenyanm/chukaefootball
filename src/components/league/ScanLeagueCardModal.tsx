import React, { useState, useEffect } from 'react';
import {
  X,
  QrCode,
  Search,
  CreditCard,
  User,
  ShieldCheck,
  ChevronRight,
  ExternalLink,
  Camera,
  AlertCircle,
} from 'lucide-react';
import { LeagueMember } from '../../types';
import { leagueService } from '../../services/leagueService';
import { LeagueCard } from './LeagueCard';

interface ScanLeagueCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectPlayer: (playerId: string) => void;
}

export const ScanLeagueCardModal: React.FC<ScanLeagueCardModalProps> = ({
  isOpen,
  onClose,
  onSelectPlayer,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [members, setMembers] = useState<LeagueMember[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedMember, setSelectedMember] = useState<LeagueMember | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setSearchQuery('');
      setSelectedMember(null);
      setCameraActive(false);
      setCameraError(null);
      return;
    }

    const loadMembers = async () => {
      setIsLoading(true);
      try {
        const list = await leagueService.getLeagueMembers('SEASON_01');
        setMembers(list.filter((m) => m.status === 'VERIFIED'));
      } catch (err) {
        console.warn('Could not load league members:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadMembers();
  }, [isOpen]);

  if (!isOpen) return null;

  // Handle QR url or ID paste/entry
  const handleQueryChange = (val: string) => {
    setSearchQuery(val);
    // If user pasted a URL with ?profile= or /?player=
    try {
      if (val.includes('profile=') || val.includes('player=')) {
        const urlObj = new URL(val);
        const pid = urlObj.searchParams.get('profile') || urlObj.searchParams.get('player');
        if (pid) {
          const found = members.find(
            (m) => m.playerId?.toUpperCase() === pid.toUpperCase()
          );
          if (found) {
            setSelectedMember(found);
            return;
          }
        }
      }
    } catch {
      // Not a valid URL string, continue standard search
    }

    const matched = members.find(
      (m) =>
        m.playerId?.toUpperCase() === val.trim().toUpperCase() ||
        m.efootballUsername?.toLowerCase() === val.trim().toLowerCase()
    );
    if (matched) {
      setSelectedMember(matched);
    }
  };

  const filteredMembers = members.filter((m) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      m.efootballUsername?.toLowerCase().includes(q) ||
      m.playerId?.toLowerCase().includes(q) ||
      m.fullName?.toLowerCase().includes(q)
    );
  });

  const handleStartCamera = async () => {
    setCameraError(null);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraError('Camera access not supported on this browser/device.');
        return;
      }
      setCameraActive(true);
    } catch (err: any) {
      setCameraError(err?.message || 'Unable to access device camera.');
      setCameraActive(false);
    }
  };

  return (
    <div
      id="scan-league-card-modal-backdrop"
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in"
      onClick={onClose}
    >
      <div
        id="scan-league-card-modal"
        className="relative max-w-lg w-full bg-[#080C09] border border-emerald-500/30 rounded-3xl p-5 sm:p-7 shadow-2xl space-y-5 my-6 max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-heading font-black text-base text-white uppercase tracking-wider">
                SCAN LEAGUE CARD
              </h3>
              <p className="text-[11px] font-mono text-white/50">
                Lookup any contender's verified card or statistics
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-all"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Selected Card View */}
        {selectedMember ? (
          <div className="space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-bold text-emerald-400 uppercase">
                Card Verified & Resolved
              </span>
              <button
                onClick={() => setSelectedMember(null)}
                className="text-xs font-mono text-white/50 hover:text-white underline"
              >
                Scan Another
              </button>
            </div>

            <div className="flex justify-center py-2">
              <LeagueCard member={selectedMember} />
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={() => {
                  onSelectPlayer(selectedMember.playerId);
                  onClose();
                }}
                className="flex-1 py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-black font-heading font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 transition-all active:scale-95"
              >
                <User className="w-4 h-4" />
                <span>Open Full League Profile</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Search or Scan Input */}
            <div className="space-y-2">
              <label className="text-xs font-mono text-white/70 block">
                Enter CHUKA ID, eFootball Username, or Paste QR Link:
              </label>
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => handleQueryChange(e.target.value)}
                  placeholder="e.g. CHK-8821, Messi, or paste profile URL..."
                  className="w-full pl-10 pr-10 py-3 rounded-2xl bg-black/60 border border-white/15 text-white placeholder:text-white/30 text-sm font-mono focus:outline-none focus:border-emerald-500 transition-all"
                  autoFocus
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/40 hover:text-white"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Camera Scan Option */}
            <div className="p-3.5 rounded-2xl bg-black/40 border border-white/10 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <Camera className="w-4 h-4 text-emerald-400 shrink-0" />
                <div className="text-xs">
                  <div className="text-white font-bold">Physical QR Card Scan</div>
                  <div className="text-white/40 text-[10px] font-mono">Scan directly with camera</div>
                </div>
              </div>
              <button
                onClick={handleStartCamera}
                className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-mono text-xs font-bold transition-all shrink-0"
              >
                {cameraActive ? 'Active' : 'Open Camera'}
              </button>
            </div>

            {cameraActive && (
              <div className="p-4 rounded-2xl bg-black/80 border border-emerald-500/40 text-center space-y-3 animate-in fade-in">
                <div className="w-48 h-48 mx-auto rounded-2xl border-2 border-dashed border-emerald-400 flex flex-col items-center justify-center p-4 bg-black/60 relative overflow-hidden">
                  <div className="w-full h-0.5 bg-emerald-400 animate-pulse absolute top-1/2 -translate-y-1/2 left-0" />
                  <QrCode className="w-12 h-12 text-emerald-400/40" />
                  <span className="text-[10px] font-mono text-white/60 mt-2">
                    Point camera at League QR code
                  </span>
                </div>
                <div className="text-[11px] font-mono text-white/50">
                  Tip: You can also copy/paste the link or enter the Player ID directly above.
                </div>
                <button
                  onClick={() => setCameraActive(false)}
                  className="text-xs font-mono text-rose-400 hover:underline"
                >
                  Close Camera
                </button>
              </div>
            )}

            {cameraError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-mono flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{cameraError}</span>
              </div>
            )}

            {/* Quick Select from Verified Members */}
            <div className="space-y-2 pt-1">
              <div className="flex items-center justify-between text-xs font-mono text-white/60">
                <span>Verified League Contenders ({filteredMembers.length})</span>
                <span>Season 01</span>
              </div>

              {isLoading ? (
                <div className="py-8 text-center space-y-2">
                  <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
                  <div className="text-[11px] font-mono text-white/40">Loading League cards...</div>
                </div>
              ) : filteredMembers.length === 0 ? (
                <div className="py-8 text-center text-xs font-mono text-white/40 p-4 rounded-2xl bg-black/30 border border-white/5">
                  No players match "{searchQuery}".
                </div>
              ) : (
                <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1">
                  {filteredMembers.slice(0, 15).map((m) => (
                    <div
                      key={m.playerId}
                      onClick={() => setSelectedMember(m)}
                      className="p-2.5 rounded-xl bg-black/40 border border-white/5 hover:border-emerald-500/40 transition-all flex items-center justify-between cursor-pointer group"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-black/60 border border-white/10 flex items-center justify-center shrink-0 overflow-hidden">
                          {m.photoURL ? (
                            <img
                              src={m.photoURL}
                              alt=""
                              className="w-full h-full object-cover"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <User className="w-4 h-4 text-white/40" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="font-heading font-black text-xs text-white truncate group-hover:text-emerald-300 flex items-center gap-1.5">
                            <span>{m.efootballUsername || m.fullName}</span>
                            <ShieldCheck className="w-3 h-3 text-emerald-400 shrink-0" />
                          </div>
                          <div className="text-[10px] font-mono text-emerald-400 font-bold">
                            {m.playerId} • #{m.currentPosition || 1} Rank
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 font-mono text-xs">
                        <span className="text-white/60">{m.points || 0} pts</span>
                        <ChevronRight className="w-4 h-4 text-white/30 group-hover:text-emerald-400 transition-transform group-hover:translate-x-0.5" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
