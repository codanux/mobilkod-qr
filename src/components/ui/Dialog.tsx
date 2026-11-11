"use client";
import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";
import { Button } from "./Button";

interface Props {
  title?: string;
  onClose: () => void;
  children: ReactNode;
  maxWidth?: "sm" | "md" | "lg";
}

const widths = { sm: "sm:max-w-sm", md: "sm:max-w-md", lg: "sm:max-w-lg" };

export function Dialog({ title, onClose, children, maxWidth = "sm" }: Props) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm"
      onMouseDown={e => e.target === e.currentTarget && onClose()}
    >
      <div className={`w-full ${widths[maxWidth]} bg-white dark:bg-zinc-900 rounded-t-3xl sm:rounded-3xl shadow-2xl`}>
        {title && (
          <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-slate-100 dark:border-zinc-800">
            <h3 className="text-base font-extrabold text-slate-900 dark:text-zinc-100">{title}</h3>
            <Button variant="secondary" onClick={onClose} aria-label="Kapat" className="w-8 h-8 !p-0 rounded-full">
              <X size={15} />
            </Button>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
