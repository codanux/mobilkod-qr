"use client";
import { useRef } from "react";
import { X, ShoppingCart } from "lucide-react";
import type { Product } from "@/types";
import { priceFor } from "@/lib/geo";
import { money } from "@/lib/money";
import { Button } from "@/components/ui/Button";

interface Props {
  product: Product;
  options: Record<string, string[]>;
  quantity: number;
  note: string;
  error: string;
  onChangeOptions: React.Dispatch<React.SetStateAction<Record<string, string[]>>>;
  onChangeQuantity: React.Dispatch<React.SetStateAction<number>>;
  onChangeNote: (v: string) => void;
  onClearError: () => void;
  onClose: () => void;
  onAddToCart: () => void;
}

export function ProductDialog({ product, options, quantity, note, error, onChangeOptions, onChangeQuantity, onChangeNote, onClearError, onClose, onAddToCart }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const selected = Object.values(options).flat();
  const price = priceFor(product, selected) * quantity;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-sm"
      onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="w-full sm:max-w-lg bg-white dark:bg-zinc-900 rounded-t-3xl sm:rounded-3xl max-h-[92vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 shrink-0">
          <p className="text-[11px] font-bold tracking-widest text-slate-400 dark:text-zinc-500 uppercase">Size özel hazırlanır</p>
          <Button variant="secondary" onClick={onClose} aria-label="Kapat" className="w-8 h-8 !p-0 rounded-full"><X size={15} /></Button>
        </div>
        {/* Scroll area */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 pb-4 space-y-1">
          {error && <p className="text-sm text-red-600 bg-red-50 dark:bg-red-900/20 rounded-xl px-3 py-2 mb-2" role="alert">{error}</p>}
          <h2 className="text-xl font-extrabold text-slate-900 dark:text-zinc-100 leading-tight">{product.name}</h2>
          {product.description && <p className="text-sm text-slate-500 dark:text-zinc-400 leading-relaxed">{product.description}</p>}
          <p className="text-sm text-slate-400 dark:text-zinc-500">{money.format(product.price)} başlayan fiyat</p>
          {product.groups.map(group => {
            const cur = options[group.id] ?? [];
            return (
              <fieldset key={group.id} className="mt-5 border-0 p-0">
                <legend className="w-full flex items-baseline gap-2 mb-2">
                  <span className="font-bold text-sm text-slate-900 dark:text-zinc-100">{group.name}</span>
                  <span className="text-[11px] text-slate-400 dark:text-zinc-500 ml-auto">{group.min > 0 ? "Zorunlu" : "İsteğe bağlı"}{group.max > 1 ? ` · max ${group.max}` : ""}</span>
                </legend>
                <div className="space-y-1.5">
                  {group.options.map(opt => {
                    const checked = cur.includes(opt.id);
                    return (
                      <label key={opt.id} className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 dark:border-zinc-800 hover:border-zinc-200 dark:hover:border-zinc-700 cursor-pointer transition-colors">
                        <input
                          type={group.max === 1 ? "radio" : "checkbox"}
                          name={`g-${group.id}`}
                          checked={checked}
                          className="accent-zinc-900 w-4 h-4"
                          onChange={() => {
                            onClearError();
                            onChangeOptions(prev => {
                              const chosen = prev[group.id] ?? [];
                              const next = checked ? chosen.filter(id => id !== opt.id) : group.max === 1 ? [opt.id] : chosen.length < group.max ? [...chosen, opt.id] : chosen;
                              return { ...prev, [group.id]: next };
                            });
                          }}
                        />
                        <span className="flex-1 text-sm text-slate-800 dark:text-zinc-200">{opt.name}</span>
                        <span className="text-xs text-slate-400 dark:text-zinc-500">{opt.abs !== null ? money.format(opt.abs) : opt.delta ? `+${money.format(opt.delta)}` : "Dahil"}</span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>
            );
          })}
          {(product.slots ?? []).map(slot => {
            const cur = options[slot.id] ?? [];
            return (
              <fieldset key={slot.id} className="mt-5 border-0 p-0">
                <legend className="w-full flex items-baseline gap-2 mb-2">
                  <span className="font-bold text-sm text-slate-900 dark:text-zinc-100">{slot.name}</span>
                  <span className="text-[11px] text-slate-400 dark:text-zinc-500 ml-auto">{slot.required ? "Zorunlu" : "İsteğe bağlı"}</span>
                </legend>
                <div className="space-y-1.5">
                  {slot.options.map(opt => (
                    <label key={opt.id} className={`flex items-center gap-3 p-3 rounded-xl border border-slate-100 dark:border-zinc-800 transition-colors ${opt.soldOut ? "opacity-40" : "hover:border-zinc-200 dark:hover:border-zinc-700 cursor-pointer"}`}>
                      <input type="radio" name={`s-${slot.id}`} checked={cur.includes(opt.id)} disabled={opt.soldOut}
                        className="accent-zinc-900 w-4 h-4"
                        onChange={() => { onClearError(); onChangeOptions(prev => ({ ...prev, [slot.id]: [opt.id] })); }} />
                      <span className="flex-1 text-sm text-slate-800 dark:text-zinc-200">{opt.name}</span>
                      <span className="text-xs text-slate-400 dark:text-zinc-500">{opt.soldOut ? "Tükendi" : opt.upcharge ? `+${money.format(opt.upcharge)}` : "Dahil"}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            );
          })}
          <label className="block mt-5">
            <span className="text-xs font-semibold text-slate-500 dark:text-zinc-400 uppercase tracking-wide mb-1.5 block">Ürün notu</span>
            <input value={note} maxLength={120} onChange={e => onChangeNote(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 text-sm text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-900/20 dark:focus:ring-zinc-100/20 focus:border-zinc-900 dark:focus:border-zinc-400 bg-slate-50 dark:bg-zinc-800 focus:bg-white dark:focus:bg-zinc-700 transition-colors"
              placeholder="Örn. az tuzlu" />
          </label>
        </div>
        {/* Footer */}
        <div className="px-5 py-4 border-t border-slate-100 dark:border-zinc-800 flex items-center gap-3 shrink-0">
          <div className="flex items-center border border-slate-200 dark:border-zinc-700 rounded-xl">
            <Button variant="outline" aria-label="Azalt" onClick={() => onChangeQuantity(q => Math.max(1, q - 1))} className="w-10 h-11 !p-0 !rounded-r-none !border-0 text-xl">−</Button>
            <span className="w-8 text-center text-sm font-bold dark:text-zinc-100">{quantity}</span>
            <Button variant="outline" aria-label="Arttır" onClick={() => onChangeQuantity(q => Math.min(20, q + 1))} className="w-10 h-11 !p-0 !rounded-l-none !border-0 text-xl">+</Button>
          </div>
          <Button onClick={onAddToCart} className="flex-1 justify-between">
            <span className="flex items-center gap-2"><ShoppingCart size={15} />Sepete ekle</span>
            <span>{money.format(price)}</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
