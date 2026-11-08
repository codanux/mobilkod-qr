import { getApps, initializeApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  OAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
} from "firebase/auth";
import { firebaseConfig } from "./firebase-config";

export const app = getApps()[0] ?? initializeApp(firebaseConfig);
export const auth = getAuth(app);

export const getFirebaseApp = () => app;
export const getFirebaseAuth = () => auth;

export { GoogleAuthProvider, OAuthProvider, onAuthStateChanged, signInWithPopup, signOut };
