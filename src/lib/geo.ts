import type { Product } from "@/types";

export function distanceKm(from: { latitude: number; longitude: number }, to: { latitude: number; longitude: number }) {
  const rad = (d: number) => d * Math.PI / 180;
  const dLat = rad(to.latitude - from.latitude);
  const dLon = rad(to.longitude - from.longitude);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(from.latitude)) * Math.cos(rad(to.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371.0088 * Math.asin(Math.sqrt(Math.min(1, a)));
}

export function priceFor(product: Product, selected: string[]) {
  let base = product.price, delta = 0;
  for (const g of product.groups) for (const o of g.options) {
    if (!selected.includes(o.id)) continue;
    if (o.abs !== null) base = o.abs; else delta += o.delta;
  }
  for (const s of product.slots ?? []) for (const o of s.options) if (selected.includes(o.id)) delta += o.upcharge;
  return base + delta;
}

export function getCurrentLocation(): Promise<GeolocationPosition> {
  if (!navigator.geolocation) return Promise.reject(new Error("Bu cihaz konum bilgisini desteklemiyor."));
  return new Promise((resolve, reject) => navigator.geolocation.getCurrentPosition(resolve,
    (e) => reject(new Error(e.code === e.PERMISSION_DENIED ? "Konum izni gerekli." : "Konum alınamadı.")),
    { enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 }));
}
