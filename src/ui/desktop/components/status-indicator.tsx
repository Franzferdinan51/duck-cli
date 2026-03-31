/**
 * StatusIndicator — Online/Busy/Idle/Offline dot with label
 */

import React from 'react';

type Status = 'online' | 'busy' | 'idle' | 'offline';

interface StatusIndicatorProps {
  status: Status;
  showLabel?: boolean;
  size?: 'sm' | 'md';
}

const STATUS_CONFIG: Record<Status, { dot: string; label: string; color: string }> = {
  online:  { dot: 'bg-[#22c55e]', label: 'Online', color: 'text-emerald-400' },
  busy:    { dot: 'bg-[#fbbf24] animate-pulse', label: 'Busy', color: 'text-amber-400' },
  idle:    { dot: 'bg-[#06b6d4]', label: 'Idle', color: 'text-cyan-400' },
  offline: { dot: 'bg-[#484f58]', label: 'Offline', color: 'text-slate-400' },
};

export const StatusIndicator: React.FC<StatusIndicatorProps> = ({
  status,
  showLabel = false,
  size = 'sm',
}) => {
  const config = STATUS_CONFIG[status];
  const dotSize = size === 'sm' ? 'w-2 h-2' : 'w-2.5 h-2.5';

  return (
    <div className="flex items-center gap-1.5">
      <div className={`${dotSize} rounded-full ${config.dot}`} />
      {showLabel && (
        <span className={`text-[10px] ${config.color} font-medium`}>
          {config.label}
        </span>
      )}
    </div>
  );
};
