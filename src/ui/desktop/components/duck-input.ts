/**
 * DuckInput — Text input component
 */

import React from 'react';

interface DuckInputProps {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  placeholder?: string;
  disabled?: boolean;
  type?: string;
  className?: string;
  autoFocus?: boolean;
}

export const DuckInput: React.FC<DuckInputProps> = ({
  value,
  onChange,
  onKeyDown,
  placeholder,
  disabled = false,
  type = 'text',
  className = '',
  autoFocus = false,
}) => {
  return (
    <input
      type={type}
      value={value}
      onChange={onChange}
      onKeyDown={onKeyDown}
      placeholder={placeholder}
      disabled={disabled}
      autoFocus={autoFocus}
      className={`
        w-full bg-[#0d1117] border border-[#30363d] text-[#e6edf3]
        rounded-lg px-3 py-2 text-sm
        placeholder-[#484f58]
        focus:outline-none focus:border-[#fbbf24] focus:ring-1 focus:ring-[#fbbf24]/30
        transition-colors duration-150
        disabled:opacity-50 disabled:cursor-not-allowed
        ${className}
      `}
      style={{ fontFamily: 'var(--font-ui, Inter, sans-serif)' }}
    />
  );
};
