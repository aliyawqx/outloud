import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

// shadcn Button, with variants remapped to Outloud's own design tokens (the
// codebase isn't a shadcn theme — our `secondary` is green, etc.) and pill shape.
const buttonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap rounded-full font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric-indigo disabled:pointer-events-none disabled:opacity-50 active:scale-95',
  {
    variants: {
      variant: {
        default: 'indigo-glow bg-electric-indigo text-white hover:-translate-y-0.5 hover:bg-primary-container',
        secondary: 'bg-surface-container-high text-on-surface hover:bg-surface-container-highest',
        outline: 'border border-border-muted text-on-surface hover:-translate-y-0.5 hover:border-electric-indigo',
        ghost: 'text-on-surface-variant hover:bg-white/[0.05] hover:text-on-surface',
        link: 'text-electric-indigo underline-offset-4 hover:underline',
        destructive: 'bg-error text-white hover:opacity-90',
      },
      size: {
        default: 'h-11 px-6 py-2.5',
        sm: 'h-9 px-4 text-sm',
        lg: 'h-14 px-8 text-lg',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
  },
)
Button.displayName = 'Button'

export { Button, buttonVariants }
