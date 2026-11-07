import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { route, renderHtml, seoContent, sitemap } from "../seo/seo-utils.js";
import { onRequest } from "../functions/_middleware.js";
import worker from "../worker/index.js";

const origin = "https://qr.mobilkod.com";
const id = "4d7c97bc-8462-4394-aab0-9136c00841b2";
const restaurants = { restaurants: [{ id, name: "Köşe <Restoran>", address: "İstanbul & çevresi" }] };
const menu = { shop: 'Köşe </script><script>alert(1)</script>', address: "İstanbul", phone: "123", categories: [{ name: "Çorbalar", products: [{ name: "Mercimek <özel>", price: 85, description: "Sıcak & taze", soldOut: false }] }] };
const template = await readFile(new URL("../index.html", import.meta.url), "utf8");

test("sadece dizin ve restoran menüleri indekslenir", () => {
  assert.equal(route("/").type, "directory");
  assert.deepEqual(route(`/restaurant/${id}`), { type: "restaurant", id });
  for (const path of ["/orders", "/profile", "/profile/addresses", "/table-token", `/restaurant/${id}/profile`, "/restaurant/invalid"]) {
    assert.equal(route(path).type, "private");
  }
});

test("sunucu HTML'i özgün içerik, güvenli metadata ve başlangıç verisi içerir", () => {
  const seo = seoContent(origin, route(`/restaurant/${id}`), menu);
  const html = renderHtml(template, seo, { path: `/m/restaurants/${id}/menu`, data: menu });
  assert.match(html, /<h1>Köşe &lt;\/script&gt;/);
  assert.match(html, /Mercimek &lt;özel&gt;/);
  assert.match(html, /rel="canonical"/);
  assert.match(html, /application\/ld\+json/);
  assert.match(html, /qr-public-data/);
  assert.ok(!html.includes("</script><script>alert"));
  const embedded = html.match(/<script id="qr-public-data" type="application\/json">(.*?)<\/script>/);
  assert.deepEqual(JSON.parse(embedded[1]).data, menu);
  assert.match(html, /fonts\.googleapis\.com\/css2[^>]+media="print" onload="this\.media='all'"/);
  assert.match(html, /<noscript><link rel="stylesheet" href="https:\/\/fonts\.googleapis\.com/);
});

test("menü ürünleri, sabit fiyatlar ve herkese açık restoran adresi yapılandırılır", () => {
  const data = {
    shop: "Örnek Lokanta", address: "Kadıköy, İstanbul", phone: "123",
    deliveryOriginLatitude: 41, deliveryOriginLongitude: 29,
    categories: [{ name: "Çorbalar", products: [
      { name: "Mercimek", price: 85, description: "Günlük", soldOut: false, groups: [] },
      { name: "Ezogelin", price: 90, soldOut: true, groups: [] },
      { name: "Kebap", price: 200, soldOut: false, groups: [{ options: [{ abs: 300 }] }] },
      { name: "Menü", price: 250, soldOut: false, isMenu: true, groups: [] },
    ] }],
  };
  const seo = seoContent(origin, route(`/restaurant/${id}`), data);
  const items = seo.structured.hasMenu.hasMenuSection[0].hasMenuItem;
  assert.equal(seo.structured.address, data.address);
  assert.ok(seo.description.includes(data.address));
  assert.ok(seo.body.includes("Kadıköy, İstanbul"));
  assert.deepEqual(items[0].offers, { "@type": "Offer", price: 85, priceCurrency: "TRY", availability: "https://schema.org/InStock" });
  assert.equal(items[1].offers.availability, "https://schema.org/OutOfStock");
  assert.equal(items[2].offers, undefined);
  assert.equal(items[3].offers, undefined);
  assert.ok(seo.body.includes("Kebap") && seo.body.includes("200"));
  assert.equal(seo.structured.geo, undefined);
  const html = renderHtml(template, seo, { path: `/m/restaurants/${id}/menu`, data });
  const jsonLd = html.match(/<script type="application\/ld\+json">(.*?)<\/script>/);
  assert.deepEqual(JSON.parse(jsonLd[1]), seo.structured);
});

test("adres yoksa konum uydurulmaz", () => {
  const seo = seoContent(origin, route(`/restaurant/${id}`), { shop: "Lokanta", address: null, categories: [] });
  assert.equal(seo.structured.address, undefined);
  assert.equal(seo.structured.geo, undefined);
  assert.equal(seo.description, "Lokanta menüsünü, ürünlerini ve fiyatlarını inceleyin.");
});

test("site haritası sadece geçerli restoran bağlantılarını içerir", () => {
  const xml = sitemap(origin, restaurants);
  assert.match(xml, /<urlset/);
  assert.ok(xml.includes(`${origin}/restaurant/${id}`));
  assert.throws(() => sitemap(origin, { restaurants: [{ id: "invalid" }] }));
});

test("middleware yanıtları indeksleme, hata ve HEAD davranışını korur", async () => {
  const oldFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url) => {
    calls.push(url);
    if (url.endsWith("/missing")) return new Response("", { status: 404 });
    return Response.json(url.endsWith("/m/restaurants") ? restaurants : menu);
  };
  const call = (path, method = "GET", host = origin) => onRequest({
    request: new Request(`${host}${path}`, { method }),
    next: async () => new Response(method === "HEAD" ? null : template, { headers: { "content-type": "text/html" } }),
  });
  try {
    const home = await call("/");
    assert.equal(home.status, 200);
    assert.equal(home.headers.get("cache-control"), "no-store");
    assert.match(await home.text(), /Köşe &lt;Restoran&gt;/);
    const privatePage = await call(`/restaurant/${id}/profile`);
    assert.equal(privatePage.headers.get("x-robots-tag"), "noindex, nofollow");
    const preview = await call("/", "GET", "https://preview.example.com");
    assert.equal(preview.headers.get("x-robots-tag"), "noindex, nofollow");
    const head = await call(`/restaurant/${id}`, "HEAD");
    assert.equal(head.status, 200);
    assert.equal(await head.text(), "");
    const xml = await call("/sitemap.xml");
    assert.match(await xml.text(), new RegExp(id));
    const xmlHead = await call("/sitemap.xml", "HEAD");
    assert.equal(xmlHead.headers.get("content-type"), "application/xml; charset=utf-8");
    assert.equal(await xmlHead.text(), "");
    const robots = await call("/robots.txt");
    assert.match(await robots.text(), /Sitemap: https:\/\/qr\.mobilkod\.com\/sitemap\.xml/);
    assert.equal(await (await call("/robots.txt", "HEAD")).text(), "");
    assert.ok(calls.every((url) => url.startsWith("https://pos.mobilkod.com/")));
    globalThis.fetch = async () => new Response("", { status: 404 });
    const originalError = console.error;
    console.error = () => {};
    try { assert.equal((await call(`/restaurant/${id}`)).status, 404); }
    finally { console.error = originalError; }
    globalThis.fetch = async () => { throw new Error("offline"); };
    console.error = () => {};
    try { assert.equal((await call("/")).status, 503); assert.equal((await call("/sitemap.xml")).status, 503); }
    finally { console.error = originalError; }
  } finally {
    globalThis.fetch = oldFetch;
  }
});

test("Worker sitemap ve SPA yanıtlarını middleware üzerinden sunar", async () => {
  const oldFetch = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async () => Response.json(restaurants);
  const env = { ASSETS: { fetch: async (request) => { requests.push(new URL(request.url).pathname); return new Response(template, { headers: { "content-type": "text/html" } }); } } };
  try {
    const xml = await worker.fetch(new Request(`${origin}/sitemap.xml`), env);
    assert.equal(xml.headers.get("content-type"), "application/xml; charset=utf-8");
    assert.match(await xml.text(), new RegExp(id));
    assert.deepEqual(requests, []);
    const home = await worker.fetch(new Request(`${origin}/`), env);
    assert.match(await home.text(), /Köşe &lt;Restoran&gt;/);
    const privatePage = await worker.fetch(new Request(`${origin}/profile`), env);
    assert.equal(privatePage.headers.get("x-robots-tag"), "noindex, nofollow");
    assert.deepEqual(requests, ["/", "/profile"]);
  } finally {
    globalThis.fetch = oldFetch;
  }
});
