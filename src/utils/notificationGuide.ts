export interface DeviceNotificationInfo {
  isIOS: boolean;
  isStandalone: boolean;
  isAndroid: boolean;
  isChromeIOS: boolean;
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
      isChromeIOS: false,
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
  const isChromeIOS = isIOS && ua.includes("crios");
  const isAndroid = /android/.test(ua);
  const isStandalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    Boolean((navigator as unknown as { standalone?: boolean }).standalone);
  const hasNotification = typeof Notification !== "undefined";
  const permission = hasNotification ? Notification.permission : "unsupported";

  if (isIOS) {
    if (!isStandalone) {
      if (isChromeIOS) {
        return {
          isIOS,
          isStandalone,
          isAndroid,
          isChromeIOS,
          isSupported: false,
          permission: "unsupported",
          guideTitle: "iPhone Chrome için Bildirim Açma",
          guideSteps: [
            "Apple, iPhone'da web bildirimlerini normal sekmede kilitler; uygulamanın ana ekranda olmasını şart koşar.",
            "Chrome'un sağ üst/alt köşesindeki 'Paylaş' simgesine dokunun.",
            "Menüyü kaydırıp 'Ana Ekrana Ekle' seçeneğini seçin.",
            "Ana ekrana gelen QR Menü simgesine dokunarak açın.",
            "Açılan uygulamada Bildirimleri Aç dediğinizde izin penceresi çıkacaktır.",
          ],
        };
      }
      return {
        isIOS,
        isStandalone,
        isAndroid,
        isChromeIOS,
        isSupported: false,
        permission: "unsupported",
        guideTitle: "iPhone için Bildirim Açma",
        guideSteps: [
          "Apple, iPhone'da web bildirimlerini yalnızca ana ekrana eklenen uygulamalarda destekler.",
          "Tarayıcınızın 'Paylaş' simgesine (⬆️) dokunun.",
          "Menüden 'Ana Ekrana Ekle' seçeneğini seçin.",
          "Ana ekrandaki QR Menü simgesinden açarak bildirimleri etkinleştirin.",
        ],
      };
    }
    return {
      isIOS,
      isStandalone,
      isAndroid,
      isChromeIOS,
      isSupported: hasNotification,
      permission,
      guideTitle: "iPhone Bildirim Ayarları",
      guideSteps: [
        "iPhone 'Ayarlar' uygulamasını açın.",
        "Listeden 'Bildirimler' veya eklediğiniz QR Menü uygulamasını bulun.",
        "'Bildirimlere İzin Ver' seçeneğini açık konuma getirin.",
      ],
    };
  }

  if (isAndroid) {
    return {
      isIOS,
      isStandalone,
      isAndroid,
      isChromeIOS,
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
    isChromeIOS,
    isSupported: hasNotification,
    permission,
    guideTitle: "Tarayıcı Bildirim Rehberi",
    guideSteps: [
      "Adres çubuğunun solundaki kilit veya ayar simgesine tıklayın.",
      "Bildirimler iznini 'İzin Ver' yapın ve sayfayı yenileyin.",
    ],
  };
}
