import { request } from "@/lib/api";
import type { Restaurant } from "@/types";
import { HomeTopBar } from "@/components/layout/HomeTopBar";
import { RestaurantSection } from "@/components/home/RestaurantSection";

const PORTAL = (process.env.NEXT_PUBLIC_PORTAL_URL ?? "").replace(/\/+$/, "");

async function getRestaurants(): Promise<Restaurant[]> {
  try {
    const data = await request<{ restaurants: Restaurant[] }>("/m/restaurants", { next: { revalidate: 60 } });
    return data.restaurants;
  } catch { return []; }
}

export default async function HomePage() {
  const restaurants = await getRestaurants();
  return (
    <main className="min-h-screen bg-slate-50 dark:bg-zinc-950 pb-20 sm:pb-0">
      <HomeTopBar />
      <div className="max-w-5xl mx-auto px-4 py-6">
        <div className="bg-zinc-900 text-white rounded-2xl p-6 mb-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <p className="font-extrabold text-lg">Restoranınızı Mobilkod'a ekleyin</p>
            <p className="text-sm text-zinc-400 mt-1">POS uygulamasını indirin, siparişleri kabul etmeye başlayın.</p>
          </div>
          <a href={`${PORTAL}/register`}
            className="shrink-0 bg-white text-zinc-900 font-bold text-sm px-5 py-2.5 rounded-xl hover:bg-zinc-100 transition-colors whitespace-nowrap">
            Ücretsiz Kaydol →
          </a>
        </div>
        <h1 className="text-xl font-extrabold text-slate-900 dark:text-zinc-100 mb-4">Mekanlar</h1>
        <RestaurantSection restaurants={restaurants} />
      </div>
    </main>
  );
}
