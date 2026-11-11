import { forwardRef, type ButtonHTMLAttributes } from "react";

export type ButtonVariant = "primary" | "secondary" | "outline" | "danger" | "dark";
export type ButtonSize = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 border font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed";

const variants: Record<ButtonVariant, string> = {
  primary:
    "bg-zinc-900 hover:bg-zinc-800 text-white border-zinc-800 dark:bg-zinc-100 dark:hover:bg-white dark:text-zinc-900 dark:border-zinc-200",
  secondary:
    "bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-zinc-200 dark:border-zinc-700",
  outline:
    "bg-white hover:bg-slate-50 text-slate-800 border-slate-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 dark:text-zinc-100 dark:border-zinc-700",
  danger:
    "bg-white hover:bg-red-50 text-red-500 border-slate-200 dark:bg-transparent dark:hover:bg-red-900/20 dark:border-zinc-700",
  dark:
    "bg-slate-900 hover:bg-slate-800 text-white border-slate-800 dark:bg-zinc-100 dark:hover:bg-white dark:text-zinc-900 dark:border-zinc-200",
};

const sizes: Record<ButtonSize, string> = {
  sm: "text-xs px-3 py-1.5 rounded-lg",
  md: "text-sm py-3 px-4 rounded-xl",
  lg: "text-sm py-3.5 px-5 rounded-2xl",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", fullWidth = false, className = "", type = "button", ...props },
  ref,
) {
  const cls = [base, variants[variant], sizes[size], fullWidth ? "w-full" : "", className]
    .filter(Boolean)
    .join(" ");
  return <button ref={ref} type={type} className={cls} {...props} />;
});
