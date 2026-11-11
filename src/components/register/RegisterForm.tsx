"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { API_BASE } from "@/lib/api";
import { Button } from "@/components/ui/Button";

export function RegisterForm() {
  const t = useTranslations("Register");
  const [form, setForm] = useState({ restaurantName: "", email: "", password: "", phone: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    setForm(p => ({ ...p, [e.target.name]: e.target.value }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError("");
    try {
      const res = await fetch(`${API_BASE}/public/register`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({})) as { message?: string };
      if (!res.ok) throw new Error(data.message ?? "Kayıt tamamlanamadı.");
      window.location.assign("https://mobilkod.com/tr/pos");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kayıt tamamlanamadı.");
    } finally { setBusy(false); }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      {[
        { name: "restaurantName", type: "text", label: t("restaurantName"), autoComplete: "organization", placeholder: "Örn. Cafe Deniz", required: true, minLength: 2 },
        { name: "email", type: "email", label: t("email"), autoComplete: "email", placeholder: "ornek@eposta.com", required: true },
        { name: "password", type: "password", label: t("password"), autoComplete: "new-password", placeholder: "En az 8 karakter", required: true, minLength: 8 },
        { name: "phone", type: "tel", label: `${t("phone")} ${t("phoneOptional")}`, autoComplete: "tel", placeholder: "0555 000 00 00" },
      ].map(f => (
        <label key={f.name} className="block">
          <span className="text-sm font-medium text-slate-700 mb-1 block">{f.label}</span>
          <input
            name={f.name}
            type={f.type}
            autoComplete={f.autoComplete}
            placeholder={f.placeholder}
            required={f.required}
            minLength={f.minLength}
            value={form[f.name as keyof typeof form]}
            onChange={onChange}
            disabled={busy}
            className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/20 focus:border-zinc-900 focus:bg-white disabled:opacity-50 transition-colors"
          />
        </label>
      ))}
      {error && (
        <p className="text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2.5" role="alert">{error}</p>
      )}
      <Button type="submit" fullWidth disabled={busy} className="mt-2">
        {busy ? t("submitting") : t("submit")}
      </Button>
    </form>
  );
}
