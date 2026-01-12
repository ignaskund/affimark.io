'use client';

import { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
    variant?: 'default' | 'circular' | 'text' | 'card';
}

export function Skeleton({
    className,
    variant = 'default',
    ...props
}: SkeletonProps) {
    return (
        <div
            className={cn(
                'animate-pulse bg-muted',
                variant === 'default' && 'rounded-md',
                variant === 'circular' && 'rounded-full',
                variant === 'text' && 'rounded h-4 w-full',
                variant === 'card' && 'rounded-xl',
                className
            )}
            aria-hidden="true"
            {...props}
        />
    );
}

// Pre-built skeleton compositions
export function SkeletonCard() {
    return (
        <div className="rounded-xl border border-white/5 bg-card/80 p-6 space-y-4">
            <div className="flex items-center justify-between">
                <div className="space-y-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-8 w-32" />
                </div>
                <Skeleton className="h-12 w-12 rounded-xl" />
            </div>
        </div>
    );
}

export function SkeletonStatCard() {
    return (
        <div className="rounded-xl border border-white/5 bg-card/80 p-6">
            <div className="flex items-center justify-between">
                <div className="space-y-2 flex-1">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-8 w-28" />
                    <Skeleton className="h-4 w-16 mt-2" />
                </div>
                <Skeleton className="h-12 w-12 rounded-xl ml-4" />
            </div>
        </div>
    );
}

export function SkeletonDashboard() {
    return (
        <div className="space-y-8 animate-fade-in">
            {/* Header */}
            <div className="space-y-2">
                <Skeleton className="h-8 w-48" />
                <Skeleton className="h-4 w-64" />
            </div>

            {/* Hero Card */}
            <div className="rounded-xl border border-white/5 bg-card/80 p-8">
                <div className="flex items-center gap-6">
                    <Skeleton className="h-16 w-16 rounded-2xl" />
                    <div className="space-y-2">
                        <Skeleton className="h-10 w-40" />
                        <Skeleton className="h-4 w-32" />
                    </div>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <SkeletonStatCard />
                <SkeletonStatCard />
                <SkeletonStatCard />
            </div>

            {/* Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="rounded-xl border border-white/5 bg-card/80 p-6 space-y-4">
                    <Skeleton className="h-6 w-32" />
                    <div className="space-y-3">
                        <Skeleton className="h-12 w-full rounded-xl" />
                        <Skeleton className="h-12 w-full rounded-xl" />
                        <Skeleton className="h-12 w-full rounded-xl" />
                    </div>
                </div>
                <div className="rounded-xl border border-white/5 bg-card/80 p-6 space-y-4">
                    <Skeleton className="h-6 w-28" />
                    <div className="space-y-3">
                        <Skeleton className="h-16 w-full rounded-xl" />
                        <Skeleton className="h-16 w-full rounded-xl" />
                    </div>
                </div>
            </div>
        </div>
    );
}

export function SkeletonTable({ rows = 5 }: { rows?: number }) {
    return (
        <div className="space-y-3">
            {/* Header */}
            <div className="flex gap-4 pb-3 border-b border-border">
                <Skeleton className="h-4 w-1/4" />
                <Skeleton className="h-4 w-1/4" />
                <Skeleton className="h-4 w-1/4" />
                <Skeleton className="h-4 w-1/4" />
            </div>
            {/* Rows */}
            {Array.from({ length: rows }).map((_, i) => (
                <div key={i} className="flex gap-4 py-3">
                    <Skeleton className="h-4 w-1/4" />
                    <Skeleton className="h-4 w-1/4" />
                    <Skeleton className="h-4 w-1/4" />
                    <Skeleton className="h-4 w-1/4" />
                </div>
            ))}
        </div>
    );
}
