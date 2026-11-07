import { memo } from "react";
import type { Restaurant } from "../types";

type Props = {
  restaurants: Restaurant[];
  loading: boolean;
  profileError: string;
  isSignedIn: boolean;
  hasSelectedAddress: boolean;
  selectedAddressHasLocation: boolean;
  money: Intl.NumberFormat;
};

function RestaurantDirectoryPageView({
  restaurants, loading, profileError, isSignedIn, hasSelectedAddress, selectedAddressHasLocation, money,
}: Props) {
  return (
    <>
      <div className="profile-heading">
        <span className="eyebrow"><span className="directory-live-dot" /> YAKININDAKİ LEZZETLER</span>
        <h1>Bugün ne <em>yesek?</em></h1>
        <p>Adresine yakın restoranları keşfet, menüye göz at ve siparişini ver.</p>
      </div>
      {isSignedIn && profileError && <p className="inline-error" role="alert">{profileError}</p>}
      <div className="directory-results-heading">
        <strong>Restoranlar</strong>
        {!loading && <span>{restaurants.length} mekan</span>}
        {isSignedIn && hasSelectedAddress && !selectedAddressHasLocation && (
          <small>Yakınlığa göre sıralama için adres konumunu Bilgilerim’den kaydedin.</small>
        )}
        {isSignedIn && !hasSelectedAddress && <small>Adres eklediğinizde restoranları yakınlığınıza göre sıralarız.</small>}
      </div>
      {loading ? (
        <p className="orders-message"><span className="loader" /> Restoranlar yükleniyor…</p>
      ) : restaurants.length ? (
        <div className="restaurant-list">
          {restaurants.map((restaurant) => (
            <a className="restaurant-card" href={`/restaurant/${encodeURIComponent(restaurant.id)}`} key={restaurant.id}>
              <span className="brand-mark">{restaurant.name.trim().charAt(0).toLocaleUpperCase("tr-TR") || "R"}</span>
              <span>
                <strong>{restaurant.name}</strong>
                <small className="restaurant-order-types">
                  Eve teslimat{restaurant.deliveryMinimumOrder > 0 ? ` · Min. sipariş ${money.format(restaurant.deliveryMinimumOrder)}` : ""}{restaurant.dineInEnabled ? " · Masa QR" : ""}
                </small>
                {restaurant.deliveryAcceptingOrders === false && <small className="delivery-paused-label">Şu an online eve siparişi alınmıyor.</small>}
                <small>{[restaurant.address, restaurant.phone].filter(Boolean).join(" · ") || "Menüyü görüntüle · Eve sipariş ver"}</small>
              </span>
              <b aria-hidden="true">→</b>
            </a>
          ))}
        </div>
      ) : (
        <p className="orders-message">Şu an listelenecek açık restoran bulunmuyor.</p>
      )}
    </>
  );
}

export const RestaurantDirectoryPage = memo(RestaurantDirectoryPageView);
