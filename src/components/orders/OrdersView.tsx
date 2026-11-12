"use client";
import { useEffect, useState } from "react";
import { ClipboardList, UtensilsCrossed, ChevronRight, Bike, Store } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { customerRequest } from "@/lib/api";
import type { CustomerOrder } from "@/types";
import { money } from "@/lib/money";
import { SignInButtons } from "@/components/auth/SignInButtons";
import { OrderDetailDialog } from "@/components/orders/OrderDetailDialog";

const STATUS: Record<CustomerOrder["status"], string> = {
  PENDING: "İletildi", CLAIMED: "Restoran aldı", RECEIVED: "Restorana iletildi",
  FEE_CONFIRMATION: "Ücret onayı bekliyor", FEE_ACCEPTED: "Ücret kabul edildi",
  FEE_CANCELLED: "İptal edildi", APPROVED: "Onaylandı", REJECTED: "Reddedildi", PAID: "Ödendi",
};

function statusColor(s: CustomerOrder["status"]) {
  if (s === "APPROVED" || s === "PAID" || s === "FEE_ACCEPTED") return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
  if (s === "REJECTED" || s === "FEE_CANCELLED") return "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400";
  return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400";
}

function accentColor(s: CustomerOrder["status"]) {
  if (s === "APPROVED" || s === "PAID" || s === "FEE_ACCEPTED") return "bg-green-500";
  if (s === "REJECTED" || s === "FEE_CANCELLED") return "bg-red-500";
  return "bg-amber-400";
}

interface Props { token?: string | null; restaurantName?: string }

export function OrdersView({ token, restaurantName }: Props) {
  const { user, ready } = useAuth();
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let active = true;
    setLoading(true);
    const load = () => customerRequest<{ orders: CustomerOrder[] }>(user, "/m/account/history/orders")
      .then(r => { if (active) { setOrders(r.orders); setError(""); } })
      .catch(e => { if (active) setError(e instanceof Error ? e.message : "Siparişler alınamadı."); })
      .finally(() => { if (active) setLoading(false); });
    void load();
    const timer = setInterval(() => { if (!document.hidden) void load(); }, 5000);
    const onVis = () => { if (!document.hidden) void load(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { active = false; clearInterval(timer); document.removeEventListener("visibilitychange", onVis); };
  }, [user]);

  if (!ready) return <div className="max-w-2xl mx-auto px-4 py-12 text-center"><p className="text-slate-400 dark:text-zinc-500 text-sm">Yükleniyor…</p></div>;

  if (!user) return (
    <div className="max-w-2xl mx-auto px-4 py-14 flex flex-col items-center gap-4">
      <div className="text-center">
        <ClipboardList size={32} className="mx-auto mb-2 text-slate-300 dark:text-zinc-600" />
        <p className="font-semibold text-slate-800 dark:text-zinc-200 mb-1">Siparişlerinizi görüntüleyin</p>
        <p className="text-sm text-slate-500 dark:text-zinc-400">Giriş yaparak sipariş geçmişinize ulaşın.</p>
      </div>
      <SignInButtons />
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto px-4 py-4">
      <h1 className="text-xl font-extrabold text-slate-900 dark:text-zinc-100 mb-4">Siparişlerim</h1>
      {loading && orders.length === 0 && (
        <div className="space-y-3">
          {[0, 1, 2].map(i => <div key={i} className="h-24 rounded-2xl bg-slate-100 dark:bg-zinc-800 animate-pulse" />)}
        </div>
      )}
      {error && <p className="text-sm text-red-600 bg-red-50 dark:bg-red-900/20 rounded-xl px-3 py-2">{error}</p>}
      {!loading && orders.length === 0 && !error && (
        <div className="text-center py-16 bg-white dark:bg-zinc-900 rounded-2xl border border-dashed border-slate-200 dark:border-zinc-800">
          <UtensilsCrossed size={32} className="mx-auto mb-3 text-slate-300 dark:text-zinc-600" />
          <p className="font-semibold text-slate-700 dark:text-zinc-300 text-sm">Henüz sipariş yok</p>
          <p className="text-slate-400 dark:text-zinc-500 text-xs mt-1">Verdiğiniz siparişler burada görünecek.</p>
        </div>
      )}
      <div className="space-y-3">
        {orders.map(order => (
          <div key={order.id} role="button" tabIndex={0}
            onClick={() => setSelectedId(order.id)}
            onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSelectedId(order.id); } }}
            className="relative overflow-hidden bg-white dark:bg-zinc-900 rounded-2xl border border-slate-100 dark:border-zinc-800 pl-5 pr-4 py-4 shadow-sm cursor-pointer hover:shadow-md hover:border-zinc-200 dark:hover:border-zinc-700 active:scale-[0.99] transition-all">
            <span className={`absolute left-0 top-0 bottom-0 w-1 ${accentColor(order.status)}`} />
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-bold text-slate-900 dark:text-zinc-100 text-sm truncate">{order.restaurantName ?? restaurantName ?? "Restoran"}</p>
                <p className="flex items-center gap-1 text-xs text-slate-400 dark:text-zinc-500 mt-0.5">
                  {order.orderType === "DELIVERY" ? <Bike size={12} className="shrink-0" /> : <Store size={12} className="shrink-0" />}
                  {order.orderType === "DELIVERY" ? "Eve teslimat" : `Masa ${order.tableName ?? "QR"}`}
                  <span>·</span>
                  {new Date(order.createdAt).toLocaleString("tr-TR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
              <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full shrink-0 ${statusColor(order.status)}`}>{STATUS[order.status]}</span>
            </div>
            <p className="text-xs text-slate-500 dark:text-zinc-400 leading-relaxed mt-2.5 line-clamp-2">
              {order.items.slice(0, 3).map(i => `${i.quantity}× ${i.productName ?? "Ürün"}`).join(" · ")}{order.items.length > 3 ? ` · +${order.items.length - 3} ürün` : ""}
            </p>
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100 dark:border-zinc-800">
              <p className="text-sm font-extrabold text-slate-900 dark:text-zinc-100">{order.amount !== null ? money.format(order.amount) : ""}</p>
              <span className="flex items-center gap-0.5 text-xs font-semibold text-slate-400 dark:text-zinc-500">Detay<ChevronRight size={14} /></span>
            </div>
          </div>
        ))}
      </div>
      {(() => {
        const sel = orders.find(o => o.id === selectedId);
        return sel ? (
          <OrderDetailDialog
            order={sel}
            statusLabel={STATUS[sel.status]}
            statusClass={statusColor(sel.status)}
            restaurantName={sel.restaurantName ?? restaurantName ?? "Restoran"}
            onClose={() => setSelectedId(null)}
          />
        ) : null;
      })()}
    </div>
  );
}
