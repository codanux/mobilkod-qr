importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyBakRBDozrug1VBLQPyEXailvAsr5q3yTE",
  authDomain: "poss-d9747.firebaseapp.com",
  projectId: "poss-d9747",
  appId: "1:928453497060:web:0f7b430bab9581e565dcf1",
  messagingSenderId: "928453497060",
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage(payload => {
  const { title, body, link } = payload.data ?? {};
  self.registration.showNotification(title ?? "Bildirim", {
    body: body ?? "",
    icon: "/favicon.ico",
    data: { link: link ?? "/" },
  });
});

self.addEventListener("notificationclick", event => {
  event.notification.close();
  const link = event.notification.data?.link ?? "/";
  event.waitUntil(clients.openWindow(link));
});
