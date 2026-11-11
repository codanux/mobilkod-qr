"use client";
import { useState, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { MapPin } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { customerRequest } from "@/lib/api";
import { getSelectedAddr, setSelectedAddr, type SelectedAddr } from "@/lib/selected-address";
import { haversineKm } from "@/lib/location";
import { AuthDialog } from "@/components/auth/AuthDialog";

interface Props {
  shop?: string;
  isTableQr?: boolean;
  table?: string | null;
  activeTab: "menu" | "orders" | "profile";
  onTabChange: (tab: "menu" | "orders" | "profile") => void;
  directory?: boolean;
}

type AddrOpt = { id: string | null; label: string; lat: number | null; lng: number | null };

function dispatchAddrChange(a: SelectedAddr | null) {
  window.dispatchEvent(new CustomEvent("qr-addr-change", { detail: a }));
}

function AddressButton({ user, ready }: { user: ReturnType<typeof useAuth>["user"]; ready: boolean }) {
  const [sel, setSel] = useState<SelectedAddr | null>(null);
  const [opts, setOpts] = useState<AddrOpt[]>([]);
  const optsRef = useRef<AddrOpt[]>([]);
  const [open, setOpen] = useState(false);
  const [geoLoading, setGeoLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => { setSel(getSelectedAddr()); }, []);

  function loadAddresses(u: typeof user) {
    if (!u) { optsRef.current = []; setOpts([]); return; }
    customerRequest<{ profile: { addresses?: { id: string | null; label: string; latitude: number | null; longitude: number | null }[] } | null }>(u, "/m/profile/current")
      .then(r => {
        const list = (r.profile?.addresses ?? [])
          .map(a => ({ id: a.id, label: a.label, lat: a.latitude ?? null, lng: a.longitude ?? null }));
        optsRef.current = list;
        setOpts(list);
        if (list.length > 0 && !getSelectedAddr()) {
          pick(list.find(a => a.lat != null && a.lng != null) ?? list[0]);
        }
      })
      .catch(() => {});
  }

  useEffect(() => { loadAddresses(user); }, [user]);

  useEffect(() => {
    function handler() { loadAddresses(user); }
    window.addEventListener("qr-profile-updated", handler);
    return () => window.removeEventListener("qr-profile-updated", handler);
  }, [user]);

  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  function pick(a: AddrOpt | null) {
    const addr = a && a.lat != null && a.lng != null
      ? { id: a.id, label: a.label, lat: a.lat, lng: a.lng }
      : a ? { id: a.id, label: a.label, lat: 0, lng: 0 }
      : null;
    setSel(addr);
    setSelectedAddr(addr);
    dispatchAddrChange(addr);
    setOpen(false);
  }

  function requestGps() {
    if (!navigator.geolocation) { setOpen(true); return; }
    setGeoLoading(true);
    navigator.geolocation.getCurrentPosition(
      pos => {
        const { latitude: lat, longitude: lng } = pos.coords;
        const current = optsRef.current.filter(a => a.lat != null && a.lng != null);
        if (current.length > 0) {
          const nearest = current.reduce((best, a) =>
            haversineKm(lat, lng, a.lat!, a.lng!) < haversineKm(lat, lng, best.lat!, best.lng!) ? a : best
          );
          pick(nearest);
        } else {
          pick({ id: null, label: "Konumum", lat, lng });
        }
        setGeoLoading(false);
      },
      () => { setGeoLoading(false); setOpen(true); },
      { timeout: 8000 },
    );
  }

  function handleClick() {
    if (sel) {
      setOpen(o => !o);
    } else {
      requestGps();
    }
  }

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        onClick={handleClick}
        disabled={!ready || geoLoading}
        className="w-[140px] h-9 flex items-center gap-1.5 px-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 hover:bg-slate-50 dark:hover:bg-zinc-800 active:bg-slate-100 dark:active:bg-zinc-700 transition-colors disabled:cursor-default"
      >
        {!ready || geoLoading ? (
          <div className="w-full h-3 rounded-full bg-slate-100 dark:bg-zinc-800 animate-pulse" />
        ) : (
          <>
            <MapPin size={13} className="shrink-0 text-slate-400 dark:text-zinc-500" />
            <span className="text-xs font-semibold text-slate-700 dark:text-zinc-200 truncate flex-1 text-left">
              {sel?.label ?? "Adres seç"}
            </span>
          </>
        )}
      </button>

      {open && opts.length > 0 && (
        <div className="absolute top-full right-0 mt-2 w-52 bg-white dark:bg-zinc-900 rounded-2xl border border-slate-100 dark:border-zinc-800 shadow-xl z-50 overflow-hidden py-1">
          {opts.map(a => (
            <button key={a.id ?? a.label} onClick={() => pick(a)}
              className={`w-full flex items-center gap-2 px-4 py-2.5 text-xs font-semibold transition-colors text-left ${sel?.id === a.id && sel?.label === a.label ? "text-zinc-900 dark:text-zinc-100 bg-slate-50 dark:bg-zinc-800" : "text-slate-500 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-800"}`}>
              <MapPin size={11} className="shrink-0" />
              {a.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function TopBar({ shop, isTableQr, table, activeTab, onTabChange, directory }: Props) {
  const t = useTranslations("Nav");
  const router = useRouter();
  const { user, ready } = useAuth();
  const [authOpen, setAuthOpen] = useState(false);

  return (
    <>
      <header className="sticky top-0 z-30 bg-white/95 dark:bg-zinc-900/95 backdrop-blur border-b border-slate-100 dark:border-zinc-800">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center gap-3">
          <button
            onClick={() => router.push("/")}
            className="flex items-center gap-2 shrink-0 mr-auto"
          >
            <div className="w-7 h-7 bg-zinc-900 rounded-lg flex items-center justify-center">
              <span className="text-white text-xs font-black">M</span>
            </div>
            <div className="text-left leading-none">
              <p className="text-sm font-bold text-slate-900 dark:text-zinc-100">{shop ?? "Mobilkod"}</p>
              <p className="text-[10px] font-semibold text-slate-400 dark:text-zinc-500 tracking-wider uppercase">QR Menü</p>
            </div>
          </button>

          <nav className="hidden sm:flex items-center gap-1">
            {!directory && (
              <button
                onClick={() => onTabChange("menu")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${activeTab === "menu" ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100" : "text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200"}`}
              >{t("menu")}</button>
            )}
            {isTableQr && table && (
              <span className="ml-2 text-[10px] font-semibold text-slate-400 dark:text-zinc-500 bg-slate-100 dark:bg-zinc-800 px-2 py-1 rounded-full">
                Masa {table}
              </span>
            )}
          </nav>

          {!isTableQr && <AddressButton user={user} ready={ready} />}

          <button
            onClick={() => setAuthOpen(true)}
            disabled={!ready}
            aria-label="Hesap"
            className="hidden sm:flex shrink-0 w-[120px] h-9 items-center gap-2 px-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 hover:bg-slate-50 dark:hover:bg-zinc-800 active:bg-slate-100 dark:active:bg-zinc-700 transition-colors cursor-pointer disabled:cursor-default"
          >
            {!ready ? (
              <div className="w-full h-3 rounded-full bg-slate-100 dark:bg-zinc-800 animate-pulse" />
            ) : user ? (
              <>
                {user.photoURL ? (
                  <img src={user.photoURL} alt="" width={24} height={24} className="w-6 h-6 rounded-full shrink-0" />
                ) : (
                  <div className="w-6 h-6 rounded-full bg-zinc-900 dark:bg-zinc-100 flex items-center justify-center text-white dark:text-zinc-900 text-[10px] font-bold shrink-0">
                    {user.displayName?.[0] ?? user.email?.[0] ?? "?"}
                  </div>
                )}
                <span className="text-sm font-semibold text-slate-900 dark:text-zinc-100 truncate flex-1 text-left">
                  {user.displayName?.split(" ")[0] ?? user.email?.split("@")[0] ?? "Hesap"}
                </span>
              </>
            ) : (
              <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 w-full text-center">
                Giriş Yap
              </span>
            )}
          </button>
        </div>
      </header>

      {authOpen && <AuthDialog onClose={() => setAuthOpen(false)} onNavigate={(tab) => { onTabChange(tab); setAuthOpen(false); }} />}
    </>
  );
}
