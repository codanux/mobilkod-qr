import type { User } from "firebase/auth";
import type { ContactProfile } from "../types";

type Props = {
  authReady: boolean;
  user: User | null;
  loading: boolean;
  ordersError: string;
  draft: ContactProfile;
  profileError: string;
  actionError: string;
  saved: boolean;
  saving: boolean;
  pushRegistered: boolean;
  pushBusy: boolean;
  pushMessage: string;
  pushError: string;
  onLogin: (provider: "google" | "apple") => void;
  onChange: (field: "name" | "phone" | "shareWithRestaurant", value: string | boolean) => void;
  onOpenAddresses: () => void;
  onToggleNotifications: () => void;
  onSave: () => void;
  onSignOut: () => void;
};

export function ProfilePage({
  authReady, user, loading, ordersError, draft, profileError, actionError, saved, saving,
  pushRegistered, pushBusy, pushMessage, pushError, onLogin, onChange, onOpenAddresses,
  onToggleNotifications, onSave, onSignOut,
}: Props) {
  return (
    <main className="profile-page">
      <div className="profile-heading">
        <span className="eyebrow">HESAP BİLGİLERİ</span>
        <h1>Bilgilerim</h1>
        <p>Telefonunuzu, teslimat adreslerinizi ve sipariş tercihlerinizi yönetin.</p>
      </div>
      <section className="profile-card">
        {!authReady ? (
          <p className="orders-message"><span className="loader" /> Oturum kontrol ediliyor…</p>
        ) : !user ? (
          <div className="profile-login">
            <p>Bilgilerinizi yönetmek için Google veya Apple hesabınızla giriş yapın.</p>
            <div className="auth-actions">
              <button className="primary-button" onClick={() => onLogin("google")}>Google ile giriş yap</button>
              <button className="secondary-button" onClick={() => onLogin("apple")}>Apple ile giriş yap</button>
            </div>
            {ordersError && <p className="inline-error" role="alert">{ordersError}</p>}
          </div>
        ) : loading ? (
          <p className="orders-message"><span className="loader" /> Profil yükleniyor…</p>
        ) : (
          <>
            <label className="field-label">
              Ad soyad
              <input type="text" autoComplete="name" maxLength={100} value={draft.name}
                onChange={(event) => onChange("name", event.target.value)}
                placeholder={user.displayName || "Adınız soyadınız"} />
            </label>
            <label className="field-label">
              Telefon
              <input type="tel" autoComplete="tel" maxLength={40} value={draft.phone}
                onChange={(event) => onChange("phone", event.target.value)} placeholder="05xx xxx xx xx" />
            </label>
            <section className="saved-addresses">
              <div className="saved-addresses-heading">
                <div>
                  <strong>Teslimat adreslerim</strong>
                  <small>{draft.addresses.length} kayıtlı adres</small>
                </div>
                <button type="button" className="text-button" onClick={onOpenAddresses}>Adresleri yönet →</button>
              </div>
              {draft.addresses.length > 0 && (
                <p className="saved-address-preview">
                  {draft.addresses.find((address) => address.isDefault)?.label || draft.addresses[0].label || "Varsayılan adres"}
                  {" · "}
                  {draft.addresses.find((address) => address.isDefault)?.address || draft.addresses[0].address}
                </p>
              )}
            </section>
            <label className="share-contact-check">
              <input type="checkbox" checked={draft.shareWithRestaurant}
                onChange={(event) => onChange("shareWithRestaurant", event.target.checked)} />
              <span>
                <strong>Ad, telefon ve seçtiğim adresi siparişlerimde otomatik paylaş</strong>
                <small>Paylaşımı istediğiniz zaman kapatabilirsiniz.</small>
              </span>
            </label>
            <section className="notification-settings profile-notification-settings">
              <div>
                <strong>Bildirim ayarları</strong>
                <p>Bu cihazda sipariş bildirimlerini açıp kapatın.</p>
              </div>
              <button className="secondary-button" disabled={pushBusy} onClick={onToggleNotifications}>
                {pushBusy ? "Kaydediliyor…" : pushRegistered ? "Bildirimleri kapat" : "Bildirimleri aç"}
              </button>
              {pushMessage && <p className="profile-saved" role="status">{pushMessage}</p>}
              {pushError && <p className="inline-error" role="alert">{pushError}</p>}
            </section>
            <p className="profile-privacy-copy">Adresleriniz hesabınızda saklanır. Siparişte yalnızca seçtiğiniz adres paylaşılır; kayıtlı konum yol ücretini hesaplamak için kullanılır, restorana gönderilmez.</p>
            {(profileError || actionError) && <p className="inline-error" role="alert">{profileError || actionError}</p>}
            {saved && <p className="profile-saved" role="status">Bilgileriniz güvenli profilinize kaydedildi.</p>}
            <div className="profile-actions">
              <button className="primary-button" disabled={loading || saving} onClick={onSave}>
                {saving ? "Kaydediliyor…" : "Kaydet"}
              </button>
            </div>
          </>
        )}
      </section>
      {user && (
        <section className="profile-session-actions">
          <p>Bu cihazdaki QR oturumunuzu kapatabilirsiniz.</p>
          <button className="secondary-button" onClick={onSignOut}>Çıkış yap</button>
        </section>
      )}
    </main>
  );
}
