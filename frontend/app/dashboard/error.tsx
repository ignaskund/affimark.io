'use client';

import { ErrorFallback } from '@/components/ui/error-boundary';

export default function DashboardError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    return <ErrorFallback error={error} onRetry={reset} />;
}
