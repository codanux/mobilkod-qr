"use client";
import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { getSelectedAddr, type SelectedAddr } from "@/lib/selected-address";
import type { CartLine, MenuResponse } from "@/types";
import type { User } from "@/lib/firebase";
import { money } from "@/lib/money";
import { Button } from "@/components/ui/Button";

interface Props {
  cart: CartLine[];
  cartNote: string;
  menu: MenuResponse;
  orderType: "DINE_IN" | "DELIVERY";
  busy: boolean;
  authReady: boolean;
  user: User | null;
  actionError: string;
  total: number;
  onClose: () => void;
  onChangeNote: (v: string) => void;
  onChangeQuantity: (key: string, amount: number) => void;
  onSubmitOrder: (provider: "google" | "apple") => void;
  onNavigateProfile: () => void;
}

export function CartDialog({ cart, cartNote, menu, orderType, busy, authReady, user, actionError, total, onClose, onChangeNote, onChangeQuantity, onSubmitOrder, onNavigateProfile }: Props) {
  const deliveryFee = menu.isTableQr ? 0 : menu.deliveryFee;
  const grandTotal = total + deliveryFee;
  const [selAddr, setSelAddr] = useState<SelectedAddr | null>(null);

  useEffect(() => {
    setSelAddr(getSelectedAddr());
    function handler() { setSelAddr(getSelectedAddr()); }
    window.addEventListener("qr-addr-change", handler);
    return () => window.removeEventListener("qr-addr-change", handler);
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm"
      onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="w-full sm:max-w-lg bg-white dark:bg-zinc-900 rounded-t-3xl sm:rounded-3xl max-h-[90vh] flex flex-col shadow-2xl">
        <div className="flex items-center justify-between px-5 pt-5 pb-3 shrink-0">
          <div>
            <p className="text-[11px] font-bold tracking-widest text-slate-400 dark:text-zinc-500 uppercase">{orderType === "DELIVERY" ? "Eve teslimat" : `Masa ${menu.table}`}</p>
            <h2 className="text-lg font-extrabold text-slate-900 dark:text-zinc-100">Sepetim</h2>
          </div>
          <Button variant="secondary" onClick={onClose} aria-label="Kapat" className="w-8 h-8 !p-0 rounded-full"><X size={15} /></Button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 pb-5 space-y-4">
          {cart.length === 0 ? (
            <p className="text-slate-400 text-sm text-center py-10">Sepetiniz boş.</p>
          ) : (
            <>
              <div className="space-y-1">
                {cart.map(line => (
                  <div key={line.key} className="flex items-center gap-3 py-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-900 dark:text-zinc-100 truncate">{line.product.name}</p>
                      {line.choiceNames.length > 0 && <p className="text-xs text-slate-400 dark:text-zinc-500 truncate">{line.choiceNames.join(" · ")}</p>}
                      <p className="text-sm font-bold text-slate-800 dark:text-zinc-200 mt-0.5">{money.format(line.unitPrice * line.quantity)}</p>
                    </div>
                    <div className="flex items-center border border-slate-200 dark:border-zinc-700 rounded-xl shrink-0">
                      <Button variant="outline" aria-label="Azalt" onClick={() => onChangeQuantity(line.key, -1)} className="w-8 h-9 !p-0 !rounded-r-none !border-0 text-lg">−</Button>
                      <span className="w-6 text-center text-xs font-bold dark:text-zinc-100">{line.quantity}</span>
                      <Button variant="outline" aria-label="Arttır" onClick={() => onChangeQuantity(line.key, 1)} className="w-8 h-9 !p-0 !rounded-l-none !border-0 text-lg">+</Button>
                    </div>
                  </div>
                ))}
              </div>

              <label className="block">
                <span className="text-xs font-semibold text-slate-400 dark:text-zinc-500 uppercase tracking-wide mb-1.5 block">Sipariş notu</span>
                <textarea maxLength={200} value={cartNote} onChange={e => onChangeNote(e.target.value)} rows={2}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 text-sm text-slate-900 dark:text-zinc-100 bg-slate-50 dark:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-900/20 dark:focus:ring-zinc-100/20 focus:border-zinc-900 dark:focus:border-zinc-400 focus:bg-white dark:focus:bg-zinc-700 resize-none transition-colors"
                  placeholder="Restorana not…" />
              </label>

              <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-zinc-800">
                <div className="flex justify-between text-sm text-slate-500 dark:text-zinc-400"><span>Ürünler</span><span>{money.format(total)}</span></div>
                {!menu.isTableQr && deliveryFee > 0 && (
                  <div className="flex justify-between text-sm text-slate-500 dark:text-zinc-400"><span>Teslimat</span><span>{money.format(deliveryFee)}</span></div>
                )}
                <div className="flex justify-between text-base font-bold text-slate-900 dark:text-zinc-100 pt-1 border-t border-slate-100 dark:border-zinc-800">
                  <span>Toplam</span><span>{money.format(grandTotal)}</span>
                </div>
              </div>

              {orderType === "DELIVERY" && !(user && selAddr?.id) && (
                <div className="bg-slate-50 dark:bg-zinc-800 rounded-xl p-3 text-xs text-slate-500 dark:text-zinc-400">
                  Teslimat için Bilgilerim'de adres ve telefon kayıtlı olmalıdır.{" "}
                  <Button size="sm" variant="outline" onClick={onNavigateProfile}>Bilgilerime git</Button>
                </div>
              )}

              {actionError && <p className="text-sm text-red-600 bg-red-50 dark:bg-red-900/20 rounded-xl px-3 py-2" role="alert">{actionError}</p>}

              {!authReady ? (
                <p className="text-xs text-slate-400 dark:text-zinc-500 text-center py-2">Oturum kontrol ediliyor…</p>
              ) : user ? (
                <Button fullWidth onClick={() => onSubmitOrder("google")} disabled={busy}>
                  {busy ? "İşleniyor…" : "Siparişi ver"}
                </Button>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-slate-400 dark:text-zinc-500 text-center">Sipariş için giriş yapın</p>
                  <Button fullWidth onClick={() => onSubmitOrder("google")} disabled={busy}>
                    Google ile siparişi ver
                  </Button>
                  <Button fullWidth variant="dark" onClick={() => onSubmitOrder("apple")} disabled={busy}>
                    Apple ile siparişi ver
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
