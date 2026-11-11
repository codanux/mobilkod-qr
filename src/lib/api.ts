import type { User } from "firebase/auth";
import { firebaseConfig } from "./firebase-config";

export const API_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "").replace(/\/+$/, "");

export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { ...init, headers: { "content-type": "application/json", ...init?.headers } });
  const data = await res.json().catch(() => ({})) as { message?: string };
  if (!res.ok) throw Object.assign(new Error(data.message ?? "İstek tamamlanamadı."), { status: res.status });
  return data as T;
}

type Session = { uid: string; accessToken: string; expiresAt: number };
const STORAGE_KEY = `qr-customer-session:v1:${firebaseConfig.projectId}`;
const MARGIN_MS = 60_000;
const FAILURE_BACKOFF_MS = 30_000;
const RATE_LIMIT_BACKOFF_MS = 120_000;

function loadSession(): Session | null {
  if (typeof window === "undefined") return null;
  try {
    const v = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null") as Session | null;
    return v && typeof v.accessToken === "string" && Number.isFinite(v.expiresAt) ? v : null;
  } catch { return null; }
}

let _session: Session | null = null;
let _pending: Promise<string> | null = null;
let _failure: { error: Error; until: number } | null = null;

export function initSession() { _session = loadSession(); }
export function clearSession() {
  _session = null; _failure = null;
  try { if (typeof window !== "undefined") localStorage.removeItem(STORAGE_KEY); } catch {}
}

async function exchange(user: User): Promise<string> {
  const idToken = await user.getIdToken();
  const result = await request<{ accessToken: string; expiresAt: string }>("/m/auth/session", { method: "POST", headers: { authorization: `Bearer ${idToken}` } });
  _session = { uid: user.uid, accessToken: result.accessToken, expiresAt: Date.parse(result.expiresAt) };
  try { if (typeof window !== "undefined") localStorage.setItem(STORAGE_KEY, JSON.stringify(_session)); } catch {}
  return _session.accessToken;
}

export function getAccessToken(user: User, force = false): Promise<string> {
  if (!force && _session?.uid === user.uid && (_session.expiresAt - Date.now()) > MARGIN_MS) return Promise.resolve(_session.accessToken);
  if (_failure && _failure.until > Date.now()) return Promise.reject(_failure.error);
  _pending ??= exchange(user)
    .catch((err: Error & { status?: number }) => { _failure = { error: err, until: Date.now() + (err.status === 429 ? RATE_LIMIT_BACKOFF_MS : FAILURE_BACKOFF_MS) }; throw err; })
    .finally(() => { _pending = null; });
  return _pending;
}

export async function customerRequest<T>(user: User, path: string, init?: RequestInit): Promise<T> {
  const send = (token: string) => request<T>(path, { ...init, headers: { ...init?.headers, authorization: `Bearer ${token}` } });
  const token = await getAccessToken(user);
  try { return await send(token); }
  catch (err) {
    if ((err as { status?: number }).status !== 401) throw err;
    clearSession();
    return send(await getAccessToken(user, true));
  }
}
