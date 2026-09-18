import React from 'react';
import { GoogleLogo } from './GoogleLogo';

export interface GoogleSignInButtonProps {
  onClick?: () => void | Promise<void>;
  disabled?: boolean;
  theme?: 'light' | 'dark' | 'neutral';
  size?: 'sm' | 'md' | 'lg';
  text?: 'signin' | 'signin_with' | 'continue_with';
  className?: string;
  id?: string;
  loading?: boolean;
}

/**
 * Official Google Sign-In Button compliant with Google Identity Brand Guidelines.
 * Features official 4-color Google "G" mark, exact padding, typography and contrast.
 */
export const GoogleSignInButton: React.FC<GoogleSignInButtonProps> = ({
  onClick,
  disabled = false,
  theme = 'light',
  size = 'md',
  text = 'signin_with',
  className = '',
  id = 'google-signin-btn',
  loading = false,
}) => {
  // Label text options per Google identity standards
  const getLabel = () => {
    switch (text) {
      case 'continue_with':
        return 'Continue with Google';
      case 'signin':
        return 'Sign in';
      case 'signin_with':
      default:
        return 'Sign in with Google';
    }
  };

  // Official dimensions & padding
  const sizeStyles = {
    sm: 'h-9 px-3 text-xs gap-2.5 rounded-lg',
    md: 'h-10 px-4 text-sm gap-3 rounded-xl',
    lg: 'h-12 px-5 text-sm md:text-base gap-3.5 rounded-xl',
  };

  const logoSizes = {
    sm: 18,
    md: 20,
    lg: 22,
  };

  // Official colors & hover states
  const themeStyles = {
    light:
      'bg-white hover:bg-[#f8fafd] text-[#1f1f1f] border border-[#dadce0] hover:border-[#c6c9ce] shadow-sm hover:shadow active:bg-[#f1f3f4]',
    dark:
      'bg-[#131314] hover:bg-[#202124] text-[#e3e3e3] border border-[#8e918f]/40 hover:border-[#8e918f] shadow-sm hover:shadow active:bg-[#303134]',
    neutral:
      'bg-white hover:bg-neutral-50 text-neutral-800 border border-neutral-300 shadow-sm active:scale-[0.99]',
  };

  return (
    <button
      id={id}
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      className={`relative inline-flex items-center justify-center font-medium font-sans select-none transition-all duration-150 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${sizeStyles[size]} ${themeStyles[theme]} ${className}`}
      style={{
        fontFamily: "'Roboto', 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif",
      }}
    >
      {loading ? (
        <div
          className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"
          aria-label="Signing in..."
        />
      ) : (
        <GoogleLogo size={logoSizes[size]} className="shrink-0" />
      )}
      <span className="font-medium tracking-normal whitespace-nowrap text-inherit">
        {loading ? 'Connecting...' : getLabel()}
      </span>
    </button>
  );
};
