import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  {
    variants: {
      variant: {
        default: 'border-transparent',
        secondary: 'border-transparent',
        destructive: 'border-transparent bg-destructive text-destructive-foreground',
        outline: 'text-foreground',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, style, ...props }: BadgeProps) {
  const defaultStyle =
    variant === 'default' || variant === undefined
      ? {
          background: 'rgba(197,168,128,0.15)',
          borderColor: 'rgba(197,168,128,0.3)',
          color: 'var(--theme-primary)',
          ...style,
        }
      : style;

  return (
    <div className={cn(badgeVariants({ variant }), className)} style={defaultStyle} {...props} />
  );
}

export { Badge, badgeVariants };
