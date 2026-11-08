import { renderToStaticMarkup } from "react-dom/server";
import { RestaurantDirectoryPage } from "./pages/RestaurantDirectoryPage";
import { MenuPage } from "./pages/MenuPage";
import { BottomNav } from "./pages/BottomNav";
import type { MenuResponse, Restaurant } from "./types";

const money = new Intl.NumberFormat("tr-TR", {
  style: "currency",
  currency: "TRY",
});

export function renderPage(type: "directory" | "restaurant", data: unknown): string {
  if (type === "directory") {
    const list = Array.isArray(data)
      ? (data as Restaurant[])
      : (data && typeof data === "object" && "restaurants" in data && Array.isArray((data as { restaurants: unknown }).restaurants))
        ? ((data as { restaurants: Restaurant[] }).restaurants)
        : [];

    return renderToStaticMarkup(
      <div id="ssr-shell" className="app-shell restaurant-directory">
        <header className="topbar">
          <a className="brand" href="/" aria-label="QR Menü restoranları">
            <img className="brand-icon" src="/favicon.svg?v=2" alt="" width="40" height="40" />
            <span className="brand-copy"><strong>Mobilkod</strong><small>QR MENÜ</small></span>
          </a>
          <div className="topbar-actions">
            <button className="directory-address-cta" type="button">
              Adres seç
              <span aria-hidden="true">→</span>
            </button>
          </div>
        </header>
        <main className="directory-page directory-home">
          <RestaurantDirectoryPage
            restaurants={list}
            loading={false}
            profileError=""
            isSignedIn={false}
            hasSelectedAddress={false}
            selectedAddressHasLocation={false}
            money={money}
          />
        </main>
        <footer className="page-footer">
          <span>Afiyet olsun</span><span>Mobilkod QR Menü</span>
        </footer>
        <BottomNav view="menu" directory onNavigate={() => {}} />
      </div>
    );
  }

  if (type === "restaurant") {
    const menu = data as MenuResponse;
    const categories = menu?.categories ?? [];
    return renderToStaticMarkup(
      <div id="ssr-shell" className="app-shell">
        <header className="topbar">
          <div className="brand">
            <img className="brand-icon" src="/favicon.svg?v=2" alt="" width="40" height="40" />
            <span className="brand-copy">
              <strong>{menu.shop}</strong>
              <small>QR MENÜ</small>
            </span>
          </div>
          <div className="topbar-actions">
            {!menu.isTableQr && <button className="orders-link" type="button">Restoranlar</button>}
            <button className="orders-link current" type="button">Menü</button>
            <button className="orders-link" type="button">Siparişlerim</button>
            <button className="orders-link" type="button">Bilgilerim</button>
            <div className="table-pill"><span /> {menu.isTableQr ? `Masa ${menu.table}` : "Eve sipariş"}</div>
          </div>
        </header>
        <MenuPage
          menu={menu}
          categories={categories}
          visibleCategories={categories}
          categoryId="all"
          query=""
          money={money}
          onQueryChange={() => {}}
          onCategoryChange={() => {}}
          onOpenProduct={() => {}}
        />
        <footer className="page-footer">
          <span>Afiyet olsun</span><span>Mobilkod QR Menü</span>
        </footer>
        <BottomNav view="menu" onNavigate={() => {}} />
      </div>
    );
  }

  return "";
}
