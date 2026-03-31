/**
 * Toast — Notification system
 *
 * Stack of toast messages with auto-dismiss.
 */

import React, { useEffect, useCallback } from 'react';

export interface ToastData {
  id?: string;
  type: 'info' | 'success' | 'warning' | 'error';
  message: string;
}

interface ToastProps extends ToastData {
  onRemove: (id: string) => void;
}

interface ToastContainerProps {
  toasts: ToastData[];
  onRemove: (id: string) => void;
}

const TOAST_ICONS: Record<ToastData['type'], string> = {
  success: '✓',
  error: '✕',
  warning: '⚠',
  info: 'ℹ',
};

const TOAST_COLORS: Record<ToastData['type'], string> = {
  success: 'border-emerald-500/50 bg-emerald-500/10 text-emerald-400',
  error: 'border-red-500/50 bg-red-500/10 text-red-400',
  warning: 'border-amber-500/50 bg-amber-500/10 text-amber-400',
  info: 'border-cyan-500/50 bg-cyan-500/10 text-cyan-400',
};

const ToastItem: React.FC<ToastProps> = ({ type, message, onRemove }) => {
  const id = Math.random().toString(36).slice(2);

  useEffect(() => {
    const timer = setTimeout(() => onRemove(id), 4000);
    return () => clearTimeout(timer);
  }, [id, onRemove]);

  return (
    <div
      className={`
        flex items-center gap-3 px-4 py-3 rounded-xl border shadow-lg
        backdrop-blur-sm animate-toast-in
        bg-[#161b22]/90 ${TOAST_COLORS[type]}
        min-w-[280px] max-w-[400px]
      `}
    >
      <span className="text-base font-bold">{TOAST_ICONS[type]}</span>
      <span className="text-sm text-[#e6edf3] flex-1">{message}</span>
      <button
        onClick={() => onRemove(id)}
        className="text-[#8b949e] hover:text-[#e6edf3] text-sm transition-colors"
      >
        ✕
      </button>
    </div>
  );
};

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onRemove }) => {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-20 md:bottom-4 right-4 z-[100] flex flex-col gap-2">
      {toasts.map(toast => (
        <ToastItem key={toast.id || Math.random().toString(36).slice(2)} {...toast} onRemove={onRemove} />
      ))}
      <style>{`
        @keyframes toast-in {
          from { opacity: 0; transform: translateX(20px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        .animate-toast-in {
          animation: toast-in 200ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>
    </div>
  );
};

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useToast() {
  const [toasts, setToasts] = React.useState<ToastData[]>([]);

  const addToast = useCallback((toast: Omit<ToastData, 'id'>) => {
    const id = Math.random().toString(36).slice(2);
    setToasts(prev => [...prev, { ...toast, id }]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return { toasts, addToast, removeToast };
}
