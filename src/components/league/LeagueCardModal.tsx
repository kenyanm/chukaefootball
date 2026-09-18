import React from 'react';
import { X } from 'lucide-react';
import { LeagueMember } from '../../types';
import { LeagueCard } from './LeagueCard';

interface LeagueCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  member: LeagueMember;
}

export const LeagueCardModal: React.FC<LeagueCardModalProps> = ({
  isOpen,
  onClose,
  member,
}) => {
  if (!isOpen) return null;

  return (
    <div
      id="league-card-modal-backdrop"
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        id="league-card-modal-content"
        className="relative max-w-sm w-full bg-[#070c09] border border-emerald-500/30 rounded-3xl p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-2 border-b border-white/10">
          <span className="text-xs font-mono font-bold uppercase tracking-wider text-emerald-400">
            Official League Card
          </span>
          <button
            onClick={onClose}
            className="p-1 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-all"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex justify-center py-2">
          <LeagueCard member={member} />
        </div>
      </div>
    </div>
  );
};
