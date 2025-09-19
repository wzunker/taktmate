import React from 'react';

/**
 * Takt Logo Component
 * Displays the official Takt logo with responsive sizing
 * Supports both solo (symbol only) and full (symbol + text) variants
 */
const Logo = ({ 
  variant = 'full',  // 'full' or 'solo'
  size = 'md',       // 'sm', 'md', 'lg'
  animate = false,   // Add subtle animation
  className = ''
}) => {
  // Size configurations
  const sizeClasses = {
    sm: {
      full: 'h-6',      // ~24px height for small screens
      solo: 'h-6 w-6'   // Square for solo variant
    },
    md: {
      full: 'h-8',      // ~32px height for medium screens  
      solo: 'h-8 w-8'   // Square for solo variant
    },
    lg: {
      full: 'h-12',     // ~48px height for large screens
      solo: 'h-12 w-12' // Square for solo variant
    }
  };

  const logoSrc = variant === 'solo' ? '/logo-solo.png' : '/logo-takt.png';
  const logoClass = sizeClasses[size][variant];
  const altText = variant === 'solo' ? 'Takt Logo' : 'Takt';

  return (
    <div className={`flex items-center ${className}`}>
      <img
        src={logoSrc}
        alt={altText}
        className={`${logoClass} object-contain ${animate ? 'animate-pulse' : ''} transition-all duration-300`}
        style={{ 
          filter: 'drop-shadow(0 1px 2px rgba(0, 0, 0, 0.05))',
          imageRendering: 'crisp-edges'
        }}
      />
    </div>
  );
};

/**
 * LogoWithText Component
 * Combines the Takt logo with custom text (like "TaktMate")
 * Useful for branded applications
 */
export const LogoWithText = ({ 
  text = 'TaktMate',
  subtitle = '',
  size = 'md',
  className = ''
}) => {
  const textSizeClasses = {
    sm: 'text-lg',
    md: 'text-2xl', 
    lg: 'text-3xl'
  };

  const subtitleSizeClasses = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base'
  };

  return (
    <div className={`flex items-center space-x-3 ${className}`}>
      <Logo variant="solo" size={size} />
      <div className="flex flex-col">
        <h1 className={`${textSizeClasses[size]} font-bold text-text-primary leading-none`}>
          {text}
        </h1>
        {subtitle && (
          <span className={`${subtitleSizeClasses[size]} text-text-secondary leading-none mt-0.5`}>
            {subtitle}
          </span>
        )}
      </div>
    </div>
  );
};

export default Logo;
