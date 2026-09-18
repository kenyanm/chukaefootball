import React from 'react';
import { ExternalLink, Users } from 'lucide-react';
import { WhatsAppLogo } from './WhatsAppLogo';
import { ChukaCrestLogo } from './ChukaCrestLogo';

const WHATSAPP_LINK = 'https://chat.whatsapp.com/DYZn4PtKAp1AeANEuPVffk';

interface WhatsAppBannerProps {
  compact?: boolean;
}

export const WhatsAppBanner: React.FC<WhatsAppBannerProps> = ({ compact = false }) => {
  return (
    <div
      id="whatsapp-community-banner"
      className={`relative overflow-hidden rounded-3xl border border-emerald-500/30 bg-gradient-to-r from-[#0d2818] via-[#091b10] to-[#12281b] shadow-xl shadow-emerald-950/20 ${
        compact ? 'p-3.5 sm:p-4' : 'p-5 md:p-6'
      }`}
    >
      <div className="absolute -right-8 -top-8 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />
      <div className="relative flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3.5 w-full sm:w-auto">
          {/* Official WhatsApp Logo Icon */}
          <div className="relative shrink-0">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 border border-emerald-400/40 flex items-center justify-center shadow-inner">
              <WhatsAppLogo className="w-7 h-7" size={28} />
            </div>
            <div className="absolute -bottom-1 -right-1">
              <ChukaCrestLogo size="sm" withBorder={false} className="w-5 h-5 min-w-[20px] ring-2 ring-[#0d2818]" />
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <h3 className="font-heading font-black text-white text-sm md:text-base tracking-wide uppercase">
                JOIN THE CHUKA eFOOTBALL COMMUNITY
              </h3>
            </div>
            <p className="text-xs text-emerald-200/80 pt-0.5">
              Match announcements · Room codes · Campus tournaments
            </p>
            <div className="flex items-center gap-1 text-[11px] font-mono text-emerald-400/90 pt-1">
              <Users className="w-3 h-3" />
              <span>250+ campus players</span>
            </div>
          </div>
        </div>

        <a
          id="btn-join-whatsapp"
          href={WHATSAPP_LINK}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-5 py-3 rounded-2xl bg-[#25D366] hover:bg-[#20bd5a] text-[#051a0e] font-heading font-black text-xs sm:text-sm uppercase tracking-wider transition-all duration-200 shadow-lg shadow-[#25D366]/25 active:scale-98 shrink-0 touch-target"
        >
          <WhatsAppLogo className="w-5 h-5" size={20} />
          <span>JOIN WHATSAPP GROUP</span>
          <ExternalLink className="w-3.5 h-3.5 opacity-80" />
        </a>
      </div>
    </div>
  );
};
