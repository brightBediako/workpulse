import { ButtonHTMLAttributes, forwardRef } from "react";

type Variant = "primary" | "conversion" | "outline" | "ghost";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  loading?: boolean;
};

const styles: Record<Variant, string> = {
  primary:
    "bg-primary-container text-on-primary hover:bg-primary border border-transparent",
  conversion:
    "bg-amber-cta text-amber-cta-text hover:brightness-95 border border-transparent shadow-sm",
  outline:
    "bg-transparent text-primary-container border-2 border-primary-container hover:bg-primary-container hover:text-on-primary",
  ghost:
    "bg-transparent text-on-surface-variant hover:bg-surface-container-low border border-transparent",
};

export const Button = forwardRef<HTMLButtonElement, Props>(
  function Button(
    { variant = "primary", loading, className = "", children, disabled, ...rest },
    ref
  ) {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={`inline-flex items-center justify-center gap-sm rounded-md px-lg py-md font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed ${styles[variant]} ${className}`}
        {...rest}
      >
        {loading ? "Please wait…" : children}
      </button>
    );
  }
);
