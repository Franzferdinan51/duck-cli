/**
 * MeshNodeCard — Agent node card for mesh panel list view
 */

import React from 'react';
import { StatusIndicator } from './status-indicator';

interface MeshNode {
  id: string;
  name: string;
  emoji: string;
  status: 'online' | 'busy' | 'idle' | 'offline';
  latency: number;
  color: string;
  capabilities: string[];
  model?: string;
}

interface MeshNodeCardProps {
  node: MeshNode;
  isSelected?: boolean;
  onClick?: () => void;
}

export const MeshNodeCard: React.FC<MeshNodeCardProps> = ({
  node,
  isSelected = false,
  onClick,
}) => {
  return (
    <div
      onClick={onClick}
      className={`
        bg-[#161b22] border rounded-xl px-4 py-3 cursor-pointer
        transition-all duration-150 hover:border-[#484f58]
        ${isSelected ? 'border-[#fbbf24]/50 shadow-[0_0_16px_rgba(251,191,36,0.08)]' : 'border-[#30363d]'}
      `}
    >
      <div className="flex items-center gap-3">
        {/* Avatar */}
        <div className={`
          w-10 h-10 rounded-full flex items-center justify-center text-xl
          border-2
          ${node.status === 'offline' ? 'bg-[#21262d] border-[#30363d]' : ''}
        `}
          style={{
            borderColor: node.status !== 'offline' ? node.color : undefined,
            background: node.status !== 'offline' ? `${node.color}1a` : undefined,
          }}
        >
          {node.emoji}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-[#e6edf3]">{node.name}</span>
            <StatusIndicator status={node.status} />
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            {node.model && (
              <span className="text-[10px] font-mono text-[#8b949e]">{node.model}</span>
            )}
            {node.latency > 0 && (
              <span className="text-[10px] font-mono text-[#484f58]">{node.latency}ms</span>
            )}
          </div>
        </div>

        {/* Capabilities */}
        <div className="flex flex-wrap gap-1 max-w-[180px] justify-end">
          {node.capabilities.slice(0, 3).map(cap => (
            <span key={cap} className="text-[9px] bg-[#21262d] text-[#8b949e] px-1.5 py-0.5 rounded">
              {cap}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};
