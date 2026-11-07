import type { User } from "firebase/auth";
import { firebaseConfig } from "./firebase-config";

export const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/+$/, "");

export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { "content-type": "application/json", ...init?.headers },
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw Object.assign(new Error(result.message || "İstek tamamlanamadı."), { status: response.status });
  }
  return result as T;
}

// ---- Sunucu oturumu: Firebase yalnızca girişte / oturum yenilenirken kullanılır ----
type Session = { uid: string; accessToken: string; expiresAt: number };
const STORAGE_KEY = `qr-customer-session:v1:${firebaseConfig.projectId}`;
const MARGIN_MS = 60_000;

function load(): Session | null {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null") as Session | null;
    return value && typeof value.accessToken === "string" && Number.isFinite(value.expiresAt) ? value : null;
  } catch { return null; }
}

let session: Session | null = load();
let pending: Promise<string> | null = null;
// Başarısız oturum denemesi kısa süre hatırlanır: yoklama/effect döngüleri sunucuyu dövmesin.
let failure: { error: Error; until: number } | null = null;
const FAILURE_BACKOFF_MS = 30_000;
const RATE_LIMIT_BACKOFF_MS = 120_000;

export function clearSession() {
  session = null;
  failure = null;
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* bellekte temizlendi */ }
}

async function exchange(user: User): Promise<string> {
  const idToken = await user.getIdToken();
  const result = await request<{ accessToken: string; expiresAt: string }>("/m/auth/session", {
    method: "POST",
    headers: { authorization: `Bearer ${idToken}` },
  });
  session = { uid: user.uid, accessToken: result.accessToken, expiresAt: Date.parse(result.expiresAt) };
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(session)); } catch { /* yalnızca bellekte tutulur */ }
  return session.accessToken;
}

/** Geçerli sunucu token'ı varsa Firebase'e gitmeden onu döner; yoksa/bittiyse bir kez yeniler. */
export function getAccessToken(user: User, force = false): Promise<string> {
  if (!force && session && session.uid === user.uid && session.expiresAt - Date.now() > MARGIN_MS) {
    return Promise.resolve(session.accessToken);
  }
  if (failure && failure.until > Date.now()) return Promise.reject(failure.error);
  pending ??= exchange(user)
    .catch((error: Error & { status?: number }) => {
      failure = { error, until: Date.now() + (error.status === 429 ? RATE_LIMIT_BACKOFF_MS : FAILURE_BACKOFF_MS) };
      throw error;
    })
    .finally(() => { pending = null; });
  return pending;
}

/** Müşteri uçları için istek: sunucu token'ı ile gider; 401'de oturumu bir kez yenileyip tekrar dener. */
export async function customerRequest<T>(user: User, path: string, init?: RequestInit): Promise<T> {
  const send = (token: string) => request<T>(path, {
    ...init,
    headers: { ...init?.headers, authorization: `Bearer ${token}` },
  });
  // Oturum alınamazsa (ör. giriş reddedildi) hata aynen yukarı çıkar; ikinci deneme yapılmaz.
  const token = await getAccessToken(user);
  try {
    return await send(token);
  } catch (error) {
    if ((error as { status?: number }).status !== 401) throw error;
    // Yalnızca API 401 verdiyse (token süresi doldu) oturum bir kez yenilenir.
    clearSession();
    return send(await getAccessToken(user, true));
  }
}
