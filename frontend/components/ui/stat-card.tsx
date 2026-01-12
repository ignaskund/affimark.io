'use client';

import { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';

export interface StatCardProps extends HTMLAttributes<HTMLDivElement> {
    title: string;
    value: string | number;
    subtitle?: string;
    icon?: LucideIcon;
    iconColor?: string;
    trend?: {
        value: number;
        label?: string;
        isPositive?: boolean;
    };
    variant?: 'default' | 'highlight' | 'warning' | 'success';
}

export function StatCard({
    title,
    value,
    subtitle,
    icon: Icon,
    iconColor = 'text-muted-foreground',
    trend,
    variant = 'default',
    className,
    ...props
}: StatCardProps) {
    return (
        <div
            className={cn(
                'rounded-xl border bg-card/80 backdrop-blur-xl border-white/5 p-6 transition-all duration-300 hover:bg-card/90',
                variant === 'highlight' && 'border-amber-500/30 bg-amber-500/5',
                variant === 'warning' && 'border-red-500/30 bg-red-500/5',
                variant === 'success' && 'border-emerald-500/30 bg-emerald-500/5',
                className
            )}
            {...props}
        >
            <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-muted-foreground truncate">
                        {title}
                    </p>
                    <p
                        className={cn(
                            'mt-2 text-3xl font-bold',
                            variant === 'highlight' && 'text-amber-400',
                            variant === 'warning' && 'text-red-400',
                            variant === 'success' && 'text-emerald-400',
                            variant === 'default' && 'text-foreground'
                        )}
                    >
                        {value}
                    </p>
                    {subtitle && (
                        <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
                    )}
                    {trend && (
                        <p
                            className={cn(
                                'mt-2 text-sm font-medium flex items-center gap-1',
                                trend.isPositive !== false ? 'text-emerald-400' : 'text-red-400'
                            )}
                        >
                            <span>
                                {trend.isPositive !== false ? '↑' : '↓'} {Math.abs(trend.value)}%
                            </span>
                            {trend.label && (
                                <span className="text-muted-foreground font-normal">
                                    {trend.label}
                                </span>
                            )}
                        </p>
                    )}
                </div>
                {Icon && (
                    <div
                        className={cn(
                            'w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ml-4',
                            variant === 'highlight' && 'bg-amber-500/20',
                            variant === 'warning' && 'bg-red-500/20',
                            variant === 'success' && 'bg-emerald-500/20',
                            variant === 'default' && 'bg-muted'
                        )}
                    >
                        <Icon
                            className={cn(
                                'w-6 h-6',
                                variant === 'highlight' && 'text-amber-400',
                                variant === 'warning' && 'text-red-400',
                                variant === 'success' && 'text-emerald-400',
                                variant === 'default' && iconColor
                            )}
                            aria-hidden="true"
                        />
                    </div>
                )}
            </div>
        </div>
    );
}
