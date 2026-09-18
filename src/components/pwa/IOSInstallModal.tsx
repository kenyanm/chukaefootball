import React from 'react';
import { X, Share, PlusSquare, Smartphone, CheckCircle } from 'lucide-react';
import { ChukaCrestLogo } from '../ChukaCrestLogo';

interface IOSInstallModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const IOSInstallModal: React.FC<IOSInstallModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div
      id="ios-install-modal"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-3xl bg-gradient-to-b from-[#09150d] via-[#060e09] to-[#040805] border border-emerald-500/30 p-6 shadow-2xl shadow-emerald-950/50 space-y-5 relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          aria-label="Close installation guide"
          className="absolute top-4 right-4 p-2 rounded-full bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3.5 pt-1">
          <div className="p-2 rounded-2xl bg-emerald-500/15 border border-emerald-400/30">
            <ChukaCrestLogo size="sm" withBorder={false} />
          </div>
          <div>
            <h3 className="font-heading font-black text-lg text-white uppercase tracking-wide">
              Install CHUKA eFOOTBALL
            </h3>
            <p className="text-xs text-emerald-400/90 font-mono">
              Fast full-screen mobile app on iPhone & iPad
            </p>
          </div>
        </div>

        {/* Instructions */}
        <div className="space-y-3.5 bg-black/40 rounded-2xl p-4 border border-white/5">
          <div className="flex items-start gap-3">
            <div className="w-7 h-7 rounded-xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-xs font-mono font-bold text-emerald-300 shrink-0 mt-0.5">
              1
            </div>
            <div className="space-y-0.5">
              <div className="text-xs font-bold text-white flex items-center gap-1.5">
                <span>Tap the</span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-white/10 text-emerald-300 font-mono text-[11px]">
                  <Share className="w-3 h-3 text-emerald-400" /> Share
                </span>
                <span>button</span>
              </div>
              <p className="text-[11px] text-white/50">
                Found in Safari's bottom toolbar (or top right on iPad).
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="w-7 h-7 rounded-xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-xs font-mono font-bold text-emerald-300 shrink-0 mt-0.5">
              2
            </div>
            <div className="space-y-0.5">
              <div className="text-xs font-bold text-white flex items-center gap-1.5">
                <span>Scroll down and select</span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-white/10 text-emerald-300 font-mono text-[11px]">
                  <PlusSquare className="w-3 h-3 text-emerald-400" /> Add to Home Screen
                </span>
              </div>
              <p className="text-[11px] text-white/50">
                Look for the plus icon in the actions menu.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="w-7 h-7 rounded-xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-xs font-mono font-bold text-emerald-300 shrink-0 mt-0.5">
              3
            </div>
            <div className="space-y-0.5">
              <div className="text-xs font-bold text-white flex items-center gap-1.5">
                <span>Tap</span>
                <span className="inline-flex items-center px-2 py-0.5 rounded bg-emerald-500/30 text-emerald-200 font-bold font-mono text-[11px]">
                  Add
                </span>
                <span>in the top-right</span>
              </div>
              <p className="text-[11px] text-white/50">
                The CHUKA eFOOTBALL crest icon will appear on your home screen!
              </p>
            </div>
          </div>
        </div>

        {/* Benefits Pill */}
        <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-emerald-950/40 border border-emerald-500/20 text-[11px] font-mono text-emerald-300">
          <span className="flex items-center gap-1.5">
            <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
            No App Store download required
          </span>
          <span className="text-white/40">Zero storage bloat</span>
        </div>

        {/* Done button */}
        <button
          onClick={onClose}
          className="w-full py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-[#04140a] font-heading font-black text-xs uppercase tracking-wider transition-all duration-150 active:scale-98"
        >
          GOT IT
        </button>
      </div>
    </div>
  );
};
