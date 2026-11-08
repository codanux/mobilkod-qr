import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Auth, User } from "firebase/auth";
import { clearSession, customerRequest, getAccessToken, request } from "./api";
import { firebaseConfig } from "./firebase-config";
import { AddressBookPage } from "./pages/AddressBookPage";
import { BottomNav } from "./pages/BottomNav";
import { MenuPage } from "./pages/MenuPage";
import { OrderHistoryPage } from "./pages/OrderHistoryPage";
import { ProfilePage } from "./pages/ProfilePage";
import { RestaurantDirectoryPage } from "./pages/RestaurantDirectoryPage";
import type { CartLine, ContactAddress, ContactProfile, CustomerOrder, MenuResponse, Product, Restaurant } from "./types";
import "./App.css";

const MAX_SAVED_ADDRESSES = 10;

function initialPublicData(path: string): unknown {
  const element = document.getElementById("qr-public-data");
  if (!element?.textContent) return undefined;
  try {
    const payload: unknown = JSON.parse(element.textContent);
    if (payload && typeof payload === "object" && "path" in payload && payload.path === path && "data" in payload) return payload.data;
  } catch (error) {
    console.error("Başlangıç verisi okunamadı:", error);
  }
  return undefined;
}

function emptyContactProfile(): ContactProfile {
  return { name: "", phone: "", address: "", addresses: [], shareWithRestaurant: false };
}

function defaultAddressId(profile: ContactProfile) {
  return profile.addresses.find((address) => address.isDefault)?.id
    ?? profile.addresses[0]?.id
    ?? "";
}

function selectedAddressStorageKey(uid: string) {
  return `qr-selected-delivery-address:v1:${uid}`;
}

function readSelectedAddressId(uid: string) {
  return localStorage.getItem(selectedAddressStorageKey(uid)) ?? "";
}

function contactProfileFromServer(profile: Partial<ContactProfile>): ContactProfile {
  const address = typeof profile.address === "string" ? profile.address : "";
  const addresses = profile.addresses ?? (address.trim()
    ? [{ id: null, label: "Adres", address, isDefault: true }]
    : []);
  return {
    name: profile.name ?? "",
    phone: profile.phone ?? "",
    address,
    addresses,
    shareWithRestaurant: profile.shareWithRestaurant === true,
  };
}

const EMPTY_CATEGORIES: MenuResponse["categories"] = [];

const money = new Intl.NumberFormat("tr-TR", {
  style: "currency",
  currency: "TRY",
});

function getTableToken() {
  const parts = window.location.pathname.split("/").filter(Boolean);
  if (parts[0] === "restaurant" || parts[0] === "orders" || parts[0] === "profile") return null;
  return parts[0] === "m" ? parts[1] : parts[0];
}

function getRestaurantId() {
  const parts = window.location.pathname.split("/").filter(Boolean);
  return parts[0] === "restaurant" ? parts[1] ?? null : null;
}

function getMenuPath() {
  const parts = window.location.pathname.split("/").filter(Boolean);
  if (parts.at(-2) === "orders") parts.pop();
  if (parts.at(-1) === "orders" || parts.at(-1) === "profile" || parts.at(-1) === "addresses") parts.pop();
  if (parts.at(-1) === "profile") parts.pop();
  return `/${parts.join("/")}`;
}

function getOrderDetailId() {
  const parts = window.location.pathname.split("/").filter(Boolean);
  const orderIndex = parts.lastIndexOf("orders");
  return orderIndex >= 0 && orderIndex === parts.length - 2 ? parts.at(-1) ?? null : null;
}

function isOrdersPath() {
  return window.location.pathname.split("/").filter(Boolean).at(-1) === "orders" || getOrderDetailId() !== null;
}

function isProfilePath() {
  return window.location.pathname.split("/").filter(Boolean).at(-1) === "profile";
}

function isAddressesPath() {
  const parts = window.location.pathname.split("/").filter(Boolean);
  return parts.at(-1) === "addresses" && parts.at(-2) === "profile";
}

function contactProfileKey(menu: MenuResponse) {
  const shop = menu.shop.trim().toLocaleLowerCase("tr-TR");
  return `qr-contact-profile:v1:${firebaseConfig.projectId}:${shop}`;
}

function readContactProfile(menu: MenuResponse): ContactProfile {
  const saved = localStorage.getItem(contactProfileKey(menu));
  if (!saved) return emptyContactProfile();
  const value: unknown = JSON.parse(saved);
  if (!value || typeof value !== "object" || !("phone" in value) || !("address" in value) ||
    typeof value.phone !== "string" || typeof value.address !== "string" ||
    ("name" in value && typeof value.name !== "string") ||
    ("shareWithRestaurant" in value && typeof value.shareWithRestaurant !== "boolean")) {
    throw new Error("Kayıtlı telefon/adres bilgileri okunamadı. Bilgilerim bölümünden yeniden kaydedin.");
  }
  const address = value.address.slice(0, 300);
  return {
    name: "name" in value && typeof value.name === "string" ? value.name.slice(0, 100) : "",
    phone: value.phone.slice(0, 40),
    address,
    addresses: address.trim() ? [{ id: null, label: "Adres", address, isDefault: true }] : [],
    shareWithRestaurant: false,
  };
}

const sessionCache = new Map<string, string>();
function newSessionId() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function getTableSessionId(token: string, rotate = false) {
  const key = `qr-table-session:${token}`;
  if (!rotate) {
    try {
      const saved = sessionStorage.getItem(key);
      if (saved && /^[0-9a-f-]{36}$/i.test(saved)) return saved;
    } catch { /* Continue with an in-memory session if browser storage is unavailable. */ }
    const cached = sessionCache.get(key);
    if (cached) return cached;
  }
  const id = newSessionId();
  sessionCache.set(key, id);
  try { sessionStorage.setItem(key, id); } catch { /* Keep the session in memory for this page. */ }
  return id;
}

function getDeliverySessionId(token: string) {
  const key = `qr-delivery-session:${token}`;
  try {
    const saved = sessionStorage.getItem(key);
    if (saved && /^[0-9a-f-]{36}$/i.test(saved)) return saved;
  } catch { /* Continue with an in-memory session if browser storage is unavailable. */ }
  const cached = sessionCache.get(key);
  if (cached) return cached;
  const id = newSessionId();
  sessionCache.set(key, id);
  try { sessionStorage.setItem(key, id); } catch { /* Keep the session in memory for this page. */ }
  return id;
}

function priceFor(product: Product, selected: string[]) {
  let base = product.price;
  let delta = 0;
  for (const group of product.groups) {
    for (const option of group.options) {
      if (!selected.includes(option.id)) continue;
      if (option.abs !== null) base = option.abs;
      else delta += option.delta;
    }
  }
  for (const slot of product.slots ?? []) {
    for (const option of slot.options) {
      if (selected.includes(option.id)) delta += option.upcharge;
    }
  }
  return base + delta;
}

function App() {
  const token = getTableToken();
  const restaurantId = getRestaurantId();
  const menuApiPath = token
    ? `/m/${encodeURIComponent(token)}`
    : restaurantId ? `/m/restaurants/${encodeURIComponent(restaurantId)}` : null;
  const bootstrap = useMemo(() => initialPublicData(menuApiPath ? `${menuApiPath}/menu` : "/m/restaurants"), [menuApiPath]);
  const initialMenu = menuApiPath && bootstrap && typeof bootstrap === "object" && "categories" in bootstrap ? bootstrap as MenuResponse : null;
  const initialRestaurants = !menuApiPath && bootstrap && typeof bootstrap === "object" && "restaurants" in bootstrap && Array.isArray(bootstrap.restaurants) ? bootstrap.restaurants as Restaurant[] : null;
  const [menu, setMenu] = useState<MenuResponse | null>(initialMenu);
  const [restaurants, setRestaurants] = useState<Restaurant[]>(initialRestaurants ?? []);
  const [restaurantsLoading, setRestaurantsLoading] = useState(!menuApiPath && !initialRestaurants);
  const [loadError, setLoadError] = useState("");
  const [query, setQuery] = useState("");
  const [categoryId, setCategoryId] = useState("all");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string[]>>({});
  const [productQuantity, setProductQuantity] = useState(1);
  const [productNote, setProductNote] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [cartNote, setCartNote] = useState("");
  const [cartOpen, setCartOpen] = useState(false);
  const [lineNoteKey, setLineNoteKey] = useState<string | null>(null);
  const [lineNoteDraft, setLineNoteDraft] = useState("");
  const [orderSent, setOrderSent] = useState(false);
  const [view, setView] = useState<"menu" | "orders" | "profile" | "addresses">(() =>
    isOrdersPath() ? "orders" : isAddressesPath() ? "addresses" : isProfilePath() ? "profile" : "menu");
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(() => getOrderDetailId());
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [auth, setAuth] = useState<Auth | null>(null);
  const [dataNoticeOpen, setDataNoticeOpen] = useState(false);
  const [dataNoticeChecked, setDataNoticeChecked] = useState(false);
  const [pendingOrderProvider, setPendingOrderProvider] = useState<"google" | "apple" | null>(null);
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [tableSessionId] = useState(() => token ? getTableSessionId(token) : "");
  const [deliverySessionId] = useState(() => getDeliverySessionId(restaurantId ?? token ?? "directory"));
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersError, setOrdersError] = useState("");
  const [feeResponseBusy, setFeeResponseBusy] = useState<string | null>(null);
  const [feeResponseMessage, setFeeResponseMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const [contactProfile, setContactProfile] = useState<ContactProfile>(emptyContactProfile);
  const [contactDraft, setContactDraft] = useState<ContactProfile>(emptyContactProfile);
  const [selectedDeliveryAddressId, setSelectedDeliveryAddressId] = useState("");
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [pushRegistered, setPushRegistered] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [pushMessage, setPushMessage] = useState("");
  const [pushError, setPushError] = useState("");
  const [addressLocationBusy, setAddressLocationBusy] = useState<number | null>(null);
  const [expandedAddressId, setExpandedAddressId] = useState<string | null>(null);
  const [addressSavingId, setAddressSavingId] = useState<string | null>(null);
  const [savedAddressId, setSavedAddressId] = useState<string | null>(null);
  const productDialogScroll = useRef<HTMLDivElement>(null);
  const orderType = menu?.isTableQr ? "DINE_IN" : "DELIVERY";

  const getPushMessaging = useCallback(async () => {
    const { isSupported, getMessaging } = await import("firebase/messaging");
    if (!firebaseConfig.vapidKey || !firebaseConfig.messagingSenderId) {
      throw new Error("Push bildirimleri için Firebase Messaging Sender ID ve VAPID anahtarı QR Menu'de yapılandırılmalı.");
    }
    if (!("serviceWorker" in navigator) || !(await isSupported())) {
      throw new Error("Bu tarayıcı push bildirimlerini desteklemiyor.");
    }
    const { getFirebaseApp } = await import("./firebase");
    const app = getFirebaseApp();
    const messaging = getMessaging(app);
    const workerConfig = {
      apiKey: firebaseConfig.apiKey,
      authDomain: firebaseConfig.authDomain,
      projectId: firebaseConfig.projectId,
      appId: firebaseConfig.appId,
      messagingSenderId: firebaseConfig.messagingSenderId,
    };
    const query = new URLSearchParams({ config: JSON.stringify(workerConfig) });
    const registration = await navigator.serviceWorker.register(`/firebase-messaging-sw.js?${query}`);
    return { messaging, registration };
  }, []);

  const syncPushToken = useCallback(async (user: User, token: string) => {
    await customerRequest(user, "/m/notifications/token", {
      method: "PUT",
      body: JSON.stringify({ token }),
    });
  }, []);

  async function toggleOrderNotifications() {
    if (!authUser) return;
    setPushBusy(true);
    setPushError("");
    setPushMessage("");
    try {
      if (!pushRegistered) {
        if (typeof Notification === "undefined") throw new Error("Bu tarayıcı push bildirimlerini desteklemiyor.");
        let permission = Notification.permission;
        if (permission === "default") permission = await Notification.requestPermission();
        if (permission !== "granted") {
          throw new Error(permission === "denied"
            ? "Bildirim izni kapalı. Tarayıcı ayarlarından QR Menü bildirimlerine izin verin."
            : "Bildirim izni verilmedi.");
        }
      }
      const { getToken, deleteToken } = await import("firebase/messaging");
      const { messaging, registration } = await getPushMessaging();
      if (pushRegistered) {
        const token = await getToken(messaging, { vapidKey: firebaseConfig.vapidKey, serviceWorkerRegistration: registration });
        if (token) {
          await customerRequest(authUser, "/m/notifications/token", {
            method: "DELETE",
            body: JSON.stringify({ token }),
          });
        }
        await deleteToken(messaging);
        setPushRegistered(false);
        setPushMessage("Sipariş bildirimleri kapatıldı.");
      } else {
        const token = await getToken(messaging, { vapidKey: firebaseConfig.vapidKey, serviceWorkerRegistration: registration });
        if (!token) throw new Error("Firebase push token'ı alınamadı.");
        await syncPushToken(authUser, token);
        setPushRegistered(true);
        setPushMessage("Sipariş durum bildirimleri açıldı.");
      }
    } catch (error) {
      setPushError(error instanceof Error ? error.message : "Bildirim tercihi kaydedilemedi.");
    } finally {
      setPushBusy(false);
    }
  }

  function navigateView(next: "menu" | "orders" | "profile" | "addresses") {
    const menuPath = getMenuPath();
    const target = next === "orders"
      ? menuApiPath ? `${menuPath}/orders` : "/orders"
      : next === "profile" ? menuApiPath ? `${menuPath}/profile` : "/profile"
        : next === "addresses" ? menuApiPath ? `${menuPath}/profile/addresses` : "/profile/addresses"
          : menuPath;
    if (window.location.pathname !== target) window.history.pushState({}, "", target);
    if (next === "profile" || next === "addresses") setContactDraft(contactProfile);
    setSelectedOrderId(null);
    setView(next);
    window.scrollTo(0, 0);
  }

  function navigateOrderDetail(orderId: string) {
    const target = menuApiPath
      ? `${getMenuPath()}/orders/${encodeURIComponent(orderId)}`
      : `/orders/${encodeURIComponent(orderId)}`;
    if (window.location.pathname !== target) window.history.pushState({}, "", target);
    setSelectedOrderId(orderId);
    setView("orders");
    window.scrollTo(0, 0);
  }

  function openOrdersList() {
    navigateView("orders");
  }

  function selectDeliveryAddress(addressId: string) {
    setSelectedDeliveryAddressId(addressId);
    if (!authUser) return;
    try {
      localStorage.setItem(selectedAddressStorageKey(authUser.uid), addressId);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Seçilen adres bu cihazda saklanamadı.");
    }
  }

  useEffect(() => {
    let active = true;
    setLoadError("");
    if (!menuApiPath) {
      if (initialRestaurants) return;
      setRestaurantsLoading(true);
      request<{ restaurants: Restaurant[] }>("/m/restaurants")
        .then(({ restaurants: rows }) => {
          if (active) setRestaurants(rows);
        })
        .catch((error: unknown) => {
          if (active) setLoadError(error instanceof Error ? error.message : "Restoranlar yüklenemedi.");
        })
        .finally(() => {
          if (active) setRestaurantsLoading(false);
        });
      return () => { active = false; };
    }
    (initialMenu ? Promise.resolve(initialMenu) : request<MenuResponse>(`${menuApiPath}/menu`))
      .then((data) => {
        if (!active) return;
        setMenu(data);
        try {
          const profile = readContactProfile(data);
          setContactDraft(profile);
          setSelectedDeliveryAddressId(defaultAddressId(profile));
        } catch (error) {
          setActionError(error instanceof Error ? error.message : "Kayıtlı bilgiler okunamadı.");
        }
      })
      .catch((error: unknown) => {
        if (active) setLoadError(error instanceof Error ? error.message : "Menü yüklenemedi.");
      });
    return () => {
      active = false;
    };
  }, [menuApiPath, initialMenu, initialRestaurants]);

  useEffect(() => {
    if ((!menu && menuApiPath) || !authUser) return;
    let active = true;
    setProfileLoading(true);
    setProfileError("");
    void customerRequest<{ profile: Partial<ContactProfile> | null }>(authUser, "/m/profile/current")
      .then(({ profile }) => {
        if (!active) return;
        if (profile) {
          const savedProfile = contactProfileFromServer(profile);
          setContactProfile(savedProfile);
          setContactDraft(savedProfile);
          const savedSelection = readSelectedAddressId(authUser.uid);
          const nextAddressId = savedProfile.addresses.some((address) => address.id === savedSelection)
            ? savedSelection
            : defaultAddressId(savedProfile);
          setSelectedDeliveryAddressId(nextAddressId);
        } else {
          setContactProfile(emptyContactProfile());
          setContactDraft((current) => ({ ...current, name: current.name || authUser.displayName?.trim() || "" }));
        }
      })
      .catch((error: unknown) => {
        if (active) setProfileError(error instanceof Error ? error.message : "Profil bilgileri buluttan alınamadı.");
      })
      .finally(() => {
        if (active) setProfileLoading(false);
      });
    return () => {
      active = false;
    };
  }, [authUser, menu, menuApiPath]);

  useEffect(() => {
    const previousScrollRestoration = window.history.scrollRestoration;
    window.history.scrollRestoration = "manual";
    window.scrollTo(0, 0);
    const onPopState = () => {
      setSelectedOrderId(getOrderDetailId());
      setView(isOrdersPath() ? "orders" : isAddressesPath() ? "addresses" : isProfilePath() ? "profile" : "menu");
      window.scrollTo(0, 0);
    };
    window.addEventListener("popstate", onPopState);
    return () => {
      window.removeEventListener("popstate", onPopState);
      window.history.scrollRestoration = previousScrollRestoration;
    };
  }, []);

  useEffect(() => {
    let active = true;
    let unsubscribe: (() => void) | undefined;
    void import("./firebase")
      .then(({ auth: firebaseAuth, onAuthStateChanged }) => {
        if (active) {
          setAuth(firebaseAuth);
          unsubscribe = onAuthStateChanged(firebaseAuth, (user) => {
            if (!user) clearSession();
            setAuthUser(user);
            setAuthReady(true);
          });
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setOrdersError(error instanceof Error ? error.message : "Oturum başlatılamadı.");
          setAuthReady(true);
        }
      });
    return () => {
      active = false;
      unsubscribe?.();
    };
  }, []);

  useEffect(() => {
    if (!authUser || typeof Notification === "undefined" || Notification.permission !== "granted") return;
    let active = true;
    void (async () => {
      try {
        const { getToken } = await import("firebase/messaging");
        const { messaging, registration } = await getPushMessaging();
        const token = await getToken(messaging, { vapidKey: firebaseConfig.vapidKey, serviceWorkerRegistration: registration });
        if (!token) throw new Error("Firebase push token'ı alınamadı.");
        await syncPushToken(authUser, token);
        if (active) setPushRegistered(true);
      } catch (error) {
        if (active) setPushError(error instanceof Error ? error.message : "Push bildirimi kaydedilemedi.");
      }
    })();
    return () => { active = false; };
  }, [authUser, getPushMessaging, syncPushToken]);

  useEffect(() => {
    if (!authUser || !pushRegistered) return;
    let active = true;
    let unsubscribe: (() => void) | undefined;
    void import("firebase/messaging").then(async ({ isSupported, getMessaging, onMessage }) => {
      const supported = await isSupported();
      if (!supported || !active) return;
      const { getFirebaseApp } = await import("./firebase");
      if (!active) return;
      const app = getFirebaseApp();
      unsubscribe = onMessage(getMessaging(app), (payload) => {
        if (active) setPushMessage(payload.notification?.body ?? "Siparişinizin durumu güncellendi.");
      });
    }).catch((error: unknown) => {
      if (active) setPushError(error instanceof Error ? error.message : "Ön plan bildirimi başlatılamadı.");
    });
    return () => {
      active = false;
      unsubscribe?.();
    };
  }, [authUser, pushRegistered]);

  useEffect(() => {
    const publicPage = view === "menu" && !token;
    document.title = view === "menu" ? menu ? `${menu.shop} Menü ve Online Sipariş | Mobilkod` : "Restoranlar ve online menüler | Mobilkod"
      : `${view === "orders" ? "Siparişlerim" : view === "addresses" ? "Teslimat adreslerim" : "Bilgilerim"} | Mobilkod`;
    let robots = document.querySelector<HTMLMetaElement>('meta[name="robots"]');
    if (!robots) { robots = document.createElement("meta"); robots.name = "robots"; document.head.appendChild(robots); }
    robots.content = publicPage ? "index, follow" : "noindex, nofollow";
  }, [menu, view, token]);

  useEffect(() => {
    if (view !== "orders" || !authUser) return;
    let active = true;
    let inFlight = false;
    const load = async () => {
      if (inFlight) return;
      inFlight = true;
      try {
        const result = await customerRequest<{ orders: CustomerOrder[] }>(authUser, 
          "/m/account/history/orders", {
        });
        if (active) {
          setOrders(result.orders);
          setOrdersError("");
          setOrdersLoading(false);
        }
      } catch (error) {
        if (active) {
          setOrdersError(error instanceof Error ? error.message : "Siparişleriniz alınamadı.");
          setOrdersLoading(false);
        }
      } finally {
        inFlight = false;
      }
    };
    setOrdersLoading(true);
    void load();
    const timer = window.setInterval(() => { if (!document.hidden) void load(); }, 5000);
    const onVisibilityChange = () => { if (!document.hidden) void load(); };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      active = false;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [authUser, view]);

  const categories = menu?.categories ?? EMPTY_CATEGORIES;
  const selectedOrder = useMemo(
    () => orders.find((order) => order.id === selectedOrderId) ?? null,
    [orders, selectedOrderId],
  );
  const visibleCategories = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("tr");
    return categories
      .filter((category) => categoryId === "all" || category.id === categoryId)
      .map((category) => ({
        ...category,
        products: category.products.filter((product) =>
          !normalized ||
          product.name.toLocaleLowerCase("tr").includes(normalized) ||
          product.description?.toLocaleLowerCase("tr").includes(normalized),
        ),
      }))
      .filter((category) => category.products.length > 0);
  }, [categories, categoryId, query]);

  const total = cart.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);
  const deliveryMinimumOrder = menu?.deliveryMinimumOrder ?? 0;
  const deliveryMinimumMet = menu?.isTableQr !== false || Math.round(total * 100) >= Math.round(deliveryMinimumOrder * 100);
  const count = cart.reduce((sum, line) => sum + line.quantity, 0);
  const selectedDeliveryAddress = contactProfile.addresses.find((address) => (address.id ?? "") === selectedDeliveryAddressId);
  const selectedAddressHasLocation = Number.isFinite(selectedDeliveryAddress?.latitude) &&
    Number.isFinite(selectedDeliveryAddress?.longitude);
  const selectedAddressLocation = useMemo(
    () => selectedAddressHasLocation && selectedDeliveryAddress
      ? { latitude: selectedDeliveryAddress.latitude!, longitude: selectedDeliveryAddress.longitude! }
      : null,
    [selectedAddressHasLocation, selectedDeliveryAddress],
  );
  const deliveryDistanceKm = menu?.isTableQr === false &&
    menu.deliveryPerKm !== null &&
    Number.isFinite(menu.deliveryOriginLatitude) &&
    Number.isFinite(menu.deliveryOriginLongitude) &&
    selectedAddressLocation
    ? distanceKm(
      { latitude: menu.deliveryOriginLatitude!, longitude: menu.deliveryOriginLongitude! },
      selectedAddressLocation,
    )
    : null;
  const activeDeliveryQuote = deliveryDistanceKm !== null && menu?.isTableQr === false && menu.deliveryPerKm !== null
    ? {
      tenantId: menu.tenantId,
      addressId: selectedDeliveryAddressId,
      distanceKm: deliveryDistanceKm,
      fee: Math.ceil(deliveryDistanceKm * menu.deliveryPerKm),
    }
    : null;
  const deliveryTotal = total + (menu?.isTableQr ? 0 : activeDeliveryQuote?.fee ?? menu?.deliveryFee ?? 0);
  const directoryRestaurants = useMemo(() => selectedAddressLocation
    ? restaurants
      .map((restaurant) => ({
        restaurant,
        distance: Number.isFinite(restaurant.deliveryOriginLatitude) && Number.isFinite(restaurant.deliveryOriginLongitude)
          ? distanceKm(
            selectedAddressLocation,
            { latitude: restaurant.deliveryOriginLatitude!, longitude: restaurant.deliveryOriginLongitude! },
          )
          : null,
      }))
      .sort((a, b) => {
        if (a.distance === null) return b.distance === null ? a.restaurant.name.localeCompare(b.restaurant.name, "tr") : 1;
        if (b.distance === null) return -1;
        return a.distance - b.distance;
      })
    : restaurants.map((restaurant) => ({ restaurant, distance: null })), [restaurants, selectedAddressLocation]);
  const sortedRestaurants = useMemo(
    () => directoryRestaurants.map(({ restaurant }) => restaurant),
    [directoryRestaurants],
  );
  const deliveryLocationReady = menu?.isTableQr !== false || menu?.deliveryPerKm === null || selectedAddressHasLocation;
  const deliveryProfileReady = !!authUser &&
    !profileLoading &&
    contactProfile.shareWithRestaurant &&
    !!selectedDeliveryAddress?.address.trim() &&
    !!contactProfile.phone.trim();

  const openProduct = useCallback((product: Product) => {
    setSelectedProduct(product);
    setSelectedOptions({});
    setProductQuantity(1);
    setProductNote("");
    setActionError("");
  }, []);

  function addToCart() {
    if (!selectedProduct) return;
    const selected = Object.values(selectedOptions).flat();
    const missing = selectedProduct.groups.find((group) => {
      const count = (selectedOptions[group.id] ?? []).length;
      return count < group.min || count > group.max;
    }) ?? selectedProduct.slots?.find((slot) => slot.required && (selectedOptions[slot.id] ?? []).length !== 1);
    if (missing) {
      setActionError(`${missing.name} seçimini yapın.`);
      productDialogScroll.current?.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    const modifierIds = selectedProduct.groups.flatMap((group) => selectedOptions[group.id] ?? []);
    const menuOptionIds = (selectedProduct.slots ?? []).flatMap((slot) => selectedOptions[slot.id] ?? []);
    const choiceNames = selectedProduct.groups.flatMap((group) =>
      group.options
        .filter((option) => selected.includes(option.id))
        .map((option) => option.name),
    );
    choiceNames.push(...(selectedProduct.slots ?? []).flatMap((slot) =>
      slot.options
        .filter((option) => (selectedOptions[slot.id] ?? []).includes(option.id))
        .map((option) => `${slot.name}: ${option.name}`),
    ));
    setCart((current) => [
      ...current,
      {
        key: crypto.randomUUID(),
        product: selectedProduct,
        quantity: productQuantity,
        note: productNote.trim(),
        modifierIds,
        menuOptionIds,
        choiceNames,
        unitPrice: priceFor(selectedProduct, selected),
      },
    ]);
    setSelectedProduct(null);
    setActionError("");
  }

  function changeQuantity(key: string, amount: number) {
    setCart((current) =>
      current
        .map((line) =>
          line.key === key
            ? { ...line, quantity: Math.min(20, line.quantity + amount) }
            : line,
        )
        .filter((line) => line.quantity > 0),
    );
  }

  function changeLineNote(key: string, note: string) {
    setCart((current) => current.map((line) => line.key === key ? { ...line, note } : line));
  }

  async function saveContactProfile() {
    if (!authUser) return;
    const addresses = contactDraft.addresses.map((entry) => ({
      id: entry.id ?? crypto.randomUUID(),
      label: entry.label.trim(),
      address: entry.address.trim(),
      latitude: entry.latitude ?? null,
      longitude: entry.longitude ?? null,
      isDefault: entry.isDefault,
    }));
    const profile = {
      ...contactDraft,
      name: contactDraft.name.trim() || authUser.displayName?.trim() || "",
      phone: contactDraft.phone.trim(),
      address: addresses.find((entry) => entry.isDefault)?.address ?? "",
      addresses,
    };
    if (addresses.length > MAX_SAVED_ADDRESSES || addresses.some((entry) => !entry.label || !entry.address)) {
      setActionError("Her adres için bir etiket ve açık adres girin. En fazla 10 adres ekleyebilirsiniz.");
      return;
    }
    if (profile.shareWithRestaurant && !profile.name && !authUser.displayName?.trim()) {
      setActionError("Otomatik paylaşım için adınızı girin.");
      return;
    }
    if (profile.shareWithRestaurant && !profile.phone && !profile.address) {
      setActionError("Otomatik paylaşım için telefon veya adres bilgisi ekleyin.");
      return;
    }
    setProfileSaving(true);
    setProfileSaved(false);
    try {
      const result = await customerRequest<{ profile: ContactProfile }>(authUser, "/m/profile/current", {
        method: "PUT",
        body: JSON.stringify(profile),
      });
      setContactProfile(result.profile);
      setContactDraft(result.profile);
      const savedSelection = readSelectedAddressId(authUser.uid);
      const nextAddressId = result.profile.addresses.some((address) => address.id === savedSelection)
        ? savedSelection
        : defaultAddressId(result.profile);
      selectDeliveryAddress(nextAddressId);
      setActionError("");
      setProfileError("");
      setProfileSaved(true);
      if (menu) {
        try {
          localStorage.removeItem(contactProfileKey(menu));
        } catch {
          setProfileError("Bulut profili kaydedildi; bu cihazdaki eski taslak silinemedi.");
        }
      }
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Profil buluta kaydedilemedi.");
    } finally {
      setProfileSaving(false);
    }
  }

  async function saveContactAddress(index: number) {
    if (!authUser || profileSaving || addressSavingId !== null) return;
    const target = contactDraft.addresses[index];
    if (!target) return;
    const targetKey = target.id ?? `legacy-address-${index}`;
    const label = target.label.trim();
    const address = target.address.trim();
    if (!label || !address) {
      setActionError("Adresi kaydetmek için etiket ve açık adres girin.");
      return;
    }

    const targetId = target.id ?? crypto.randomUUID();
    const addresses: ContactAddress[] = [];
    contactProfile.addresses.forEach((saved, savedIndex) => {
      const draftIndex = contactDraft.addresses.findIndex((entry, entryIndex) =>
        saved.id ? entry.id === saved.id : entry.id === null && entryIndex === savedIndex);
      if (draftIndex === -1) return;
      const draft = contactDraft.addresses[draftIndex];
      const isTarget = draftIndex === index;
      addresses.push({
        id: isTarget ? targetId : saved.id ?? crypto.randomUUID(),
        label: isTarget ? label : saved.label.trim(),
        address: isTarget ? address : saved.address.trim(),
        latitude: isTarget ? target.latitude ?? null : saved.latitude ?? null,
        longitude: isTarget ? target.longitude ?? null : saved.longitude ?? null,
        isDefault: isTarget ? target.isDefault : draft.isDefault,
      });
    });
    if (!addresses.some((entry) => entry.id === targetId)) {
      addresses.push({
        id: targetId,
        label,
        address,
        latitude: target.latitude ?? null,
        longitude: target.longitude ?? null,
        isDefault: target.isDefault,
      });
    }
    if (addresses.length > MAX_SAVED_ADDRESSES) {
      setActionError("En fazla 10 adres ekleyebilirsiniz.");
      return;
    }
    if (addresses.length > 0 && !addresses.some((entry) => entry.isDefault)) {
      const currentDefault = contactProfile.addresses.find((entry) => entry.isDefault);
      const defaultId = currentDefault && addresses.some((entry) => entry.id === currentDefault.id)
        ? currentDefault.id
        : addresses[0].id;
      for (const entry of addresses) entry.isDefault = entry.id === defaultId;
    }
    if (target.isDefault) {
      for (const entry of addresses) entry.isDefault = entry.id === targetId;
    }

    const profile = {
      ...contactProfile,
      address: addresses.find((entry) => entry.isDefault)?.address ?? "",
      addresses,
    };
    setAddressSavingId(targetKey);
    setSavedAddressId(null);
    setActionError("");
    try {
      const result = await customerRequest<{ profile: ContactProfile }>(authUser, "/m/profile/current", {
        method: "PUT",
        body: JSON.stringify(profile),
      });
      setContactProfile(result.profile);
      setContactDraft((current) => ({
        ...current,
        address: result.profile.address,
        addresses: current.addresses.map((entry, entryIndex) => {
          const saved = result.profile.addresses.find((candidate) =>
            candidate.id === (entry.id ?? (entryIndex === index ? targetId : null)));
          if (!saved) return entry;
          if (entryIndex === index) return saved;
          const outgoing = addresses.find((candidate) => candidate.id === saved.id);
          return { ...entry, id: saved.id, isDefault: outgoing?.isDefault ?? saved.isDefault };
        }),
      }));
      const selectedId = readSelectedAddressId(authUser.uid);
      selectDeliveryAddress(result.profile.addresses.some((entry) => entry.id === selectedId)
        ? selectedId
        : defaultAddressId(result.profile));
      setActionError("");
      setSavedAddressId(targetId);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Adres kaydedilemedi.");
    } finally {
      setAddressSavingId(null);
    }
  }

  function updateContactAddress(index: number, patch: Partial<ContactAddress>) {
    setProfileSaved(false);
    setSavedAddressId(null);
    setContactDraft((current) => ({
      ...current,
      addresses: current.addresses.map((address, addressIndex) =>
        addressIndex === index
          ? {
              ...address,
              ...patch,
              ...(Object.prototype.hasOwnProperty.call(patch, "address")
                ? { latitude: null, longitude: null }
                : {}),
            }
          : address,
      ),
    }));
  }

  function addContactAddress() {
    if (contactDraft.addresses.length >= MAX_SAVED_ADDRESSES) return;
    const isFirst = contactDraft.addresses.length === 0;
    const address: ContactAddress = {
      id: crypto.randomUUID(),
      label: `Adres ${contactDraft.addresses.length + 1}`,
      address: "",
      isDefault: isFirst,
    };
    setProfileSaved(false);
    setSavedAddressId(null);
    setContactDraft((current) => ({ ...current, addresses: [...current.addresses, address] }));
    setExpandedAddressId(address.id);
    if (isFirst) setSelectedDeliveryAddressId(address.id ?? "");
  }

  async function saveAddressLocation(index: number) {
    setAddressLocationBusy(index);
    setActionError("");
    try {
      const position = await getCurrentLocation();
      updateContactAddress(index, {
        latitude: Math.round(position.coords.latitude * 1_000_000) / 1_000_000,
        longitude: Math.round(position.coords.longitude * 1_000_000) / 1_000_000,
      });
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Adres konumu alınamadı.");
    } finally {
      setAddressLocationBusy(null);
    }
  }

  function removeContactAddress(index: number) {
    const removed = contactDraft.addresses[index];
    const addresses = contactDraft.addresses.filter((_, addressIndex) => addressIndex !== index);
    if (removed?.isDefault && addresses.length > 0) {
      addresses[0] = { ...addresses[0], isDefault: true };
    }
    setProfileSaved(false);
    setSavedAddressId(null);
    setContactDraft((current) => ({ ...current, addresses }));
    if (removed && expandedAddressId === (removed.id ?? `legacy-address-${index}`)) {
      setExpandedAddressId(null);
    }
    if (removed && (removed.id ?? "") === selectedDeliveryAddressId) {
      selectDeliveryAddress(defaultAddressId({ ...contactDraft, addresses }));
    }
  }

  function setDefaultContactAddress(index: number) {
    const address = contactDraft.addresses[index];
    setProfileSaved(false);
    setSavedAddressId(null);
    setContactDraft((current) => ({
      ...current,
      addresses: current.addresses.map((entry, addressIndex) => ({ ...entry, isDefault: addressIndex === index })),
    }));
    if (address) selectDeliveryAddress(address.id ?? "");
  }

  function openLineNote(line: CartLine) {
    setLineNoteKey(line.key);
    setLineNoteDraft(line.note);
  }

  function dataNoticeKey() {
    const shopKey = menu?.shop.trim().toLocaleLowerCase("tr-TR") ?? "unknown";
    return `qr-name-notice:v1:${firebaseConfig.projectId}:${shopKey}`;
  }

  function getCurrentLocation(): Promise<GeolocationPosition> {
    if (!navigator.geolocation) return Promise.reject(new Error("Bu cihaz konum bilgisini desteklemiyor."));
    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, (error) => {
        const message = error.code === error.PERMISSION_DENIED
          ? "Adres konumunu kaydetmek için tarayıcı konum izni gereklidir."
          : error.code === error.TIMEOUT
            ? "Konum alınamadı. Lütfen tekrar deneyin."
            : "Konum bilgisi alınamadı. Konum servislerini kontrol edin.";
        reject(new Error(message));
      }, { enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 });
    });
  }

  function distanceKm(from: { latitude: number; longitude: number }, to: { latitude: number; longitude: number }) {
    const radians = (degrees: number) => degrees * Math.PI / 180;
    const latitudeDelta = radians(to.latitude - from.latitude);
    const longitudeDelta = radians(to.longitude - from.longitude);
    const startLatitude = radians(from.latitude);
    const endLatitude = radians(to.latitude);
    const a = Math.sin(latitudeDelta / 2) ** 2 +
      Math.cos(startLatitude) * Math.cos(endLatitude) * Math.sin(longitudeDelta / 2) ** 2;
    return 2 * 6371.0088 * Math.asin(Math.sqrt(Math.min(1, a)));
  }

  function requestOrder(providerName: "google" | "apple") {
    try {
      if (localStorage.getItem(dataNoticeKey()) === "accepted") {
        void submitOrder(providerName);
        return;
      }
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Bilgilendirme tercihi okunamadı.");
      return;
    }
    setPendingOrderProvider(providerName);
    setDataNoticeChecked(false);
    setDataNoticeOpen(true);
  }

  function acceptDataNotice() {
    if (!dataNoticeChecked || !pendingOrderProvider || !menu) return;
    try {
      localStorage.setItem(dataNoticeKey(), "accepted");
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Bilgilendirme tercihi kaydedilemedi.");
      return;
    }
    const provider = pendingOrderProvider;
    setDataNoticeOpen(false);
    setPendingOrderProvider(null);
    void submitOrder(provider);
  }

  async function submitOrder(providerName: "google" | "apple") {
    if (!menu || !menuApiPath || cart.length === 0) return;
    if (orderType === "DELIVERY" && menu.deliveryAcceptingOrders === false) {
      setActionError("Restoran şu anda yoğun. Online eve siparişi geçici olarak kapalı; lütfen daha sonra tekrar deneyin.");
      return;
    }
    if (orderType === "DELIVERY" && !deliveryMinimumMet) {
      setActionError(`Teslimat için minimum ürün sepeti tutarı ${money.format(deliveryMinimumOrder)}. Sepetinizi bu tutara tamamlayın.`);
      return;
    }
    if (orderType === "DELIVERY" && !deliveryProfileReady) {
      setActionError("Eve teslimat için Bilgilerim bölümünde seçili adres, telefon ve otomatik paylaşım gerekli.");
      return;
    }
    setBusy(true);
    setActionError("");
    try {
      if (orderType === "DELIVERY" && menu.deliveryPerKm !== null) {
        if (menu.deliveryOriginLatitude === null || menu.deliveryOriginLongitude === null) {
          throw new Error("Restoran teslimat konumunu henüz ayarlamadı.");
        }
        if (!selectedDeliveryAddress ||
          !Number.isFinite(selectedDeliveryAddress.latitude) ||
          !Number.isFinite(selectedDeliveryAddress.longitude)) {
          throw new Error("Seçtiğiniz adresin konumunu Bilgilerim bölümünde kaydedin.");
        }
        if (!activeDeliveryQuote || activeDeliveryQuote.addressId !== selectedDeliveryAddressId) {
          throw new Error("Seçili adres için yol ücreti hesaplanamadı. Adres konumunu kontrol edin.");
        }
      }
      if (!auth) throw new Error("Oturum başlatılamadı. Sayfayı yenileyip tekrar deneyin.");
      const { GoogleAuthProvider, OAuthProvider, signInWithPopup } = await import("./firebase");
      const currentAuth = auth;
      const provider =
        providerName === "google"
          ? new GoogleAuthProvider()
          : new OAuthProvider("apple.com");
      if (providerName === "apple") provider.addScope("name");
      const user = currentAuth.currentUser ?? (await signInWithPopup(currentAuth, provider)).user;
      await getAccessToken(user);
      setAuthUser(user);
      await customerRequest<{ id: string }>(user, 
        `${menuApiPath}/orders`,
        {
          method: "POST",
          body: JSON.stringify({
            sessionId: menu.isTableQr ? tableSessionId : deliverySessionId,
            orderType,
            ...(!menu.isTableQr && selectedDeliveryAddressId && { deliveryAddressId: selectedDeliveryAddressId }),
            note: cartNote.trim() || undefined,
            ...(contactProfile.shareWithRestaurant && {
              shareContactDetails: true,
            }),
            items: cart.map((line) => ({
              productId: line.product.id,
              quantity: line.quantity,
              note: line.note || undefined,
              ...(line.modifierIds.length > 0 && { modifierIds: line.modifierIds }),
              ...(line.menuOptionIds.length > 0 && { menuOptionIds: line.menuOptionIds }),
            })),
          }),
        },
      );
      setCart([]);
      setCartNote("");
      setCartOpen(false);
      setOrderSent(true);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Sipariş gönderilemedi.");
    } finally {
      setBusy(false);
    }
  }

  async function signInForOrders(providerName: "google" | "apple") {
    if (!auth) {
      setOrdersError("Oturum başlatılamadı. Sayfayı yenileyip tekrar deneyin.");
      return;
    }
    setOrdersError("");
    try {
      const { GoogleAuthProvider, OAuthProvider, signInWithPopup } = await import("./firebase");
      const provider = providerName === "google" ? new GoogleAuthProvider() : new OAuthProvider("apple.com");
      if (providerName === "apple") provider.addScope("name");
      const user = auth.currentUser ?? (await signInWithPopup(auth, provider)).user;
      await getAccessToken(user); // Firebase yalnızca burada: sunucu oturumu alınır
      setAuthUser(user);
    } catch (error) {
      setOrdersError(error instanceof Error ? error.message : "Giriş yapılamadı.");
    }
  }

  async function signOutProfile() {
    if (!auth) return;
    try {
      if (pushRegistered && authUser && firebaseConfig) {
        const { getToken, deleteToken } = await import("firebase/messaging");
        const { messaging, registration } = await getPushMessaging();
        const token = await getToken(messaging, { vapidKey: firebaseConfig.vapidKey!, serviceWorkerRegistration: registration });
        if (token) {
          await customerRequest(authUser, "/m/notifications/token", {
            method: "DELETE",
            body: JSON.stringify({ token }),
          });
        }
        await deleteToken(messaging);
      }
      const { signOut } = await import("./firebase");
      await signOut(auth);
      clearSession();
      setPushRegistered(false);
      setPushMessage("");
      setPushError("");
      setAuthUser(null);
      setOrders([]);
      setOrdersError("");
      setContactProfile(emptyContactProfile());
      setContactDraft(emptyContactProfile());
      setSelectedDeliveryAddressId("");
    } catch (error) {
      setOrdersError(error instanceof Error ? error.message : "Oturum kapatılamadı.");
    }
  }

  function orderStatusLabel(status: CustomerOrder["status"]) {
    if (status === "PAID") return "Ödendi";
    if (status === "APPROVED") return "Onaylandı";
    if (status === "FEE_CONFIRMATION") return "Teslimat ücreti onayınızı bekliyor";
    if (status === "FEE_ACCEPTED") return "Ücret kabul edildi";
    if (status === "FEE_CANCELLED") return "İptal edildi";
    if (status === "REJECTED") return "Reddedildi";
    if (status === "RECEIVED") return "Restorana iletildi";
    if (status === "CLAIMED") return "Restoran siparişinizi aldı";
    return "İletildi";
  }

  async function respondToFee(order: CustomerOrder, decision: "ACCEPTED" | "CANCELLED") {
    if (!authUser) {
      setOrdersError("Ücret teklifini yanıtlamak için sipariş verdiğiniz hesapla giriş yapın.");
      return;
    }
    if (decision === "CANCELLED" && !window.confirm("Ücret teklifini reddedip bu siparişi iptal etmek istiyor musunuz?")) return;
    setFeeResponseBusy(order.id);
    setOrdersError("");
    setFeeResponseMessage("");
    try {
      await customerRequest(authUser, `/m/restaurants/${encodeURIComponent(order.tenantId)}/orders/${encodeURIComponent(order.id)}/fee-response`, {
        method: "POST",
        body: JSON.stringify({ sessionId: order.sessionId, decision }),
      });
      setFeeResponseMessage(decision === "ACCEPTED"
        ? "Teslimat ücreti kabul edildi. Restoran siparişinizi işleme alacak."
        : "Teslimat ücreti reddedildi ve sipariş iptal edildi.");
    } catch (error) {
      setOrdersError(error instanceof Error ? error.message : "Ücret teklifi yanıtınız gönderilemedi.");
    } finally {
      setFeeResponseBusy(null);
    }
  }

  function feeResponseControls(order: CustomerOrder) {
    if (order.status !== "FEE_CONFIRMATION") return null;
    return (
      <section className="customer-order-payment">
        <strong>Yeni teslimat ücreti onayı</strong>
        <span>Ücreti kabul edebilir veya siparişi iptal edebilirsiniz. Yanıt gelene kadar sipariş beklemede kalır.</span>
        <div className="auth-actions">
          <button className="primary-button" disabled={feeResponseBusy === order.id} onClick={() => void respondToFee(order, "ACCEPTED")}>
            {feeResponseBusy === order.id ? "Gönderiliyor…" : "Ücreti kabul et"}
          </button>
          <button className="secondary-button" disabled={feeResponseBusy === order.id} onClick={() => void respondToFee(order, "CANCELLED")}>
            Siparişi iptal et
          </button>
        </div>
      </section>
    );
  }

  function paymentMethodLabel(method: string) {
    if (method === "CASH") return "Nakit";
    if (method === "CARD") return "Kart";
    if (method === "MEAL_VOUCHER") return "Yemek kartı";
    if (method === "CREDIT") return "Veresiye";
    return "Diğer";
  }

  function orderItemDetails(item: CustomerOrder["items"][number]) {
    const product = categories.flatMap((category) => category.products).find((candidate) => candidate.id === item.productId);
    const choices = [
      ...(product?.groups.flatMap((group) => group.options
        .filter((option) => item.modifierIds?.includes(option.id))
        .map((option) => option.name)) ?? []),
      ...(product?.slots?.flatMap((slot) => slot.options
        .filter((option) => item.menuOptionIds?.includes(option.id))
        .map((option) => `${slot.name}: ${option.name}`)) ?? []),
    ];
    return { name: item.productName ?? product?.name ?? "Ürün", choices: item.choiceNames ?? choices };
  }

  function renderOrderSummary(order: CustomerOrder, fallbackRestaurantName: string) {
    const itemNames = order.items.slice(0, 2).map((item) => `${item.quantity}× ${orderItemDetails(item).name}`);
    return (
      <button className="customer-order-summary" key={order.id} onClick={() => navigateOrderDetail(order.id)}>
        <span className="customer-order-summary-main">
          <strong>{order.restaurantName ?? fallbackRestaurantName}</strong>
          <small>{order.orderType === "DELIVERY" ? "Eve teslimat" : `Masa ${order.tableName ?? "QR"}`}{order.localNumber ? ` · #${order.localNumber}` : ""} · {new Date(order.createdAt).toLocaleDateString("tr-TR")}</small>
          <span>{itemNames.join(" · ")}{order.items.length > 2 ? ` · +${order.items.length - 2} ürün` : ""}</span>
        </span>
        <span className={`order-status ${order.status === "APPROVED" || order.status === "FEE_ACCEPTED" || order.status === "PAID" ? "is-approved" : order.status === "REJECTED" || order.status === "FEE_CANCELLED" ? "is-rejected" : ""}`}>
          {orderStatusLabel(order.status)}
        </span>
        <span className="customer-order-summary-total">
          <small>{order.status === "FEE_CONFIRMATION" ? "Yeni tutar" : order.amount === null ? "Tutar bekleniyor" : "Toplam"}</small>
          <strong>{order.amount === null ? "—" : money.format(order.amount)}</strong>
        </span>
        <span className="customer-order-summary-arrow" aria-hidden="true">›</span>
      </button>
    );
  }

  function renderOrderDetails(order: CustomerOrder, fallbackRestaurantName: string) {
    return (
      <div className="order-detail-view">
        <button className="order-back-button" onClick={openOrdersList}>← Siparişlerim</button>
        <div className="orders-heading">
          <span className="eyebrow">SİPARİŞ DETAYI</span>
          <h1>{order.restaurantName ?? fallbackRestaurantName}</h1>
          <p>{order.orderType === "DELIVERY" ? "Eve teslimat" : `Masa ${order.tableName ?? "QR"}`}{order.localNumber ? ` · #${order.localNumber}` : ""} · {new Date(order.createdAt).toLocaleString("tr-TR")}</p>
        </div>
        <article className="customer-order order-detail-card">
          <div className="customer-order-heading">
            <strong>Sipariş durumu</strong>
            <span className={`order-status ${order.status === "APPROVED" || order.status === "FEE_ACCEPTED" || order.status === "PAID" ? "is-approved" : order.status === "REJECTED" || order.status === "FEE_CANCELLED" ? "is-rejected" : ""}`}>
              {orderStatusLabel(order.status)}
            </span>
          </div>
          <section className="customer-order-items">
            {order.items.map((item, index) => {
              const details = orderItemDetails(item);
              return (
                <div className="customer-order-item" key={`${order.id}-${index}`}>
                  <div>
                    <p>{item.quantity}× {details.name}{item.note ? ` · ${item.note}` : ""}</p>
                    {details.choices.map((choice) => <span key={choice}>{choice}</span>)}
                  </div>
                  {typeof item.unitPrice === "number" && <strong>{money.format(item.unitPrice * item.quantity)}</strong>}
                </div>
              );
            })}
          </section>
          <div className="customer-order-breakdown">
            {order.subtotal !== null && <div><span>Ara toplam</span><strong>{money.format(order.subtotal)}</strong></div>}
            {(order.discount ?? 0) > 0 && <div><span>İndirim</span><strong>−{money.format(order.discount!)}</strong></div>}
            {(order.deliveryFee ?? order.estimatedDeliveryFee) !== null && (order.deliveryFee ?? order.estimatedDeliveryFee)! > 0 && (
              <div>
                <span>{order.deliveryFee === null ? "Tahmini teslimat ücreti" : "Teslimat ücreti"}</span>
                <strong>{money.format((order.deliveryFee ?? order.estimatedDeliveryFee)!)}</strong>
              </div>
            )}
            {order.deliveryDistanceKm !== null && <div><span>Kuş uçuşu mesafe</span><strong>{order.deliveryDistanceKm.toFixed(2)} km</strong></div>}
            <div className="customer-order-total">
              <span>{order.status === "FEE_CONFIRMATION" ? "Teklif edilen toplam" : order.amount === null ? "Tutar" : order.localNumber ? "Kesin tutar" : "Tahmini tutar"}</span>
              <strong>{order.amount === null ? "Restoran belirleyecek" : money.format(order.amount)}</strong>
            </div>
          </div>
          {feeResponseControls(order)}
          <section className="customer-order-payment">
            <strong>Ödeme</strong>
            {order.status === "PAID" ? (
              <>
                <span>Ödeme restoranda alındı</span>
                {order.paymentDetails?.length ? order.paymentDetails.map((payment, index) => (
                  <div key={`${order.id}-payment-${index}`}>
                    <span>{paymentMethodLabel(payment.method)}{payment.provider ? ` · ${payment.provider}` : ""}</span>
                    <strong>{money.format(payment.amount)}</strong>
                  </div>
                )) : <span>Ödeme yöntemi bilgisi bulunmuyor.</span>}
              </>
            ) : <span>Ödeme, sipariş tesliminde restoranda alınır.</span>}
          </section>
          <section className="customer-order-timeline">
            <strong>Sipariş geçmişi</strong>
            <div><span>Sipariş oluşturuldu</span><time>{new Date(order.createdAt).toLocaleString("tr-TR")}</time></div>
            {(order.receivedAt || order.claimedAt) && <div><span>Restorana iletildi</span><time>{new Date(order.receivedAt ?? order.claimedAt!).toLocaleString("tr-TR")}</time></div>}
            {order.decidedAt && (order.status === "APPROVED" || order.status === "PAID" || order.status === "REJECTED" || order.status === "FEE_ACCEPTED" || order.status === "FEE_CANCELLED") && (
              <div><span>{order.status === "REJECTED" || order.status === "FEE_CANCELLED" ? "Sipariş iptal edildi" : order.status === "FEE_ACCEPTED" ? "Ücret kabul edildi" : "Sipariş onaylandı"}</span><time>{new Date(order.decidedAt).toLocaleString("tr-TR")}</time></div>
            )}
            {order.status === "PAID" && order.paidAt && <div><span>Ödeme alındı</span><time>{new Date(order.paidAt).toLocaleString("tr-TR")}</time></div>}
          </section>
          {order.status === "REJECTED" && order.reason && <p className="order-reason">{order.reason}</p>}
        </article>
        {(feeResponseMessage || ordersError) && (
          <p className={feeResponseMessage ? "profile-saved" : "inline-error"} role={feeResponseMessage ? "status" : "alert"}>
            {feeResponseMessage || ordersError}
          </p>
        )}
      </div>
    );
  }

  if (loadError) {
    return (
      <main className="state-page">
        <section className="state-card">
          <span className="eyebrow">MOBILKOD · QR MENÜ</span>
          <h1>Menü açılamadı</h1>
          <p>{loadError}</p>
        </section>
      </main>
    );
  }

  if (!menu && !menuApiPath) {
    return (
      <div className="app-shell restaurant-directory">
        <header className="topbar">
          <a className="brand" href="/" aria-label="QR Menü restoranları">
            <img className="brand-icon" src="/favicon.svg?v=2" alt="" width="40" height="40" />
            <span className="brand-copy"><strong>Mobilkod</strong><small>QR MENÜ</small></span>
          </a>
          <div className="topbar-actions">
            {view === "orders" && <button className="orders-link" onClick={() => navigateView("menu")}>Restoranlar</button>}
            {view === "menu" && (authUser && contactProfile.addresses.length > 0 ? (
              <label className="directory-address-picker">
                <span>TESLİMAT ADRESİ</span>
                <select
                  aria-label="Yakınlığı hesaplanacak teslimat adresi"
                  value={selectedDeliveryAddressId}
                  onChange={(event) => selectDeliveryAddress(event.target.value)}
                  disabled={profileLoading}
                >
                  {contactProfile.addresses.map((address, index) => (
                    <option key={address.id ?? `directory-address-${index}`} value={address.id ?? ""}>
                      {address.label || `Adres ${index + 1}`}{address.isDefault ? " · Varsayılan" : ""}
                    </option>
                  ))}
                </select>
                <span className="directory-address-chevron" aria-hidden="true">⌄</span>
              </label>
            ) : (
              <button
                className="directory-address-cta"
                onClick={() => {
                  if (!authUser) {
                    navigateView("orders");
                    return;
                  }
                  navigateView("profile");
                }}
              >
                {authUser ? "Adres ekle" : "Adres seç"}
                <span aria-hidden="true">→</span>
              </button>
            ))}
            <button className={view === "orders" ? "orders-link current" : "orders-link"} onClick={() => navigateView("orders")}>Siparişlerim</button>
            <button className={`orders-link directory-profile-link${view === "profile" || view === "addresses" ? " current" : ""}`} onClick={() => navigateView("profile")}>Bilgilerim</button>
          </div>
        </header>
        <BottomNav view={view} directory onNavigate={navigateView} />
        <>
          {view === "addresses" ? (
            <AddressBookPage
              authReady={authReady} user={authUser} loading={profileLoading} saving={profileSaving}
              ordersError={ordersError} profileError={profileError} actionError={actionError}
              addresses={contactDraft.addresses} expandedAddressId={expandedAddressId}
              locationBusyIndex={addressLocationBusy} savingAddressId={addressSavingId}
              savedAddressId={savedAddressId} maxAddresses={MAX_SAVED_ADDRESSES}
              onBack={() => navigateView("profile")} onLogin={(provider) => void signInForOrders(provider)}
              onToggleAddress={(id) => setExpandedAddressId((current) => current === id ? null : id)}
              onUpdateAddress={updateContactAddress} onSaveLocation={(index) => void saveAddressLocation(index)}
              onSaveAddress={(index) => void saveContactAddress(index)}
              onSetDefaultAddress={setDefaultContactAddress} onRemoveAddress={removeContactAddress}
              onAddAddress={addContactAddress}
            />
          ) : view === "profile" ? (
            <ProfilePage
              authReady={authReady} user={authUser} loading={profileLoading} ordersError={ordersError}
              draft={contactDraft} profileError={profileError} actionError={actionError}
              saved={profileSaved} saving={profileSaving} pushRegistered={pushRegistered}
              pushBusy={pushBusy} pushMessage={pushMessage} pushError={pushError}
              onLogin={(provider) => void signInForOrders(provider)}
              onChange={(field, value) => {
                setProfileSaved(false);
                setContactDraft((current) => field === "name" ? { ...current, name: String(value) }
                  : field === "phone" ? { ...current, phone: String(value) }
                    : { ...current, shareWithRestaurant: Boolean(value) });
              }}
              onOpenAddresses={() => navigateView("addresses")}
              onToggleNotifications={() => void toggleOrderNotifications()}
              onSave={() => void saveContactProfile()} onSignOut={() => void signOutProfile()}
            />
          ) : view === "orders" ? (
            <main className="directory-page">
              <OrderHistoryPage
                scope="account" user={authUser} authReady={authReady} loading={ordersLoading}
                orders={orders} selectedOrderId={selectedOrderId} selectedOrder={selectedOrder}
                ordersError={ordersError} feeResponseMessage={feeResponseMessage}
                onLogin={(provider) => void signInForOrders(provider)} onBack={openOrdersList}
                renderOrderSummary={(order) => renderOrderSummary(order, "Restoran")}
                renderOrderDetails={(order) => renderOrderDetails(order, "Restoran")}
              />
            </main>
          ) : (
            <main className={view === "menu" ? "directory-page directory-home" : "directory-page"}>
              <RestaurantDirectoryPage
                restaurants={sortedRestaurants} loading={restaurantsLoading} profileError={profileError}
                isSignedIn={!!authUser} hasSelectedAddress={!!selectedDeliveryAddress}
                selectedAddressHasLocation={selectedAddressHasLocation} money={money}
              />
            </main>
          )}
        </>
      </div>
    );
  }

  if (!menu) {
    return (
      <main className="state-page">
        <section className="state-card">
          <span className="loader" />
          <p>Menü hazırlanıyor…</p>
        </section>
      </main>
    );
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href={getMenuPath()} aria-label={`${menu.shop} menü ana sayfa`} onClick={(event) => {
          event.preventDefault();
          navigateView("menu");
        }}>
          <img className="brand-icon" src="/favicon.svg?v=2" alt="" width="40" height="40" />
          <span className="brand-copy">
            <strong>{menu.shop}</strong>
            <small>QR MENÜ</small>
          </span>
        </a>
        <div className="topbar-actions">
          {!menu.isTableQr && <button className="orders-link" onClick={() => window.location.assign("/")}>Restoranlar</button>}
          <button className={view === "menu" ? "orders-link current" : "orders-link"} onClick={() => navigateView("menu")}>Menü</button>
          <button className={view === "orders" ? "orders-link current" : "orders-link"} onClick={() => navigateView("orders")}>Siparişlerim</button>
          <button className={view === "profile" || view === "addresses" ? "orders-link current" : "orders-link"} onClick={() => navigateView("profile")}>Bilgilerim</button>
          <div className="table-pill"><span /> {menu.isTableQr ? `Masa ${menu.table}` : "Eve sipariş"}</div>
        </div>
      </header>

      <BottomNav view={view} onNavigate={navigateView} />

      {view === "addresses" ? (
        <AddressBookPage
          authReady={authReady} user={authUser} loading={profileLoading} saving={profileSaving}
          ordersError={ordersError} profileError={profileError} actionError={actionError}
          addresses={contactDraft.addresses} expandedAddressId={expandedAddressId}
          locationBusyIndex={addressLocationBusy} savingAddressId={addressSavingId}
          savedAddressId={savedAddressId} maxAddresses={MAX_SAVED_ADDRESSES}
          onBack={() => navigateView("profile")} onLogin={(provider) => void signInForOrders(provider)}
          onToggleAddress={(id) => setExpandedAddressId((current) => current === id ? null : id)}
          onUpdateAddress={updateContactAddress} onSaveLocation={(index) => void saveAddressLocation(index)}
          onSaveAddress={(index) => void saveContactAddress(index)}
          onSetDefaultAddress={setDefaultContactAddress} onRemoveAddress={removeContactAddress}
          onAddAddress={addContactAddress}
        />
      ) : view === "profile" ? (
        <ProfilePage
          authReady={authReady} user={authUser} loading={profileLoading} ordersError={ordersError}
          draft={contactDraft} profileError={profileError} actionError={actionError}
          saved={profileSaved} saving={profileSaving} pushRegistered={pushRegistered}
          pushBusy={pushBusy} pushMessage={pushMessage} pushError={pushError}
          onLogin={(provider) => void signInForOrders(provider)}
          onChange={(field, value) => {
            setProfileSaved(false);
            setContactDraft((current) => field === "name" ? { ...current, name: String(value) }
              : field === "phone" ? { ...current, phone: String(value) }
                : { ...current, shareWithRestaurant: Boolean(value) });
          }}
          onOpenAddresses={() => navigateView("addresses")}
          onToggleNotifications={() => void toggleOrderNotifications()}
          onSave={() => void saveContactProfile()} onSignOut={() => void signOutProfile()}
        />
      ) : view === "orders" ? (
        <OrderHistoryPage
          scope="restaurant" user={authUser} authReady={authReady} loading={ordersLoading}
          orders={orders} selectedOrderId={selectedOrderId} selectedOrder={selectedOrder}
          ordersError={ordersError} feeResponseMessage={feeResponseMessage}
          onLogin={(provider) => void signInForOrders(provider)} onBack={openOrdersList}
          renderOrderSummary={(order) => renderOrderSummary(order, menu.shop)}
          renderOrderDetails={(order) => renderOrderDetails(order, menu.shop)}
        />
      ) : <MenuPage menu={menu} categories={categories} visibleCategories={visibleCategories}
        categoryId={categoryId} query={query} money={money} onQueryChange={setQuery}
        onCategoryChange={setCategoryId} onOpenProduct={openProduct} />}

      {view === "menu" && <footer className="page-footer">
        <span>Afiyet olsun</span><span>Mobilkod QR Menü</span>
      </footer>}

      {view === "menu" && count > 0 && (
        <button className="cart-bar" onClick={() => setCartOpen(true)}>
          <span className="cart-count">{count}</span>
          <span className="cart-label">Sepetini görüntüle</span>
          <strong>{money.format(total)}</strong>
          <span className="cart-arrow">→</span>
        </button>
      )}

      {view === "menu" && selectedProduct && (
        <div className="overlay" onMouseDown={(event) => event.target === event.currentTarget && setSelectedProduct(null)}>
          <section className="dialog product-dialog" role="dialog" aria-modal="true" aria-labelledby="product-title">
            <button className="icon-close" onClick={() => setSelectedProduct(null)} aria-label="Kapat">×</button>
            <div className="dialog-scroll" ref={productDialogScroll}>
              <span className="dialog-kicker">SİZE ÖZEL HAZIRLANIR</span>
              {actionError && <p className="inline-error product-error" role="alert" aria-live="assertive">{actionError}</p>}
              <h2 id="product-title">{selectedProduct.name}</h2>
              {selectedProduct.description && <p className="dialog-description">{selectedProduct.description}</p>}
              <p className="dialog-base-price">{money.format(selectedProduct.price)} <span>başlayan fiyat</span></p>
              {selectedProduct.groups.map((group) => {
                const current = selectedOptions[group.id] ?? [];
                return (
                  <fieldset className="modifier-group" key={group.id}>
                    <legend>
                      <span>{group.name}</span>
                      <small>{group.min > 0 ? `Zorunlu · en az ${group.min}` : "İsteğe bağlı"}{group.max > 1 ? ` · en fazla ${group.max}` : ""}</small>
                    </legend>
                    {group.options.map((option) => {
                      const checked = current.includes(option.id);
                      const inputType = group.max === 1 ? "radio" : "checkbox";
                      return (
                        <label className="modifier-option" key={option.id}>
                          <input
                            type={inputType}
                            name={`group-${group.id}`}
                            checked={checked}
                            onChange={() => {
                              setSelectedOptions((options) => {
                                const chosen = options[group.id] ?? [];
                                const next = checked
                                  ? chosen.filter((id) => id !== option.id)
                                  : group.max === 1
                                    ? [option.id]
                                    : chosen.length < group.max
                                      ? [...chosen, option.id]
                                      : chosen;
                                return { ...options, [group.id]: next };
                              });
                              setActionError("");
                            }}
                          />
                          <span>{option.name}</span>
                          <small>{option.abs !== null ? money.format(option.abs) : option.delta ? `+${money.format(option.delta)}` : "Dahil"}</small>
                        </label>
                      );
                    })}
                  </fieldset>
                );
              })}
              {(selectedProduct.slots ?? []).map((slot) => {
                const current = selectedOptions[slot.id] ?? [];
                return (
                  <fieldset className="modifier-group" key={slot.id}>
                    <legend>
                      <span>{slot.name}</span>
                      <small>{slot.required ? "Zorunlu seçim" : "İsteğe bağlı"}</small>
                    </legend>
                    {slot.options.map((option) => {
                      const checked = current.includes(option.id);
                      return (
                        <label className="modifier-option" key={option.id}>
                          <input
                            type="radio"
                            name={`slot-${slot.id}`}
                            checked={checked}
                            disabled={option.soldOut}
                            onChange={() => {
                              setSelectedOptions((options) => ({ ...options, [slot.id]: [option.id] }));
                              setActionError("");
                            }}
                          />
                          <span>{option.name}</span>
                          <small>{option.soldOut ? "Tükendi" : option.upcharge ? `+${money.format(option.upcharge)}` : "Dahil"}</small>
                        </label>
                      );
                    })}
                  </fieldset>
                );
              })}
              <label className="field-label">
                Ürün notu
                <input maxLength={120} value={productNote} onChange={(event) => setProductNote(event.target.value)} placeholder="Örn. az tuzlu" />
              </label>
            </div>
            <div className="dialog-actions">
              <div className="quantity-control">
                <button onClick={() => setProductQuantity((quantity) => Math.max(1, quantity - 1))} aria-label="Adedi azalt">−</button>
                <span>{productQuantity}</span>
                <button onClick={() => setProductQuantity((quantity) => Math.min(20, quantity + 1))} aria-label="Adedi artır">+</button>
              </div>
              <button className="primary-button" onClick={addToCart}>
                Sepete ekle <span>{money.format(priceFor(selectedProduct, Object.values(selectedOptions).flat()) * productQuantity)}</span>
              </button>
            </div>
          </section>
        </div>
      )}

      {view === "menu" && cartOpen && (
        <div className="overlay" onMouseDown={(event) => event.target === event.currentTarget && setCartOpen(false)}>
          <section className="dialog cart-dialog" role="dialog" aria-modal="true" aria-labelledby="cart-title">
            <button className="icon-close" onClick={() => setCartOpen(false)} aria-label="Kapat">×</button>
            <div className="dialog-scroll">
              <span className="dialog-kicker">{orderType === "DELIVERY" ? "EVE TESLİMAT" : `MASA ${menu.table}`}</span>
              <h2 id="cart-title">Sipariş sepetin</h2>
              {cart.length === 0 ? <p className="muted-copy">Sepetiniz şu an boş.</p> : (
                <div className="cart-lines">
                  {cart.map((line) => (
                    <article className="cart-line" key={line.key}>
                      <div className="cart-line-copy">
                        <strong>{line.product.name}</strong>
                        {line.choiceNames.length > 0 && <span>{line.choiceNames.join(" · ")}</span>}
                        <b>{money.format(line.unitPrice * line.quantity)}</b>
                        <button className="cart-note-button" onClick={() => openLineNote(line)}>
                          {line.note ? "Notu düzenle" : "Ürün notu ekle"}
                        </button>
                        {line.note && <span className="cart-note-preview">{line.note}</span>}
                      </div>
                      <div className="cart-line-controls">
                        <div className="quantity-control compact">
                          <button onClick={() => changeQuantity(line.key, -1)} aria-label="Ürün adedini azalt">−</button>
                          <span>{line.quantity}</span>
                          <button onClick={() => changeQuantity(line.key, 1)} aria-label="Ürün adedini artır">+</button>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )}
              {cart.length > 0 && (
                <>
                  {!menu.isTableQr && menu.deliveryAcceptingOrders === false && (
                    <div className="delivery-paused-notice" role="status">
                      Restoran yoğun olduğu için şu anda online teslimat siparişi alamıyor. Daha sonra tekrar deneyin.
                    </div>
                  )}
                  {!menu.isTableQr && (
                    <div className="delivery-profile-hint">
                      {profileLoading ? (
                        <span>Adres ve telefon bilgileriniz kontrol ediliyor…</span>
                      ) : deliveryProfileReady && selectedDeliveryAddress ? (
                        <span>
                          <strong>{selectedDeliveryAddress.label || "Teslimat adresi"}</strong> · {selectedDeliveryAddress.address}
                          {contactProfile.phone && <> · {contactProfile.phone}</>}
                        </span>
                      ) : (
                        <>
                          <span>Eve teslimat için Bilgilerim’de adres ve telefon ekleyip otomatik paylaşımı açın.</span>
                          <button type="button" onClick={() => { setCartOpen(false); navigateView("profile"); }}>Bilgilerime git</button>
                        </>
                      )}
                    </div>
                  )}
                  {!menu.isTableQr && menu.deliveryPerKm !== null && !selectedAddressHasLocation && (
                    <div className="delivery-profile-hint">
                      <span>Seçtiğiniz adres için konum kaydedilmemiş. Siparişten önce Bilgilerim’de bu adresin konumunu kaydedin.</span>
                      <button type="button" onClick={() => { setCartOpen(false); navigateView("profile"); }}>Bilgilerime git</button>
                    </div>
                  )}
                  <label className="field-label">
                    Sipariş notu
                    <textarea maxLength={200} value={cartNote} onChange={(event) => setCartNote(event.target.value)} placeholder="Restorana iletmek istediğiniz bir not var mı?" />
                  </label>
                  {!menu.isTableQr && (menu.deliveryPerKm === null || activeDeliveryQuote) && <div className="total-row">
                    <span>{activeDeliveryQuote ? `Yol ücreti (${activeDeliveryQuote.distanceKm.toFixed(2)} km)` : "Yol ücreti"}</span>
                    <strong>{activeDeliveryQuote ? money.format(activeDeliveryQuote.fee) : money.format(menu.deliveryFee)}</strong>
                  </div>}
                  <div className="total-row"><span>{menu.isTableQr ? "Toplam" : activeDeliveryQuote || menu.deliveryPerKm === null ? "Tahmini toplam" : "Ürünler toplamı"}</span><strong>{money.format(menu.isTableQr ? total : deliveryTotal)}</strong></div>
                  {!menu.isTableQr && deliveryMinimumOrder > 0 && (
                    <p className={deliveryMinimumMet ? "delivery-minimum-hint met" : "delivery-minimum-hint"}>
                      {deliveryMinimumMet
                        ? `Minimum sipariş tutarı karşılandı: ${money.format(deliveryMinimumOrder)}`
                        : `Minimum ürün sepeti ${money.format(deliveryMinimumOrder)}. Sepetinize ${money.format(deliveryMinimumOrder - total)} daha ekleyin.`}
                    </p>
                  )}
                  <p className="muted-copy">{menu.isTableQr
                    ? "Masa siparişi restoran onayına gönderilir."
                    : activeDeliveryQuote
                      ? "Restoran ücreti kontrol eder. Ücret artarsa yeni tutar onayınıza sunulur; ödeme restoranda alınır."
                      : menu.deliveryPerKm !== null
                        ? "Yol ücreti, sipariş öncesinde kayıtlı adresiniz ve restoran konumuna göre hesaplanır."
                        : "Teslimat ücreti toplam tutara eklenmiştir. Ödeme restoranda alınır."}</p>
                  {!authReady ? <p className="cart-auth-hint">Oturum kontrol ediliyor…</p> : authUser ? (
                    <div className="cart-auth-ready">
                      <button className="primary-button" disabled={busy || (!menu.isTableQr && (menu.deliveryAcceptingOrders === false || !deliveryProfileReady || !deliveryMinimumMet || !deliveryLocationReady))} onClick={() => requestOrder("google")}>
                        {busy ? "İşleniyor…" : "Siparişi ver"}
                      </button>
                    </div>
                  ) : (
                    menu.isTableQr ? (
                      <div className="auth-actions">
                        <button className="primary-button" disabled={busy} onClick={() => requestOrder("google")}>Google ile doğrula ve sipariş ver</button>
                        <button className="secondary-button" disabled={busy} onClick={() => requestOrder("apple")}>Apple ile doğrula ve sipariş ver</button>
                      </div>
                    ) : (
                      <div className="auth-actions">
                        <button className="primary-button" disabled={busy} onClick={() => void signInForOrders("google")}>Giriş yap ve adresini kaydet</button>
                        <button className="secondary-button" disabled={busy} onClick={() => void signInForOrders("apple")}>Apple ile giriş yap</button>
                      </div>
                    )
                  )}
                  {!menu.isTableQr && !authUser && authReady && (
                    <p className="cart-auth-hint">Giriş yaptıktan sonra Bilgilerim’den teslimat adresi, telefon ve otomatik paylaşım tercihini kaydedin.</p>
                  )}
                </>
              )}
              {actionError && <p className="inline-error" role="alert">{actionError}</p>}
            </div>
          </section>
        </div>
      )}

      {view === "menu" && lineNoteKey && (
        <div className="overlay note-overlay" onMouseDown={(event) => event.target === event.currentTarget && setLineNoteKey(null)}>
          <section className="dialog note-dialog" role="dialog" aria-modal="true" aria-labelledby="line-note-title">
            <button className="icon-close" onClick={() => setLineNoteKey(null)} aria-label="Kapat">×</button>
            <div className="dialog-scroll">
              <span className="dialog-kicker">ÜRÜN NOTU</span>
              <h2 id="line-note-title">{cart.find((line) => line.key === lineNoteKey)?.product.name ?? "Ürün notu"}</h2>
              <label className="field-label">
                Hazırlama notu
                <textarea autoFocus maxLength={120} value={lineNoteDraft} onChange={(event) => setLineNoteDraft(event.target.value)} placeholder="Örn. az tuzlu" />
              </label>
            </div>
            <div className="note-dialog-actions">
              <button className="secondary-button" onClick={() => setLineNoteKey(null)}>Vazgeç</button>
              <button className="primary-button" onClick={() => {
                changeLineNote(lineNoteKey, lineNoteDraft.trim());
                setLineNoteKey(null);
              }}>Notu kaydet</button>
            </div>
          </section>
        </div>
      )}

      {view === "menu" && dataNoticeOpen && (
        <div className="overlay data-notice-overlay">
          <section className="dialog data-notice-dialog" role="dialog" aria-modal="true" aria-labelledby="data-notice-title">
            <div className="dialog-scroll">
              <span className="dialog-kicker">MÜŞTERİ BİLGİLENDİRMESİ</span>
              <h2 id="data-notice-title">Sipariş ve müşteri kaydı</h2>
              <p>Devam ettiğinizde Google veya Apple profil adınız siparişinizle restorana iletilir ve restoranın yerel müşteri kaydına eklenir. Eve teslimatta seçtiğiniz adres ve telefonunuz otomatik paylaşım açıksa restorana gönderilir. Cihaz konumunuz yalnızca yol ücretini hesaplamak için o sipariş isteği sırasında kullanılır; profilinize veya sipariş kaydınıza yazılmaz.</p>
              <label className="data-notice-check">
                <input type="checkbox" checked={dataNoticeChecked} onChange={(event) => setDataNoticeChecked(event.target.checked)} />
                <span>Bilgilendirmeyi okudum ve devam etmek istiyorum.</span>
              </label>
              {actionError && <p className="inline-error" role="alert">{actionError}</p>}
            </div>
            <div className="note-dialog-actions">
              <button className="secondary-button" onClick={() => { setDataNoticeOpen(false); setPendingOrderProvider(null); }}>Vazgeç</button>
              <button className="primary-button" disabled={!dataNoticeChecked || busy} onClick={acceptDataNotice}>Onayla ve devam et</button>
            </div>
          </section>
        </div>
      )}

      {view === "menu" && orderSent && (
        <div className="overlay status-overlay">
          <section className="dialog status-dialog" role="dialog" aria-modal="true" aria-labelledby="status-title">
            <div className="status-icon approved" aria-hidden="true">✓</div>
            <span className="dialog-kicker">{orderType === "DELIVERY" ? "EVE TESLİMAT" : `MASA ${menu.table}`}</span>
            <h2 id="status-title">Siparişiniz iletildi</h2>
            <p>{orderType === "DELIVERY" ? "Eve teslimat isteğiniz restorana gönderildi." : "Sipariş isteğiniz restorana gönderildi."} Onay için bu ekranda beklemeniz gerekmiyor.</p>
            <div className="auth-actions">
              <button className="primary-button" onClick={() => { setOrderSent(false); navigateView("orders"); }}>Siparişlerimi gör</button>
              <button className="secondary-button" onClick={() => setOrderSent(false)}>Menüye dön</button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

export default App;
