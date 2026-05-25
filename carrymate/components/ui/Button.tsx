import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';
import LoadingSpinner from './LoadingSpinner';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', loading, disabled, children, ...props }, ref) => {
    const variants = {
      primary: 'bg-brand-primary text-white hover:bg-brand-secondary',
      secondary: 'bg-brand-secondary text-white hover:bg-brand-accent',
      danger: 'bg-brand-danger text-white hover:opacity-90',
      ghost: 'bg-transparent hover:bg-brand-light text-brand-primary',
      outline: 'border-2 border-brand-primary text-brand-primary hover:bg-brand-light',
    };
    const sizes = {
      sm: 'px-3 py-1.5 text-sm',
      md: 'px-4 py-2 text-sm',
      lg: 'px-6 py-3 text-base',
    };
    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
          variants[variant],
          sizes[size],
          className
        )}
        disabled={disabled || loading}
        {...props}
      >
        {loading && <LoadingSpinner size="sm" />}
        {children}
      </button>
    );
  }
);
Button.displayName = 'Button';
export default Button;
