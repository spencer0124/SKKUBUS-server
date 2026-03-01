// Mock db to prevent MongoDB connection on require
jest.mock("../lib/db", () => ({
  getClient: jest.fn(),
}));

// Unit tests for weightedRandomSelect — pure function, no MongoDB needed
const {
  weightedRandomSelect,
} = require("../features/ad/ad.data");

describe("weightedRandomSelect", () => {
  it("returns null for empty array", () => {
    expect(weightedRandomSelect([])).toBeNull();
  });

  it("returns null for null/undefined input", () => {
    expect(weightedRandomSelect(null)).toBeNull();
    expect(weightedRandomSelect(undefined)).toBeNull();
  });

  it("returns the only candidate for single-element array", () => {
    const ad = { placement: "splash", weight: 100 };
    expect(weightedRandomSelect([ad])).toBe(ad);
  });

  it("always returns an item from the candidates", () => {
    const candidates = [
      { name: "A", weight: 50 },
      { name: "B", weight: 30 },
      { name: "C", weight: 20 },
    ];
    for (let i = 0; i < 100; i++) {
      const result = weightedRandomSelect(candidates);
      expect(candidates).toContain(result);
    }
  });

  it("respects weight distribution approximately", () => {
    const candidates = [
      { name: "heavy", weight: 90 },
      { name: "light", weight: 10 },
    ];

    const counts = { heavy: 0, light: 0 };
    const iterations = 10000;

    for (let i = 0; i < iterations; i++) {
      const result = weightedRandomSelect(candidates);
      counts[result.name]++;
    }

    // With 10k iterations, heavy should be ~9000 (90%), light ~1000 (10%)
    // Allow generous margin (±5%) to avoid flaky tests
    expect(counts.heavy / iterations).toBeGreaterThan(0.8);
    expect(counts.heavy / iterations).toBeLessThan(1.0);
    expect(counts.light / iterations).toBeGreaterThan(0.0);
    expect(counts.light / iterations).toBeLessThan(0.2);
  });

  it("handles candidates with default weight (no weight property)", () => {
    const candidates = [
      { name: "A" },
      { name: "B" },
    ];
    for (let i = 0; i < 50; i++) {
      const result = weightedRandomSelect(candidates);
      expect(candidates).toContain(result);
    }
  });

  it("handles candidate with weight=0 (never selected when others have weight)", () => {
    const candidates = [
      { name: "zero", weight: 0 },
      { name: "nonzero", weight: 100 },
    ];
    for (let i = 0; i < 100; i++) {
      const result = weightedRandomSelect(candidates);
      expect(result.name).toBe("nonzero");
    }
  });
});
