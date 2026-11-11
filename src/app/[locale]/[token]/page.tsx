import { notFound } from "next/navigation";
import { request } from "@/lib/api";
import type { MenuResponse } from "@/types";
import { MenuView } from "@/components/menu/MenuView";
import { CartProvider } from "@/context/CartContext";
import type { Metadata } from "next";

async function fetchMenu(token: string): Promise<MenuResponse | null> {
  try {
    return await request<MenuResponse>(`/m/${encodeURIComponent(token)}/menu`, { next: { revalidate: 30 } });
  } catch { return null; }
}

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const { token } = await params;
  const menu = await fetchMenu(token);
  if (!menu) return { title: "Menü bulunamadı | Mobilkod" };
  return {
    title: `${menu.shop} | QR Menü`,
    description: `${menu.shop} için QR menü ve online sipariş.`,
  };
}

export default async function MenuPage({ params }: { params: Promise<{ locale: string; token: string }> }) {
  const { token } = await params;
  const menu = await fetchMenu(token);
  if (!menu) notFound();
  return (
    <CartProvider>
      <MenuView menu={menu} token={token} />
    </CartProvider>
  );
}
