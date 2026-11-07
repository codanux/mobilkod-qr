# Mobilkod QR Menü

POS Cloud tarafından sağlanan menü ve QR sipariş akışının statik React
istemcisi. Bu repoda sipariş veritabanı veya Cloud API bulunmaz; backend
değişiklikleri [POS Cloud](../pos-cloud/README.md) projesinde yapılır.

## İçindekiler

- [Mimari ve kullanıcı yolları](#mimari-ve-kullanıcı-yolları)
- [Geliştirme](#geliştirme)
- [Yayın](#yayın)
- [Cloud API sözleşmesi](#cloud-api-sözleşmesi)
- [İş kuralları ve gizlilik](#iş-kuralları-ve-gizlilik)
- [AI agent ve katkı notları](#ai-agent-ve-katkı-notları)

## Mimari ve kullanıcı yolları

| Sorumluluk | Uygulama |
|---|---|
| UI, sepet, Firebase Google/Apple oturumu | `src/App.tsx` |
| Stil ve responsive düzen | `src/App.css` |
| API origin | `VITE_API_BASE_URL`; boşsa göreli `/m` istekleri |
| Geliştirme proxy | `vite.config.ts`; `/m/*` → `QR_API_PROXY_TARGET` |
| Menü, auth token doğrulama, sipariş kaydı | POS Cloud `src/qr/` |
| POS'a aktarma ve personel onayı | Mobilkod POS `server/src/cloud/` |

- Masada sipariş: `/<tableToken>` → `GET /m/:tableToken/menu`.
- Restoran dizini/teslimat menüsü: `/` → `/restaurant/:tenantId` →
  `GET /m/restaurants/:tenantId/menu`.
- Menü yolu sonuna `/orders` veya `/profile` eklenerek sipariş geçmişi ve
  profil açılır. `/orders` dizin kökünde giriş yapmış kullanıcının restoranlar
  arası geçmişidir.
- Eve teslimat siparişi için profil bilgileri ve açıkça etkinleştirilmiş
  otomatik paylaşım gerekir. Online ödeme bu uygulamanın kapsamı dışındadır.

## Geliştirme

Gereksinimler: Node.js ve npm.

```sh
npm install
cp .env.example .env.local
npm run dev
```

`.env.local` içindeki `VITE_API_BASE_URL` boşsa Vite göreli `/m` isteklerini
kullanır; `QR_API_PROXY_TARGET` varsayılanı `http://localhost:4000`'dır.
Geliştirme sunucusu açılışı `http://localhost:5173/`; masa akışı için
`http://localhost:5173/<tableToken>` kullanın. POS Cloud API'si ve geçerli
menü snapshot'ı çalışır durumda olmalıdır.

```sh
npm run lint
npm run build
npm run preview
```

## Yayın

Cloudflare Pages build ayarları:

| Ayar | Değer |
|---|---|
| Build command | `npm run build` |
| Build output directory | `dist` |
| Root directory | QR Menu proje kökü |

Build komutu `vite build --mode production` çalıştırır ve repodaki
`.env.production` dosyasından `VITE_API_BASE_URL` değerini alır (yayınlanan API
origin'i, `https://pos.mobilkod.com`). Bu değer frontend bundle'ına gömülür;
API origin'ini değiştirmek için `.env.production` güncellenip Pages yeniden
deploy edilmelidir. `.env.production` production endpoint dışında secret
içermemelidir. `dist/` içeriği HTTPS ve SPA fallback ile `/`, `/<tableToken>`,
`/restaurant/:tenantId`, `/orders` ve `/profile` yolları `index.html`'e
gitmelidir.

POS Cloud'da `QR_MENU_URL=https://qr.mobilkod.com` ayarlayın. Cloud bu origin'e
CORS izni verir ve masa QR linklerini frontend'e yönlendirir. Firebase
Authentication'da Google/Apple sağlayıcılarını ve `qr.mobilkod.com` authorized
domain'ini etkinleştirin. Firebase web config'i
[`src/firebase-config.ts`](src/firebase-config.ts) içinde build'e gömülür;
değişiklik sonrası QR Menu yeniden build/deploy edilmelidir. Web API key ve
VAPID public key istemciye açık değerlerdir. Firebase Admin service-account
JSON'u veya private key bu projeye kesinlikle kopyalanmamalıdır.

## Cloud API sözleşmesi

Tüm istekler JSON kullanır. `request()` başarısız HTTP yanıtında JSON `message`
alanını `Error` olarak yükseltir. Public menü/dizin dışında profil, sipariş,
geçmiş ve sipariş durumu isteklerinde header:
`Authorization: Bearer <Firebase-ID-token>`.
Token Google veya Apple üzerinden Firebase Authentication'dan alınır.

| Method ve path | Auth | İstek / yanıt |
|---|---|---|
| `GET /m/restaurants` | Public | `{restaurants}`; yalnız QR ve teslimata açık, menüsü yayınlanmış restoranlar; varsa restoran koordinatları, `deliveryMinimumOrder` ve `deliveryAcceptingOrders`. Giriş yapmış müşterinin seçili kayıtlı adresine göre en yakından uzağa sıralanır; mesafe sınırı uygulanmaz. QR açılışında yol ücreti gösterilmez; sepet açıldığında kayıtlı adres konumuna göre otomatik hesaplanıp toplamda gösterilir. |
| `GET /m/:tableToken/menu` | Public | Restoran/masa bilgisi, `categories` ve QR/teslimat ayarları; `deliveryMinimumOrder` |
| `GET /m/restaurants/:tenantId/menu` | Public | Aynı menu response; `table:null`, `isTableQr:false`, `deliveryAcceptingOrders` |
| `GET /m/profile/current` | Firebase Bearer | `{profile:null}` veya `{profile:{name,phone,address,shareWithRestaurant}}` |
| `PUT /m/profile/current` | Firebase Bearer | Gönderilen profil alanlarını kaydeder, `{profile}` döner |
| `PUT /m/notifications/token` | Firebase Bearer | Push izni verilen tarayıcının FCM token'ını hesaba bağlar |
| `DELETE /m/notifications/token` | Firebase Bearer | Gövdedeki `{token}` kaydını bu hesaptan kaldırır |
| `POST /m/:tableToken/orders` | Firebase Bearer | Masaya `DINE_IN` siparişi; `{id}` |
| `POST /m/restaurants/:tenantId/orders` | Firebase Bearer | Teslimata `DELIVERY` siparişi; `{id}` |
| `GET /m/:tableToken/orders?sessionId=<uuid>` | Firebase Bearer | `{orders,sessionEnded}`; aynı kullanıcı/masa oturumu |
| `GET /m/restaurants/:tenantId/orders?sessionId=<uuid>` | Firebase Bearer | `{orders,sessionEnded}`; restoran teslimat oturumu |
| `GET /m/:tableToken/orders/:id?sessionId=<uuid>` | Firebase Bearer | `{status,number,reason}` |
| `GET /m/account/history/orders` | Firebase Bearer | Hesap sahibinin son 100 restoranlar arası QR siparişi |

Sipariş geçmişi kısa özet kartları gösterir; karta dokununca siparişin ürün,
ücret, ödeme ve durum geçmişi ayrı bir detay sayfasında açılır.
Teslimat adresi restoran dizininde seçilir ve kullanıcı bazında cihazda saklanır;
restoran menüsündeki sepet yalnızca bu adresi kullanır, adres değişimi ana
sayfadan yapılır.

Profil uçları en fazla 10 kayıtlı teslimat adresi döndürür ve kaydeder:
`addresses:[{id,label,address,latitude,longitude,isDefault}]`. Enlem/boylam
opsiyoneldir ve birlikte ayarlanmalıdır. Eski `address` alanı varsayılan
adresle uyumluluk için korunur.

Sipariş request body:

```json
{
  "sessionId": "UUID",
  "orderType": "DINE_IN",
  "note": "Opsiyonel sipariş notu",
  "shareContactDetails": false,
  "items": [{
    "productId": "UUID",
    "quantity": 1,
    "note": "Opsiyonel kalem notu",
    "modifierIds": ["UUID"],
    "menuOptionIds": ["UUID"]
  }]
}
```

`orderType` masada `DINE_IN`, restoran menüsünde `DELIVERY` olmalıdır.
`items` 1–40 satır, her `quantity` 1–20 aralığındadır; `sessionId` UUID'dir.
Restoran yoğunluk nedeniyle online teslimatı geçici kapatabilir. Bu durumda
menü görüntülenmeye devam eder, yeni `DELIVERY` siparişleri `409` ile reddedilir;
masa QR siparişleri ve daha önce alınan siparişler etkilenmez.
Teslimat siparişinde `deliveryAddressId` seçilen kayıtlı adresi belirtir.
Profildeki adresler ve adres eklerken kaydedilen `latitude`/`longitude`
hesapta saklanır; yalnızca seçilen adres siparişle restorana iletilir.
İstemci fiyat/ara toplam göndermez. Cloud menü snapshot'ından tahmini tutarı
hesaplar, POS kasası onay sırasında kendi veritabanından fiyatı tekrar hesaplar.
`id` UUID alanı tekrar gönderimi idempotent yapmak için opsiyoneldir.
Km bazlı teslimat ücretinde seçilen adresin kayıtlı konumu kullanılır; müşteri
sipariş anında orada bulunmak veya yeniden GPS izni vermek zorunda değildir.
Cloud restoran koordinatlarıyla Haversine mesafesini hesaplar ve km ücretini
kuruşa yuvarlar. Adres koordinatları profil hesabında saklanır, siparişe veya
restorana aktarılmaz. Eski istemciler geriye uyumluluk için
`"customerLocation":{"latitude":41.01,"longitude":28.97}` gönderebilir.

Profil PUT gövdesi:
`{"name":"…","phone":"…","addresses":[{"id":"UUID","label":"Ev","address":"…","latitude":40.99,"longitude":29.02,"isDefault":true}],"shareWithRestaurant":false}`.
Restorana yalnız `shareWithRestaurant` açıkken seçilen adres ve telefon
gönderilir. Eski istemcilerdeki tek `address` alanı varsayılan adres olarak
desteklenir.

Cloud istek sınırları daima geçerlidir; masada 3 bekleyen sipariş sınırı ve
IP/tenant rate limit aşılınca 429, engellenmiş müşteri 403, gerekli Firebase
token yoksa 401 döner. Endpoint'in ayrıntılı server şeması ve error response
kuralları [POS Cloud API referansında](../pos-cloud/README.md#qr-menü-apisi).

## İş kuralları ve gizlilik

- Restoran dizininde yalnız teslimat açılmış işletmeler listelenir; masa QR
  bağlantısı doğrudan masaya gider ve teslimat seçeneği sunmaz.
- İstemcide görülen tutar tahmindir. Ürün fiyatı, seçenek fiyatı, indirim,
  teslimat ücreti ve kesin toplam POS tarafından onayda belirlenir.
- POS teslimat ücretini tahminden yükseltirse müşteri sipariş geçmişinde yeni
  ücreti kabul edebilir veya siparişi iptal edebilir. Yanıt gelmediğinde
  sipariş otomatik iptal olmaz; personel müşteriyi arayıp kararı POS'tan
  kaydedebilir.
- Sipariş önce Cloud'da `PENDING` olur; kasaya aktarılır, personel onaylar veya
  reddeder. Onay gerçek POS adisyonu oluşturur; müşteri geçmişi Cloud'dan
  durum ve son tutarı alır.
- Müşteri sipariş geçmişinden tarayıcı bildirimini ayrıca açabilir. Cloud,
  sipariş onay/iptal/ödeme durumunda FCM bildirimi gönderir; teslimat ücreti
  değiştiyse eski ve yeni ücreti ve kesin toplamı bildirir. Push için HTTPS,
  Firebase Messaging Sender ID, Web Push VAPID public key ve Cloud'da Firebase
  Admin service-account credential gerekir.
- Profil, kayıtlı adresler ve sipariş geçmişi Firebase UID'ye bağlıdır.
  Kullanıcı farklı cihazlarda aynı Firebase hesabıyla giriş yaparsa
  adreslerine ve geçmişine erişebilir. Km ücreti için adres konumu adres
  kaydedilirken eklenir; sipariş anında müşterinin GPS'i gerekmez.
- Sipariş bildirimleri tercihi QR Menü'nün `Bilgilerim` ayarları altında
  yönetilir; FCM token bu tarayıcıya ve hesaba bağlanır.
- Menüdeki restaurant address/phone/delivery fee POS/Cloud ayarlarından gelir;
  frontend bunları değiştirmez. Teslimat minimumu ürün ara toplamına uygulanır,
  teslimat ücreti bu tutara dahil değildir; istemci düşük sepeti engeller ve
  Cloud siparişi kabul etmeden önce aynı sınırı sunucu tarafında doğrular.

## AI agent ve katkı notları

- Önce [AGENTS.md](AGENTS.md)'yi okuyun. Bu repo yalnız frontend'dir; `/m`
  endpoint sözleşmesini veya veritabanını frontend içinde taklit etmeyin.
- API alanlarını değiştirirken POS Cloud'daki QR controller ve servis
  doğrulamasıyla, ayrıca bu README'deki request/response tablosuyla birlikte
  güncelleyin.
- Yeni route eklenirse Vite/hosting SPA fallback'ini ve `getTableToken`,
  `getRestaurantId`, `getMenuPath` URL çözümlemesini kontrol edin.
- API/client'tan dönen hata mesajlarını kullanıcıya görünür tutun; sessiz boş
  menü veya sahte başarılı sipariş üretmeyin.
- Doğrulama: `npm run lint` ve `npm run build`. Firebase popup, CORS ve gerçek
  sipariş uçtan uca doğrulaması için çalışan Cloud API ve Firebase sağlayıcı
  yapılandırması gerekir.
