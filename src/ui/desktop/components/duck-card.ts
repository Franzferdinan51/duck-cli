/**
 * DuckCard — Surface container component
 *
 * Dark card with border, hover glow, and consistent padding.
 */

import React from 'react';

interface DuckCardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  hoverable?: boolean;
}

export const DuckCard: React.FC<DuckCardProps> = ({
  children,
  className = '',
  onClick,
  hoverable = true,
}) => {
  return (
    <div
      onClick={onClick}
      className={`
        bg-[#161b22] border border-[#30363d] rounded-xl p-4
        ${hoverable ? 'transition-all duration-150 hover:shadow-[0_0_16px_rgba(251,191,36,0.06)]' : ''}
        ${onClick ? 'cursor-pointer' : ''}
        ${className}
      `}
    >
      {children}
    </div>
  );
};
