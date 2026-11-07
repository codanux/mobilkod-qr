importScripts("https://www.gstatic.com/firebasejs/13.2.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/13.2.0/firebase-messaging-compat.js");

const encodedConfig = new URL(self.location.href).searchParams.get("config");
if (!encodedConfig) throw new Error("Firebase messaging configuration is missing");

firebase.initializeApp(JSON.parse(encodedConfig));
firebase.messaging();
