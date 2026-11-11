export type SelectedAddr = { id: string | null; label: string; lat: number; lng: number };

const KEY = "qr-selected-addr";

export function getSelectedAddr(): SelectedAddr | null {
  if (typeof window === "undefined") return null;
  try { return JSON.parse(localStorage.getItem(KEY) ?? "null"); } catch { return null; }
}

export function setSelectedAddr(a: SelectedAddr | null) {
  if (typeof window === "undefined") return;
  if (a) localStorage.setItem(KEY, JSON.stringify(a));
  else localStorage.removeItem(KEY);
}
