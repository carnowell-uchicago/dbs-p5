// Smooth marker movement between updates (src/lib/predict.ts), checked with
// 10 s steps taken from real worker log lines.
import { describe, expect, it } from "vitest";
import { predict, wrapLon } from "../src/lib/predict";

const at = (s: number) => new Date(Date.UTC(2026, 10, 3, 12, 0, s)).toISOString();

describe("predict", () => {
  const prev = { latitude: 2.96, longitude: 44.38, source_ts: at(0) };
  const latest = { latitude: 2.45, longitude: 44.74, source_ts: at(10) };

  it("at 0 s ahead it is the real position", () => {
    const p = predict(prev, latest, 0)!;
    expect(p.latitude).toBeCloseTo(2.45, 5); // within 0.00001°: floating-point wrap arithmetic
    expect(p.longitude).toBeCloseTo(44.74, 5);
  });

  it("5 s ahead it continues at the same speed and heading", () => {
    const p = predict(prev, latest, 5)!;
    expect(p.latitude).toBeCloseTo(2.195, 5); // -0.051°/s
    expect(p.longitude).toBeCloseTo(44.92, 5); // +0.036°/s
  });

  it("crosses the date line the short way and wraps", () => {
    const p = predict({ latitude: 10, longitude: 179.5, source_ts: at(0) }, { latitude: 10, longitude: 179.9, source_ts: at(10) }, 10)!;
    expect(p.longitude).toBeCloseTo(-179.7, 5);
  });

  it("caps how far ahead it predicts", () => {
    expect(predict(prev, latest, 300)).toEqual(predict(prev, latest, 30));
  });

  it("won't predict without a previous fix, or across a long gap in the data", () => {
    expect(predict(null, latest, 5)).toBeNull();
    expect(predict({ ...prev, source_ts: at(-120) }, latest, 5)).toBeNull();
  });
});

describe("wrapLon", () => {
  it("keeps longitudes in [-180, 180)", () => {
    expect([wrapLon(190), wrapLon(-190), wrapLon(45), wrapLon(540)]).toEqual([-170, 170, 45, 180 - 360]);
  });
});
