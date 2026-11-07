import { route, renderHtml, seoContent, sitemap } from "../seo/seo-utils.js";

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
    const apiPath = page.type === "directory" ? "/m/restaurants" : `/m/restaurants/${page.id}/menu`;
    const data = await publicData(apiPath);
    const seo = seoContent(canonicalOrigin, page, data);
    headers.delete("content-encoding");
    headers.delete("last-modified");
    headers.set("cache-control", "no-store");
    if (new URL(request.url).origin !== canonicalOrigin) headers.set("X-Robots-Tag", "noindex, nofollow");
    const html = request.method === "HEAD" ? null : renderHtml(await response.text(), seo, { path: apiPath, data });
    return new Response(html, { status: response.status, headers });
  } catch (error) {
    console.error("SEO sayfası oluşturulamadı", error);
    const status = error?.status === 404 ? 404 : 503;
    return new Response(status === 404 ? "Restoran bulunamadı." : "Sayfa geçici olarak kullanılamıyor.", { status, headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store", "X-Robots-Tag": "noindex" } });
  }
}
