import { OrdersView } from "@/components/orders/OrdersView";
import { HomeTopBar } from "@/components/layout/HomeTopBar";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Siparişlerim | Mobilkod", robots: "noindex" };

export default function OrdersPage() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 pb-20">
      <HomeTopBar activeTab="orders" />
      <OrdersView />
    </div>
  );
}
