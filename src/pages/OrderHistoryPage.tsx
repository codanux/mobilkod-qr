import type { ReactNode } from "react";
import type { User } from "firebase/auth";
import type { CustomerOrder } from "../types";

type Props = {
  scope: "account" | "restaurant";
  user: User | null;
  authReady: boolean;
  loading: boolean;
  orders: CustomerOrder[];
  selectedOrderId: string | null;
  selectedOrder: CustomerOrder | null | undefined;
  ordersError: string;
  feeResponseMessage: string;
  onLogin: (provider: "google" | "apple") => void;
  onBack: () => void;
  renderOrderSummary: (order: CustomerOrder) => ReactNode;
  renderOrderDetails: (order: CustomerOrder) => ReactNode;
};

export function OrderHistoryPage({
  scope, user, authReady, loading, orders, selectedOrderId, selectedOrder,
  ordersError, feeResponseMessage, onLogin, onBack, renderOrderSummary, renderOrderDetails,
}: Props) {
  const account = scope === "account";
  const heading = account
    ? "QR Menü üzerinden verdiğiniz siparişleri hesabınızla takip edin."
    : "QR Menü hesabınızla verdiğiniz siparişleri ve tutar bilgilerini buradan takip edebilirsiniz.";

  const content = (
    <>
      {!selectedOrderId && (
        <div className={account ? "profile-heading" : "orders-heading"}>
          <span className="eyebrow">HESAP GEÇMİŞİ</span>
          <h1>Siparişlerim</h1>
          <p>{heading}</p>
        </div>
      )}
      {!authReady && account ? (
        <p className="orders-message"><span className="loader" /> Oturum kontrol ediliyor…</p>
      ) : !user ? (
        <section className="orders-login">
          <p>{account
            ? "Sipariş geçmişinizi görmek için sipariş verirken kullandığınız Google veya Apple hesabıyla giriş yapın."
            : "Siparişlerinizi görmek için Google veya Apple hesabınızla giriş yapın."}</p>
          <div className="auth-actions">
            <button className="primary-button" onClick={() => onLogin("google")}>Google ile giriş yap</button>
            <button className="secondary-button" onClick={() => onLogin("apple")}>Apple ile giriş yap</button>
          </div>
          {ordersError && <p className="inline-error" role="alert">{ordersError}</p>}
        </section>
      ) : loading && orders.length === 0 ? (
        <p className="orders-message"><span className="loader" /> Siparişler yükleniyor…</p>
      ) : selectedOrderId ? (
        selectedOrder
          ? renderOrderDetails(selectedOrder)
          : <div className="order-detail-missing">
            <p>Bu sipariş bulunamadı veya artık bu hesapla görüntülenemiyor.</p>
            <button className="secondary-button" onClick={onBack}>Siparişlerime dön</button>
          </div>
      ) : orders.length === 0 ? (
        <p className="orders-message">Bu hesapla verilmiş QR siparişi bulunamadı.</p>
      ) : (
        <div className="orders-list">
          {orders.map((order) => renderOrderSummary(order))}
        </div>
      )}
      {feeResponseMessage && <p className="profile-saved" role="status">{feeResponseMessage}</p>}
      {ordersError && <p className="inline-error" role="alert">{ordersError}</p>}
    </>
  );
  return account ? content : <main className="orders-page">{content}</main>;
}
