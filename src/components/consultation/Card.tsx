import React from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  as?: 'div' | 'section' | 'article';
}

export function Card({
  children,
  className = '',
  as: Component = 'div',
  ...props
}: CardProps) {
  return (
    <Component
      className={`bg-surface rounded-xl halo-border ${className}`}
      {...props}
    >
      {children}
    </Component>
  );
}
