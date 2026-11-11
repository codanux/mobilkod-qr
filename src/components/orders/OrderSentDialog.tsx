"use client";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/Button";
interface Props { orderType: "DINE_IN" | "DELIVERY"; table: string | null; onViewOrders: () => void; onClose: () => void }
export function OrderSentDialog({ orderType, table, onViewOrders, onClose }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm bg-white rounded-3xl p-7 text-center shadow-2xl">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-5">
          <Check size={28} className="text-green-500" strokeWidth={2.5} />
        </div>
        <p className="text-[11px] font-bold tracking-widest text-slate-400 uppercase mb-1">{orderType === "DELIVERY" ? "Eve teslimat" : `Masa ${table}`}</p>
        <h2 className="text-xl font-extrabold text-slate-900 mb-2">Siparişiniz iletildi</h2>
        <p className="text-sm text-slate-500 leading-relaxed mb-7">
          Siparişiniz restorana gönderildi. Onay için bu ekranda beklemeniz gerekmiyor.
        </p>
        <div className="space-y-2">
          <Button fullWidth onClick={onViewOrders}>Siparişlerimi gör</Button>
          <Button fullWidth variant="secondary" onClick={onClose}>Menüye dön</Button>
        </div>
      </div>
    </div>
  );
}
