"use client";
import { useEffect } from "react";
import { X } from "lucide-react";
import type { CustomerOrder } from "@/types";
import { money } from "@/lib/money";

interface Props {
  order: CustomerOrder;
  statusLabel: string;
  statusClass: string;
  restaurantName: string;
  onClose: () => void;
}

function fmt(d: string | null) {
  return d ? new Date(d).toLocaleString("tr-TR") : null;
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between gap-3 text-sm ${bold ? "font-extrabold text-slate-900 dark:text-zinc-100 pt-2 border-t border-slate-100 dark:border-zinc-800" : "text-slate-500 dark:text-zinc-400"}`}>
      <span>{label}</span><span className="text-right">{value}</span>
    </div>
  );
}

export function OrderDetailDialog({ order, statusLabel, statusClass, restaurantName, onClose }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const times: [string, string | null][] = [
    ["Sipariş verildi", fmt(order.createdAt)],
    ["Restoran aldı", fmt(order.claimedAt)],
    ["Restorana iletildi", fmt(order.receivedAt)],
    ["Karar", fmt(order.decidedAt)],
    ["Ödendi", fmt(order.paidAt)],
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm"
      onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="w-full sm:max-w-md max-h-[90vh] overflow-y-auto bg-white dark:bg-zinc-900 rounded-t-3xl sm:rounded-3xl shadow-2xl p-6 space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-bold tracking-widest text-slate-400 dark:text-zinc-500 uppercase">
              Sipariş{order.localNumber != null ? ` #${order.localNumber}` : ""}
            </p>
            <h2 className="text-lg font-extrabold text-slate-900 dark:text-zinc-100 truncate">{restaurantName}</h2>
            <p className="text-xs text-slate-400 dark:text-zinc-500 mt-0.5">
              {order.orderType === "DELIVERY" ? "Eve teslimat" : `Masa ${order.tableName ?? "QR"}`}
            </p>
          </div>
          <button onClick={onClose} aria-label="Kapat"
            className="w-8 h-8 shrink-0 rounded-full bg-slate-100 dark:bg-zinc-800 flex items-center justify-center text-slate-500 dark:text-zinc-400 hover:bg-slate-200 dark:hover:bg-zinc-700 transition-colors">
            <X size={15} />
          </button>
        </div>

        <div>
          <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${statusClass}`}>{statusLabel}</span>
          {order.reason && (
            <p className="text-sm text-red-600 bg-red-50 dark:bg-red-900/20 rounded-xl px-3 py-2 mt-3">{order.reason}</p>
          )}
        </div>

        <div className="space-y-3">
          <p className="text-xs font-semibold text-slate-400 dark:text-zinc-500 uppercase tracking-wide">Ürünler</p>
          {order.items.map((i, idx) => (
            <div key={idx} className="flex justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900 dark:text-zinc-100">{i.quantity}× {i.productName ?? "Ürün"}</p>
                {i.choiceNames && i.choiceNames.length > 0 && (
                  <p className="text-xs text-slate-400 dark:text-zinc-500">{i.choiceNames.join(" · ")}</p>
                )}
                {i.note && <p className="text-xs italic text-slate-400 dark:text-zinc-500">Not: {i.note}</p>}
              </div>
              {i.unitPrice != null && (
                <p className="text-sm font-bold text-slate-800 dark:text-zinc-200 shrink-0">{money.format(i.unitPrice * i.quantity)}</p>
              )}
            </div>
          ))}
        </div>

        <div className="space-y-1.5 pt-3 border-t border-slate-100 dark:border-zinc-800">
          {order.subtotal != null && <Row label="Ürünler" value={money.format(order.subtotal)} />}
          {order.discount != null && order.discount > 0 && <Row label="İndirim" value={`-${money.format(order.discount)}`} />}
          {order.deliveryFee != null
            ? <Row label="Teslimat" value={money.format(order.deliveryFee)} />
            : order.estimatedDeliveryFee != null && <Row label="Tahmini teslimat" value={money.format(order.estimatedDeliveryFee)} />}
          {order.deliveryDistanceKm != null && <Row label="Mesafe" value={`${order.deliveryDistanceKm.toFixed(1)} km`} />}
          {order.amount != null && <Row label="Toplam" value={money.format(order.amount)} bold />}
        </div>

        {order.paymentDetails && order.paymentDetails.length > 0 && (
          <div className="space-y-1.5 pt-3 border-t border-slate-100 dark:border-zinc-800">
            <p className="text-xs font-semibold text-slate-400 dark:text-zinc-500 uppercase tracking-wide">Ödeme</p>
            {order.paymentDetails.map((p, idx) => (
              <Row key={idx} label={`${p.method}${p.provider ? ` (${p.provider})` : ""}`} value={money.format(p.amount)} />
            ))}
          </div>
        )}

        <div className="space-y-1.5 pt-3 border-t border-slate-100 dark:border-zinc-800">
          <p className="text-xs font-semibold text-slate-400 dark:text-zinc-500 uppercase tracking-wide">Zaman çizelgesi</p>
          {times.filter((t): t is [string, string] => t[1] !== null).map(([label, value]) => (
            <Row key={label} label={label} value={value} />
          ))}
        </div>
      </div>
    </div>
  );
}
