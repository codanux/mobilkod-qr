"use client";
import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { customerRequest, clearSession } from "@/lib/api";
import { getPushState, registerPush, unregisterPush, type PushState } from "@/lib/notifications";
import type { ContactProfile, ContactAddress } from "@/types";
import { SignInButtons } from "@/components/auth/SignInButtons";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

const inputCls = "w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-900/20 dark:focus:ring-zinc-100/20 focus:border-zinc-900 dark:focus:border-zinc-400 transition-colors placeholder-slate-400 dark:placeholder-zinc-500";

type DialogState = { addr: ContactAddress; idx: number | null };

function AddressDialog({ init, phone: initPhone, onSave, onDelete, onClose }: {
  init: DialogState;
  phone: string;
  onSave: (addr: ContactAddress, idx: number | null, phone: string) => void;
  onDelete: (idx: number) => void;
  onClose: () => void;
}) {
  const [label, setLabel] = useState(init.addr.label);
  const [address, setAddress] = useState(init.addr.address);
  const [phone, setPhone] = useState(initPhone);
  const [isDefault, setIsDefault] = useState(init.addr.isDefault);
  const [lat, setLat] = useState(init.addr.latitude != null ? String(init.addr.latitude) : "");
  const [lng, setLng] = useState(init.addr.longitude != null ? String(init.addr.longitude) : "");
  const [locating, setLocating] = useState(false);
  const [locErr, setLocErr] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Konum yalnızca kullanıcı butona tıklayınca istenir
  function useLocation() {
    if (!navigator.geolocation) { setLocErr("Konum desteklenmiyor."); return; }
    setLocating(true); setLocErr("");
    navigator.geolocation.getCurrentPosition(
      pos => { setLat(pos.coords.latitude.toFixed(6)); setLng(pos.coords.longitude.toFixed(6)); setLocating(false); },
      () => { setLocErr("Konum alınamadı."); setLocating(false); },
      { timeout: 10000 },
    );
  }

  function submit() {
    const latitude = lat ? parseFloat(lat) : undefined;
    const longitude = lng ? parseFloat(lng) : undefined;
    const hasCoords = latitude != null && !isNaN(latitude) && longitude != null && !isNaN(longitude);
    onSave({
      ...init.addr,
      label: label.trim() || "Adres",
      address: address.trim(),
      isDefault,
      latitude: hasCoords ? latitude : null,
      longitude: hasCoords ? longitude : null,
    }, init.idx, phone.trim());
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm"
      onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="w-full sm:max-w-sm bg-white dark:bg-zinc-900 rounded-t-3xl sm:rounded-3xl shadow-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-extrabold text-slate-900 dark:text-zinc-100">
            {init.idx === null ? "Adres Ekle" : "Adresi Düzenle"}
          </h3>
          <Button variant="secondary" onClick={onClose} aria-label="Kapat" className="w-8 h-8 !p-0 rounded-full">
            <X size={15} />
          </Button>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold text-slate-500 dark:text-zinc-400">Etiket</label>
          <input value={label} onChange={e => setLabel(e.target.value)} maxLength={60}
            placeholder="Ev, İş…" className={inputCls} />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold text-slate-500 dark:text-zinc-400">Telefon <span className="text-red-400">*</span></label>
          <input value={phone} onChange={e => setPhone(e.target.value)} maxLength={40}
            type="tel" placeholder="+90 5xx xxx xx xx" className={inputCls} />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold text-slate-500 dark:text-zinc-400">Adres <span className="text-red-400">*</span></label>
          <textarea value={address} onChange={e => setAddress(e.target.value)} maxLength={300} rows={2}
            placeholder="Açık adres…" className={inputCls + " resize-none"} />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-slate-500 dark:text-zinc-400">Konum <span className="text-red-400">*</span></label>
            <Button size="sm" variant="secondary" onClick={useLocation} disabled={locating}>
              {locating ? "Alınıyor…" : "Konumumu kullan"}
            </Button>
          </div>
          {locErr && <p className="text-xs text-red-500">{locErr}</p>}
          {lat && lng && (
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs text-emerald-600 dark:text-emerald-400">Konum eklendi</p>
              <Button size="sm" variant="outline" onClick={() => { setLat(""); setLng(""); }}>
                Konumu kaldır
              </Button>
            </div>
          )}
        </div>

        <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-zinc-200 cursor-pointer">
          <input type="checkbox" checked={isDefault} onChange={e => setIsDefault(e.target.checked)}
            className="accent-zinc-900 dark:accent-zinc-100" />
          Varsayılan adres olarak kaydet
        </label>

        <div className="flex gap-2 pt-1">
          <Button onClick={submit} disabled={!phone.trim() || !address.trim() || !lat || !lng} className="flex-1">
            Kaydet
          </Button>
          {init.idx !== null && (
            <Button variant="danger" onClick={() => setConfirmDelete(true)}>
              Sil
            </Button>
          )}
        </div>
      </div>

      {confirmDelete && (
        <ConfirmDialog
          title="Adresi sil"
          message={`"${label.trim() || "Adres"}" silinecek. Emin misin?`}
          confirmLabel="Sil"
          danger
          onConfirm={() => { onDelete(init.idx!); onClose(); }}
          onClose={() => setConfirmDelete(false)}
        />
      )}
    </div>
  );
}

function NotificationRow({ user }: { user: NonNullable<ReturnType<typeof useAuth>["user"]> }) {
  const [state, setState] = useState<PushState>("default");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => { setState(getPushState()); }, []);

  if (state === "unsupported") return null;

  async function enable() {
    setBusy(true); setErr("");
    try {
      const token = await registerPush();
      if (!token) { setState(getPushState()); return; }
      await customerRequest(user, "/m/notifications/token", { method: "PUT", body: JSON.stringify({ token }) });
      setState("granted");
    } catch { setErr("Bildirim kaydedilemedi."); }
    finally { setBusy(false); }
  }

  async function disable() {
    setBusy(true); setErr("");
    try {
      const { getMessaging, getToken } = await import("firebase/messaging");
      const { getFirebaseApp } = await import("@/lib/firebase");
      const token = await getToken(getMessaging(getFirebaseApp())).catch(() => null);
      if (token) await customerRequest(user, "/m/notifications/token", { method: "DELETE", body: JSON.stringify({ token }) });
      await unregisterPush();
      setState("default");
    } catch { setErr("Bildirim kaldırılamadı."); }
    finally { setBusy(false); }
  }

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-100 dark:border-zinc-800 p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-900 dark:text-zinc-100">Sipariş Bildirimleri</p>
          <p className="text-xs text-slate-400 dark:text-zinc-500 mt-0.5">
            {state === "granted" ? "Bildirimler açık." : state === "denied" ? "Tarayıcıdan izin verilmedi." : "Sipariş durumunuzdan anında haberdar olun."}
          </p>
        </div>
        {state === "denied" ? (
          <span className="text-xs text-slate-400 dark:text-zinc-500 shrink-0">Kapalı</span>
        ) : state === "granted" ? (
          <Button size="sm" variant="danger" onClick={disable} disabled={busy} className="shrink-0">
            {busy ? "…" : "Kapat"}
          </Button>
        ) : (
          <Button size="sm" onClick={enable} disabled={busy} className="shrink-0">
            {busy ? "…" : "Aç"}
          </Button>
        )}
      </div>
      {err && <p className="text-xs text-red-500 mt-2">{err}</p>}
    </div>
  );
}

export function ProfileView({ isTableQr }: { isTableQr?: boolean }) {
  const { user, ready } = useAuth();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [addrs, setAddrs] = useState<ContactAddress[]>([]);
  const [share, setShare] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [dialog, setDialog] = useState<DialogState | null>(null);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    customerRequest<{ profile: ContactProfile | null }>(user, "/m/profile/current")
      .then(r => {
        const p = r.profile;
        setName(p?.name ?? "");
        setPhone(p?.phone ?? "");
        setShare(isTableQr ? (p?.shareWithRestaurant ?? false) : true);
        setAddrs(p?.addresses ?? []);
      })
      .catch(() => setError("Profil yüklenemedi."))
      .finally(() => setLoading(false));
  }, [user]);

  function openAdd() {
    setDialog({ addr: { id: crypto.randomUUID(), label: "", address: "", isDefault: addrs.length === 0 }, idx: null });
  }

  function normalizeAddrs(list: ContactAddress[], savedIdx: number): ContactAddress[] {
    if (list[savedIdx]?.isDefault) return list.map((x, i) => ({ ...x, isDefault: i === savedIdx }));
    if (list.length > 0 && !list.some(a => a.isDefault)) return list.map((x, i) => ({ ...x, isDefault: i === 0 }));
    return list;
  }

  function buildPayload(addrList: ContactAddress[]) {
    return {
      name: name.trim(),
      phone: phone.trim() || null,
      shareWithRestaurant: isTableQr ? share : true,
      addresses: addrList.filter(a => a.address.trim()).map(a => ({
        id: a.id ?? crypto.randomUUID(),
        label: a.label.trim() || "Adres",
        address: a.address.trim(),
        isDefault: a.isDefault,
        ...(a.latitude != null && a.longitude != null ? { latitude: a.latitude, longitude: a.longitude } : {}),
      })),
    };
  }

  async function pushToServer(addrList: ContactAddress[]) {
    if (!user) return;
    setSaving(true); setError("");
    try {
      await customerRequest(user, "/m/profile/current", { method: "PUT", body: JSON.stringify(buildPayload(addrList)) });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      window.dispatchEvent(new CustomEvent("qr-profile-updated"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Kaydedilemedi.");
    } finally { setSaving(false); }
  }

  async function saveAddr(addr: ContactAddress, idx: number | null, addrPhone: string) {
    if (addrPhone) setPhone(addrPhone);
    const base = idx === null ? [...addrs, addr] : addrs.map((x, i) => i === idx ? addr : x);
    const next = normalizeAddrs(base, idx === null ? base.length - 1 : idx);
    setAddrs(next);
    await pushToServer(next);
  }

  async function removeAddr(idx: number) {
    let next = addrs.filter((_, i) => i !== idx);
    if (next.length > 0 && !next.some(a => a.isDefault)) next[0] = { ...next[0], isDefault: true };
    setAddrs(next);
    await pushToServer(next);
  }

  async function save() {
    await pushToServer(addrs);
  }

  if (!ready) return <div className="max-w-2xl mx-auto px-4 py-12 text-center"><p className="text-slate-400 dark:text-zinc-500 text-sm">Yükleniyor…</p></div>;

  if (!user) return (
    <div className="max-w-2xl mx-auto px-4 py-14 flex flex-col items-center gap-4">
      <div className="text-center">
        <p className="font-semibold text-slate-800 dark:text-zinc-200 mb-1">Bilgilerinizi yönetin</p>
        <p className="text-sm text-slate-500 dark:text-zinc-400">Teslimat adresi ve telefon için giriş yapın.</p>
      </div>
      <SignInButtons />
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto px-4 py-4 space-y-4">
      <h1 className="text-xl font-extrabold text-slate-900 dark:text-zinc-100">Bilgilerim</h1>

      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-100 dark:border-zinc-800 p-5 shadow-sm space-y-3">
        <div className="flex items-center gap-3 pb-3 border-b border-slate-100 dark:border-zinc-800">
          {user.photoURL ? (
            <img src={user.photoURL} alt="" width={40} height={40} className="w-10 h-10 rounded-full shrink-0" />
          ) : (
            <div className="w-10 h-10 rounded-full bg-zinc-900 dark:bg-zinc-100 flex items-center justify-center text-white dark:text-zinc-900 text-sm font-bold shrink-0">
              {user.displayName?.[0] ?? user.email?.[0] ?? "?"}
            </div>
          )}
          <div className="min-w-0">
            <p className="font-bold text-slate-900 dark:text-zinc-100 truncate">{user.displayName ?? user.email}</p>
            <p className="text-xs text-slate-400 dark:text-zinc-500 truncate">{user.email}</p>
          </div>
        </div>
        {loading ? (
          <p className="text-sm text-slate-400 dark:text-zinc-500 py-2 text-center">Yükleniyor…</p>
        ) : (
          <>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-500 dark:text-zinc-400">Ad Soyad</label>
              <input value={name} onChange={e => setName(e.target.value)} maxLength={100}
                placeholder="Adınız" className={inputCls} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-500 dark:text-zinc-400">Telefon</label>
              <input value={phone} onChange={e => setPhone(e.target.value)} maxLength={40}
                type="tel" placeholder="+90 5xx xxx xx xx" className={inputCls} />
            </div>
          </>
        )}
      </div>

      {!loading && (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-100 dark:border-zinc-800 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-zinc-800">
            <p className="text-sm font-semibold text-slate-900 dark:text-zinc-100">Teslimat Adreslerim</p>
            <Button size="sm" variant="secondary" onClick={openAdd}>
              + Ekle
            </Button>
          </div>
          {addrs.length === 0 ? (
            <p className="text-sm text-slate-400 dark:text-zinc-500 px-5 py-4">Kayıtlı adres yok.</p>
          ) : (
            <ul>
              {addrs.map((a, i) => (
                <li key={a.id ?? i} className="flex items-center gap-3 px-5 py-3 border-b border-slate-50 dark:border-zinc-800 last:border-0">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-semibold text-slate-900 dark:text-zinc-100">{a.label || "Adres"}</span>
                      {a.isDefault && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900">
                          Varsayılan
                        </span>
                      )}
                      {a.latitude != null && (
                        <span className="text-[10px] text-slate-400 dark:text-zinc-500">Konum</span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 dark:text-zinc-500 truncate mt-0.5">{a.address}</p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => setDialog({ addr: a, idx: i })} className="shrink-0">
                    Düzenle
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {!loading && isTableQr && (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-100 dark:border-zinc-800 p-5 shadow-sm">
          <label className="flex items-start gap-3 cursor-pointer">
            <input type="checkbox" checked={share} onChange={e => setShare(e.target.checked)}
              className="mt-0.5 accent-zinc-900 dark:accent-zinc-100" />
            <div>
              <p className="text-sm font-semibold text-slate-900 dark:text-zinc-100">Bilgileri Restoranla Paylaş</p>
              <p className="text-xs text-slate-400 dark:text-zinc-500 mt-0.5">Ad ve telefonunuz masa siparişlerinde restorana iletilir.</p>
            </div>
          </label>
        </div>
      )}

      {!loading && <NotificationRow user={user} />}

      {error && <p className="text-sm text-red-600 bg-red-50 dark:bg-red-900/20 rounded-xl px-4 py-2">{error}</p>}

      {!loading && (
        <div className="flex items-center gap-3 pb-4">
          <Button onClick={save} disabled={saving} className="flex-1">
            {saving ? "Kaydediliyor…" : saved ? "Kaydedildi" : "Kaydet"}
          </Button>
          <Button variant="danger" onClick={async () => {
            const { getFirebaseAuth, signOut } = await import("@/lib/firebase");
            clearSession(); await signOut(getFirebaseAuth());
          }}>
            Çıkış
          </Button>
        </div>
      )}

      {dialog && (
        <AddressDialog
          key={dialog.addr.id}
          init={dialog}
          phone={phone}
          onSave={saveAddr}
          onDelete={removeAddr}
          onClose={() => setDialog(null)}
        />
      )}
    </div>
  );
}
