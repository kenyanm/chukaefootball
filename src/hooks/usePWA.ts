import { useState, useEffect, useCallback } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

const DISMISS_KEY = 'chuka_efootball_pwa_dismissed_time';
const DISMISS_COOLDOWN_MS = 1000 * 60 * 60 * 24 * 7; // 7 days cooldown before showing prominent mobile banner again

export type PWAInstallState =
  | 'INSTALLED'
  | 'CAN_INSTALL_NATIVE'
  | 'CAN_INSTALL_IOS'
  | 'UNSUPPORTED_BROWSER'
  | 'DISMISSED';

export function usePWA() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState<boolean>(false);
  const [isIOS, setIsIOS] = useState<boolean>(false);
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [isPrompting, setIsPrompting] = useState<boolean>(false);
  const [isDismissed, setIsDismissed] = useState<boolean>(false);
  const [showIOSGuide, setShowIOSGuide] = useState<boolean>(false);

  // Check standalone / installed mode across Android, iOS, Windows, macOS
  const checkIsInstalled = useCallback((): boolean => {
    if (typeof window === 'undefined') return false;
    const isStandaloneDisplay = window.matchMedia('(display-mode: standalone)').matches;
    const isIOSStandalone = (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    const isAndroidApp = document.referrer?.includes('android-app://');
    return Boolean(isStandaloneDisplay || isIOSStandalone || isAndroidApp);
  }, []);

  useEffect(() => {
    // 1. Initial installed check
    const installed = checkIsInstalled();
    setIsInstalled(installed);

    // 2. Check iOS
    if (typeof window !== 'undefined') {
      const ua = window.navigator.userAgent.toLowerCase();
      const isIOSDevice = /iphone|ipad|ipod/.test(ua) && !/crios/.test(ua);
      setIsIOS(isIOSDevice);

      // Check dismissal state
      try {
        const lastDismissed = localStorage.getItem(DISMISS_KEY);
        if (lastDismissed) {
          const elapsed = Date.now() - parseInt(lastDismissed, 10);
          if (elapsed < DISMISS_COOLDOWN_MS) {
            setIsDismissed(true);
          } else {
            localStorage.removeItem(DISMISS_KEY);
          }
        }
      } catch (e) {
        // localStorage disabled/restricted
      }
    }

    // 3. Listen for display-mode changes
    const mediaQuery = window.matchMedia('(display-mode: standalone)');
    const handleDisplayModeChange = (e: MediaQueryListEvent) => {
      if (e.matches) {
        setIsInstalled(true);
        setDeferredPrompt(null);
      }
    };
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleDisplayModeChange);
    }

    // 4. Native beforeinstallprompt
    const handleBeforeInstallPrompt = (e: Event) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      // Stash the event so it can be triggered later
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    // 5. appinstalled event
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
      setIsPrompting(false);
      try {
        localStorage.setItem('chuka_efootball_pwa_installed', 'true');
      } catch (err) {
        // ignore
      }
    };

    // 6. Online / Offline listeners
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener('change', handleDisplayModeChange);
      }
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [checkIsInstalled]);

  // Trigger installation prompt
  const installApp = async (): Promise<boolean> => {
    if (isInstalled) {
      return true;
    }

    if (isIOS) {
      setShowIOSGuide(true);
      return false;
    }

    if (!deferredPrompt) {
      // Browser does not support beforeinstallprompt (e.g. Firefox, Safari desktop)
      setShowIOSGuide(true);
      return false;
    }

    setIsPrompting(true);
    try {
      await deferredPrompt.prompt();
      const choiceResult = await deferredPrompt.userChoice;
      if (choiceResult.outcome === 'accepted') {
        setIsInstalled(true);
        setDeferredPrompt(null);
        return true;
      } else {
        // User dismissed the native dialog
        dismissPrompt();
        return false;
      }
    } catch (err) {
      console.warn('PWA install prompt error:', err);
      return false;
    } finally {
      setIsPrompting(false);
    }
  };

  // User dismissed prompt banner
  const dismissPrompt = () => {
    setIsDismissed(true);
    try {
      localStorage.setItem(DISMISS_KEY, Date.now().toString());
    } catch (e) {
      // ignore
    }
  };

  // Compute state
  let installState: PWAInstallState = 'UNSUPPORTED_BROWSER';
  if (isInstalled) {
    installState = 'INSTALLED';
  } else if (isDismissed) {
    installState = 'DISMISSED';
  } else if (deferredPrompt) {
    installState = 'CAN_INSTALL_NATIVE';
  } else if (isIOS) {
    installState = 'CAN_INSTALL_IOS';
  }

  const retryConnectivity = () => {
    if (typeof navigator !== 'undefined') {
      setIsOnline(navigator.onLine);
    }
  };

  return {
    isInstalled,
    isInstallable: Boolean(deferredPrompt || isIOS),
    canPromptNative: Boolean(deferredPrompt),
    isIOS,
    isOnline,
    isPrompting,
    isDismissed,
    installState,
    showIOSGuide,
    setShowIOSGuide,
    installApp,
    dismissPrompt,
    retryConnectivity,
  };
}
