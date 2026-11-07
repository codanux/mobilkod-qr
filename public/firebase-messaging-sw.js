importScripts("https://www.gstatic.com/firebasejs/13.2.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/13.2.0/firebase-messaging-compat.js");

const encodedConfig = new URL(self.location.href).searchParams.get("config");
if (!encodedConfig) throw new Error("Firebase messaging configuration is missing");

firebase.initializeApp(JSON.parse(encodedConfig));
const messaging = firebase.messaging();

messaging.onBackgroundMessage(({ data }) => {
  if (!data?.title || !data.body) return;
  return self.registration.showNotification(data.title, {
    body: data.body,
    data: { url: data.link || "/orders" },
  });
});

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("notificationclick", (event) => {
  const target = event.notification.data?.url || "/orders";
  event.notification.close();
  const url = typeof target === "string" ? new URL(target, self.location.origin) : null;

  // Notifications created by older deployments may contain a different host.
  const destination = new URL(
    url?.origin === self.location.origin ? url.pathname + url.search + url.hash : "/orders",
    self.location.origin,
  );

  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of windows) {
      if (new URL(client.url).origin !== self.location.origin || !("focus" in client)) continue;
      if (client.url === destination.href) return client.focus();
      try {
        if ("navigate" in client) {
          const targetClient = await client.navigate(destination.href);
          if (targetClient) return await targetClient.focus();
        }
      } catch {
        continue;
      }
    }
    return self.clients.openWindow(destination.href);
  })());
});
