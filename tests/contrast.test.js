import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const css = await readFile(new URL("../src/App.css", import.meta.url), "utf8");

function color(selector, property) {
  const rule = css.split("\n").find((line) => line.startsWith(`${selector} {`));
  assert.ok(rule, `${selector} kuralı bulunamadı`);
  const match = new RegExp(`(?:\\{|;)\\s*${property}:\\s*#([0-9a-f]{6})(?:;|\\s*})`, "i").exec(rule);
  assert.ok(match, `${selector} ${property} bulunamadı`);
  return match[1];
}

function luminance(hex) {
  const channels = hex.match(/../g).map((part) => parseInt(part, 16) / 255)
    .map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrast(first, second) {
  const values = [luminance(first), luminance(second)].sort((a, b) => a - b);
  return (values[1] + 0.05) / (values[0] + 0.05);
}

test("restoran kartındaki küçük metinler ve marka harfi yeterli kontrasta sahip", () => {
  for (const selector of [".restaurant-card small", ".restaurant-card .restaurant-order-types", ".restaurant-card .delivery-paused-label"]) {
    assert.ok(contrast(color(selector, "color"), "ffffff") >= 4.5, selector);
  }
  const brand = color(".restaurant-card .brand-mark", "color");
  for (const background of ["e1bc6c", "b9832e"]) assert.ok(contrast(brand, background) >= 4.5, background);
});
