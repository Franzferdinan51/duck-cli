/**
 * CouncilorBadge — Agent/councilor pill component
 *
 * Shows agent status, name, role, and color with hover interaction.
 */

import React from 'react';

interface Councilor {
  id: string;
  name: string;
  role: string;
  color: string;
  model: string;
  enabled: boolean;
}

interface CouncilorBadgeProps {
  councilor: Councilor;
  isThinking?: boolean;
  onClick?: () => void;
}

export const CouncilorBadge: React.FC<CouncilorBadgeProps> = ({
  councilor,
  isThinking = false,
  onClick,
}) => {
  const roleColors: Record<string, string> = {
    speaker: 'text-amber-400',
    moderator: 'text-cyan-400',
    councilor: 'text-slate-400',
    specialist: 'text-purple-400',
    sentinel: 'text-slate-500',
  };

  const roleLabels: Record<string, string> = {
    speaker: 'SPEAKER',
    moderator: 'MOD',
    councilor: 'COUNCILOR',
    specialist: 'AGENT',
    sentinel: 'SENTINEL',
  };

  return (
    <div
      onClick={onClick}
      className={`
        relative flex-shrink-0 w-32 md:w-44 h-14 md:h-20 p-2 md:p-2.5
        rounded-lg md:rounded-xl border backdrop-blur-sm
        transition-all duration-200 cursor-pointer group overflow-hidden
        ${councilor.enabled ? '' : 'opacity-40'}
        ${isThinking
          ? 'border-[#fbbf24]/50 bg-[#1c2333] shadow-[0_0_16px_rgba(251,191,36,0.15)]'
          : 'border-[#30363d] bg-[#161b22] hover:border-[#484f58] hover:bg-[#1c2333]'}
      `}
    >
      {/* Active glow pulse */}
      {isThinking && (
        <div className="absolute inset-0 bg-[#fbbf24]/5 animate-pulse rounded-lg" />
      )}

      {/* Top bar */}
      <div className="flex justify-between items-center mb-1">
        <div className="flex items-center gap-1.5">
          <div className={`
            w-1.5 h-1.5 rounded-full
            ${isThinking ? 'bg-[#fbbf24] animate-ping' : councilor.enabled ? 'bg-emerald-400' : 'bg-slate-600'}
          `} />
          <span className={`
            text-[9px] font-bold uppercase tracking-widest
            ${roleColors[councilor.role] || 'text-slate-400'}
            opacity-90
          `}>
            {roleLabels[councilor.role] || councilor.role.toUpperCase()}
          </span>
        </div>
        {isThinking && (
          <span className="text-[8px] text-[#fbbf24] font-mono animate-pulse">THINKING</span>
        )}
      </div>

      {/* Name & Model */}
      <div className="flex flex-col justify-center h-10">
        <h3 className="text-[11px] md:text-xs font-serif font-bold text-[#e6edf3] truncate tracking-wide leading-tight
                        group-hover:text-white transition-colors">
          {councilor.name}
        </h3>
        <div className="flex items-center gap-1 mt-0.5">
          <p className="text-[9px] text-[#484f58] truncate font-mono">{councilor.model}</p>
        </div>
      </div>

      {/* Bottom gradient line */}
      <div className={`
        absolute bottom-0 left-0 right-0 h-0.5
        bg-gradient-to-r ${councilor.color}
        ${isThinking ? 'opacity-100' : 'opacity-50 group-hover:opacity-100'}
        transition-opacity
      `} />

      {/* Hover consult hint */}
      <div className="absolute inset-0 bg-[#0d1117]/80 backdrop-blur-[2px]
                      flex items-center justify-center
                      opacity-0 group-hover:opacity-100 transition-all duration-150
                      rounded-lg">
        <div className="border border-white/20 bg-white/5 rounded-full px-3 py-1 flex items-center gap-1.5">
          <span className="text-[10px] font-bold text-white uppercase tracking-wider">Consult</span>
          <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24"
               fill="none" stroke="currentColor" strokeWidth="2"
               className="text-white">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </div>
      </div>
    </div>
  );
};
