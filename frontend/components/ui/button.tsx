import { forwardRef, ButtonHTMLAttributes, ReactNode } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 font-medium rounded-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-background disabled:opacity-50 disabled:pointer-events-none',
  {
    variants: {
      variant: {
        primary:
          'bg-gradient-to-r from-amber-700 to-orange-600 text-white hover:from-amber-600 hover:to-orange-500 shadow-lg shadow-orange-900/30 hover:shadow-orange-800/50 focus:ring-primary',
        secondary:
          'bg-secondary text-foreground border border-border hover:bg-muted hover:border-muted-foreground/20 focus:ring-secondary',
        ghost:
          'text-muted-foreground hover:text-foreground hover:bg-muted focus:ring-muted',
        danger:
          'bg-red-600 text-white hover:bg-red-500 shadow-lg shadow-red-900/30 focus:ring-red-500',
        outline:
          'border border-border text-foreground hover:bg-muted focus:ring-primary',
        link: 'text-primary underline-offset-4 hover:underline p-0',
      },
      size: {
        sm: 'text-sm px-3 py-1.5',
        md: 'text-sm px-4 py-2.5',
        lg: 'text-base px-6 py-3',
        xl: 'text-lg px-8 py-4',
        icon: 'p-2',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  }
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
  VariantProps<typeof buttonVariants> {
  isLoading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      isLoading,
      leftIcon,
      rightIcon,
      children,
      disabled,
      ...props
    },
    ref
  ) => {
    return (
      <button
        className={buttonVariants({ variant, size, className })}
        ref={ref}
        disabled={disabled || isLoading}
        {...props}
      >
        {isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
        ) : leftIcon ? (
          <span aria-hidden="true">{leftIcon}</span>
        ) : null}
        {children}
        {rightIcon && !isLoading && (
          <span aria-hidden="true">{rightIcon}</span>
        )}
      </button>
    );
  }
);

Button.displayName = 'Button';

export { Button, buttonVariants };
