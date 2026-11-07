import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  getApps,
  initializeApp,
} from "firebase/app";
import {
  browserLocalPersistence,
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  OAuthProvider,
  setPersistence,
  signOut,
  signInWithPopup,
  type User,
} from "firebase/auth";
import {
  deleteToken,
  getMessaging,
  getToken,
  isSupported,
  onMessage,
} from "firebase/messaging";
import { firebaseConfig } from "./firebase-config";
import "./App.css";

type ModifierOption = {
  id: string;
  name: string;
  delta: number;
  abs: number | null;
};

type ModifierGroup = {
  id: string;
  name: string;
  min: number;
  max: number;
  options: ModifierOption[];
};

type MenuSlot = {
  id: string;
  name: string;
  required: boolean;
  options: { id: string; productId: string; name: string; upcharge: number; soldOut: boolean }[];
};

type Product = {
  id: string;
  name: string;
  description?: string;
  imageUrl?: string;
  price: number;
  soldOut: boolean;
  isMenu?: boolean;
  groups: ModifierGroup[];
  slots?: MenuSlot[];
};

type MenuResponse = {
  tenantId: string;
  shop: string;
  address: string;
  phone: string;
  table: string | null;
  isTableQr: boolean;
  dineInEnabled: boolean;
  deliveryEnabled: boolean;
  deliveryFee: number;
  categories: { id: string; name: string; products: Product[] }[];
};
type Restaurant = { id: string; name: string; address: string; phone: string; dineInEnabled: boolean; deliveryEnabled: boolean; deliveryFee: number };

type ContactProfile = { name: string; phone: string; address: string; shareWithRestaurant: boolean };

type CartLine = {
  key: string;
  product: Product;
  quantity: number;
  note: string;
  modifierIds: string[];
  menuOptionIds: string[];
  choiceNames: string[];
  unitPrice: number;
};

type CustomerOrder = {
  id: string;
  items: { productId: string; productName?: string; choiceNames?: string[]; quantity: number; unitPrice?: number; note?: string; modifierIds?: string[]; menuOptionIds?: string[] }[];
  orderType: "DINE_IN" | "DELIVERY";
  status: "PENDING" | "CLAIMED" | "RECEIVED" | "APPROVED" | "REJECTED" | "PAID";
  localNumber: number | null;
  amount: number | null;
  subtotal: number | null;
  discount: number | null;
  deliveryFee: number | null;
  estimatedDeliveryFee: number | null;
  paymentDetails: { method: string; amount: number; provider?: string | null; paidAt: string }[] | null;
  claimedAt: string | null;
  receivedAt: string | null;
  decidedAt: string | null;
  paidAt: string | null;
  reason: string | null;
  createdAt: string;
  restaurantName?: string;
  tableName?: string | null;
};

const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/+$/, "");
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
  if (parts.at(-1) === "orders" || parts.at(-1) === "profile") parts.pop();
  return `/${parts.join("/")}`;
}

function isOrdersPath() {
  return window.location.pathname.split("/").filter(Boolean).at(-1) === "orders";
}

function isProfilePath() {
  return window.location.pathname.split("/").filter(Boolean).at(-1) === "profile";
}

function contactProfileKey(menu: MenuResponse) {
  const shop = menu.shop.trim().toLocaleLowerCase("tr-TR");
  return `qr-contact-profile:v1:${firebaseConfig.projectId}:${shop}`;
}

function readContactProfile(menu: MenuResponse): ContactProfile {
  const saved = localStorage.getItem(contactProfileKey(menu));
  if (!saved) return { name: "", phone: "", address: "", shareWithRestaurant: false };
  const value: unknown = JSON.parse(saved);
  if (!value || typeof value !== "object" || !("phone" in value) || !("address" in value) ||
    typeof value.phone !== "string" || typeof value.address !== "string" ||
    ("name" in value && typeof value.name !== "string") ||
    ("shareWithRestaurant" in value && typeof value.shareWithRestaurant !== "boolean")) {
    throw new Error("Kayıtlı telefon/adres bilgileri okunamadı. Bilgilerim bölümünden yeniden kaydedin.");
  }
  return {
    name: "name" in value && typeof value.name === "string" ? value.name.slice(0, 100) : "",
    phone: value.phone.slice(0, 40),
    address: value.address.slice(0, 300),
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

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { "content-type": "application/json", ...init?.headers },
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(result.message || "İstek tamamlanamadı.");
  }
  return result as T;
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
  const [menu, setMenu] = useState<MenuResponse | null>(null);
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [restaurantsLoading, setRestaurantsLoading] = useState(false);
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
  const [view, setView] = useState<"menu" | "orders" | "profile">(() => isOrdersPath() ? "orders" : isProfilePath() ? "profile" : "menu");
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [dataNoticeOpen, setDataNoticeOpen] = useState(false);
  const [dataNoticeChecked, setDataNoticeChecked] = useState(false);
  const [pendingOrderProvider, setPendingOrderProvider] = useState<"google" | "apple" | null>(null);
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [tableSessionId] = useState(() => token ? getTableSessionId(token) : "");
  const [deliverySessionId] = useState(() => getDeliverySessionId(restaurantId ?? token ?? "directory"));
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersError, setOrdersError] = useState("");
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const [contactProfile, setContactProfile] = useState<ContactProfile>({ name: "", phone: "", address: "", shareWithRestaurant: false });
  const [contactDraft, setContactDraft] = useState<ContactProfile>({ name: "", phone: "", address: "", shareWithRestaurant: false });
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [pushRegistered, setPushRegistered] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [pushMessage, setPushMessage] = useState("");
  const [pushError, setPushError] = useState("");
  const productDialogScroll = useRef<HTMLDivElement>(null);
  const auth = useMemo(() => getAuth(getApps()[0] ?? initializeApp(firebaseConfig)), []);
  const orderType = menu?.isTableQr ? "DINE_IN" : "DELIVERY";

  const getPushMessaging = useCallback(async () => {
    if (!firebaseConfig.vapidKey || !firebaseConfig.messagingSenderId) {
      throw new Error("Push bildirimleri için Firebase Messaging Sender ID ve VAPID anahtarı QR Menu'de yapılandırılmalı.");
    }
    if (!("serviceWorker" in navigator) || !(await isSupported())) {
      throw new Error("Bu tarayıcı push bildirimlerini desteklemiyor.");
    }
    const app = getApps()[0] ?? initializeApp(firebaseConfig);
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
    const idToken = await user.getIdToken();
    await request("/m/notifications/token", {
      method: "PUT",
      headers: { authorization: `Bearer ${idToken}` },
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
      const { messaging, registration } = await getPushMessaging();
      if (pushRegistered) {
        const token = await getToken(messaging, { vapidKey: firebaseConfig.vapidKey, serviceWorkerRegistration: registration });
        if (token) {
          const idToken = await authUser.getIdToken();
          await request("/m/notifications/token", {
            method: "DELETE",
            headers: { authorization: `Bearer ${idToken}` },
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

  function navigateView(next: "menu" | "orders" | "profile") {
    const menuPath = getMenuPath();
    const target = next === "orders"
      ? menuApiPath ? `${menuPath}/orders` : "/orders"
      : next === "profile" ? `${menuPath}/profile` : menuPath;
    if (window.location.pathname !== target) window.history.pushState({}, "", target);
    if (next === "profile") setContactDraft(contactProfile);
    setView(next);
  }

  useEffect(() => {
    let active = true;
    setLoadError("");
    if (!menuApiPath) {
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
    request<MenuResponse>(`${menuApiPath}/menu`)
      .then((data) => {
        if (!active) return;
        setMenu(data);
        try {
          const profile = readContactProfile(data);
          setContactDraft(profile);
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
  }, [menuApiPath]);

  useEffect(() => {
    if (!menu || !authUser) return;
    let active = true;
    setProfileLoading(true);
    setProfileError("");
    void authUser.getIdToken()
      .then((idToken) => request<{ profile: ContactProfile | null }>("/m/profile/current", {
        headers: { authorization: `Bearer ${idToken}` },
      }))
      .then(({ profile }) => {
        if (!active) return;
        if (profile) {
          setContactProfile(profile);
          setContactDraft(profile);
        } else {
          setContactProfile({ name: "", phone: "", address: "", shareWithRestaurant: false });
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
  }, [authUser, menu]);

  useEffect(() => {
    const onPopState = () => setView(isOrdersPath() ? "orders" : isProfilePath() ? "profile" : "menu");
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    if (!auth) return;
    let active = true;
    let unsubscribe: (() => void) | undefined;
    void setPersistence(auth, browserLocalPersistence)
      .then(() => {
        if (active) unsubscribe = onAuthStateChanged(auth, (user) => {
          setAuthUser(user);
          setAuthReady(true);
        });
      })
      .catch((error: unknown) => {
        if (active) {
          setOrdersError(error instanceof Error ? error.message : "Oturum saklanamadı.");
          setAuthReady(true);
        }
      });
    return () => {
      active = false;
      unsubscribe?.();
    };
  }, [auth]);

  useEffect(() => {
    if (!authUser || typeof Notification === "undefined" || Notification.permission !== "granted") return;
    let active = true;
    void (async () => {
      try {
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
    void isSupported().then((supported) => {
      if (!supported || !active) return;
      const app = getApps()[0] ?? initializeApp(firebaseConfig);
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
    if (menu) document.title = `${menu.shop} · QR Menü`;
  }, [menu]);

  useEffect(() => {
    if (view !== "orders" || !authUser) return;
    let active = true;
    const load = async () => {
      try {
        const idToken = await authUser.getIdToken();
        const result = await request<{ orders: CustomerOrder[] }>(
          "/m/account/history/orders", {
          headers: { authorization: `Bearer ${idToken}` },
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
      }
    };
    setOrdersLoading(true);
    void load();
    const timer = window.setInterval(() => void load(), 5000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [authUser, view]);

  const categories = menu?.categories ?? [];
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
  const deliveryTotal = total + (menu?.isTableQr ? 0 : menu?.deliveryFee ?? 0);
  const count = cart.reduce((sum, line) => sum + line.quantity, 0);
  const deliveryProfileReady = !!authUser &&
    !profileLoading &&
    contactProfile.shareWithRestaurant &&
    !!contactProfile.address.trim() &&
    !!contactProfile.phone.trim();

  function openProduct(product: Product) {
    setSelectedProduct(product);
    setSelectedOptions({});
    setProductQuantity(1);
    setProductNote("");
    setActionError("");
  }

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
    if (!menu || !authUser) return;
    const profile = {
      ...contactDraft,
      name: contactDraft.name.trim() || authUser.displayName?.trim() || "",
      phone: contactDraft.phone.trim(),
      address: contactDraft.address.trim(),
    };
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
      const idToken = await authUser.getIdToken();
      const result = await request<{ profile: ContactProfile }>("/m/profile/current", {
        method: "PUT",
        headers: { authorization: `Bearer ${idToken}` },
        body: JSON.stringify(profile),
      });
      setContactProfile(result.profile);
      setContactDraft(result.profile);
      setActionError("");
      setProfileError("");
      setProfileSaved(true);
      try {
        localStorage.removeItem(contactProfileKey(menu));
      } catch {
        setProfileError("Bulut profili kaydedildi; bu cihazdaki eski taslak silinemedi.");
      }
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Profil buluta kaydedilemedi.");
    } finally {
      setProfileSaving(false);
    }
  }

  function openLineNote(line: CartLine) {
    setLineNoteKey(line.key);
    setLineNoteDraft(line.note);
  }

  function dataNoticeKey() {
    const shopKey = menu?.shop.trim().toLocaleLowerCase("tr-TR") ?? "unknown";
    return `qr-name-notice:v1:${firebaseConfig.projectId}:${shopKey}`;
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
    if (orderType === "DELIVERY" && !deliveryProfileReady) {
      setActionError("Eve teslimat için Bilgilerim bölümünde adres, telefon ve otomatik paylaşım gerekli.");
      return;
    }
    setBusy(true);
    setActionError("");
    try {
      const currentAuth = getAuth(getApps()[0] ?? initializeApp(firebaseConfig));
      const provider =
        providerName === "google"
          ? new GoogleAuthProvider()
          : new OAuthProvider("apple.com");
      if (providerName === "apple") provider.addScope("name");
      await setPersistence(currentAuth, browserLocalPersistence);
      const user = currentAuth.currentUser ?? (await signInWithPopup(currentAuth, provider)).user;
      const idToken = await user.getIdToken();
      setAuthUser(user);
      await request<{ id: string }>(
        `${menuApiPath}/orders`,
        {
          method: "POST",
          headers: { authorization: `Bearer ${idToken}` },
          body: JSON.stringify({
            sessionId: menu.isTableQr ? tableSessionId : deliverySessionId,
            orderType,
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
    if (!auth) return;
    setOrdersError("");
    const provider = providerName === "google" ? new GoogleAuthProvider() : new OAuthProvider("apple.com");
    if (providerName === "apple") provider.addScope("name");
    try {
      await setPersistence(auth, browserLocalPersistence);
      const user = auth.currentUser ?? (await signInWithPopup(auth, provider)).user;
      setAuthUser(user);
    } catch (error) {
      setOrdersError(error instanceof Error ? error.message : "Giriş yapılamadı.");
    }
  }

  async function signOutProfile() {
    if (!auth) return;
    try {
      if (pushRegistered && authUser && firebaseConfig) {
        const { messaging, registration } = await getPushMessaging();
        const token = await getToken(messaging, { vapidKey: firebaseConfig.vapidKey!, serviceWorkerRegistration: registration });
        if (token) {
          const idToken = await authUser.getIdToken();
          await request("/m/notifications/token", {
            method: "DELETE",
            headers: { authorization: `Bearer ${idToken}` },
            body: JSON.stringify({ token }),
          });
        }
        await deleteToken(messaging);
      }
      await signOut(auth);
      setPushRegistered(false);
      setPushMessage("");
      setPushError("");
      setAuthUser(null);
      setOrders([]);
      setOrdersError("");
      setContactProfile({ name: "", phone: "", address: "", shareWithRestaurant: false });
      setContactDraft({ name: "", phone: "", address: "", shareWithRestaurant: false });
    } catch (error) {
      setOrdersError(error instanceof Error ? error.message : "Oturum kapatılamadı.");
    }
  }

  function orderStatusLabel(status: CustomerOrder["status"]) {
    if (status === "PAID") return "Ödendi";
    if (status === "APPROVED") return "Onaylandı";
    if (status === "REJECTED") return "Reddedildi";
    if (status === "RECEIVED") return "Restorana iletildi";
    if (status === "CLAIMED") return "Restoran siparişinizi aldı";
    return "İletildi";
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
            <span className="brand-mark">M</span>
            <span className="brand-copy"><strong>Mobilkod</strong><small>QR MENÜ</small></span>
          </a>
          <div className="topbar-actions">
            {view === "orders" && <button className="orders-link" onClick={() => navigateView("menu")}>Restoranlar</button>}
            <button className={view === "orders" ? "orders-link current" : "orders-link"} onClick={() => navigateView("orders")}>Siparişlerim</button>
          </div>
        </header>
        <main className="directory-page">
          {view === "orders" ? (
            <>
              <div className="profile-heading">
                <span className="eyebrow">HESAP GEÇMİŞİ</span>
                <h1>Siparişlerim</h1>
                <p>QR Menü üzerinden verdiğiniz siparişleri hesabınızla takip edin.</p>
              </div>
              {authUser && (
                <section className="notification-settings">
                  <div>
                    <strong>Sipariş bildirimleri</strong>
                    <p>Onay, iptal ve ödeme durumlarını bu cihazda alın.</p>
                  </div>
                  <button className="secondary-button" disabled={pushBusy} onClick={() => void toggleOrderNotifications()}>
                    {pushBusy ? "Kaydediliyor…" : pushRegistered ? "Bildirimleri kapat" : "Bildirimleri aç"}
                  </button>
                  {pushMessage && <p className="profile-saved" role="status">{pushMessage}</p>}
                  {pushError && <p className="inline-error" role="alert">{pushError}</p>}
                </section>
              )}
              {!authReady ? (
                <p className="orders-message"><span className="loader" /> Oturum kontrol ediliyor…</p>
              ) : !authUser ? (
                <section className="orders-login">
                  <p>Sipariş geçmişinizi görmek için sipariş verirken kullandığınız Google veya Apple hesabıyla giriş yapın.</p>
                  <div className="auth-actions">
                    <button className="primary-button" onClick={() => void signInForOrders("google")}>Google ile giriş yap</button>
                    <button className="secondary-button" onClick={() => void signInForOrders("apple")}>Apple ile giriş yap</button>
                  </div>
                  {ordersError && <p className="inline-error" role="alert">{ordersError}</p>}
                </section>
              ) : ordersLoading && orders.length === 0 ? (
                <p className="orders-message"><span className="loader" /> Siparişler yükleniyor…</p>
              ) : orders.length === 0 ? (
                <p className="orders-message">Bu hesapla verilmiş QR siparişi bulunamadı.</p>
              ) : (
                <div className="orders-list">
                  {orders.map((order) => (
                    <article className="customer-order" key={order.id}>
                      <div className="customer-order-heading">
                        <div>
                          <strong>{order.restaurantName ?? "Restoran"} · {order.orderType === "DELIVERY" ? "Eve teslimat" : `Masa ${order.tableName ?? "QR"}`}{order.localNumber ? ` · #${order.localNumber}` : ""}</strong>
                          <span>{new Date(order.createdAt).toLocaleString("tr-TR")}</span>
                        </div>
                        <span className={`order-status ${order.status === "APPROVED" ? "is-approved" : order.status === "REJECTED" ? "is-rejected" : ""}`}>
                          {orderStatusLabel(order.status)}
                        </span>
                      </div>
                      <div className="customer-order-items">
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
                      </div>
                      <div className="customer-order-breakdown">
                        {order.subtotal !== null && <div><span>Ara toplam</span><strong>{money.format(order.subtotal)}</strong></div>}
                        {(order.discount ?? 0) > 0 && <div><span>İndirim</span><strong>−{money.format(order.discount!)}</strong></div>}
                        {(order.deliveryFee ?? order.estimatedDeliveryFee) !== null && (order.deliveryFee ?? order.estimatedDeliveryFee)! > 0 && (
                          <div>
                            <span>{order.deliveryFee === null ? "Tahmini teslimat ücreti" : "Teslimat ücreti"}</span>
                            <strong>{money.format((order.deliveryFee ?? order.estimatedDeliveryFee)!)}</strong>
                          </div>
                        )}
                        <div className="customer-order-total">
                          <span>{order.amount === null ? "Tutar" : order.localNumber ? "Kesin tutar" : "Tahmini tutar"}</span>
                          <strong>{order.amount === null ? "Restoran belirleyecek" : money.format(order.amount)}</strong>
                        </div>
                      </div>
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
                        {order.decidedAt && (order.status === "APPROVED" || order.status === "PAID" || order.status === "REJECTED") && (
                          <div><span>{order.status === "REJECTED" ? "Sipariş reddedildi" : "Sipariş onaylandı"}</span><time>{new Date(order.decidedAt).toLocaleString("tr-TR")}</time></div>
                        )}
                        {order.status === "PAID" && order.paidAt && <div><span>Ödeme alındı</span><time>{new Date(order.paidAt).toLocaleString("tr-TR")}</time></div>}
                      </section>
                      {order.status === "REJECTED" && order.reason && <p className="order-reason">{order.reason}</p>}
                    </article>
                  ))}
                </div>
              )}
              {ordersError && <p className="inline-error" role="alert">{ordersError}</p>}
            </>
          ) : (
            <>
            <div className="profile-heading">
              <span className="eyebrow">YAKININDAKİ LEZZETLER</span>
              <h1>Restoranlar</h1>
              <p>Restoran seçin, menüyü keşfedin ve adresinize sipariş verin.</p>
            </div>
            {restaurantsLoading ? (
            <p className="orders-message"><span className="loader" /> Restoranlar yükleniyor…</p>
          ) : restaurants.length ? (
            <div className="restaurant-list">
              {restaurants.map((restaurant) => (
                <a className="restaurant-card" href={`/restaurant/${encodeURIComponent(restaurant.id)}`} key={restaurant.id}>
                  <span className="brand-mark">{restaurant.name.trim().charAt(0).toLocaleUpperCase("tr-TR") || "R"}</span>
                  <span>
                    <strong>{restaurant.name}</strong>
                    <small className="restaurant-order-types">
                      Eve teslimat · Yol ücreti {money.format(restaurant.deliveryFee)}{restaurant.dineInEnabled ? " · Masa QR" : ""}
                    </small>
                    <small>{[restaurant.address, restaurant.phone].filter(Boolean).join(" · ") || "Menüyü görüntüle · Eve sipariş ver"}</small>
                  </span>
                  <b aria-hidden="true">→</b>
                </a>
              ))}
            </div>
          ) : (
            <p className="orders-message">Şu an listelenecek açık restoran bulunmuyor.</p>
          )}
            </>
          )}
        </main>
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
          <span className="brand-mark">{menu.shop.trim().charAt(0).toLocaleUpperCase("tr-TR") || "M"}</span>
          <span className="brand-copy">
            <strong>{menu.shop}</strong>
            <small>QR MENÜ</small>
          </span>
        </a>
        <div className="topbar-actions">
          {!menu.isTableQr && <button className="orders-link" onClick={() => window.location.assign("/")}>Restoranlar</button>}
          <button className={view === "menu" ? "orders-link current" : "orders-link"} onClick={() => navigateView("menu")}>Menü</button>
          <button className={view === "orders" ? "orders-link current" : "orders-link"} onClick={() => navigateView("orders")}>Siparişlerim</button>
          <button className={view === "profile" ? "orders-link current" : "orders-link"} onClick={() => navigateView("profile")}>Bilgilerim</button>
          <div className="table-pill"><span /> {menu.isTableQr ? `Masa ${menu.table}` : "Eve sipariş"}</div>
        </div>
      </header>

      <nav className="bottom-nav" aria-label="Ana gezinme">
        <button
          className={view === "menu" ? "bottom-nav-item active" : "bottom-nav-item"}
          aria-current={view === "menu" ? "page" : undefined}
          onClick={() => navigateView("menu")}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5.5h6v6H4zm10 0h6v6h-6zM4 15.5h6v4H4zm10 0h6v4h-6z" /></svg>
          <span>Menü</span>
        </button>
        <button
          className={view === "orders" ? "bottom-nav-item active" : "bottom-nav-item"}
          aria-current={view === "orders" ? "page" : undefined}
          onClick={() => navigateView("orders")}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3.75h10a2 2 0 0 1 2 2v14.5l-7-3.5-7 3.5V5.75a2 2 0 0 1 2-2Z" /><path d="M9 8h6m-6 4h6" /></svg>
          <span>Siparişlerim</span>
        </button>
        <button
          className={view === "profile" ? "bottom-nav-item active" : "bottom-nav-item"}
          aria-current={view === "profile" ? "page" : undefined}
          onClick={() => navigateView("profile")}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3.25" /><path d="M5.5 20a6.5 6.5 0 0 1 13 0" /></svg>
          <span>Bilgilerim</span>
        </button>
      </nav>

      {view === "profile" ? (
        <main className="profile-page">
          <div className="profile-heading">
            <span className="eyebrow">HESAP BİLGİLERİ</span>
            <h1>Bilgilerim</h1>
            <p>Telefon ve adres bilgilerinizi düzenleyin, restorana otomatik paylaşım tercihinizi yönetin.</p>
          </div>
          <section className="profile-card">
            {!authReady ? (
              <p className="orders-message"><span className="loader" /> Oturum kontrol ediliyor…</p>
            ) : !authUser ? (
              <div className="profile-login">
                <p>Bilgilerinizi yönetmek için Google veya Apple hesabınızla giriş yapın.</p>
                <div className="auth-actions">
                  <button className="primary-button" onClick={() => void signInForOrders("google")}>Google ile giriş yap</button>
                  <button className="secondary-button" onClick={() => void signInForOrders("apple")}>Apple ile giriş yap</button>
                </div>
                {ordersError && <p className="inline-error" role="alert">{ordersError}</p>}
              </div>
            ) : profileLoading ? (
              <p className="orders-message"><span className="loader" /> Profil yükleniyor…</p>
            ) : (
              <>
                <label className="field-label">
                  Ad soyad
                  <input type="text" autoComplete="name" maxLength={100} value={contactDraft.name} onChange={(event) => { setProfileSaved(false); setContactDraft((current) => ({ ...current, name: event.target.value })); }} placeholder={authUser.displayName || "Adınız soyadınız"} />
                </label>
                <label className="field-label">
                  Telefon
                  <input type="tel" autoComplete="tel" maxLength={40} value={contactDraft.phone} onChange={(event) => { setProfileSaved(false); setContactDraft((current) => ({ ...current, phone: event.target.value })); }} placeholder="05xx xxx xx xx" />
                </label>
                <label className="field-label">
                  Adres
                  <textarea autoComplete="street-address" maxLength={300} value={contactDraft.address} onChange={(event) => { setProfileSaved(false); setContactDraft((current) => ({ ...current, address: event.target.value })); }} placeholder="İsteğe bağlı adres bilgisi" />
                </label>
                <label className="share-contact-check">
                  <input
                    type="checkbox"
                    checked={contactDraft.shareWithRestaurant}
                    onChange={(event) => { setProfileSaved(false); setContactDraft((current) => ({ ...current, shareWithRestaurant: event.target.checked })); }}
                  />
                  <span>
                    <strong>Ad, telefon ve adresimi siparişlerimde otomatik paylaş</strong>
                    <small>Restoran siparişi onayladığında bu bilgilerle eşleşen müşteri kaydı güncellenir. Paylaşımı istediğiniz zaman kapatabilirsiniz.</small>
                  </span>
                </label>
                <p className="profile-privacy-copy">Bilgileriniz hesabınızda bulutta saklanır. Otomatik paylaşım açıksa her yeni siparişle restorana gönderilir. Paylaşımı kapatmanız, restoranda önceden kaydedilmiş bilgileri silmez.</p>
                {(profileError || actionError) && <p className="inline-error" role="alert">{profileError || actionError}</p>}
                {profileSaved && <p className="profile-saved" role="status">Bilgileriniz güvenli profilinize kaydedildi.</p>}
                <div className="profile-actions">
                  <button className="primary-button" disabled={profileLoading || profileSaving} onClick={() => void saveContactProfile()}>{profileSaving ? "Kaydediliyor…" : "Kaydet"}</button>
                </div>
              </>
            )}
          </section>
          {authUser && (
            <section className="profile-session-actions">
              <p>Bu cihazdaki QR oturumunuzu kapatabilirsiniz.</p>
              <button className="secondary-button" onClick={() => void signOutProfile()}>Çıkış yap</button>
            </section>
          )}
        </main>
      ) : view === "orders" ? (
        <main className="orders-page">
          <div className="orders-heading">
            <span className="eyebrow">HESAP GEÇMİŞİ</span>
            <h1>Siparişlerim</h1>
            <p>QR Menü hesabınızla verdiğiniz siparişleri ve tutar bilgilerini buradan takip edebilirsiniz.</p>
          </div>
          {authUser && (
            <section className="notification-settings">
              <div>
                <strong>Sipariş bildirimleri</strong>
                <p>Onay, iptal ve ödeme durumlarını bu cihazda alın.</p>
              </div>
              <button className="secondary-button" disabled={pushBusy} onClick={() => void toggleOrderNotifications()}>
                {pushBusy ? "Kaydediliyor…" : pushRegistered ? "Bildirimleri kapat" : "Bildirimleri aç"}
              </button>
              {pushMessage && <p className="profile-saved" role="status">{pushMessage}</p>}
              {pushError && <p className="inline-error" role="alert">{pushError}</p>}
            </section>
          )}
          {!authUser ? (
            <section className="orders-login">
              <p>Siparişlerinizi görmek için Google veya Apple hesabınızla giriş yapın.</p>
              <div className="auth-actions">
                <button className="primary-button" onClick={() => void signInForOrders("google")}>Google ile giriş yap</button>
                <button className="secondary-button" onClick={() => void signInForOrders("apple")}>Apple ile giriş yap</button>
              </div>
            </section>
          ) : ordersLoading && orders.length === 0 ? (
            <p className="orders-message"><span className="loader" /> Siparişler yükleniyor…</p>
          ) : orders.length === 0 ? (
            <p className="orders-message">Bu hesapla verilmiş QR siparişi bulunamadı.</p>
          ) : (
            <>
              <div className="orders-list">
                {orders.map((order) => (
                  <article className="customer-order" key={order.id}>
                    <div className="customer-order-heading">
                      <div>
                        <strong>{order.restaurantName ?? menu.shop} · {order.orderType === "DELIVERY" ? "Eve teslimat" : `Masa ${order.tableName ?? "QR"}`}{order.localNumber ? ` · #${order.localNumber}` : ""}</strong>
                        <span>{new Date(order.createdAt).toLocaleString("tr-TR")}</span>
                      </div>
                      <span className={`order-status ${order.status === "APPROVED" ? "is-approved" : order.status === "REJECTED" ? "is-rejected" : ""}`}>
                        {orderStatusLabel(order.status)}
                      </span>
                    </div>
                    <div className="customer-order-items">
                      {order.items.map((item, index) => {
                        const details = orderItemDetails(item);
                        return (
                          <div key={`${order.id}-${index}`}>
                            <p>{item.quantity}× {details.name}{item.note ? ` · ${item.note}` : ""}</p>
                            {details.choices.map((choice) => <span key={choice}>{choice}</span>)}
                          </div>
                        );
                      })}
                    </div>
                    <div className="customer-order-total">
                      <span>{order.amount === null ? "Tutar" : order.localNumber ? "Kesin tutar" : "Tahmini tutar"}</span>
                      <strong>{order.amount === null ? "Restoran belirleyecek" : money.format(order.amount)}</strong>
                    </div>
                    {order.status === "REJECTED" && order.reason && <p className="order-reason">{order.reason}</p>}
                  </article>
                ))}
              </div>
            </>
          )}
          {ordersError && <p className="inline-error" role="alert">{ordersError}</p>}
        </main>
      ) : <main>
        <section className="menu-section" aria-label="Menü">
          {!menu.isTableQr && (menu.address || menu.phone || menu.deliveryEnabled) && (
            <div className="restaurant-contact">
              {menu.address && <span>{menu.address}</span>}
              {menu.phone && <a href={`tel:${menu.phone.replace(/[^\d+]/g, "")}`}>{menu.phone}</a>}
              {menu.deliveryEnabled && <span>Yol ücreti: {money.format(menu.deliveryFee)}</span>}
            </div>
          )}
          <div className="menu-heading">
            <div>
              <span className="eyebrow">BUGÜN SİZİN İÇİN</span>
              <h2>Menüyü keşfet</h2>
            </div>
            <label className="search-box">
              <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 5 5" /></svg>
              <input
                aria-label="Ürün ara"
                placeholder="Bir lezzet arayın"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
          </div>

          <nav className="category-nav" aria-label="Menü kategorileri">
            <button
              className={categoryId === "all" ? "category-chip active" : "category-chip"}
              onClick={() => setCategoryId("all")}
            >Tümü</button>
            {categories.map((category) => (
              <button
                key={category.id}
                className={categoryId === category.id ? "category-chip active" : "category-chip"}
                onClick={() => setCategoryId(category.id)}
              >{category.name}</button>
            ))}
          </nav>

          {visibleCategories.length === 0 ? (
            <div className="empty-search"><span>⌕</span><p>Aramanızla eşleşen ürün bulamadık.</p></div>
          ) : visibleCategories.map((category) => (
            <section className="category-section" key={category.id}>
              <div className="category-title">
                <h3>{category.name}</h3>
                <span>{category.products.length} ürün</span>
              </div>
              <div className="product-grid">
                {category.products.map((product) => (
                  <article className={product.soldOut ? "product-card sold-out" : "product-card"} key={product.id}>
                    <button
                      className="product-main"
                      onClick={() => !product.soldOut && openProduct(product)}
                      disabled={product.soldOut}
                    >
                      {product.imageUrl ? (
                        <img className="product-image" src={product.imageUrl} alt="" loading="lazy" />
                      ) : (
                        <span className="product-image product-image-placeholder" aria-hidden="true">
                          <svg viewBox="0 0 48 48"><path d="M8 28c0-9 7-16 16-16s16 7 16 16v5H8z" /><path d="M13 21c-3-4-1-8 2-10m18 10c3-4 1-8-2-10" /><path d="M7 35h34" /></svg>
                        </span>
                      )}
                      <span className="product-copy">
                        <span className="product-name">{product.name}</span>
                        {product.description && <span className="product-description">{product.description}</span>}
                        <span className="product-meta">
                          <strong>{money.format(product.price)}</strong>
                          {product.groups.length > 0 && <span>Seçenekli</span>}
                          {product.isMenu && <span>Menü seçmeli</span>}
                          {product.soldOut && <span className="sold-label">Tükendi</span>}
                        </span>
                      </span>
                    </button>
                    {!product.soldOut && (
                      <button className="add-button" onClick={() => openProduct(product)} aria-label={`${product.name} ekle`}>
                        <span>+</span>
                      </button>
                    )}
                  </article>
                ))}
              </div>
            </section>
          ))}
        </section>
      </main>}

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
                  {!menu.isTableQr && (
                    <div className="delivery-profile-hint">
                      {profileLoading ? (
                        <span>Adres ve telefon bilgileriniz kontrol ediliyor…</span>
                      ) : deliveryProfileReady ? (
                        <span>Teslimat adresiniz ve telefonunuz Bilgilerim’den alınacak.</span>
                      ) : (
                        <>
                          <span>Eve teslimat için Bilgilerim’de adres ve telefon ekleyip otomatik paylaşımı açın.</span>
                          <button type="button" onClick={() => { setCartOpen(false); navigateView("profile"); }}>Bilgilerime git</button>
                        </>
                      )}
                    </div>
                  )}
                  <label className="field-label">
                    Sipariş notu
                    <textarea maxLength={200} value={cartNote} onChange={(event) => setCartNote(event.target.value)} placeholder="Restorana iletmek istediğiniz bir not var mı?" />
                  </label>
                  {!menu.isTableQr && <div className="total-row"><span>Yol ücreti</span><strong>{money.format(menu.deliveryFee)}</strong></div>}
                  <div className="total-row"><span>{menu.isTableQr ? "Toplam" : "Tahmini toplam"}</span><strong>{money.format(menu.isTableQr ? total : deliveryTotal)}</strong></div>
                  <p className="muted-copy">{menu.isTableQr ? "Masa siparişi restoran onayına gönderilir." : "Tahmini toplam varsayılan yol ücretini içerir. Restoran onay sırasında ücreti değiştirebilir; ödeme restoranda alınır."}</p>
                  {!authReady ? <p className="cart-auth-hint">Oturum kontrol ediliyor…</p> : authUser ? (
                    <div className="cart-auth-ready">
                      <button className="primary-button" disabled={busy || (!menu.isTableQr && !deliveryProfileReady)} onClick={() => requestOrder("google")}>
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
              <p>Devam ettiğinizde Google veya Apple profil adınız siparişinizle restorana iletilir ve restoranın yerel müşteri kaydına eklenir. Bilgilerim bölümünde otomatik paylaşımı açarsanız telefon ve adresiniz her yeni siparişinizle gönderilir ve restoranın müşteri kaydı güncellenir.</p>
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
