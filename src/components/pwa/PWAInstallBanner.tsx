import React, { useState } from 'react';
import {
  Download,
  Smartphone,
  CheckCircle2,
  X,
  Zap,
  ShieldCheck,
  ChevronRight,
  Wifi,
} from 'lucide-react';
import { usePWA } from '../../hooks/usePWA';
import { ChukaCrestLogo } from '../ChukaCrestLogo';
import { IOSInstallModal } from './IOSInstallModal';

interface PWAInstallBannerProps {
  compact?: boolean;
}

export const PWAInstallBanner: React.FC<PWAInstallBannerProps> = ({ compact = false }) => {
  const {
    isInstalled,
    isIOS,
    canPromptNative,
    isPrompting,
    isDismissed,
    installApp,
    dismissPrompt,
    showIOSGuide,
    setShowIOSGuide,
  } = usePWA();

  // If already installed, show subtle confirmation or compact installed badge
  if (isInstalled) {
    return (
      <div
        id="pwa-installed-banner"
        className="w-full rounded-2xl bg-emerald-950/30 border border-emerald-500/20 px-4 py-2.5 flex items-center justify-between text-xs font-mono text-emerald-300"
      >
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-400" />
          <span className="font-bold tracking-wider uppercase">APP INSTALLED ✓</span>
        </div>
        <span className="text-[11px] text-emerald-400/70 hidden sm:inline">
          Running high-performance standalone mode
        </span>
      </div>
    );
  }

  // If user dismissed the prompt and it's not explicitly requested, suppress prominent banner
  if (isDismissed && !compact) {
    return (
      <>
        <div
          id="pwa-dismissed-hint"
          className="w-full flex items-center justify-between px-3 py-1.5 rounded-xl bg-white/[0.02] border border-white/5 text-[11px] font-mono text-white/40"
        >
          <span>CHUKA eFOOTBALL is installable on your device</span>
          <button
            onClick={() => installApp()}
            className="text-emerald-400 hover:text-emerald-300 font-bold underline cursor-pointer ml-2"
          >
            Install App
          </button>
        </div>
        <IOSInstallModal isOpen={showIOSGuide} onClose={() => setShowIOSGuide(false)} />
      </>
    );
  }

  return (
    <>
      <div
        id="pwa-install-banner"
        className="relative overflow-hidden rounded-3xl border border-emerald-500/30 bg-gradient-to-r from-[#06150b] via-[#091f11] to-[#041007] p-4 sm:p-5 md:p-6 shadow-xl shadow-emerald-950/30 transition-all"
      >
        {/* Ambient background blur */}
        <div className="absolute -right-10 -bottom-10 w-44 h-44 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />
        <div className="absolute top-0 right-0 p-3">
          <button
            id="btn-dismiss-pwa-banner"
            onClick={dismissPrompt}
            aria-label="Dismiss install banner"
            className="p-1.5 rounded-full bg-white/5 hover:bg-white/10 text-white/50 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          {/* Left Icon + Text */}
          <div className="flex items-center gap-3.5 max-w-xl">
            <div className="relative shrink-0">
              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-emerald-500/15 border border-emerald-400/40 flex items-center justify-center shadow-inner">
                <ChukaCrestLogo size="sm" withBorder={false} className="w-8 h-8 sm:w-9 sm:h-9" />
              </div>
              <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-amber-400 border-2 border-[#06150b] flex items-center justify-center text-[#06150b]">
                <Download className="w-2.5 h-2.5 stroke-[3]" />
              </div>
            </div>

            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <h3 className="font-heading font-black text-white text-xs sm:text-sm md:text-base uppercase tracking-wider">
                  GET THE CHUKA eFOOTBALL APP
                </h3>
              </div>
              <p className="text-xs text-white/70 leading-snug">
                Install for faster access, full-screen play and a better mobile experience.
              </p>
              <div className="flex items-center gap-3 pt-0.5 text-[10px] font-mono text-emerald-400/80">
                <span className="flex items-center gap-1">
                  <Zap className="w-3 h-3 text-amber-400" /> Instant launch
                </span>
                <span className="flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-emerald-400" /> Offline cache
                </span>
              </div>
            </div>
          </div>

          {/* Right Action Button */}
          <div className="w-full sm:w-auto shrink-0 pt-1 sm:pt-0">
            <button
              id="btn-install-pwa-main"
              onClick={() => installApp()}
              disabled={isPrompting}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-[#04140a] font-heading font-black text-xs sm:text-sm uppercase tracking-wider shadow-lg shadow-emerald-500/25 transition-all active:scale-95 touch-target cursor-pointer"
            >
              <Download className={`w-4 h-4 ${isPrompting ? 'animate-bounce' : ''}`} />
              <span>
                {isPrompting
                  ? 'INSTALLING...'
                  : isIOS
                  ? 'HOW TO INSTALL'
                  : 'INSTALL APP'}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* iOS Modal */}
      <IOSInstallModal isOpen={showIOSGuide} onClose={() => setShowIOSGuide(false)} />
    </>
  );
};
