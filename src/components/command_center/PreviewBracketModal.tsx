import React from 'react';
import { X, Network, ShieldCheck, Award, AlertTriangle } from 'lucide-react';
import { Tournament, TournamentEntry } from '../../types';
import { calculateBracketDimensions, generateStandardSeedOrder } from '../../services/bracketEngine';

interface PreviewBracketModalProps {
  isOpen: boolean;
  onClose: () => void;
  tournament: Tournament;
  verifiedEntries: TournamentEntry[];
  onConfirmGenerate: () => void;
  generating: boolean;
}

export const PreviewBracketModal: React.FC<PreviewBracketModalProps> = ({
  isOpen,
  onClose,
  tournament,
  verifiedEntries,
  onConfirmGenerate,
  generating,
}) => {
  if (!isOpen) return null;

  const verifiedCount = verifiedEntries.length;
  const canGenerate = verifiedCount >= 2;

  let dimensions: ReturnType<typeof calculateBracketDimensions> | null = null;
  let seedPairs: Array<{
    matchIndex: number;
    homeSeed: number;
    awaySeed: number;
    homeEntry?: TournamentEntry;
    awayEntry?: TournamentEntry;
    isHomeBye: boolean;
    isAwayBye: boolean;
  }> = [];

  if (canGenerate) {
    try {
      dimensions = calculateBracketDimensions(verifiedCount);
      const seedOrder = generateStandardSeedOrder(dimensions.bracketSize);

      // Sort entries deterministically: by verification time, playerId tie-breaker
      const sortedEntries = [...verifiedEntries].sort((a, b) => {
        const timeA = new Date(a.verifiedAt || a.registeredAt || 0).getTime();
        const timeB = new Date(b.verifiedAt || b.registeredAt || 0).getTime();
        if (timeA !== timeB) return timeA - timeB;
        return a.playerId.localeCompare(b.playerId);
      });

      for (let i = 0; i < seedOrder.length; i += 2) {
        const homeSeed = seedOrder[i];
        const awaySeed = seedOrder[i + 1];

        const homeEntry = homeSeed <= sortedEntries.length ? sortedEntries[homeSeed - 1] : undefined;
        const awayEntry = awaySeed <= sortedEntries.length ? sortedEntries[awaySeed - 1] : undefined;

        seedPairs.push({
          matchIndex: Math.floor(i / 2) + 1,
          homeSeed,
          awaySeed,
          homeEntry,
          awayEntry,
          isHomeBye: !homeEntry,
          isAwayBye: !awayEntry,
        });
      }
    } catch (e) {
      console.error('Bracket calculation error:', e);
    }
  }

  return (
    <div
      id="preview-bracket-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm overflow-y-auto"
    >
      <div
        id="preview-bracket-modal"
        className="w-full max-w-3xl bg-[#09110d] border border-emerald-500/40 rounded-3xl shadow-2xl overflow-hidden my-8"
      >
        {/* Modal Header */}
        <div className="p-6 border-b border-white/10 bg-gradient-to-r from-[#0d2215] to-[#09110d] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-400">
              <Network className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-heading font-black text-lg text-white uppercase tracking-wider">
                Bracket Mathematical Preview
              </h2>
              <p className="text-xs text-emerald-400/80 font-mono">
                {tournament.name} • Deterministic Seeding Tree
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-white/50 hover:text-white hover:bg-white/10 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-6">
          {!canGenerate ? (
            <div className="p-6 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-4">
              <AlertTriangle className="w-6 h-6 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <h3 className="font-heading font-black text-sm text-amber-300 uppercase">
                  Insufficient Verified Players
                </h3>
                <p className="text-xs text-white/70 mt-1">
                  At least 2 verified players are required to generate a bracket. Currently, there are only{' '}
                  <strong className="text-white">{verifiedCount}</strong> verified players for {tournament.name}.
                  Complete player verification in the Payment Monitor first.
                </p>
              </div>
            </div>
          ) : dimensions ? (
            <>
              {/* Mathematical Dimensions Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <div className="p-3.5 rounded-2xl bg-black/40 border border-white/10 text-center">
                  <div className="text-[10px] text-white/40 uppercase font-mono font-bold">Verified Players</div>
                  <div className="font-heading font-black text-xl text-emerald-400 mt-1">
                    {dimensions.verifiedCount}
                  </div>
                </div>
                <div className="p-3.5 rounded-2xl bg-black/40 border border-white/10 text-center">
                  <div className="text-[10px] text-white/40 uppercase font-mono font-bold">Bracket Size</div>
                  <div className="font-heading font-black text-xl text-white mt-1">
                    {dimensions.bracketSize}
                  </div>
                </div>
                <div className="p-3.5 rounded-2xl bg-black/40 border border-white/10 text-center">
                  <div className="text-[10px] text-white/40 uppercase font-mono font-bold">Total Rounds</div>
                  <div className="font-heading font-black text-xl text-amber-400 mt-1">
                    {dimensions.totalRounds}
                  </div>
                </div>
                <div className="p-3.5 rounded-2xl bg-black/40 border border-white/10 text-center">
                  <div className="text-[10px] text-white/40 uppercase font-mono font-bold">BYEs Count</div>
                  <div className="font-heading font-black text-xl text-teal-400 mt-1">
                    {dimensions.byesCount}
                  </div>
                </div>
                <div className="p-3.5 rounded-2xl bg-black/40 border border-white/10 text-center col-span-2 sm:col-span-1">
                  <div className="text-[10px] text-white/40 uppercase font-mono font-bold">Round 1 Matches</div>
                  <div className="font-heading font-black text-xl text-white mt-1">
                    {dimensions.round1Matches}
                  </div>
                </div>
              </div>

              {/* Notice & Rule */}
              <div className="text-xs text-white/60 bg-black/30 p-3 rounded-xl border border-white/5 font-mono">
                <span className="text-emerald-400 font-bold">Deterministic Engine:</span> Seeds 1..
                {dimensions.byesCount} automatically receive first-round BYEs and advance to Round 2 without
                inflating played match statistics.
              </div>

              {/* Seed Pairs Preview Table */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-mono font-bold uppercase tracking-wider text-white/50">
                  <span>Round 1 Simulated Pairings ({seedPairs.length} matches)</span>
                  <span>Deterministic Seeds</span>
                </div>
                <div className="max-h-72 overflow-y-auto space-y-2 pr-1 rounded-2xl border border-white/5 bg-black/20 p-2">
                  {seedPairs.map((pair) => (
                    <div
                      key={pair.matchIndex}
                      className="p-3 rounded-xl bg-white/[0.02] border border-white/5 flex items-center justify-between text-xs hover:border-emerald-500/30 transition-all"
                    >
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-[10px] text-white/40 w-10">
                          M{String(pair.matchIndex).padStart(2, '0')}
                        </span>
                        {/* Home */}
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-white/70">
                            #{pair.homeSeed}
                          </span>
                          <span className="font-bold text-white">
                            {pair.homeEntry ? pair.homeEntry.displayName : 'BYE'}
                          </span>
                          {pair.homeEntry && (
                            <span className="font-mono text-[10px] text-white/40">
                              ({pair.homeEntry.playerId})
                            </span>
                          )}
                        </div>
                        <span className="text-white/30 font-bold text-[10px]">VS</span>
                        {/* Away */}
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-white/70">
                            #{pair.awaySeed}
                          </span>
                          <span
                            className={`font-bold ${pair.isAwayBye ? 'text-teal-400/80 italic' : 'text-white'}`}
                          >
                            {pair.awayEntry ? pair.awayEntry.displayName : 'BYE'}
                          </span>
                          {pair.awayEntry && (
                            <span className="font-mono text-[10px] text-white/40">
                              ({pair.awayEntry.playerId})
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Status Tag */}
                      <div>
                        {pair.isAwayBye ? (
                          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-teal-500/20 text-teal-300 border border-teal-500/30">
                            AUTO-ADVANCE (BYE)
                          </span>
                        ) : (
                          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-white/10 text-white/60">
                            PLAYABLE
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : null}

          {/* Action Footer */}
          <div className="flex items-center justify-between pt-4 border-t border-white/10">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white text-xs font-bold uppercase tracking-wider transition-all"
            >
              Close Preview
            </button>
            {canGenerate && (
              <button
                id="btn-confirm-generate-from-preview"
                type="button"
                disabled={generating}
                onClick={onConfirmGenerate}
                className="px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-[#051a0e] font-heading font-black text-xs uppercase tracking-wider transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50 flex items-center gap-2"
              >
                {generating ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                    <span>Authoritatively Generating...</span>
                  </>
                ) : (
                  <>
                    <Network className="w-4 h-4" />
                    <span>GENERATE BRACKET AUTHORITATIVELY</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
