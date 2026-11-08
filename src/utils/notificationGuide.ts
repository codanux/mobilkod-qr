export interface DeviceNotificationInfo {
  isIOS: boolean;
  isStandalone: boolean;
  isAndroid: boolean;
  isSupported: boolean;
  permission: NotificationPermission | "unsupported";
  guideTitle: string;
  guideSteps: string[];
}

export function getDeviceNotificationInfo(): DeviceNotificationInfo {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return {
      isIOS: false,
      isStandalone: false,
      isAndroid: false,
      isSupported: false,
      permission: "unsupported",
      guideTitle: "Bildirim İzni",
      guideSteps: [],
    };
  }

  const ua = navigator.userAgent.toLowerCase();
  const isIOS =
    /iphone|ipad|ipod/.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const isAndroid = /android/.test(ua);
  const isStandalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    Boolean((navigator as unknown as { standalone?: boolean }).standalone);
  const hasNotification = typeof Notification !== "undefined";
  const permission = hasNotification ? Notification.permission : "unsupported";

  if (isIOS) {
    if (!isStandalone) {
      return {
        isIOS,
        isStandalone,
        isAndroid,
        isSupported: false,
        permission: "unsupported",
        guideTitle: "iPhone için Bildirim Rehberi",
        guideSteps: [
          "Apple, iPhone'da web bildirimlerini yalnızca ana ekrana eklenen uygulamalarda destekler (Chrome sekmesinde desteklenmez).",
          "Bu siteyi Safari tarayıcısında açın.",
          "Alttaki 'Paylaş' simgesine (kare içinden çıkan yukarı ok ⬆️) dokunun.",
          "Menüden 'Ana Ekrana Ekle' seçeneğini seçin.",
          "Ardından uygulamayı ana ekrandaki simgesinden açıp bildirimleri etkinleştirin.",
        ],
      };
    }
    return {
      isIOS,
      isStandalone,
      isAndroid,
      isSupported: hasNotification,
      permission,
      guideTitle: "iPhone Bildirim Ayarları",
      guideSteps: [
        "iPhone Ayarlar uygulamasını açın.",
        "Listeden 'Bildirimler' veya eklediğiniz web uygulamasını bulun.",
        "'Bildirimlere İzin Ver' seçeneğini açık konuma getirin.",
      ],
    };
  }

  if (isAndroid) {
    return {
      isIOS,
      isStandalone,
      isAndroid,
      isSupported: hasNotification,
      permission,
      guideTitle: "Android (Chrome) Bildirim Rehberi",
      guideSteps: [
        "Adres çubuğundaki sol tarafta bulunan kilit / ayar (tune) simgesine dokunun.",
        "'İzinler' veya 'Bildirimler' seçeneğine dokunun.",
        "'İzin Ver' olarak ayarlayın ve sayfayı yenileyin.",
      ],
    };
  }

  return {
    isIOS,
    isStandalone,
    isAndroid,
    isSupported: hasNotification,
    permission,
    guideTitle: "Tarayıcı Bildirim Rehberi",
    guideSteps: [
      "Adres çubuğunun solundaki kilit veya ayar simgesine tıklayın.",
      "Bildirimler iznini 'İzin Ver' yapın ve sayfayı yenileyin.",
    ],
  };
}

