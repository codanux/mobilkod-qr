import { useEffect, useMemo, useState } from "react";
import {
  getApps,
  initializeApp,
  type FirebaseOptions,
} from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  OAuthProvider,
  signInWithPopup,
  type User,
} from "firebase/auth";
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
  shop: string;
  table: string;
  categories: { id: string; name: string; products: Product[] }[];
  firebase: FirebaseOptions & { projectId: string };
};

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
  items: { productId: string; quantity: number; note?: string; modifierIds?: string[]; menuOptionIds?: string[] }[];
  status: "PENDING" | "CLAIMED" | "RECEIVED" | "APPROVED" | "REJECTED";
  localNumber: number | null;
  amount: number | null;
  reason: string | null;
  createdAt: string;
};

const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/+$/, "");
const money = new Intl.NumberFormat("tr-TR", {
  style: "currency",
  currency: "TRY",
});

function getTableToken() {
  const parts = window.location.pathname.split("/").filter(Boolean);
  return parts[0] === "m" ? parts[1] : parts[0];
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
  const [menu, setMenu] = useState<MenuResponse | null>(null);
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
  const [orderSent, setOrderSent] = useState(false);
  const [view, setView] = useState<"menu" | "orders">("menu");
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersError, setOrdersError] = useState("");
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const auth = useMemo(() => menu ? getAuth(getApps()[0] ?? initializeApp(menu.firebase)) : null, [menu]);

  useEffect(() => {
    if (!token) {
      setLoadError("Masa QR bağlantısı eksik veya hatalı.");
      return;
    }
    let active = true;
    request<MenuResponse>(`/m/${encodeURIComponent(token)}/menu`)
      .then((data) => {
        if (active) setMenu(data);
      })
      .catch((error: unknown) => {
        if (active) setLoadError(error instanceof Error ? error.message : "Menü yüklenemedi.");
      });
    return () => {
      active = false;
    };
  }, [token]);

  useEffect(() => {
    if (!auth) return;
    return onAuthStateChanged(auth, setAuthUser);
  }, [auth]);

  useEffect(() => {
    if (view !== "orders" || !authUser || !token) return;
    let active = true;
    const load = async () => {
      try {
        const idToken = await authUser.getIdToken();
        const result = await request<CustomerOrder[]>(`/m/${encodeURIComponent(token)}/orders`, {
          headers: { authorization: `Bearer ${idToken}` },
        });
        if (active) {
          setOrders(result);
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
  }, [authUser, token, view]);

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
  const count = cart.reduce((sum, line) => sum + line.quantity, 0);

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

  async function submitOrder(providerName: "google" | "apple") {
    if (!menu || !token || cart.length === 0) return;
    setBusy(true);
    setActionError("");
    try {
      const currentAuth = getAuth(getApps()[0] ?? initializeApp(menu.firebase));
      const provider =
        providerName === "google"
          ? new GoogleAuthProvider()
          : new OAuthProvider("apple.com");
      if (providerName === "apple") {
        provider.addScope("email");
        provider.addScope("name");
      }
      const credential = await signInWithPopup(currentAuth, provider);
      const idToken = await credential.user.getIdToken();
      setAuthUser(credential.user);
      await request<{ id: string }>(
        `/m/${encodeURIComponent(token)}/orders`,
        {
          method: "POST",
          headers: { authorization: `Bearer ${idToken}` },
          body: JSON.stringify({
            note: cartNote.trim() || undefined,
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
    if (providerName === "apple") {
      provider.addScope("email");
      provider.addScope("name");
    }
    try {
      const credential = await signInWithPopup(auth, provider);
      setAuthUser(credential.user);
    } catch (error) {
      setOrdersError(error instanceof Error ? error.message : "Giriş yapılamadı.");
    }
  }

  function orderStatusLabel(status: CustomerOrder["status"]) {
    if (status === "APPROVED") return "Onaylandı";
    if (status === "REJECTED") return "Reddedildi";
    if (status === "RECEIVED") return "Restorana iletildi";
    if (status === "CLAIMED") return "Restoran siparişinizi aldı";
    return "İletildi";
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
    return { name: product?.name ?? "Ürün", choices };
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
        <a className="brand" href="#" aria-label="Mobilkod menü ana sayfa">
          <span className="brand-mark">m</span>
          <span>mobilkod<span className="brand-dot">.</span></span>
        </a>
        <div className="topbar-actions">
          <button className="orders-link" onClick={() => setView(view === "orders" ? "menu" : "orders")}>
            {view === "orders" ? "Menüye dön" : "Siparişlerim"}
          </button>
          <div className="table-pill"><span /> Masa {menu.table}</div>
        </div>
      </header>

      {view === "orders" ? (
        <main className="orders-page">
          <div className="orders-heading">
            <span className="eyebrow">MASA {menu.table}</span>
            <h1>Siparişlerim</h1>
            <p>Sipariş durumunuzu ve tutar bilgisini buradan takip edebilirsiniz.</p>
          </div>
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
            <p className="orders-message">Bu masada henüz siparişiniz yok.</p>
          ) : (
            <div className="orders-list">
              {orders.map((order) => (
                <article className="customer-order" key={order.id}>
                  <div className="customer-order-heading">
                    <div>
                      <strong>{order.localNumber ? `Sipariş #${order.localNumber}` : "QR siparişi"}</strong>
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
          )}
          {ordersError && <p className="inline-error" role="alert">{ordersError}</p>}
        </main>
      ) : <main>
        <section className="hero">
          <div className="hero-content">
            <span className="eyebrow">MASANIZA ÖZEL MENÜ</span>
            <h1>{menu.shop}</h1>
            <p>Lezzetleri keşfedin, siparişinizi masanızdan verin.</p>
          </div>
          <div className="hero-art" aria-hidden="true">
            <span className="hero-orbit orbit-one" />
            <span className="hero-orbit orbit-two" />
            <span className="hero-spark">✳</span>
            <span className="hero-leaf">✦</span>
          </div>
        </section>

        <section className="menu-section" aria-label="Menü">
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
            <div className="dialog-scroll">
              <span className="dialog-kicker">SİZE ÖZEL HAZIRLANIR</span>
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
              {actionError && <p className="inline-error" role="alert">{actionError}</p>}
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
              <span className="dialog-kicker">MASA {menu.table}</span>
              <h2 id="cart-title">Sipariş sepetin</h2>
              {cart.length === 0 ? <p className="muted-copy">Sepetiniz şu an boş.</p> : (
                <div className="cart-lines">
                  {cart.map((line) => (
                    <article className="cart-line" key={line.key}>
                      <div className="cart-line-copy">
                        <strong>{line.product.name}</strong>
                        {line.choiceNames.length > 0 && <span>{line.choiceNames.join(" · ")}</span>}
                        {line.note && <span>Not: {line.note}</span>}
                        <b>{money.format(line.unitPrice * line.quantity)}</b>
                      </div>
                      <div className="quantity-control compact">
                        <button onClick={() => changeQuantity(line.key, -1)} aria-label="Ürün adedini azalt">−</button>
                        <span>{line.quantity}</span>
                        <button onClick={() => changeQuantity(line.key, 1)} aria-label="Ürün adedini artır">+</button>
                      </div>
                    </article>
                  ))}
                </div>
              )}
              {cart.length > 0 && (
                <>
                  <label className="field-label">
                    Sipariş notu
                    <textarea maxLength={200} value={cartNote} onChange={(event) => setCartNote(event.target.value)} placeholder="Restorana iletmek istediğiniz bir not var mı?" />
                  </label>
                  <div className="total-row"><span>Tahmini toplam</span><strong>{money.format(total)}</strong></div>
                  <p className="muted-copy">Toplam tahminidir; kesin tutarı restoran belirler. Bu menüden ödeme alınmaz.</p>
                  <div className="auth-actions">
                    <button className="primary-button" disabled={busy} onClick={() => void submitOrder("google")}>
                      {busy ? "İşleniyor…" : "Google ile doğrula ve sipariş ver"}
                    </button>
                    <button className="secondary-button" disabled={busy} onClick={() => void submitOrder("apple")}>
                      Apple ile doğrula ve sipariş ver
                    </button>
                  </div>
                </>
              )}
              {actionError && <p className="inline-error" role="alert">{actionError}</p>}
            </div>
          </section>
        </div>
      )}

      {view === "menu" && orderSent && (
        <div className="overlay status-overlay">
          <section className="dialog status-dialog" role="dialog" aria-modal="true" aria-labelledby="status-title">
            <div className="status-icon approved" aria-hidden="true">✓</div>
            <span className="dialog-kicker">MASA {menu.table}</span>
            <h2 id="status-title">Siparişiniz iletildi</h2>
            <p>Sipariş isteğiniz restorana gönderildi. Onay için bu ekranda beklemeniz gerekmiyor.</p>
            <div className="auth-actions">
              <button className="primary-button" onClick={() => { setOrderSent(false); setView("orders"); }}>Siparişlerimi gör</button>
              <button className="secondary-button" onClick={() => setOrderSent(false)}>Menüye dön</button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

export default App;
