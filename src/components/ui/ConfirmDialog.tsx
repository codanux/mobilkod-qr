"use client";
import { Dialog } from "./Dialog";
import { Button } from "./Button";

interface Props {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export function ConfirmDialog({ title, message, confirmLabel = "Onayla", cancelLabel = "İptal", danger = false, onConfirm, onClose }: Props) {
  return (
    <Dialog onClose={onClose}>
      <div className="p-5 space-y-4">
        <div>
          <p className="text-base font-extrabold text-slate-900 dark:text-zinc-100">{title}</p>
          {message && <p className="text-sm text-slate-500 dark:text-zinc-400 mt-1">{message}</p>}
        </div>
        <div className="flex gap-2 pt-1">
          <Button variant="secondary" onClick={onClose} className="flex-1">{cancelLabel}</Button>
          <Button variant={danger ? "danger" : "primary"} onClick={() => { onConfirm(); onClose(); }} className="flex-1">
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
