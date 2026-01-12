'use client';

import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from './button';

interface ErrorBoundaryProps {
    children: ReactNode;
    fallback?: ReactNode;
    onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface ErrorBoundaryState {
    hasError: boolean;
    error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
    constructor(props: ErrorBoundaryProps) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): ErrorBoundaryState {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('ErrorBoundary caught an error:', error, errorInfo);
        this.props.onError?.(error, errorInfo);
    }

    handleRetry = () => {
        this.setState({ hasError: false, error: null });
    };

    render() {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback;
            }

            return (
                <ErrorFallback
                    error={this.state.error}
                    onRetry={this.handleRetry}
                />
            );
        }

        return this.props.children;
    }
}

interface ErrorFallbackProps {
    error: Error | null;
    onRetry?: () => void;
}

export function ErrorFallback({ error, onRetry }: ErrorFallbackProps) {
    return (
        <div className="flex flex-col items-center justify-center min-h-[400px] p-8 text-center">
            <div className="w-16 h-16 rounded-2xl bg-red-500/20 flex items-center justify-center mb-6">
                <AlertTriangle className="w-8 h-8 text-red-400" aria-hidden="true" />
            </div>

            <h2 className="text-xl font-semibold text-foreground mb-2">
                Something went wrong
            </h2>

            <p className="text-muted-foreground max-w-md mb-6">
                We encountered an unexpected error. This has been logged and we'll look into it.
            </p>

            {process.env.NODE_ENV === 'development' && error && (
                <details className="mb-6 w-full max-w-lg text-left">
                    <summary className="text-sm text-muted-foreground cursor-pointer hover:text-foreground">
                        Error details (dev only)
                    </summary>
                    <pre className="mt-2 p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-400 overflow-auto">
                        {error.message}
                        {'\n\n'}
                        {error.stack}
                    </pre>
                </details>
            )}

            <div className="flex gap-3">
                {onRetry && (
                    <Button variant="primary" onClick={onRetry} leftIcon={<RefreshCw className="w-4 h-4" />}>
                        Try again
                    </Button>
                )}
                <Button
                    variant="secondary"
                    onClick={() => window.location.reload()}
                >
                    Reload page
                </Button>
            </div>
        </div>
    );
}

// Hook for using error boundary in functional components
export function withErrorBoundary<P extends object>(
    WrappedComponent: React.ComponentType<P>,
    fallback?: ReactNode
) {
    return function WithErrorBoundary(props: P) {
        return (
            <ErrorBoundary fallback={fallback}>
                <WrappedComponent {...props} />
            </ErrorBoundary>
        );
    };
}
