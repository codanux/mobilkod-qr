const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const escape = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const json = (value) => JSON.stringify(value).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026");

export function route(path) {
  if (path === "/") return { type: "directory" };
  const match = /^\/restaurant\/([^/]+)\/?$/.exec(path);
  if (match && UUID.test(match[1])) return { type: "restaurant", id: match[1] };
  return { type: "private" };
}

export function restaurantUrl(origin, id) {
  if (!UUID.test(id)) throw new Error("Geçersiz restoran kimliği");
  return `${origin}/restaurant/${id}`;
}

export function seoContent(origin, page, data) {
  if (page.type === "directory") {
    if (!Array.isArray(data.restaurants)) throw new Error("Geçersiz restoran listesi");
    const title = "Restoranlar ve online menüler | Mobilkod";
    const description = "Restoranları keşfedin, menülerini inceleyin ve online sipariş verin.";
    const items = data.restaurants.map((r) => {
      if (!UUID.test(r.id) || typeof r.name !== "string") throw new Error("Geçersiz restoran bilgisi");
      return `<li><a href="${escape(restaurantUrl(origin, r.id))}">${escape(r.name)}</a>${r.address ? ` — ${escape(r.address)}` : ""}</li>`;
    }).join("");
    return { title, description, canonical: `${origin}/`, body: `<main><h1>Restoranlar</h1><p>${description}</p><ul>${items}</ul></main>` };
  }
  if (typeof data.shop !== "string" || !Array.isArray(data.categories)) throw new Error("Geçersiz restoran menüsü");
  const title = `${data.shop} Menü ve Online Sipariş | Mobilkod`;
  const address = typeof data.address === "string" ? data.address.trim() : "";
  const description = `${data.shop}${address ? ` · ${address}` : ""} menüsünü, ürünlerini ve fiyatlarını inceleyin.`;
  const canonical = restaurantUrl(origin, page.id);
  const sections = [];
  const categories = data.categories.map((category) => {
    if (typeof category.name !== "string" || !Array.isArray(category.products)) throw new Error("Geçersiz menü kategorisi");
    const menuItems = [];
    const products = category.products.map((product) => {
      if (typeof product.name !== "string" || typeof product.price !== "number" || !Number.isFinite(product.price)) throw new Error("Geçersiz menü ürünü");
      const fixedPrice = Array.isArray(product.groups) && product.groups.length === 0 && !product.isMenu && product.price >= 0;
      menuItems.push({
        "@type": "MenuItem",
        name: product.name,
        ...(product.description ? { description: product.description } : {}),
        ...(fixedPrice ? { offers: { "@type": "Offer", price: product.price, priceCurrency: "TRY", availability: product.soldOut ? "https://schema.org/OutOfStock" : "https://schema.org/InStock" } } : {}),
      });
      return `<li><strong>${escape(product.name)}</strong>${product.description ? ` — ${escape(product.description)}` : ""} · ${escape(new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(product.price))}${product.soldOut ? " · Tükendi" : ""}</li>`;
    }).join("");
    sections.push({ "@type": "MenuSection", name: category.name, hasMenuItem: menuItems });
    return `<section><h2>${escape(category.name)}</h2><ul>${products}</ul></section>`;
  }).join("");
  const structured = { "@context": "https://schema.org", "@type": "Restaurant", name: data.shop, url: canonical,
    ...(address ? { address } : {}), ...(data.phone ? { telephone: data.phone } : {}),
    hasMenu: { "@type": "Menu", url: canonical, hasMenuSection: sections } };
  return { title, description, canonical, structured, body: `<main><h1>${escape(data.shop)} menüsü</h1>${address ? `<p>${escape(address)}</p>` : ""}${data.phone ? `<p>${escape(data.phone)}</p>` : ""}${categories}</main>` };
}

export function renderHtml(template, seo, bootstrap) {
  const meta = `<meta name="description" content="${escape(seo.description)}"><link rel="canonical" href="${escape(seo.canonical)}"><meta property="og:type" content="website"><meta property="og:title" content="${escape(seo.title)}"><meta property="og:description" content="${escape(seo.description)}"><meta property="og:url" content="${escape(seo.canonical)}"><meta name="twitter:card" content="summary"><meta name="twitter:title" content="${escape(seo.title)}"><meta name="twitter:description" content="${escape(seo.description)}">${seo.structured ? `<script type="application/ld+json">${json(seo.structured)}</script>` : ""}`;
  if (!template.includes('<div id="root"></div>') || !template.includes("</head>")) throw new Error("HTML şablonu geçersiz");
  return template.replace(/<title>[^<]*<\/title>/, `<title>${escape(seo.title)}</title>`)
    .replace(/<meta name="description"[^>]*\/?>/, meta)
    .replace('<div id="root"></div>', `<div id="root">${seo.body}</div><script id="qr-public-data" type="application/json">${json(bootstrap)}</script>`);
}

export function sitemap(origin, data) {
  if (!Array.isArray(data.restaurants)) throw new Error("Geçersiz restoran listesi");
  const urls = [`${origin}/`, ...data.restaurants.map((r) => restaurantUrl(origin, r.id))];
  if (urls.length > 50000) throw new Error("Site haritası 50000 URL sınırını aşıyor");
  return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map((url) => `<url><loc>${escape(url)}</loc></url>`).join("")}</urlset>`;
}
