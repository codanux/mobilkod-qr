export const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "AIzaSyBakRBDozrug1VBLQPyEXailvAsr5q3yTE",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "poss-d9747.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "poss-d9747",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? "1:928453497060:web:0f7b430bab9581e565dcf1",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "928453497060",
  vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY ?? "BAiF-gnoOxUWc_3Y7nTWDVFsAAdh-z-lLfBE0gb4m9c1ooKUohdIdPjJn6vh7o6dHxzg9qI1KwJhhcu20Qb1nKs",
};
