import React from 'react';
import { AlertTriangle, WifiOff, ExternalLink, RefreshCw, X, ShieldAlert } from 'lucide-react';
import { AuthErrorNotice } from '../context/AuthContext';

interface AuthNoticeBannerProps {
  notice: AuthErrorNotice | null;
  onRetry?: () => void;
  onDismiss?: () => void;
  variant?: 'banner' | 'inline';
  className?: string;
}

export const AuthNoticeBanner: React.FC<AuthNoticeBannerProps> = ({
  notice,
  onRetry,
  onDismiss,
  variant = 'banner',
  className = '',
}) => {
  if (!notice) return null;

  const appUrl = typeof window !== 'undefined' ? window.location.href : '#';

  const getIcon = () => {
    switch (notice.type) {
      case 'offline':
        return <WifiOff className="w-4 h-4 text-amber-400 shrink-0" />;
      case 'network':
        return <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />;
      case 'unauthorized-domain':
        return <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />;
      default:
        return <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />;
    }
  };

  const getTitle = () => {
    switch (notice.type) {
      case 'offline':
        return 'Network Offline';
      case 'network':
        return 'Google Auth Connection Blocked';
      case 'unauthorized-domain':
        return 'Firebase Domain Authorization Needed';
      case 'popup-blocked':
        return 'Sign-In Popup Blocked';
      default:
        return 'Authentication Notice';
    }
  };

  if (variant === 'inline') {
    return (
      <div
        id="auth-inline-notice"
        className={`w-full max-w-sm p-3.5 rounded-xl border border-amber-500/40 bg-amber-950/40 text-amber-200 text-xs space-y-2.5 backdrop-blur-sm ${className}`}
      >
        <div className="flex items-start gap-2">
          {getIcon()}
          <div className="space-y-1 flex-1">
            <div className="font-bold text-amber-300 flex items-center justify-between">
              <span>{getTitle()}</span>
              {onDismiss && (
                <button
                  type="button"
                  onClick={onDismiss}
                  className="text-amber-400/70 hover:text-white transition-colors"
                  aria-label="Dismiss notice"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <p className="text-[11px] text-amber-200/90 leading-relaxed">{notice.message}</p>
            {notice.actionHint && (
              <p className="text-[10px] text-amber-300/80 font-medium">{notice.actionHint}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 pt-1 border-t border-amber-500/20">
          <a
            href={appUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-black font-bold text-[11px] transition-all shadow"
          >
            <span>Open in New Tab</span>
            <ExternalLink className="w-3 h-3" />
          </a>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white font-medium text-[11px] transition-all border border-white/15"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Retry</span>
            </button>
          )}
        </div>
      </div>
    );
  }

  // Banner variant (top of page)
  return (
    <div
      id="auth-error-banner"
      className={`bg-gradient-to-r from-amber-950/95 via-amber-900/90 to-amber-950/95 border-b border-amber-500/40 px-4 py-2.5 text-xs text-amber-200 z-50 sticky top-0 backdrop-blur-md shadow-lg ${className}`}
    >
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-start sm:items-center gap-2.5">
          {getIcon()}
          <div>
            <span className="font-bold text-amber-300 mr-1.5">{getTitle()}:</span>
            <span className="text-amber-100/90">{notice.message}</span>
            {notice.actionHint && (
              <span className="hidden md:inline text-amber-300/90 ml-1 font-medium">
                {notice.actionHint}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0 w-full sm:w-auto justify-end">
          <a
            href={appUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-lg bg-amber-400 hover:bg-amber-300 text-black font-bold text-xs transition-colors shadow"
          >
            <span>Open in New Tab</span>
            <ExternalLink className="w-3 h-3" />
          </a>

          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white font-medium text-xs transition-colors border border-white/15"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Retry</span>
            </button>
          )}

          {onDismiss && (
            <button
              type="button"
              onClick={onDismiss}
              className="p-1 text-amber-300/80 hover:text-white transition-colors ml-1"
              aria-label="Dismiss banner"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
