import React from 'react';

/**
 * Card Component
 * Reusable card component following Takt design system
 * Provides consistent styling, spacing, and visual hierarchy
 */
const Card = ({
  children,
  variant = 'default',     // 'default', 'elevated', 'interactive', 'accent'
  padding = 'default',     // 'sm', 'default', 'lg', 'xl'
  className = '',
  onClick,
  ...props
}) => {
  // Base card styles
  const baseStyles = 'rounded-card transition-all duration-300';
  
  // Variant styles
  const variantStyles = {
    default: 'bg-background-warm-white border border-gray-200 card-shadow',
    elevated: 'bg-background-warm-white border border-gray-200 card-shadow-hover',
    interactive: 'bg-background-warm-white border border-gray-200 card-shadow hover:card-shadow-hover cursor-pointer',
    accent: 'bg-primary-50 border border-primary-200 card-shadow',
    secondary: 'bg-secondary-50 border border-secondary-200 warm-shadow',
  };
  
  // Padding styles
  const paddingStyles = {
    sm: 'p-4',
    default: 'p-6',
    lg: 'p-8',
    xl: 'p-10',
  };
  
  // Combine all styles
  const cardClasses = [
    baseStyles,
    variantStyles[variant],
    paddingStyles[padding],
    className
  ].join(' ');
  
  const CardWrapper = onClick ? 'button' : 'div';
  
  return (
    <CardWrapper
      className={cardClasses}
      onClick={onClick}
      {...props}
    >
      {children}
    </CardWrapper>
  );
};

/**
 * CardHeader Component
 * Standardized header for cards with consistent typography and spacing
 */
export const CardHeader = ({ 
  title, 
  subtitle, 
  action,
  className = '' 
}) => (
  <div className={`flex items-center justify-between mb-6 ${className}`}>
    <div className="flex-1 min-w-0">
      {title && (
        <h3 className="heading-4 mb-1">{title}</h3>
      )}
      {subtitle && (
        <p className="body-small text-text-secondary">{subtitle}</p>
      )}
    </div>
    {action && (
      <div className="flex-shrink-0 ml-4">
        {action}
      </div>
    )}
  </div>
);

/**
 * CardContent Component
 * Main content area with proper spacing
 */
export const CardContent = ({ 
  children, 
  className = '' 
}) => (
  <div className={`${className}`}>
    {children}
  </div>
);

/**
 * CardFooter Component
 * Footer area with consistent styling and spacing
 */
export const CardFooter = ({ 
  children, 
  className = '' 
}) => (
  <div className={`mt-6 pt-4 border-t border-gray-200 ${className}`}>
    {children}
  </div>
);

/**
 * InfoCard Component
 * Specialized card for informational content with icon support
 */
export const InfoCard = ({
  icon,
  title,
  description,
  variant = 'default',
  className = ''
}) => (
  <Card variant={variant} className={className}>
    <div className="flex items-start space-x-4">
      {icon && (
        <div className="flex-shrink-0">
          <div className="w-12 h-12 bg-primary-100 rounded-card flex items-center justify-center">
            {icon}
          </div>
        </div>
      )}
      <div className="flex-1 min-w-0">
        {title && (
          <h4 className="heading-5 mb-2">{title}</h4>
        )}
        {description && (
          <p className="body-normal text-text-secondary">{description}</p>
        )}
      </div>
    </div>
  </Card>
);

/**
 * StatCard Component
 * Card for displaying statistics and metrics
 */
export const StatCard = ({
  label,
  value,
  change,
  icon,
  variant = 'default',
  className = ''
}) => (
  <Card variant={variant} className={className}>
    <div className="flex items-center justify-between">
      <div className="flex-1">
        <p className="body-small text-text-secondary mb-1">{label}</p>
        <p className="text-2xl font-bold text-text-primary">{value}</p>
        {change && (
          <p className={`body-xs mt-1 ${
            change.startsWith('+') ? 'text-green-600' : 
            change.startsWith('-') ? 'text-red-600' : 
            'text-text-muted'
          }`}>
            {change}
          </p>
        )}
      </div>
      {icon && (
        <div className="w-10 h-10 bg-primary-100 rounded-card flex items-center justify-center">
          {icon}
        </div>
      )}
    </div>
  </Card>
);

export default Card;
