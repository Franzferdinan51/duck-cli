/**
 * DuckModal — Dialog overlay component
 *
 * Backdrop blur, centered card, escape to close.
 */

import React, { useEffect } from 'react';

interface DuckModalProps {
  isOpen?: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  className?: string;
  showClose?: boolean;
}

export const DuckModal: React.FC<DuckModalProps> = ({
  onClose,
  title,
  children,
  className = '',
  showClose = true,
}) => {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

      {/* Modal */}
      <div
        className={`
          relative bg-[#161b22] border border-[#30363d] rounded-2xl
          w-full max-w-md shadow-2xl
          animate-modal-enter
          ${className}
        `}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#30363d]">
          <h3
            className="text-sm font-bold text-[#fbbf24] uppercase tracking-wider"
            style={{ fontFamily: 'var(--font-display, Crimson Pro, serif)' }}
          >
            {title}
          </h3>
          {showClose && (
            <button
              onClick={onClose}
              className="text-[#8b949e] hover:text-[#e6edf3] transition-colors text-lg"
            >
              ✕
            </button>
          )}
        </div>

        {/* Content */}
        <div className="px-6 py-4">
          {children}
        </div>
      </div>

      {/* Animation style */}
      <style>{`
        @keyframes modal-enter {
          from { opacity: 0; transform: scale(0.95); }
          to   { opacity: 1; transform: scale(1); }
        }
        .animate-modal-enter {
          animation: modal-enter 200ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>
    </div>
  );
};
