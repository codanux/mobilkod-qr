import { memo } from "react";
import type { MenuCategory, MenuResponse, Product } from "../types";

type Props = {
  menu: MenuResponse;
  categories: MenuCategory[];
  visibleCategories: MenuCategory[];
  categoryId: string;
  query: string;
  money: Intl.NumberFormat;
  onQueryChange: (value: string) => void;
  onCategoryChange: (id: string) => void;
  onOpenProduct: (product: Product) => void;
};

function MenuPageView({
  menu, categories, visibleCategories, categoryId, query, money,
  onQueryChange, onCategoryChange, onOpenProduct,
}: Props) {
  return (
    <main>
      <section className="menu-section" aria-label="Menü">
        <h1 className="sr-only">{menu.shop} menüsü</h1>
        {(menu.address || menu.phone) && (
          <div className="restaurant-contact">
            {menu.address && <span>{menu.address}</span>}
            {menu.phone && <a href={`tel:${menu.phone.replace(/[^\d+]/g, "")}`}>{menu.phone}</a>}
          </div>
        )}
        {!menu.isTableQr && menu.deliveryAcceptingOrders === false && (
          <div className="delivery-paused-notice" role="status">
            Restoran şu anda yoğun. Online eve siparişi geçici olarak kapalı; menüyü inceleyebilirsiniz.
          </div>
        )}
        <div className="menu-heading">
          <label className="search-box">
            <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 5 5" /></svg>
            <input aria-label="Ürün ara" placeholder="Bir lezzet arayın" value={query}
              onChange={(event) => onQueryChange(event.target.value)} />
          </label>
        </div>
        <nav className="category-nav" aria-label="Menü kategorileri">
          <button className={categoryId === "all" ? "category-chip active" : "category-chip"}
            onClick={() => onCategoryChange("all")}>Tümü</button>
          {categories.map((category) => (
            <button key={category.id}
              className={categoryId === category.id ? "category-chip active" : "category-chip"}
              onClick={() => onCategoryChange(category.id)}>{category.name}</button>
          ))}
        </nav>
        {visibleCategories.length === 0 ? (
          <div className="empty-search"><span>⌕</span><p>Aramanızla eşleşen ürün bulamadık.</p></div>
        ) : visibleCategories.map((category, categoryIndex) => (
          <section className="category-section" key={category.id}>
            <div className="category-title">
              <h2>{category.name}</h2>
              <span>{category.products.length} ürün</span>
            </div>
            <div className="product-grid">
              {category.products.map((product, productIndex) => (
                <article className={product.soldOut ? "product-card sold-out" : "product-card"} key={product.id}>
                  <button className="product-main" onClick={() => !product.soldOut && onOpenProduct(product)} disabled={product.soldOut}>
                    {product.imageUrl ? (
                      <img className="product-image" src={product.imageUrl} alt="" loading={categoryIndex === 0 && productIndex < 2 ? "eager" : "lazy"} fetchPriority={categoryIndex === 0 && productIndex === 0 ? "high" : "auto"} width="78" height="78" decoding="async" />
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
                    <button className="add-button" onClick={() => onOpenProduct(product)} aria-label={`${product.name} ekle`}>
                      <span>+</span>
                    </button>
                  )}
                </article>
              ))}
            </div>
          </section>
        ))}
      </section>
    </main>
  );
}

export const MenuPage = memo(MenuPageView);
