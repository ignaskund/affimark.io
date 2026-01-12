'use client';

import { ReactNode } from 'react';
import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from './button';

export interface EmptyStateProps {
    icon?: LucideIcon;
    iconColor?: string;
    title: string;
    description?: string;
    action?: {
        label: string;
        onClick?: () => void;
        href?: string;
    };
    secondaryAction?: {
        label: string;
        onClick?: () => void;
        href?: string;
    };
    className?: string;
    children?: ReactNode;
}

export function EmptyState({
    icon: Icon,
    iconColor = 'text-muted-foreground',
    title,
    description,
    action,
    secondaryAction,
    className,
    children,
}: EmptyStateProps) {
    const ActionButton = action?.href ? 'a' : 'button';
    const SecondaryButton = secondaryAction?.href ? 'a' : 'button';

    return (
        <div
            className={cn(
                'flex flex-col items-center justify-center text-center py-12 px-6',
                className
            )}
        >
            {Icon && (
                <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-6">
                    <Icon className={cn('w-8 h-8', iconColor)} aria-hidden="true" />
                </div>
            )}

            <h3 className="text-xl font-semibold text-foreground mb-2">{title}</h3>

            {description && (
                <p className="text-muted-foreground max-w-md mb-6">{description}</p>
            )}

            {children}

            {(action || secondaryAction) && (
                <div className="flex flex-col sm:flex-row gap-3 mt-6">
                    {action && (
                        <Button
                            variant="primary"
                            onClick={action.onClick}
                            {...(action.href && { as: 'a', href: action.href })}
                        >
                            {action.label}
                        </Button>
                    )}
                    {secondaryAction && (
                        <Button
                            variant="secondary"
                            onClick={secondaryAction.onClick}
                            {...(secondaryAction.href && { as: 'a', href: secondaryAction.href })}
                        >
                            {secondaryAction.label}
                        </Button>
                    )}
                </div>
            )}
        </div>
    );
}

// Pre-built empty states
export function EmptyStateNoData({
    title = 'No data yet',
    description = 'Get started by adding your first item.',
    ...props
}: Partial<EmptyStateProps>) {
    return <EmptyState title={title} description={description} {...props} />;
}

export function EmptyStateError({
    title = 'Something went wrong',
    description = 'We encountered an error loading this content. Please try again.',
    action = { label: 'Try again', onClick: () => window.location.reload() },
    ...props
}: Partial<EmptyStateProps>) {
    return <EmptyState title={title} description={description} action={action} {...props} />;
}

export function EmptyStateSearch({
    title = 'No results found',
    description = 'Try adjusting your search or filters to find what you\'re looking for.',
    ...props
}: Partial<EmptyStateProps>) {
    return <EmptyState title={title} description={description} {...props} />;
}
