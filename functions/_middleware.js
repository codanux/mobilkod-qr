import { route, seoContent, sitemap } from "../seo/seo-utils.js";

let _renderPage;
async function getRenderPage() {
  if (!_renderPage) {
    try {
      const mod = await import("./ssr.js");
      _renderPage = mod.renderPage;
    } catch {
      _renderPage = null;
    }
  }
  return _renderPage;
}

const canonicalOrigin = "https://qr.mobilkod.com";
const apiOrigin = "https://pos.mobilkod.com";

async function publicData(path) {
  const response = await fetch(`${apiOrigin}${path}`, { signal: AbortSignal.timeout(8000), headers: { accept: "application/json" } });
  if (!response.ok) {
    const error = new Error(`SEO API: HTTP ${response.status}`);
    error.status = response.status;
    throw error;
  }
  return response.json();
}

export async function onRequest(context) {
  const { request } = context;
  if (request.method !== "GET" && request.method !== "HEAD") return context.next();
  const path = new URL(request.url).pathname;
  if (path === "/ai-catalog.json") return new Response(null, { status: 404, headers: { "cache-control": "public, max-age=300" } });
  if (path === "/robots.txt") return new Response(request.method === "HEAD" ? null : `User-agent: *\nAllow: /\nSitemap: ${canonicalOrigin}/sitemap.xml\n`, { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=300" } });
  if (path === "/sitemap.xml") {
    try {
      const xml = sitemap(canonicalOrigin, await publicData("/m/restaurants"));
      return new Response(request.method === "HEAD" ? null : xml, { headers: { "content-type": "application/xml; charset=utf-8", "cache-control": "public, max-age=300" } });
    } catch (error) {
      console.error("Site haritası oluşturulamadı", error);
      return new Response("Site haritası geçici olarak kullanılamıyor.", { status: 503, headers: { "cache-control": "no-store" } });
    }
  }
  const page = route(path);
  const apiPath = page.type === "directory" ? "/m/restaurants" : page.type === "restaurant" ? `/m/restaurants/${page.id}/menu` : null;
  const publicDataResult = apiPath
    ? publicData(apiPath).then((data) => ({ data }), (error) => ({ error }))
    : null;
  const response = await context.next();
  if (!response.headers.get("content-type")?.includes("text/html")) return response;
  const headers = new Headers(response.headers);
  headers.delete("content-length");
  headers.delete("etag");
  if (page.type === "private") {
    headers.set("X-Robots-Tag", "noindex, nofollow");
    return new Response(response.body, { status: response.status, headers });
  }
  if (!response.ok) return response;
  try {
    if (!apiPath || !publicDataResult) throw new Error("SEO sayfa yolu geçersiz");
    const result = await publicDataResult;
    if ("error" in result) throw result.error;
    const data = result.data;
    const seo = seoContent(canonicalOrigin, page, data);
    headers.delete("content-encoding");
    headers.delete("last-modified");
    headers.set("cache-control", "no-store");
    if (new URL(request.url).origin !== canonicalOrigin) headers.set("X-Robots-Tag", "noindex, nofollow");
    let html = null;
    if (request.method !== "HEAD") {
      const template = await response.text();
      const renderPage = await getRenderPage();
      let ssrBody = null;
      if (renderPage) {
        try {
          const ssrData = page.type === "directory" ? data.restaurants ?? data : data;
          ssrBody = await renderPage(page.type, ssrData);
        } catch (ssrError) {
          console.error("SSR render başarısız, ham SEO içeriğine düşülüyor", ssrError);
          ssrBody = seo.body;
        }
      } else {
        ssrBody = seo.body;
      }
      const bootstrap = { path: apiPath, data };
      const json = (value) => JSON.stringify(value).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026");
      const escape = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
      const meta = `<meta name="description" content="${escape(seo.description)}"><link rel="canonical" href="${escape(seo.canonical)}"><meta property="og:type" content="website"><meta property="og:title" content="${escape(seo.title)}"><meta property="og:description" content="${escape(seo.description)}"><meta property="og:url" content="${escape(seo.canonical)}"><meta name="twitter:card" content="summary"><meta name="twitter:title" content="${escape(seo.title)}"><meta name="twitter:description" content="${escape(seo.description)}">${seo.structured ? `<script type="application/ld+json">${json(seo.structured)}</script>` : ""}`;
      if (!template.includes('<div id="root"></div>') || !template.includes("</head>")) throw new Error("HTML şablonu geçersiz");
      html = template
        .replace(/<title>[^<]*<\/title>/, `<title>${escape(seo.title)}</title>`)
        .replace(/<meta name="description"[^>]*\/?>/, meta)
        .replace('<div id="root"></div>', `<div id="root">${ssrBody}</div><script id="qr-public-data" type="application/json">${json(bootstrap)}</script>`);
    }
    return new Response(html, { status: response.status, headers });
  } catch (error) {
    console.error("SEO sayfası oluşturulamadı", error);
    const status = error?.status === 404 ? 404 : 503;
    return new Response(status === 404 ? "Restoran bulunamadı." : "Sayfa geçici olarak kullanılamıyor.", { status, headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store", "X-Robots-Tag": "noindex" } });
  }
}
