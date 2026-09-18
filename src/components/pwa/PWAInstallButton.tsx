import React from 'react';
import { Download, CheckCircle, Smartphone } from 'lucide-react';
import { usePWA } from '../../hooks/usePWA';
import { IOSInstallModal } from './IOSInstallModal';

interface PWAInstallButtonProps {
  className?: string;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({ className = '' }) => {
  const {
    isInstalled,
    isIOS,
    canPromptNative,
    installApp,
    isPrompting,
    showIOSGuide,
    setShowIOSGuide,
  } = usePWA();

  // If already installed, show subtle indicator or hide
  if (isInstalled) {
    return (
      <div
        id="pwa-header-installed-pill"
        title="App is installed in standalone mode"
        className={`hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-mono text-[11px] font-bold ${className}`}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
        <span>APP INSTALLED ✓</span>
      </div>
    );
  }

  return (
    <>
      <button
        id="btn-header-install-pwa"
        onClick={() => installApp()}
        disabled={isPrompting}
        title="Install CHUKA eFOOTBALL app"
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-400/40 text-emerald-300 font-heading font-black text-xs uppercase tracking-wider transition-all duration-150 active:scale-95 touch-target ${className}`}
      >
        <Download className={`w-3.5 h-3.5 text-amber-400 ${isPrompting ? 'animate-bounce' : ''}`} />
        <span className="hidden sm:inline">
          {isPrompting ? 'INSTALLING...' : isIOS ? 'INSTALL APP' : 'INSTALL APP'}
        </span>
        <span className="sm:hidden">INSTALL</span>
      </button>

      <IOSInstallModal isOpen={showIOSGuide} onClose={() => setShowIOSGuide(false)} />
    </>
  );
};
