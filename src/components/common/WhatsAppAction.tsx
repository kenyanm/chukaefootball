import React, { useState } from 'react';
import { MessageCircle, Copy, Check, ExternalLink } from 'lucide-react';
import { getWhatsAppClickToChatUrl } from '../../services/contactService';

interface WhatsAppActionProps {
  phone?: string;
  message: string;
  label?: string;
  variant?: 'primary' | 'secondary' | 'compact';
  className?: string;
}

export const WhatsAppAction: React.FC<WhatsAppActionProps> = ({
  phone = '0111359682',
  message,
  label = 'SEND ON WHATSAPP',
  variant = 'primary',
  className = '',
}) => {
  const [copied, setCopied] = useState(false);

  const handleOpen = () => {
    const url = getWhatsAppClickToChatUrl(phone, message);
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleCopyMessage = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(message);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (variant === 'compact') {
    return (
      <button
        type="button"
        onClick={handleOpen}
        className={`px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold font-mono uppercase tracking-wider transition-all flex items-center gap-1.5 touch-target active:scale-95 ${className}`}
        title="Opens WhatsApp to manually send text"
      >
        <MessageCircle className="w-3.5 h-3.5 shrink-0" />
        <span>{label}</span>
      </button>
    );
  }

  return (
    <div className={`space-y-1.5 ${className}`}>
      <button
        type="button"
        onClick={handleOpen}
        className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-heading font-black text-xs uppercase tracking-wider shadow-lg shadow-emerald-950/50 transition-all flex items-center justify-center gap-2 active:scale-95 touch-target"
      >
        <MessageCircle className="w-4 h-4 shrink-0" />
        <span>📱 {label}</span>
        <ExternalLink className="w-3.5 h-3.5 opacity-60 ml-1" />
      </button>

      <div className="flex items-center justify-between text-[10px] font-mono text-white/50 px-1">
        <span>Opens WhatsApp • Send manually</span>
        <button
          type="button"
          onClick={handleCopyMessage}
          className="hover:text-emerald-300 flex items-center gap-1"
        >
          {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
          <span>{copied ? 'Copied' : 'Copy Text'}</span>
        </button>
      </div>
    </div>
  );
};
