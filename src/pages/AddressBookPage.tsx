import type { User } from "firebase/auth";
import type { ContactAddress } from "../types";

type Props = {
  authReady: boolean;
  user: User | null;
  loading: boolean;
  saving: boolean;
  ordersError: string;
  profileError: string;
  actionError: string;
  addresses: ContactAddress[];
  expandedAddressId: string | null;
  locationBusyIndex: number | null;
  savingAddressId: string | null;
  savedAddressId: string | null;
  maxAddresses: number;
  onBack: () => void;
  onLogin: (provider: "google" | "apple") => void;
  onToggleAddress: (id: string) => void;
  onUpdateAddress: (index: number, patch: Partial<ContactAddress>) => void;
  onSaveLocation: (index: number) => void;
  onSaveAddress: (index: number) => void;
  onSetDefaultAddress: (index: number) => void;
  onRemoveAddress: (index: number) => void;
  onAddAddress: () => void;
};

export function AddressBookPage({
  authReady, user, loading, saving, ordersError, profileError, actionError, addresses,
  expandedAddressId, locationBusyIndex, savingAddressId, savedAddressId, maxAddresses,
  onBack, onLogin, onToggleAddress, onUpdateAddress, onSaveLocation, onSaveAddress,
  onSetDefaultAddress, onRemoveAddress, onAddAddress,
}: Props) {
  return (
    <main className="profile-page">
      <button type="button" className="text-button" onClick={onBack}>← Bilgilerime dön</button>
      <div className="profile-heading">
        <span className="eyebrow">HESAP BİLGİLERİ</span>
        <h1>Teslimat adreslerim</h1>
        <p>Adreslerinizi ve teslimat konumlarınızı buradan yönetin.</p>
      </div>
      <section className="profile-card">
        {!authReady ? (
          <p className="orders-message"><span className="loader" /> Oturum kontrol ediliyor…</p>
        ) : !user ? (
          <div className="profile-login">
            <p>Adreslerinizi yönetmek için Google veya Apple hesabınızla giriş yapın.</p>
            <div className="auth-actions">
              <button className="primary-button" onClick={() => onLogin("google")}>Google ile giriş yap</button>
              <button className="secondary-button" onClick={() => onLogin("apple")}>Apple ile giriş yap</button>
            </div>
            {ordersError && <p className="inline-error" role="alert">{ordersError}</p>}
          </div>
        ) : loading ? (
          <p className="orders-message"><span className="loader" /> Adresler yükleniyor…</p>
        ) : (
          <>
            <section className="saved-addresses" aria-labelledby="saved-address-manager-title">
              <div className="saved-addresses-heading">
                <div>
                  <strong id="saved-address-manager-title">Kayıtlı adresler</strong>
                  <small>En fazla {maxAddresses} adres ekleyebilirsiniz.</small>
                </div>
                <span>{addresses.length}/{maxAddresses}</span>
              </div>
              {addresses.map((entry, index) => {
                const id = entry.id ?? `legacy-address-${index}`;
                const expanded = expandedAddressId === id;
                const hasLocation = Number.isFinite(entry.latitude) && Number.isFinite(entry.longitude);
                return (
                  <article className="saved-address-card" key={id}>
                    <div className="saved-address-card-heading">
                      <button type="button" className="saved-address-summary" aria-expanded={expanded}
                        onClick={() => onToggleAddress(id)}>
                        <span className="saved-address-title">
                          <strong>{entry.label || `Adres ${index + 1}`}</strong>
                          {entry.isDefault && <small>Varsayılan</small>}
                        </span>
                        <span className="saved-address-preview">{entry.address || "Açık adres ekleyin"}</span>
                        <span className={hasLocation ? "saved-address-location saved" : "saved-address-location"}>
                          {hasLocation ? "Konum kayıtlı" : "Konum eklenmedi"}
                        </span>
                      </button>
                      <div className="saved-address-actions">
                        <button type="button" className="text-button edit-address-button"
                          disabled={savingAddressId !== null}
                          aria-label={`${entry.label || `Adres ${index + 1}`} adresini ${expanded ? "kapat" : "düzenle"}`}
                          onClick={() => onToggleAddress(id)}>
                          {expanded ? "Kapat" : "Düzenle"}
                        </button>
                        <button type="button" className="text-button" disabled={savingAddressId !== null}
                          onClick={() => onRemoveAddress(index)}>Sil</button>
                      </div>
                    </div>
                    {expanded && <div className="saved-address-fields">
                      <label className="field-label">
                        Adres etiketi
                        <input type="text" maxLength={60} value={entry.label} disabled={savingAddressId !== null}
                          onChange={(event) => onUpdateAddress(index, { label: event.target.value })}
                          placeholder="Ev, İş" />
                      </label>
                      <label className="field-label">
                        Açık adres
                        <textarea autoComplete="street-address" maxLength={300} value={entry.address}
                          disabled={savingAddressId !== null}
                          onChange={(event) => onUpdateAddress(index, { address: event.target.value })}
                          placeholder="Mahalle, cadde, bina ve daire bilgisi" />
                      </label>
                      <div className="address-location-settings">
                        <button type="button" className="secondary-button"
                          disabled={locationBusyIndex !== null || saving || savingAddressId !== null}
                          onClick={() => onSaveLocation(index)}>
                          {locationBusyIndex === index ? "Konum alınıyor…" : hasLocation ? "Konumu güncelle" : "Bu adresin konumunu kaydet"}
                        </button>
                        <small>{hasLocation
                          ? `Konum kayıtlı (${entry.latitude!.toFixed(5)}, ${entry.longitude!.toFixed(5)})`
                          : "Bu adresteyken konumu kaydedin. Sonraki siparişlerde yeniden GPS izni gerekmez."}</small>
                      </div>
                      <label className="default-address-choice">
                        <input type="radio" name="default-delivery-address" checked={entry.isDefault}
                          disabled={savingAddressId !== null}
                          onChange={() => onSetDefaultAddress(index)} />
                        Varsayılan adres
                      </label>
                      <div className="saved-address-save-actions">
                        <button type="button" className="primary-button"
                          disabled={saving || savingAddressId !== null || locationBusyIndex !== null}
                          onClick={() => onSaveAddress(index)}>
                          {savingAddressId === id ? "Kaydediliyor…" : savedAddressId === id ? "Kaydedildi" : "Bu adresi kaydet"}
                        </button>
                      </div>
                    </div>}
                  </article>
                );
              })}
              <button type="button" className="secondary-button add-address-button"
                disabled={addresses.length >= maxAddresses || saving || savingAddressId !== null}
                onClick={onAddAddress}>
                + Adres ekle
              </button>
            </section>
            {(profileError || actionError) && <p className="inline-error" role="alert">{profileError || actionError}</p>}
          </>
        )}
      </section>
    </main>
  );
}
