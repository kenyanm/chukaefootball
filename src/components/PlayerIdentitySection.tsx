import React, { useState, useRef } from 'react';
import {
  Smartphone,
  Camera,
  Upload,
  CheckCircle2,
  AlertTriangle,
  Shield,
  Check,
  Edit2,
  Loader2,
  Info,
  MessageCircle,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { storageService } from '../services/storageService';
import { validateKenyanPhone } from '../services/contactService';
import { sanitizeEfootballUsername } from '../services/playerService';
import { UserProfile } from '../types';

interface PlayerIdentitySectionProps {
  userProfile: UserProfile;
}

export const PlayerIdentitySection: React.FC<PlayerIdentitySectionProps> = ({ userProfile }) => {
  const { currentUser, updateProfile, updateWhatsApp } = useAuth();
  const { success, error } = useToast();

  // eFootball Username state
  const [isEditingUsername, setIsEditingUsername] = useState(false);
  const [usernameInput, setUsernameInput] = useState(userProfile.efootballUsername || '');
  const [savingUsername, setSavingUsername] = useState(false);

  // eFootball Profile Image state
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // WhatsApp state
  const [isEditingPhone, setIsEditingPhone] = useState(!userProfile.whatsappNumber);
  const [phoneInput, setPhoneInput] = useState(userProfile.whatsappNumber || '');
  const [savingPhone, setSavingPhone] = useState(false);
  const [phoneError, setPhoneError] = useState<string | null>(null);

  // Handle saving eFootball username
  const handleSaveUsername = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;

    const sanitized = sanitizeEfootballUsername(usernameInput);
    setSavingUsername(true);
    try {
      await updateProfile({ efootballUsername: sanitized });
      setIsEditingUsername(false);
      setUsernameInput(sanitized);
      success('eFootball Tag Saved', `Updated to ${sanitized || 'none'}`);
    } catch (err: any) {
      error('Failed to Save Tag', err.message || 'Error updating eFootball username');
    } finally {
      setSavingUsername(false);
    }
  };

  // Handle uploading eFootball account / profile image
  const handleImageFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentUser) return;

    // Reset input value so user can re-select same file if desired
    e.target.value = '';

    // Validate MIME type
    const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
    if (!ALLOWED_TYPES.includes(file.type.toLowerCase())) {
      error('Invalid File Type', 'Please choose a JPEG, PNG, WebP, or GIF image.');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      error('File Too Large', 'eFootball profile image must be under 5MB.');
      return;
    }

    // Validate dangerous extensions
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    const DANGEROUS_EXTENSIONS = ['exe', 'bat', 'sh', 'cmd', 'js', 'py', 'php', 'apk', 'bin', 'msi'];
    if (DANGEROUS_EXTENSIONS.includes(ext)) {
      error('Security Alert', `File extension .${ext} is strictly forbidden.`);
      return;
    }

    setUploadingImage(true);
    try {
      const { downloadUrl } = await storageService.uploadProfileImage(currentUser.uid, file, file.name);
      await updateProfile({ efootballAccountImageUrl: downloadUrl });
      success('Image Uploaded', 'Your official eFootball Mobile profile image is now updated.');
    } catch (err: any) {
      console.error('Upload profile image error:', err);
      error('Upload Failed', err.message || 'Could not upload image to Firebase Storage.');
    } finally {
      setUploadingImage(false);
    }
  };

  // Handle saving WhatsApp number
  const handleSavePhone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;

    setPhoneError(null);
    const validation = validateKenyanPhone(phoneInput);
    if (!validation.valid) {
      setPhoneError(validation.error || 'Please enter a valid Kenyan phone number.');
      return;
    }

    setSavingPhone(true);
    try {
      const res = await updateWhatsApp(phoneInput);
      setIsEditingPhone(false);
      setPhoneInput(res.cleanDigits);
      success('WhatsApp Verified', `Saved ${res.formatted} for knockout match coordination.`);
    } catch (err: any) {
      setPhoneError(err.message || 'Failed to save WhatsApp number.');
      error('WhatsApp Error', err.message);
    } finally {
      setSavingPhone(false);
    }
  };

  const hasWhatsApp = Boolean(userProfile.whatsappNumber);
  const formattedWhatsApp = userProfile.whatsappNumber
    ? validateKenyanPhone(userProfile.whatsappNumber).formatted
    : '';

  return (
    <div id="player-identity-section" className="space-y-6">
      {/* SECTION HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/10 pb-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-mono font-bold uppercase tracking-wider mb-1">
            <Smartphone className="w-3.5 h-3.5" />
            <span>eFootball™ Mobile Identity</span>
          </div>
          <h2 className="font-heading font-black text-xl sm:text-2xl text-white uppercase tracking-tight">
            Athlete Profile &amp; Match Contact
          </h2>
          <p className="text-xs text-white/60">
            Manage your in-game identity and required WhatsApp contact for 1v1 knockout coordination.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* ===================================================================== */}
        {/* CARD 1: eFootball Mobile Identity (Username & Image)                   */}
        {/* ===================================================================== */}
        <div className="p-5 sm:p-6 rounded-3xl bg-[#09100d] border border-white/10 flex flex-col justify-between space-y-5 shadow-xl relative overflow-hidden">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-bold uppercase text-emerald-400 tracking-wider">
                1. In-Game Persona
              </span>
              <span className="text-[11px] text-white/40 font-mono">
                ID: {userProfile.playerId}
              </span>
            </div>

            {/* Profile Avatar & Upload trigger */}
            <div className="flex items-center gap-4 p-4 rounded-2xl bg-black/50 border border-white/10">
              <div className="relative shrink-0">
                {userProfile.efootballAccountImageUrl || userProfile.photoURL ? (
                  <img
                    src={userProfile.efootballAccountImageUrl || userProfile.photoURL}
                    alt={userProfile.displayName}
                    referrerPolicy="no-referrer"
                    className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl object-cover border-2 border-emerald-400/80 shadow-lg shadow-emerald-950/60"
                  />
                ) : (
                  <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-br from-emerald-600 via-emerald-800 to-[#002d18] flex items-center justify-center text-white font-heading font-black text-2xl border-2 border-emerald-400">
                    {userProfile.displayName.charAt(0)}
                  </div>
                )}
                {uploadingImage && (
                  <div className="absolute inset-0 bg-black/70 rounded-2xl flex items-center justify-center">
                    <Loader2 className="w-6 h-6 text-emerald-400 animate-spin" />
                  </div>
                )}
              </div>

              <div className="space-y-2 flex-1 min-w-0">
                <div>
                  <h4 className="font-heading font-black text-sm text-white uppercase truncate">
                    eFootball™ Account Image
                  </h4>
                  <p className="text-[11px] text-white/50 leading-tight">
                    Upload your in-game avatar or squad screenshot (max 5MB).
                  </p>
                </div>

                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleImageFileSelected}
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="hidden"
                />

                <button
                  type="button"
                  id="btn-upload-profile-image"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingImage}
                  className="px-3.5 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-400/40 text-emerald-300 font-bold text-xs uppercase tracking-wider transition-all flex items-center gap-1.5 active:scale-95 disabled:opacity-50"
                >
                  <Camera className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{uploadingImage ? 'Uploading...' : 'Upload Image'}</span>
                </button>
              </div>
            </div>

            {/* eFootball Username Field */}
            <div className="p-4 rounded-2xl bg-black/50 border border-white/10 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-white/60 font-bold uppercase tracking-wider text-[10px]">
                  eFootball Mobile In-Game Username
                </span>
                {!isEditingUsername && (
                  <button
                    type="button"
                    onClick={() => {
                      setUsernameInput(userProfile.efootballUsername || '');
                      setIsEditingUsername(true);
                    }}
                    className="text-emerald-400 hover:text-emerald-300 text-[11px] font-bold flex items-center gap-1"
                  >
                    <Edit2 className="w-3 h-3" />
                    <span>{userProfile.efootballUsername ? 'Edit' : 'Add Tag'}</span>
                  </button>
                )}
              </div>

              {isEditingUsername ? (
                <form onSubmit={handleSaveUsername} className="space-y-2 pt-1">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      maxLength={30}
                      placeholder="e.g. ChukaSniper99"
                      value={usernameInput}
                      onChange={(e) => setUsernameInput(e.target.value)}
                      className="flex-1 px-3 py-2 rounded-xl bg-black border border-white/20 text-white font-mono text-sm focus:outline-none focus:border-emerald-400"
                    />
                    <button
                      type="submit"
                      disabled={savingUsername}
                      className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-heading font-black text-xs uppercase tracking-wider disabled:opacity-50 transition-all shrink-0"
                    >
                      {savingUsername ? 'Saving...' : 'Save'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsEditingUsername(false)}
                      className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white/70 text-xs font-bold transition-all"
                    >
                      Cancel
                    </button>
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-white/40">
                    <span>Retains letters, numbers, spaces, dots, and hyphens</span>
                    <span className="font-mono">{usernameInput.length}/30</span>
                  </div>
                </form>
              ) : (
                <div className="flex items-center justify-between">
                  <span className="font-mono text-sm sm:text-base font-bold text-white">
                    {userProfile.efootballUsername ? (
                      <span className="text-emerald-300">🎮 {userProfile.efootballUsername}</span>
                    ) : (
                      <span className="text-white/40 italic">Not set (Click Add Tag)</span>
                    )}
                  </span>
                  {userProfile.efootballUsername && (
                    <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">
                      PUBLIC ON ROSTER
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="text-[11px] text-white/40 flex items-start gap-1.5 pt-2 border-t border-white/5">
            <Info className="w-3.5 h-3.5 text-white/50 shrink-0 mt-0.5" />
            <span>
              Your permanent CHUKA Player ID (<strong>{userProfile.playerId}</strong>) remains authoritative for tournament bracket seeding.
            </span>
          </div>
        </div>

        {/* ===================================================================== */}
        {/* CARD 2: Knockout Match WhatsApp Communication                         */}
        {/* ===================================================================== */}
        <div className="p-5 sm:p-6 rounded-3xl bg-[#09100d] border border-white/10 flex flex-col justify-between space-y-5 shadow-xl relative overflow-hidden">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-bold uppercase text-emerald-400 tracking-wider">
                2. Match Communication
              </span>
              <span
                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase border ${
                  hasWhatsApp
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40'
                    : 'bg-amber-500/20 text-amber-300 border-amber-400/40'
                }`}
              >
                {hasWhatsApp ? (
                  <>
                    <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                    <span>KNOCKOUT READY</span>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-3 h-3 text-amber-400" />
                    <span>REQUIRED FOR KNOCKOUTS</span>
                  </>
                )}
              </span>
            </div>

            {/* Explanation Banner */}
            <div className="p-3.5 rounded-2xl bg-black/50 border border-white/10 space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-white uppercase">
                <MessageCircle className="w-4 h-4 text-[#25D366]" />
                <span>WhatsApp Knockout Channel</span>
              </div>
              <p className="text-[11px] text-white/70 leading-relaxed">
                WhatsApp is <strong className="text-amber-300">REQUIRED</strong> before participating in knockout fixtures so opponents can exchange eFootball Mobile room codes, verify ping, and settle disputes.
              </p>
            </div>

            {/* Current WhatsApp or Input Form */}
            {isEditingPhone ? (
              <form onSubmit={handleSavePhone} className="p-4 rounded-2xl bg-black/60 border border-emerald-500/40 space-y-3">
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-emerald-300 block mb-1">
                    Kenyan WhatsApp Phone Number
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="tel"
                      inputMode="tel"
                      required
                      placeholder="e.g. 0712345678 or 0112345678"
                      value={phoneInput}
                      onChange={(e) => {
                        setPhoneInput(e.target.value);
                        setPhoneError(null);
                      }}
                      className="flex-1 px-3.5 py-2.5 rounded-xl bg-black border border-white/20 text-white font-mono text-sm focus:outline-none focus:border-emerald-400 placeholder:text-white/30"
                    />
                    <button
                      type="submit"
                      disabled={savingPhone || !phoneInput.trim()}
                      className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-heading font-black text-xs uppercase tracking-wider disabled:opacity-50 transition-all shrink-0"
                    >
                      {savingPhone ? 'Verifying...' : 'Save Phone'}
                    </button>
                    {hasWhatsApp && (
                      <button
                        type="button"
                        onClick={() => {
                          setIsEditingPhone(false);
                          setPhoneError(null);
                        }}
                        className="p-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white/70"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  {phoneError && (
                    <p className="text-xs text-red-400 mt-1.5">{phoneError}</p>
                  )}
                </div>

                <div className="text-[10px] text-white/40 space-y-0.5">
                  <p>Accepts 07XXXXXXXX, 01XXXXXXXX, or 254XXXXXXXXX.</p>
                  <p>Normalized to international E.164 (+254) automatically.</p>
                </div>
              </form>
            ) : (
              <div className="p-4 rounded-2xl bg-black/50 border border-white/10 flex items-center justify-between gap-3">
                <div className="space-y-1">
                  <span className="text-[10px] text-white/40 font-bold uppercase tracking-wider block">
                    Verified Match WhatsApp Contact
                  </span>
                  <div className="font-mono text-base sm:text-lg font-bold text-emerald-400 flex items-center gap-2">
                    <span>{formattedWhatsApp}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-white/70 font-mono">
                      KE (+254)
                    </span>
                  </div>
                  {userProfile.whatsappUpdatedAt && (
                    <span className="text-[10px] text-white/40 block">
                      Updated {new Date(userProfile.whatsappUpdatedAt).toLocaleDateString()}
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setPhoneInput(userProfile.whatsappNumber || '');
                    setIsEditingPhone(true);
                  }}
                  className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs uppercase tracking-wider border border-white/10 transition-all flex items-center gap-1.5 shrink-0"
                >
                  <Edit2 className="w-3.5 h-3.5 text-white/70" />
                  <span>Edit</span>
                </button>
              </div>
            )}
          </div>

          {/* Privacy Guarantee */}
          <div className="p-3 rounded-2xl bg-emerald-950/20 border border-emerald-500/20 flex items-start gap-2 text-[11px] text-emerald-300/80">
            <Shield className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>
              <strong>Privacy Protection:</strong> Stored securely in your private contact record. Never exposed on public rosters, brackets, or Google Sheets. Accessible only to your assigned opponent during active fixtures and admin for mediation.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
