import type { FirebaseOptions } from "firebase/app";

// Firebase web yapılandırması public'tir (gizli değil). Build sırasında VITE_FIREBASE_* ile ezilebilir.
const env = import.meta.env;

export const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY ?? "AIzaSyBakRBDozrug1VBLQPyEXailvAsr5q3yTE",
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN ?? "poss-d9747.firebaseapp.com",
  projectId: env.VITE_FIREBASE_PROJECT_ID ?? "poss-d9747",
  appId: env.VITE_FIREBASE_APP_ID ?? "1:928453497060:web:0f7b430bab9581e565dcf1",
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? "928453497060",
  vapidKey: env.VITE_FIREBASE_VAPID_KEY ?? "BAiF-gnoOxUWc_3Y7nTWDVFsAAdh-z-lLfBE0gb4m9c1ooKUohdIdPjJn6vh7o6dHxzg9qI1KwJhhcu20Qb1nKs",
} satisfies FirebaseOptions & { projectId: string; messagingSenderId: string; vapidKey: string };
