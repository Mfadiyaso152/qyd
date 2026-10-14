import React from 'react';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showSubtitle?: boolean;
  showWordmark?: boolean;
  variant?: 'light' | 'dark' | 'white';
  className?: string;
}

export const Logo: React.FC<LogoProps> = ({
  size = 'md',
  showSubtitle = true,
  showWordmark = true,
  variant = 'dark',
  className = '',
}) => {
  // Dimensions based on size
  const iconSizes = {
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-14 h-14',
    xl: 'w-20 h-20',
  };

  const titleSizes = {
    sm: 'text-xl',
    md: 'text-2xl',
    lg: 'text-3xl',
    xl: 'text-4xl',
  };

  const subtitleSizes = {
    sm: 'text-[10px]',
    md: 'text-xs',
    lg: 'text-sm',
    xl: 'text-base',
  };

  const textColor = variant === 'white' ? 'text-white' : 'text-[#17233D]';
  const subtitleColor = variant === 'white' ? 'text-blue-100' : 'text-slate-500';

  return (
    <div className={`flex items-center gap-3 select-none ${className}`}>
      {/* Icon Badge: Stacked rounded squares with checkmark and diacritic dot */}
      <div className={`relative shrink-0 ${iconSizes[size]}`}>
        <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full drop-shadow-sm">
          {/* Back square (soft secondary blue #85A7FB) */}
          <rect
            x="12"
            y="28"
            width="56"
            height="56"
            rx="16"
            fill="#85A7FB"
            transform="rotate(-8 40 56)"
          />

          {/* Front square (cobalt primary blue #315BEB) */}
          <rect
            x="24"
            y="20"
            width="60"
            height="60"
            rx="18"
            fill="#315BEB"
          />

          {/* Clean White Checkmark inside front square */}
          <path
            d="M39 50L49 60L69 40"
            stroke="white"
            strokeWidth="8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Diacritic dot above icon */}
          <circle
            cx="68"
            cy="15"
            r="8.5"
            fill="#315BEB"
          />
        </svg>
      </div>

      {/* Typography: "قَيد" with optional subtitle */}
      {showWordmark && (
        <div className="flex flex-col justify-center text-right leading-tight">
          <span className={`font-bold tracking-tight ${titleSizes[size]} ${textColor} font-['IBM_Plex_Sans_Arabic',sans-serif]`}>
            قَيد
          </span>
          {showSubtitle && (
            <span className={`${subtitleSizes[size]} ${subtitleColor} font-normal mt-0.5 whitespace-nowrap`}>
              كل عملية، في يومها
            </span>
          )}
        </div>
      )}
    </div>
  );
};
