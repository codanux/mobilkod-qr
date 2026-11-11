import { getFirebaseApp } from "./firebase";
import { firebaseConfig } from "./firebase-config";

export type PushState = "unsupported" | "default" | "granted" | "denied";

export function getPushState(): PushState {
  if (typeof window === "undefined" || !("Notification" in window) || !("serviceWorker" in navigator)) return "unsupported";
  return Notification.permission as PushState;
}

export async function registerPush(): Promise<string | null> {
  if (getPushState() === "unsupported") return null;
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return null;
  const { getMessaging, getToken } = await import("firebase/messaging");
  const sw = await navigator.serviceWorker.register("/firebase-messaging-sw.js");
  const token = await getToken(getMessaging(getFirebaseApp()), { vapidKey: firebaseConfig.vapidKey, serviceWorkerRegistration: sw });
  return token ?? null;
}

export async function unregisterPush(): Promise<void> {
  try {
    const { getMessaging, deleteToken } = await import("firebase/messaging");
    await deleteToken(getMessaging(getFirebaseApp()));
  } catch { /* already unregistered */ }
}
