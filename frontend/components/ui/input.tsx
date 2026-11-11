import { forwardRef, useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes, cloneElement, isValidElement, type ReactElement } from "react";
import { cn } from "@/lib/utils";

const control =
  "w-full rounded-lg border border-border-strong bg-surface px-3 text-sm text-fg placeholder:text-fg-subtle transition-colors focus:border-accent focus:outline-none focus:ring-2 focus:ring-[var(--ring)] disabled:opacity-60 aria-[invalid=true]:border-negative";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className, ...props },
  ref,
) {
  return <input ref={ref} className={cn(control, "h-9", className)} {...props} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...props }, ref) {
    return <textarea ref={ref} className={cn(control, "min-h-[72px] py-2", className)} {...props} />;
  },
);

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select(
  { className, children, ...props },
  ref,
) {
  return (
    <select
      ref={ref}
      className={cn(
        control,
        "h-9 appearance-none bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2212%22 height=%2212%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%2385847e%22 stroke-width=%222%22><path d=%22m6 9 6 6 6-6%22/></svg>')] bg-[length:14px] bg-[right_10px_center] bg-no-repeat pr-8",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
});

export const MoneyInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function MoneyInput(
  { className, ...props },
  ref,
) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-fg-subtle">₹</span>
      <Input
        ref={ref}
        inputMode="decimal"
        autoComplete="off"
        placeholder="0"
        className={cn("pl-7 tabular-nums", className)}
        {...props}
      />
    </div>
  );
});

/** Label + control + hint/error, wiring ids and aria attributes. */
export function Field({
  label,
  error,
  hint,
  children,
  className,
  optional,
}: {
  label: ReactNode;
  error?: string;
  hint?: ReactNode;
  children: ReactElement<Record<string, unknown>>;
  className?: string;
  optional?: boolean;
}) {
  const id = useId();
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  const child = isValidElement(children)
    ? cloneElement(children, {
        id: (children.props.id as string) ?? id,
        "aria-invalid": error ? true : undefined,
        "aria-describedby": describedBy,
      })
    : children;
  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={(children.props.id as string) ?? id} className="flex items-center gap-1.5 text-[13px] font-medium text-fg">
        {label}
        {optional ? <span className="text-xs font-normal text-fg-subtle">Optional</span> : null}
      </label>
      {child}
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-xs text-negative">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-xs text-fg-subtle">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function Checkbox({ label, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: ReactNode }) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-fg">
      <input type="checkbox" className="h-4 w-4 rounded border-border-strong accent-[var(--accent)]" {...props} />
      {label}
    </label>
  );
}
