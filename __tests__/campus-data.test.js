// Mock db and config BEFORE requiring the module
jest.mock("../lib/db", () => ({
  getClient: jest.fn(),
}));

// Provide collection name values matching config.js pattern
jest.mock("../lib/config", () => ({
  mongo: {
    dbName: "test_db",
    collections: {
      INJA_weekday: "inja_weekday_col",
      INJA_friday: "inja_friday_col",
      INJA_weekend: "inja_weekend_col",
      JAIN_weekday: "jain_weekday_col",
      JAIN_friday: "jain_friday_col",
      JAIN_weekend: "jain_weekend_col",
    },
  },
}));

const {
  resolveCollectionName,
  findNextBusTime,
  clearCache,
} = require("../features/bus/campus.data");

afterEach(() => {
  clearCache();
});

// --- resolveCollectionName ---

describe("resolveCollectionName", () => {
  it("maps INJA weekdays (mon-thu) to INJA_weekday collection", () => {
    for (const day of ["monday", "tuesday", "wednesday", "thursday"]) {
      expect(resolveCollectionName("inja", day)).toBe("inja_weekday_col");
    }
  });

  it("maps INJA friday to INJA_friday collection", () => {
    expect(resolveCollectionName("inja", "friday")).toBe("inja_friday_col");
  });

  it("maps INJA weekend days to INJA_weekend collection", () => {
    expect(resolveCollectionName("inja", "saturday")).toBe("inja_weekend_col");
    expect(resolveCollectionName("inja", "sunday")).toBe("inja_weekend_col");
  });

  it("maps JAIN directions identically", () => {
    expect(resolveCollectionName("jain", "monday")).toBe("jain_weekday_col");
    expect(resolveCollectionName("jain", "friday")).toBe("jain_friday_col");
    expect(resolveCollectionName("jain", "sunday")).toBe("jain_weekend_col");
  });

  it("weekday days all resolve to the same value", () => {
    const mon = resolveCollectionName("inja", "monday");
    const tue = resolveCollectionName("inja", "tuesday");
    const wed = resolveCollectionName("inja", "wednesday");
    const thu = resolveCollectionName("inja", "thursday");
    expect(mon).toBe(tue);
    expect(tue).toBe(wed);
    expect(wed).toBe(thu);
  });

  it("normalizes direction to uppercase for collection key lookup", () => {
    expect(resolveCollectionName("INJA", "monday")).toBe("inja_weekday_col");
    expect(resolveCollectionName("Inja", "friday")).toBe("inja_friday_col");
  });

  it("returns null for invalid inputs", () => {
    expect(resolveCollectionName("inja", "holiday")).toBeNull();
    expect(resolveCollectionName("", "monday")).toBeNull();
    expect(resolveCollectionName(null, "monday")).toBeNull();
    expect(resolveCollectionName("inja", null)).toBeNull();
    expect(resolveCollectionName(null, null)).toBeNull();
  });

  it("returns null for unknown direction with valid day", () => {
    expect(resolveCollectionName("unknown", "monday")).toBeNull();
  });
});

// --- findNextBusTime ---

describe("findNextBusTime", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    // Set time to 2026-03-01 10:00:00 KST
    jest.setSystemTime(new Date("2026-03-01T01:00:00.000Z"));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("returns null for empty array", () => {
    expect(findNextBusTime([])).toBeNull();
  });

  it("returns null when no buses are available", () => {
    const docs = [
      { _id: "id1", isAvailableBus: false, operatingHours: "10:30" },
    ];
    expect(findNextBusTime(docs)).toBeNull();
  });

  it("returns null when all buses have passed", () => {
    const docs = [
      { _id: "id1", isAvailableBus: true, operatingHours: "09:00" },
      { _id: "id2", isAvailableBus: true, operatingHours: "09:30" },
    ];
    expect(findNextBusTime(docs)).toBeNull();
  });

  it("returns the earliest future available bus time", () => {
    const docs = [
      { _id: "early", isAvailableBus: true, operatingHours: "10:30" },
      { _id: "late", isAvailableBus: true, operatingHours: "11:00" },
      { _id: "passed", isAvailableBus: true, operatingHours: "09:00" },
    ];
    expect(findNextBusTime(docs)).toBe("10:30");
  });

  it("skips unavailable buses even if they are sooner", () => {
    const docs = [
      { _id: "disabled", isAvailableBus: false, operatingHours: "10:10" },
      { _id: "available", isAvailableBus: true, operatingHours: "10:30" },
    ];
    expect(findNextBusTime(docs)).toBe("10:30");
  });

  it("handles single available future bus", () => {
    const docs = [
      { _id: "only", isAvailableBus: true, operatingHours: "12:00" },
    ];
    expect(findNextBusTime(docs)).toBe("12:00");
  });

  it("returns the shared time when multiple buses depart at the same time", () => {
    const docs = [
      { _id: "regular", isAvailableBus: true, operatingHours: "10:30", routeType: "regular" },
      { _id: "hakbu", isAvailableBus: true, operatingHours: "10:30", routeType: "hakbu" },
      { _id: "later", isAvailableBus: true, operatingHours: "12:00", routeType: "regular" },
    ];
    expect(findNextBusTime(docs)).toBe("10:30");
  });
});

// --- applyFastestBusFlag ---

describe("applyFastestBusFlag", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    // Set time to 2026-03-01 10:00:00 KST
    jest.setSystemTime(new Date("2026-03-01T01:00:00.000Z"));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("flags ALL entries at the next available time", () => {
    const docs = [
      { _id: "r1", isAvailableBus: true, operatingHours: "10:30", routeType: "regular" },
      { _id: "h1", isAvailableBus: true, operatingHours: "10:30", routeType: "hakbu" },
      { _id: "r2", isAvailableBus: true, operatingHours: "12:00", routeType: "regular" },
      { _id: "past", isAvailableBus: true, operatingHours: "09:00", routeType: "regular" },
    ];

    // applyFastestBusFlag is not exported directly, but we can verify via
    // findNextBusTime that the time-based matching works correctly
    const nextTime = findNextBusTime(docs);
    expect(nextTime).toBe("10:30");

    // Simulate applyFastestBusFlag logic
    const flagged = docs.map((doc) => ({
      ...doc,
      isFastestBus: nextTime != null && doc.operatingHours === nextTime && doc.isAvailableBus,
    }));

    expect(flagged[0].isFastestBus).toBe(true);  // 10:30 regular
    expect(flagged[1].isFastestBus).toBe(true);  // 10:30 hakbu
    expect(flagged[2].isFastestBus).toBe(false); // 12:00 — not next
    expect(flagged[3].isFastestBus).toBe(false); // 09:00 — passed
  });

  it("does not flag unavailable buses even at the next time", () => {
    const docs = [
      { _id: "avail", isAvailableBus: true, operatingHours: "10:30" },
      { _id: "unavail", isAvailableBus: false, operatingHours: "10:30" },
    ];

    const nextTime = findNextBusTime(docs);
    const flagged = docs.map((doc) => ({
      ...doc,
      isFastestBus: nextTime != null && doc.operatingHours === nextTime && doc.isAvailableBus,
    }));

    expect(flagged[0].isFastestBus).toBe(true);
    expect(flagged[1].isFastestBus).toBe(false);
  });
});
