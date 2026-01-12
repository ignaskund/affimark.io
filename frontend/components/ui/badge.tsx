import { HTMLAttributes, forwardRef } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
    'inline-flex items-center gap-1 rounded-full font-medium transition-colors',
    {
        variants: {
            variant: {
                default: 'bg-muted text-muted-foreground border border-border',
                success: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30',
                warning: 'bg-amber-500/20 text-amber-400 border border-amber-500/30',
                danger: 'bg-red-500/20 text-red-400 border border-red-500/30',
                info: 'bg-blue-500/20 text-blue-400 border border-blue-500/30',
                purple: 'bg-purple-500/20 text-purple-400 border border-purple-500/30',
                outline: 'bg-transparent text-foreground border border-border',
            },
            size: {
                sm: 'text-xs px-2 py-0.5',
                md: 'text-xs px-2.5 py-1',
                lg: 'text-sm px-3 py-1.5',
            },
        },
        defaultVariants: {
            variant: 'default',
            size: 'md',
        },
    }
);

export interface BadgeProps
    extends HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
    dot?: boolean;
}

const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
    ({ className, variant, size, dot, children, ...props }, ref) => {
        return (
            <span
                ref={ref}
                className={cn(badgeVariants({ variant, size, className }))}
                {...props}
            >
                {dot && (
                    <span
                        className={cn(
                            'w-1.5 h-1.5 rounded-full',
                            variant === 'success' && 'bg-emerald-400',
                            variant === 'warning' && 'bg-amber-400',
                            variant === 'danger' && 'bg-red-400',
                            variant === 'info' && 'bg-blue-400',
                            variant === 'purple' && 'bg-purple-400',
                            (!variant || variant === 'default' || variant === 'outline') && 'bg-muted-foreground'
                        )}
                        aria-hidden="true"
                    />
                )}
                {children}
            </span>
        );
    }
);

Badge.displayName = 'Badge';

export { Badge, badgeVariants };
