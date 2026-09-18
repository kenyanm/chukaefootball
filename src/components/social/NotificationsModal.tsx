import React, { useEffect, useState } from 'react';
import {
  X,
  Bell,
  CheckCheck,
  Swords,
  CheckCircle2,
  AlertTriangle,
  Award,
  TrendingUp,
  CreditCard,
  Sun,
  MessageSquare,
  ExternalLink,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { socialService } from '../../services/socialService';
import { InAppNotification } from '../../types';

interface NotificationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateTab?: (tab: string) => void;
}

export const NotificationsModal: React.FC<NotificationsModalProps> = ({
  isOpen,
  onClose,
  onNavigateTab,
}) => {
  const { currentUser } = useAuth();
  const [notifications, setNotifications] = useState<InAppNotification[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'UNREAD'>('ALL');

  const loadNotifications = async () => {
    if (!currentUser) return;
    setIsLoading(true);
    try {
      const list = await socialService.getNotifications(currentUser.uid);
      setNotifications(list);
    } catch (e) {
      console.warn('Error loading notifications:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && currentUser) {
      loadNotifications();
    }
  }, [isOpen, currentUser]);

  if (!isOpen) return null;

  const handleMarkAsRead = async (notifId: string) => {
    await socialService.markNotificationAsRead(notifId);
    setNotifications((prev) =>
      prev.map((n) => (n.notificationId === notifId ? { ...n, isRead: true } : n))
    );
  };

  const handleMarkAllRead = async () => {
    if (!currentUser) return;
    await socialService.markAllNotificationsAsRead(currentUser.uid);
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
  };

  const filteredList =
    activeFilter === 'UNREAD' ? notifications.filter((n) => !n.isRead) : notifications;
  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const getIconForType = (type: string) => {
    switch (type) {
      case 'CHALLENGE_RECEIVED':
        return <Swords className="w-4 h-4 text-amber-400" />;
      case 'RESULT_CONFIRMED':
        return <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
      case 'RESULT_DISPUTED':
        return <AlertTriangle className="w-4 h-4 text-rose-400" />;
      case 'ACHIEVEMENT_EARNED':
        return <Award className="w-4 h-4 text-amber-400" />;
      case 'RANKING_CHANGED':
        return <TrendingUp className="w-4 h-4 text-cyan-400" />;
      case 'CARD_ACTIVATED':
        return <CreditCard className="w-4 h-4 text-emerald-400" />;
      case 'DAILY_FIRST_OPEN':
        return <Sun className="w-4 h-4 text-orange-400" />;
      default:
        return <Bell className="w-4 h-4 text-emerald-400" />;
    }
  };

  return (
    <div
      id="notifications-modal-backdrop"
      className="fixed inset-0 z-50 flex items-start justify-end p-2 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in"
    >
      <div
        id="notifications-container"
        className="w-full max-w-md bg-[#080C09] border border-white/10 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] sm:mt-16 mr-0 sm:mr-4"
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-white/10 flex items-center justify-between bg-black/40">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
              <Bell className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-heading font-black text-sm sm:text-base text-white flex items-center gap-2">
                <span>Notifications</span>
                {unreadCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500 text-black text-[10px] font-mono font-bold">
                    {unreadCount} NEW
                  </span>
                )}
              </h3>
              <p className="text-[10px] font-mono text-white/50">
                Authoritative match & community updates
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-all"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action bar & Filters */}
        <div className="px-4 py-2.5 bg-black/20 border-b border-white/5 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 font-mono text-xs">
            <button
              onClick={() => setActiveFilter('ALL')}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                activeFilter === 'ALL'
                  ? 'bg-white/15 text-white font-bold'
                  : 'text-white/50 hover:text-white'
              }`}
            >
              All ({notifications.length})
            </button>
            <button
              onClick={() => setActiveFilter('UNREAD')}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                activeFilter === 'UNREAD'
                  ? 'bg-emerald-500/20 text-emerald-300 font-bold'
                  : 'text-white/50 hover:text-white'
              }`}
            >
              Unread ({unreadCount})
            </button>
          </div>

          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              className="text-[11px] font-mono font-bold text-emerald-400 hover:text-emerald-300 flex items-center gap-1 transition-all"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              <span>Mark all read</span>
            </button>
          )}
        </div>

        {/* Notifications List */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-2.5">
          {isLoading ? (
            <div className="py-16 text-center space-y-2">
              <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
              <div className="text-xs font-mono text-white/50">Fetching notifications...</div>
            </div>
          ) : filteredList.length === 0 ? (
            <div className="py-16 text-center space-y-3 px-4">
              <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto text-white/40">
                <Bell className="w-6 h-6" />
              </div>
              <div className="font-heading font-black text-sm text-white">No notifications yet</div>
              <p className="text-xs text-white/50 max-w-xs mx-auto">
                Official alerts for received challenges, dual confirmed scores, and unlocked
                achievements will appear here.
              </p>
            </div>
          ) : (
            filteredList.map((notif) => (
              <div
                key={notif.notificationId}
                onClick={() => {
                  if (!notif.isRead) handleMarkAsRead(notif.notificationId);
                  if (notif.linkTab && onNavigateTab) {
                    onNavigateTab(notif.linkTab);
                    onClose();
                  }
                }}
                className={`p-3.5 rounded-2xl border transition-all cursor-pointer text-left space-y-1.5 relative group ${
                  notif.isRead
                    ? 'bg-black/30 border-white/5 hover:border-white/15 opacity-80'
                    : 'bg-emerald-950/20 border-emerald-500/30 hover:bg-emerald-950/30 shadow-sm'
                }`}
              >
                {!notif.isRead && (
                  <span className="absolute top-3.5 right-3.5 w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                )}
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-black/40 border border-white/10">
                    {getIconForType(notif.type)}
                  </div>
                  <span className="font-heading font-black text-xs text-white truncate pr-4">
                    {notif.title}
                  </span>
                </div>
                <p className="text-xs text-white/80 leading-relaxed">{notif.message}</p>
                <div className="flex items-center justify-between pt-1 text-[10px] font-mono text-white/40">
                  <span>
                    {new Date(notif.createdAt).toLocaleDateString('en-KE', {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                  {notif.linkTab && (
                    <span className="text-emerald-400 flex items-center gap-0.5 group-hover:underline">
                      <span>View</span>
                      <ExternalLink className="w-2.5 h-2.5" />
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
