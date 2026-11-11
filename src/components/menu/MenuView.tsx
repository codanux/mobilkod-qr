"use client";
import { useState, useMemo, useCallback } from "react";
import { ShoppingCart } from "lucide-react";
import type { MenuResponse, Product, CartLine } from "@/types";
import type { User } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { useCart } from "@/context/CartContext";
import { useRouter } from "@/i18n/navigation";
import { priceFor } from "@/lib/geo";
import { money } from "@/lib/money";
import { customerRequest, getAccessToken } from "@/lib/api";
import { getSelectedAddr } from "@/lib/selected-address";
import { Button } from "@/components/ui/Button";
import { TopBar } from "@/components/layout/TopBar";
import { BottomNav } from "@/components/layout/BottomNav";
import { CategoryNav } from "./CategoryNav";
import { ProductCard } from "./ProductCard";
import { ProductDialog } from "./ProductDialog";
import { CartDialog } from "@/components/cart/CartDialog";
import { OrderSentDialog } from "@/components/orders/OrderSentDialog";

function DesktopCart({ cart, cartNote, total, menu, onChangeNote, onChangeQuantity, onSubmitOrder, busy, authReady, user, actionError }: {
  cart: CartLine[]; cartNote: string; total: number; menu: MenuResponse;
  busy: boolean; authReady: boolean; user: User | null; actionError: string;
  onChangeNote: (v: string) => void;
  onChangeQuantity: (key: string, amt: number) => void;
  onSubmitOrder: (p: "google" | "apple") => void;
}) {
  const deliveryFee = menu.isTableQr ? 0 : menu.deliveryFee;
  const grandTotal = total + deliveryFee;
  return (
    <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-100 dark:border-zinc-800 p-5 space-y-4">
      <h3 className="font-extrabold text-slate-900 dark:text-zinc-100">Sepet</h3>
      <div className="space-y-1">
        {cart.map(line => (
          <div key={line.key} className="flex items-center gap-2 py-1.5">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-900 dark:text-zinc-100 truncate">{line.product.name}</p>
              {line.choiceNames.length > 0 && <p className="text-xs text-slate-400 dark:text-zinc-500 truncate">{line.choiceNames.join(" · ")}</p>}
              <p className="text-sm font-bold dark:text-zinc-100 mt-0.5">{money.format(line.unitPrice * line.quantity)}</p>
            </div>
            <div className="flex items-center border border-slate-200 dark:border-zinc-700 rounded-xl shrink-0">
              <Button variant="outline" aria-label="Azalt" onClick={() => onChangeQuantity(line.key, -1)} className="w-7 h-8 !p-0 !rounded-r-none !border-0 text-base">−</Button>
              <span className="w-5 text-center text-xs font-bold dark:text-zinc-100">{line.quantity}</span>
              <Button variant="outline" aria-label="Arttır" onClick={() => onChangeQuantity(line.key, 1)} className="w-7 h-8 !p-0 !rounded-l-none !border-0 text-base">+</Button>
            </div>
          </div>
        ))}
      </div>
      <textarea maxLength={200} value={cartNote} onChange={e => onChangeNote(e.target.value)} rows={2}
        className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 text-sm text-slate-900 dark:text-zinc-100 bg-slate-50 dark:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-900/20 dark:focus:ring-zinc-100/20 focus:border-zinc-900 dark:focus:border-zinc-400 focus:bg-white dark:focus:bg-zinc-700 resize-none transition-colors"
        placeholder="Sipariş notu…" />
      <div className="space-y-1 pt-2 border-t border-slate-100 dark:border-zinc-800">
        <div className="flex justify-between text-sm text-slate-500 dark:text-zinc-400"><span>Ürünler</span><span>{money.format(total)}</span></div>
        {!menu.isTableQr && deliveryFee > 0 && <div className="flex justify-between text-sm text-slate-500 dark:text-zinc-400"><span>Teslimat</span><span>{money.format(deliveryFee)}</span></div>}
        <div className="flex justify-between font-bold text-slate-900 dark:text-zinc-100 pt-1 border-t border-slate-100 dark:border-zinc-800"><span>Toplam</span><span>{money.format(grandTotal)}</span></div>
      </div>
      {actionError && <p className="text-sm text-red-600 bg-red-50 dark:bg-red-900/20 rounded-xl px-3 py-2">{actionError}</p>}
      {!authReady ? null : user ? (
        <Button fullWidth onClick={() => onSubmitOrder("google")} disabled={busy}>
          {busy ? "İşleniyor…" : "Siparişi ver"}
        </Button>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-slate-400 text-center">Sipariş için giriş yapın</p>
          <Button fullWidth onClick={() => onSubmitOrder("google")} disabled={busy}>
            Google ile siparişi ver
          </Button>
        </div>
      )}
    </div>
  );
}

export function MenuView({ menu, token }: { menu: MenuResponse; token: string }) {
  const { user, ready: authReady } = useAuth();
  const { cart, cartNote, cartOpen, setCart, setCartOpen, setCartNote, clearCart } = useCart();
  const router = useRouter();
  const [sessionId] = useState(() => crypto.randomUUID());
  const [query, setQuery] = useState("");
  const [categoryId, setCategoryId] = useState("all");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [options, setOptions] = useState<Record<string, string[]>>({});
  const [quantity, setQuantity] = useState(1);
  const [productNote, setProductNote] = useState("");
  const [actionError, setActionError] = useState("");
  const [busy, setBusy] = useState(false);
  const [orderSent, setOrderSent] = useState(false);
  const orderType = menu.isTableQr ? "DINE_IN" : "DELIVERY";
  const nav = (tab: "menu" | "orders" | "profile") => {
    if (tab === "orders") router.push({ pathname: "/orders" });
    else if (tab === "profile") router.push({ pathname: "/profile" });
  };

  const visibleCategories = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("tr");
    return menu.categories
      .filter(c => categoryId === "all" || c.id === categoryId)
      .map(c => ({ ...c, products: c.products.filter(p => !q || p.name.toLocaleLowerCase("tr").includes(q) || p.description?.toLocaleLowerCase("tr").includes(q)) }))
      .filter(c => c.products.length > 0);
  }, [menu.categories, categoryId, query]);

  const total = cart.reduce((s, l) => s + l.unitPrice * l.quantity, 0);
  const count = cart.reduce((s, l) => s + l.quantity, 0);

  const changeQuantity = (key: string, amt: number) =>
    setCart(cur => cur.map(l => l.key === key ? { ...l, quantity: Math.min(20, l.quantity + amt) } : l).filter(l => l.quantity > 0));

  const openProduct = useCallback((product: Product) => {
    setSelectedProduct(product); setOptions({}); setQuantity(1); setProductNote(""); setActionError("");
  }, []);

  function addToCart() {
    if (!selectedProduct) return;
    const sel = Object.values(options).flat();
    const missing = selectedProduct.groups.find(g => { const c = (options[g.id] ?? []).length; return c < g.min || c > g.max; })
      ?? selectedProduct.slots?.find(s => s.required && (options[s.id] ?? []).length !== 1);
    if (missing) { setActionError(`${missing.name} seçimini yapın.`); return; }
    setCart(cur => [...cur, {
      key: crypto.randomUUID(),
      product: selectedProduct,
      quantity,
      note: productNote.trim(),
      modifierIds: selectedProduct.groups.flatMap(g => options[g.id] ?? []),
      menuOptionIds: (selectedProduct.slots ?? []).flatMap(s => options[s.id] ?? []),
      choiceNames: selectedProduct.groups.flatMap(g => g.options.filter(o => sel.includes(o.id)).map(o => o.name)),
      unitPrice: priceFor(selectedProduct, sel),
    }]);
    setSelectedProduct(null);
  }

  async function submitOrder(provider: "google" | "apple") {
    if (cart.length === 0) return;
    setBusy(true); setActionError("");
    try {
      const { getFirebaseAuth, GoogleAuthProvider, OAuthProvider, signInWithPopup } = await import("@/lib/firebase");
      const auth = getFirebaseAuth();
      const p = provider === "google" ? new GoogleAuthProvider() : (() => { const o = new OAuthProvider("apple.com"); o.addScope("name"); return o; })();
      const currentUser = auth.currentUser ?? (await signInWithPopup(auth, p)).user;
      await getAccessToken(currentUser);
      const selAddr = orderType === "DELIVERY" ? getSelectedAddr() : null;
      await customerRequest(currentUser, `/m/${encodeURIComponent(token)}/orders`, {
        method: "POST",
        body: JSON.stringify({
          sessionId, orderType, note: cartNote.trim() || undefined,
          ...(selAddr?.id ? { deliveryAddressId: selAddr.id } : {}),
          items: cart.map(l => ({ productId: l.product.id, quantity: l.quantity, note: l.note || undefined, ...(l.modifierIds.length > 0 && { modifierIds: l.modifierIds }), ...(l.menuOptionIds.length > 0 && { menuOptionIds: l.menuOptionIds }) })),
        }),
      });
      clearCart(); setOrderSent(true);
    } catch (err) { setActionError(err instanceof Error ? err.message : "Sipariş gönderilemedi."); }
    finally { setBusy(false); }
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 pb-20 lg:pb-0">
      <TopBar shop={menu.shop} isTableQr={menu.isTableQr} table={menu.table} activeTab="menu" onTabChange={nav} />
      <BottomNav activeTab="menu" onTabChange={nav} />

      <div className="lg:max-w-5xl lg:mx-auto lg:px-6 lg:py-6 lg:flex lg:gap-8 lg:items-start">
          {/* Left: search + categories + products */}
          <div className="lg:flex-1 lg:min-w-0">
            <div className="sticky top-14 z-20 bg-white dark:bg-zinc-950 border-b border-slate-100 dark:border-zinc-800 lg:static lg:border-0 lg:bg-transparent lg:dark:bg-transparent lg:mb-4">
              <div className="max-w-lg mx-auto lg:max-w-none px-4 lg:px-0 py-2">
                <input value={query} onChange={e => setQuery(e.target.value)} type="search"
                  className="w-full px-4 py-2 rounded-xl bg-slate-100 dark:bg-zinc-800 text-sm text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-900/20 dark:focus:ring-zinc-100/20 placeholder-slate-400 dark:placeholder-zinc-500"
                  placeholder="Ürün ara…" />
              </div>
            </div>
            <div className="sticky top-[calc(3.5rem+2.75rem)] z-20 bg-white dark:bg-zinc-950 lg:static lg:dark:bg-transparent">
              <CategoryNav categories={menu.categories} activeId={categoryId} onChange={setCategoryId} />
            </div>
            <div className="max-w-lg mx-auto lg:max-w-none px-4 lg:px-0 py-4 space-y-8">
              {visibleCategories.map(cat => (
                <section key={cat.id}>
                  <h2 className="text-base font-extrabold text-slate-800 dark:text-zinc-200 mb-3">{cat.name}</h2>
                  <div className="space-y-2 md:grid md:grid-cols-2 md:gap-2 md:space-y-0">
                    {cat.products.map(p => <ProductCard key={p.id} product={p} onOpen={openProduct} />)}
                  </div>
                </section>
              ))}
              {visibleCategories.length === 0 && (
                <p className="text-center text-slate-400 text-sm py-16">Sonuç bulunamadı.</p>
              )}
            </div>
            <footer className="text-center text-xs text-slate-300 dark:text-zinc-700 py-8">
              {menu.venueType === "MARKET" ? "İyi alışverişler" : "Afiyet olsun"} · Mobilkod
            </footer>
          </div>

          {/* Right: desktop cart sidebar */}
          <div className="hidden lg:block lg:w-80 lg:shrink-0 lg:sticky lg:top-20">
            {count > 0 ? (
              <DesktopCart cart={cart} cartNote={cartNote} total={total} menu={menu}
                onChangeNote={setCartNote} onChangeQuantity={changeQuantity}
                onSubmitOrder={submitOrder} busy={busy} authReady={authReady}
                user={user} actionError={actionError} />
            ) : (
              <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-100 dark:border-zinc-800 p-6 text-center">
                <ShoppingCart size={28} className="mx-auto mb-2 text-slate-300 dark:text-zinc-600" />
                <p className="text-slate-400 dark:text-zinc-500 text-sm">Sepetiniz boş</p>
              </div>
            )}
          </div>
        </div>

      {/* Mobile floating cart bar */}
      {count > 0 && (
        <div className="fixed bottom-16 sm:bottom-6 left-0 right-0 px-4 z-20 pointer-events-none lg:hidden">
          <Button size="lg" fullWidth onClick={() => setCartOpen(true)}
            className="pointer-events-auto max-w-lg mx-auto justify-between shadow-lg">
            <span className="bg-white/20 rounded-lg px-2 py-0.5 text-xs font-black">{count}</span>
            <span>Sepeti Gör</span>
            <span>{money.format(total)}</span>
          </Button>
        </div>
      )}

      {selectedProduct && (
        <ProductDialog product={selectedProduct} options={options} quantity={quantity} note={productNote} error={actionError}
          onChangeOptions={setOptions} onChangeQuantity={setQuantity} onChangeNote={setProductNote}
          onClearError={() => setActionError("")} onClose={() => setSelectedProduct(null)} onAddToCart={addToCart} />
      )}
      {cartOpen && (
        <CartDialog cart={cart} cartNote={cartNote} menu={menu} orderType={orderType} busy={busy} authReady={authReady}
          user={user} actionError={actionError} total={total} onClose={() => setCartOpen(false)}
          onChangeNote={setCartNote} onChangeQuantity={changeQuantity}
          onSubmitOrder={submitOrder} onNavigateProfile={() => { setCartOpen(false); nav("profile"); }} />
      )}
      {orderSent && <OrderSentDialog orderType={orderType} table={menu.table} onViewOrders={() => { setOrderSent(false); nav("orders"); }} onClose={() => setOrderSent(false)} />}
    </div>
  );
}
