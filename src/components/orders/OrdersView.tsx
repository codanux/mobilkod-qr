"use client";
import { useEffect, useState } from "react";
import { ClipboardList, UtensilsCrossed } from "lucide-react";
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
  if (s === "APPROVED" || s === "PAID" || s === "FEE_ACCEPTED") return "bg-green-100 text-green-700";
  if (s === "REJECTED" || s === "FEE_CANCELLED") return "bg-red-100 text-red-600";
  return "bg-slate-100 text-slate-600";
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
      {loading && orders.length === 0 && <p className="text-slate-400 dark:text-zinc-500 text-sm">Yükleniyor…</p>}
      {error && <p className="text-sm text-red-600 bg-red-50 dark:bg-red-900/20 rounded-xl px-3 py-2">{error}</p>}
      {!loading && orders.length === 0 && !error && (
        <div className="text-center py-12"><UtensilsCrossed size={32} className="mx-auto mb-3 text-slate-300 dark:text-zinc-600" /><p className="text-slate-400 dark:text-zinc-500 text-sm">Henüz sipariş verilmedi.</p></div>
      )}
      <div className="space-y-3">
        {orders.map(order => (
          <div key={order.id} role="button" tabIndex={0}
            onClick={() => setSelectedId(order.id)}
            onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSelectedId(order.id); } }}
            className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-100 dark:border-zinc-800 p-4 shadow-sm cursor-pointer hover:border-zinc-200 dark:hover:border-zinc-700 transition-colors">
            <div className="flex items-start justify-between gap-2 mb-2">
              <div>
                <p className="font-bold text-slate-900 dark:text-zinc-100 text-sm">{order.restaurantName ?? restaurantName ?? "Restoran"}</p>
                <p className="text-xs text-slate-400 dark:text-zinc-500 mt-0.5">{new Date(order.createdAt).toLocaleString("tr-TR")} · {order.orderType === "DELIVERY" ? "Eve teslimat" : `Masa ${order.tableName ?? "QR"}`}</p>
              </div>
              <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full shrink-0 ${statusColor(order.status)}`}>{STATUS[order.status]}</span>
            </div>
            <p className="text-xs text-slate-500 dark:text-zinc-400 leading-relaxed">
              {order.items.slice(0, 3).map(i => `${i.quantity}× ${i.productName ?? "Ürün"}`).join(" · ")}{order.items.length > 3 ? ` · +${order.items.length - 3} ürün` : ""}
            </p>
            {order.amount !== null && <p className="text-sm font-extrabold text-slate-900 dark:text-zinc-100 mt-2">{money.format(order.amount)}</p>}
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
