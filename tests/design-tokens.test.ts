// Design-system guard: reads the color tokens from src/app/globals.css and checks
// every text/control pairing the UI actually uses against WCAG 2.2 contrast.
// AA: 4.5:1 for text, 3:1 for borders, focus rings and large text.
// Hover states must change the fill by at least 1.3:1, so the change is visible.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8");
const tokens = Object.fromEntries(
  [...css.matchAll(/--color-([a-z-]+):\s*(#[0-9a-f]{6})/gi)].map((m) => [m[1], m[2]]),
);

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(tokens[a]), luminance(tokens[b])].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const TEXT = 4.5;
const UI = 3;
const HOVER = 1.3;

describe("design tokens", () => {
  it("defines every token the UI uses", () => {
    for (const name of ["bg", "surface", "raised", "hover", "line", "text", "muted", "ink", "gold", "cyan", "magenta", "fresh", "stale", "down"]) {
      expect(tokens[name], name).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it.each([
    ["text", "surface"], ["text", "raised"], ["text", "bg"],
    ["muted", "surface"], ["muted", "raised"], ["muted", "bg"],
    ["cyan", "surface"], ["gold", "surface"], ["magenta", "surface"],
    ["fresh", "surface"], ["stale", "surface"], ["down", "surface"], ["down", "raised"],
    ["ink", "gold"], ["ink", "cyan"], ["ink", "magenta"], ["ink", "fresh"], ["ink", "stale"], ["ink", "down"], ["ink", "text"],
    ["text", "hover"], ["muted", "hover"],
  ])("text %s on %s meets AA (4.5:1)", (fg, bg) => {
    expect(contrast(fg, bg)).toBeGreaterThanOrEqual(TEXT);
  });

  it.each([
    ["line", "surface"], ["line", "raised"], ["gold", "bg"], ["gold", "raised"],
  ])("border/focus %s on %s meets 3:1", (fg, bg) => {
    expect(contrast(fg, bg)).toBeGreaterThanOrEqual(UI);
  });

  it.each([
    ["primary", "gold", "text"], // gold fill -> white fill
    ["secondary", "raised", "cyan"], // dark fill -> cyan fill
    ["ghost", "surface", "hover"], // nothing -> hover fill
  ])("%s button hover changes the fill visibly (%s -> %s)", (_name, rest, hover) => {
    expect(contrast(rest, hover)).toBeGreaterThanOrEqual(HOVER);
  });
});
