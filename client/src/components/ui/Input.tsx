import { InputHTMLAttributes, forwardRef } from "react";

type Props = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
  hint?: string;
};

export const Input = forwardRef<HTMLInputElement, Props>(function Input(
  { label, error, hint, className = "", id, ...rest },
  ref
) {
  const inputId = id || rest.name || label.replace(/\s+/g, "-").toLowerCase();
  return (
    <div className="space-y-xs">
      <label
        htmlFor={inputId}
        className="font-label-caps text-on-surface-variant block"
      >
        {label}
      </label>
      <input
        ref={ref}
        id={inputId}
        className={`w-full h-12 bg-surface-container-low border rounded-md px-md font-sans text-[15px] focus:outline-none focus:ring-1 transition-all ${
          error
            ? "border-error focus:border-error focus:ring-error"
            : "border-outline-variant focus:border-primary-container focus:ring-primary-container"
        } ${className}`}
        {...rest}
      />
      {error ? (
        <p className="font-body-dense text-error">{error}</p>
      ) : hint ? (
        <p className="font-body-dense text-on-surface-variant">{hint}</p>
      ) : null}
    </div>
  );
});
