import { getApps, initializeApp } from "firebase/app";
import { browserLocalPersistence, browserSessionPersistence, indexedDBLocalPersistence, initializeAuth } from "firebase/auth";
import { firebaseConfig } from "./firebase-config";

/** Tek yerden başlatma: uygulamada başka hiçbir yerde initializeApp çağrılmaz. */
export const getFirebaseApp = () => getApps()[0] ?? initializeApp(firebaseConfig);
export const getFirebaseAuth = () => initializeAuth(getFirebaseApp(), {
  persistence: [indexedDBLocalPersistence, browserLocalPersistence, browserSessionPersistence],
});
