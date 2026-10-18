import React from 'react';
import { cn } from '../lib/utils';

interface PageTitleProps {
  children: React.ReactNode;
  className?: string;
}

export function PageTitle({ children, className }: PageTitleProps) {
  return (
    <h1 className={cn('font-serif text-4xl md:text-5xl text-primary tracking-tight', className)}>
      {children}
    </h1>
  );
}
