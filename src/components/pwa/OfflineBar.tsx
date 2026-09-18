import React, { useState } from 'react';
import { WifiOff, RefreshCw, AlertTriangle } from 'lucide-react';
import { usePWA } from '../../hooks/usePWA';

export const OfflineBar: React.FC = () => {
  const { isOnline, retryConnectivity } = usePWA();
  const [isRetrying, setIsRetrying] = useState(false);

  if (isOnline) return null;

  const handleRetry = () => {
    setIsRetrying(true);
    retryConnectivity();
    setTimeout(() => {
      setIsRetrying(false);
    }, 1000);
  };

  return (
    <div
      id="pwa-offline-notice"
      className="sticky top-0 z-50 w-full bg-gradient-to-r from-amber-600 via-orange-600 to-amber-700 text-white px-4 py-2.5 shadow-xl border-b border-amber-400/30 animate-in slide-in-from-top duration-200"
    >
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5 text-center sm:text-left">
          <div className="p-1 rounded-lg bg-black/20 shrink-0">
            <WifiOff className="w-4 h-4 text-amber-100 animate-pulse" />
          </div>
          <div>
            <span className="font-heading font-black text-xs uppercase tracking-wide mr-2">
              You're offline
            </span>
            <span className="text-xs text-amber-100/90 hidden sm:inline">
              — Some CHUKA eFOOTBALL features require an internet connection.
            </span>
            <div className="text-[11px] text-amber-100/90 sm:hidden">
              Some features require an internet connection.
            </div>
          </div>
        </div>

        <button
          onClick={handleRetry}
          disabled={isRetrying}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-black/30 hover:bg-black/50 text-white font-mono text-xs font-bold uppercase tracking-wider border border-white/20 active:scale-95 transition-all touch-target"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRetrying ? 'animate-spin' : ''}`} />
          <span>{isRetrying ? 'Checking...' : 'Try Again'}</span>
        </button>
      </div>
    </div>
  );
};
