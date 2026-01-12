'use client';

import { forwardRef, InputHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    error?: string;
    hint?: string;
    leftIcon?: ReactNode;
    rightIcon?: ReactNode;
    variant?: 'default' | 'glow';
}

const Input = forwardRef<HTMLInputElement, InputProps>(
    (
        {
            className,
            type = 'text',
            label,
            error,
            hint,
            leftIcon,
            rightIcon,
            variant = 'default',
            id,
            ...props
        },
        ref
    ) => {
        const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');

        return (
            <div className="w-full">
                {label && (
                    <label
                        htmlFor={inputId}
                        className="block text-sm font-medium text-foreground mb-2"
                    >
                        {label}
                    </label>
                )}
                <div className="relative">
                    {leftIcon && (
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                            {leftIcon}
                        </div>
                    )}
                    <input
                        type={type}
                        id={inputId}
                        ref={ref}
                        className={cn(
                            'w-full rounded-xl border bg-secondary text-foreground placeholder:text-muted-foreground',
                            'focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50',
                            'transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed',
                            variant === 'default' && 'border-border px-4 py-3',
                            variant === 'glow' && 'border-border/50 px-4 py-3 focus:shadow-[0_0_20px_rgba(192,88,0,0.2)]',
                            leftIcon && 'pl-10',
                            rightIcon && 'pr-10',
                            error && 'border-red-500/50 focus:ring-red-500/50 focus:border-red-500/50',
                            className
                        )}
                        aria-invalid={error ? 'true' : 'false'}
                        aria-describedby={
                            error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined
                        }
                        {...props}
                    />
                    {rightIcon && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                            {rightIcon}
                        </div>
                    )}
                </div>
                {error && (
                    <p id={`${inputId}-error`} className="mt-2 text-sm text-red-400" role="alert">
                        {error}
                    </p>
                )}
                {hint && !error && (
                    <p id={`${inputId}-hint`} className="mt-2 text-sm text-muted-foreground">
                        {hint}
                    </p>
                )}
            </div>
        );
    }
);

Input.displayName = 'Input';

export { Input };
