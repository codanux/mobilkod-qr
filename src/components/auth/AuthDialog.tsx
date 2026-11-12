"use client";
import { useEffect, useState } from "react";
import { ClipboardList, User, X, LogOut, Moon, Sun, ChevronRight, ShieldCheck } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { clearSession } from "@/lib/api";
import { SignInButtons } from "./SignInButtons";
import { Button } from "@/components/ui/Button";

interface Props {
  onClose: () => void;
  onNavigate?: (tab: "orders" | "profile") => void;
}

export function AuthDialog({ onClose, onNavigate }: Props) {
  const { user } = useAuth();
  const { theme, toggle } = useTheme();
  const [signingOut, setSigningOut] = useState(false);
  const [outError, setOutError] = useState("");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [onClose]);

  async function handleSignOut() {
    setSigningOut(true); setOutError("");
    try {
      const { getFirebaseAuth, signOut } = await import("@/lib/firebase");
      clearSession();
      await signOut(getFirebaseAuth());
      onClose();
    } catch (err) {
      setOutError(err instanceof Error ? err.message : "Çıkış yapılamadı.");
      setSigningOut(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div role="dialog" aria-modal="true" aria-label={user ? "Hesabım" : "Giriş Yap"}
        className="w-full sm:max-w-sm max-h-[90vh] overflow-y-auto bg-white dark:bg-zinc-900 rounded-t-3xl sm:rounded-3xl shadow-2xl p-7">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-extrabold text-slate-900 dark:text-zinc-100">
            {user ? "Hesabım" : "Hoş geldiniz"}
          </h2>
          <button
            onClick={onClose}
            aria-label="Kapat"
            className="w-8 h-8 rounded-full bg-slate-100 dark:bg-zinc-800 flex items-center justify-center text-slate-500 dark:text-zinc-400 hover:bg-slate-200 dark:hover:bg-zinc-700 transition-colors"
          >
            <X size={15} />
          </button>
        </div>

        {user ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3 rounded-2xl bg-slate-50 dark:bg-zinc-800/60 p-3">
              {user.photoURL ? (
                <img
                  src={user.photoURL}
                  alt=""
                  width={48}
                  height={48}
                  className="w-12 h-12 rounded-full"
                />
              ) : (
                <div className="w-12 h-12 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-900 dark:text-zinc-100 font-bold text-lg">
                  {user.displayName?.[0] ?? user.email?.[0] ?? "?"}
                </div>
              )}
              <div className="min-w-0">
                <p className="font-bold text-slate-900 dark:text-zinc-100 truncate">
                  {user.displayName ?? "Kullanıcı"}
                </p>
                <p className="text-sm text-slate-500 dark:text-zinc-400 truncate">{user.email}</p>
              </div>
            </div>
            {onNavigate && (
              <div className="rounded-2xl border border-slate-100 dark:border-zinc-800 divide-y divide-slate-100 dark:divide-zinc-800 overflow-hidden">
                {([["orders", ClipboardList, "Siparişlerim", "Geçmiş ve aktif siparişler"], ["profile", User, "Bilgilerim", "Adres ve iletişim bilgileri"]] as const).map(([tab, Icon, label, desc]) => (
                  <button key={tab} type="button" onClick={() => { onNavigate(tab); onClose(); }}
                    className="w-full flex items-center gap-3 px-3.5 py-3 text-left bg-white dark:bg-zinc-900 hover:bg-slate-50 dark:hover:bg-zinc-800 active:bg-slate-100 dark:active:bg-zinc-700 transition-colors">
                    <span className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-zinc-800 flex items-center justify-center shrink-0">
                      <Icon size={17} className="text-slate-600 dark:text-zinc-300" />
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-semibold text-slate-900 dark:text-zinc-100">{label}</span>
                      <span className="block text-xs text-slate-400 dark:text-zinc-500 truncate">{desc}</span>
                    </span>
                    <ChevronRight size={16} className="text-slate-300 dark:text-zinc-600 shrink-0" />
                  </button>
                ))}
              </div>
            )}
            {outError && <p className="text-xs text-red-600 text-center">{outError}</p>}
            <Button variant="danger" fullWidth onClick={() => void handleSignOut()} disabled={signingOut}>
              <LogOut size={15} className="shrink-0" />
              {signingOut ? "Çıkış yapılıyor…" : "Çıkış yap"}
            </Button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <div className="w-12 h-12 bg-zinc-900 dark:bg-zinc-100 rounded-2xl flex items-center justify-center">
              <span className="text-white dark:text-zinc-900 text-xl font-black">M</span>
            </div>
            <p className="text-sm text-slate-500 dark:text-zinc-400 mb-1 text-center">
              Sipariş vermek ve geçmişinizi görmek için giriş yapın.
            </p>
            <SignInButtons onSuccess={onClose} />
            <p className="flex items-center gap-1.5 text-[11px] text-slate-400 dark:text-zinc-500 text-center mt-1">
              <ShieldCheck size={12} className="shrink-0" />
              Şifre saklamayız, giriş Google veya Apple ile yapılır.
            </p>
          </div>
        )}
        <div className="mt-4 pt-4 border-t border-slate-100 dark:border-zinc-800 flex items-center justify-between">
          <span className="text-sm text-slate-500 dark:text-zinc-400">Görünüm</span>
          <Button size="sm" variant="secondary" onClick={toggle}>
            {theme === "dark" ? <Sun size={14} className="shrink-0" /> : <Moon size={14} className="shrink-0" />}
            <span>{theme === "dark" ? "Açık tema" : "Koyu tema"}</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
