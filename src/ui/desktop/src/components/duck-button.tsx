/**
 * DuckButton — Primary button component
 *
 * Variants: primary (yellow), secondary (border), ghost (text), danger (red)
 * Sizes: sm, md, lg
 */

import React from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

interface DuckButtonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  disabled?: boolean;
  loading?: boolean;
  className?: string;
  type?: 'button' | 'submit' | 'reset';
  children: React.ReactNode;
  title?: string;
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: `
    bg-[#fbbf24] text-[#0d1117] font-semibold
    hover:bg-[#d97706] active:scale-95
    disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-[#fbbf24] disabled:active:scale-100
    border border-transparent
    shadow-[0_0_0_1px_rgba(251,191,36,0.1)]
    hover:shadow-[0_0_12px_rgba(251,191,36,0.3)]
  `,
  secondary: `
    bg-transparent text-[#fbbf24] font-semibold border border-[#fbbf24]/50
    hover:bg-[#fbbf24]/10 hover:border-[#fbbf24]
    active:scale-95
    disabled:opacity-40 disabled:cursor-not-allowed
  `,
  ghost: `
    bg-transparent text-[#8b949e] font-medium
    hover:bg-[#21262d] hover:text-[#e6edf3]
    active:scale-95
    disabled:opacity-40 disabled:cursor-not-allowed
  `,
  danger: `
    bg-[#ef4444] text-white font-semibold
    hover:bg-[#dc2626] active:scale-95
    disabled:opacity-40 disabled:cursor-not-allowed
    border border-transparent
  `,
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-xs rounded-md gap-1.5',
  md: 'px-4 py-2 text-sm rounded-lg gap-2',
  lg: 'px-6 py-3 text-base rounded-xl gap-2',
};

export const DuckButton: React.FC<DuckButtonProps> = ({
  variant = 'primary',
  size = 'md',
  onClick,
  disabled = false,
  loading = false,
  className = '',
  type = 'button',
  children,
  title,
}) => {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      title={title}
      className={`
        inline-flex items-center justify-center
        transition-all duration-100 ease-out
        select-none
        ${VARIANT_CLASSES[variant]}
        ${SIZE_CLASSES[size]}
        ${className}
      `}
      style={{ fontFamily: 'var(--font-ui, Inter, sans-serif)' }}
    >
      {loading && (
        <svg
          className="animate-spin -ml-1 mr-1 h-3 w-3"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      )}
      {children}
    </button>
  );
};
