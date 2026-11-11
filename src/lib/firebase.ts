import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { firebaseConfig } from "./firebase-config";

export type { User } from "firebase/auth";
export { GoogleAuthProvider, OAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth";

let _app: ReturnType<typeof initializeApp> | undefined;
export function getFirebaseApp() {
  if (!_app) _app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  return _app;
}
export function getFirebaseAuth() { return getAuth(getFirebaseApp()); }
