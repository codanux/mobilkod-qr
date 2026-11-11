"use client";
import { useEffect, useState } from "react";
import { Link } from "@/i18n/navigation";
import { haversineKm, deliveryFeeForKm } from "@/lib/location";
import { getSelectedAddr, type SelectedAddr } from "@/lib/selected-address";
import { money } from "@/lib/money";
import type { Restaurant } from "@/types";

interface Props { restaurants: Restaurant[] }

function fmtFee(r: Restaurant, sel: SelectedAddr | null): string {
  if (!r.deliveryEnabled) return "";
  if (sel && r.deliveryPerKm && r.deliveryOriginLatitude != null && r.deliveryOriginLongitude != null) {
    const dist = haversineKm(r.deliveryOriginLatitude, r.deliveryOriginLongitude, sel.lat, sel.lng);
    const fee = deliveryFeeForKm(r.deliveryPerKm, dist);
    return `${dist.toFixed(1)} km · ${fee > 0 ? money.format(fee) : "Ücretsiz teslimat"}`;
  }
  const fee = r.deliveryFee > 0 ? `Teslimat: ${money.format(r.deliveryFee)}` : "Ücretsiz teslimat";
  return r.deliveryMinimumOrder > 0 ? `${fee} · Min. ${money.format(r.deliveryMinimumOrder)}` : fee;
}

function distKm(r: Restaurant, sel: SelectedAddr): number | null {
  if (!r.deliveryOriginLatitude || !r.deliveryOriginLongitude) return null;
  return haversineKm(r.deliveryOriginLatitude, r.deliveryOriginLongitude, sel.lat, sel.lng);
}

export function RestaurantSection({ restaurants }: Props) {
  const [sel, setSel] = useState<SelectedAddr | null>(null);

  // Load initial selection from localStorage
  useEffect(() => { setSel(getSelectedAddr()); }, []);

  // React to TopBar address changes
  useEffect(() => {
    function handler(e: Event) {
      setSel((e as CustomEvent<SelectedAddr | null>).detail);
    }
    window.addEventListener("qr-addr-change", handler);
    return () => window.removeEventListener("qr-addr-change", handler);
  }, []);

  const sorted = sel
    ? [...restaurants].sort((a, b) => (distKm(a, sel) ?? 999) - (distKm(b, sel) ?? 999))
    : restaurants;

  return (
    <div>
      {sorted.length === 0 && (
        <p className="text-slate-400 dark:text-zinc-500 text-sm py-12 text-center">Mekan bulunamadı.</p>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {sorted.map(r => (
          <Link key={r.id} href={{ pathname: "/[token]", params: { token: r.id } }}
            className="flex items-center gap-3 bg-white dark:bg-zinc-900 rounded-2xl border border-slate-100 dark:border-zinc-800 p-4 hover:shadow-sm hover:border-zinc-200 dark:hover:border-zinc-700 transition-all">
            <div className="flex-1 min-w-0">
              <p className="font-bold text-slate-900 dark:text-zinc-100">{r.name}</p>
              {r.address && <p className="text-xs text-slate-400 dark:text-zinc-500 mt-0.5 truncate">{r.address}</p>}
              {r.deliveryEnabled && (
                <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">{fmtFee(r, sel)}</p>
              )}
            </div>
            <span className="text-slate-300 dark:text-zinc-600 text-lg shrink-0">›</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
