'use client';

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const cardVariants = cva(
  'rounded-xl border transition-all duration-300',
  {
    variants: {
      variant: {
        default: 'bg-card/80 backdrop-blur-xl border-white/5',
        solid: 'bg-card border-border',
        ghost: 'bg-transparent border-transparent',
        glass: 'bg-card/80 backdrop-blur-xl border-white/5',
        success: 'bg-emerald-500/10 border-emerald-500/30',
        warning: 'bg-amber-500/10 border-amber-500/30',
        danger: 'bg-red-500/10 border-red-500/30',
      },
      padding: {
        none: 'p-0',
        sm: 'p-4',
        md: 'p-6',
        lg: 'p-8',
      },
    },
    defaultVariants: {
      variant: 'default',
      padding: 'md',
    },
  }
);

export interface CardProps
  extends React.HTMLAttributes<HTMLDivElement>,
  VariantProps<typeof cardVariants> {
  hover?: boolean;
}

export function Card({ className, variant, padding, hover, ...props }: CardProps) {
  return (
    <div
      className={cn(
        cardVariants({ variant, padding }),
        hover && 'hover:bg-card/90 hover:border-white/10 cursor-pointer',
        className
      )}
      {...props}
    />
  );
}

export function CardHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex flex-col space-y-1.5 mb-4', className)} {...props} />;
}

export function CardTitle({
  className,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3 className={cn('text-lg font-semibold text-foreground', className)} {...props} />
  );
}

export function CardDescription({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={cn('text-sm text-muted-foreground', className)} {...props} />
  );
}

export function CardContent({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('', className)} {...props} />;
}

export function CardFooter({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex items-center pt-4 mt-4 border-t border-border', className)} {...props} />;
}

export { cardVariants };
