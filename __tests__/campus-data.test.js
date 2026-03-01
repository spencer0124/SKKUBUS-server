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
  findNextBusId,
  clearCache,
} = require("../features/bus/campus.data");

afterEach(() => {
  clearCache();
});

// --- resolveCollectionName ---

describe("resolveCollectionName", () => {
  it("maps INJA weekdays (mon-thu) to INJA_weekday collection", () => {
    for (const day of ["monday", "tuesday", "wednesday", "thursday"]) {
      expect(resolveCollectionName(`INJA_${day}`)).toBe("inja_weekday_col");
    }
  });

  it("maps INJA_friday to INJA_friday collection", () => {
    expect(resolveCollectionName("INJA_friday")).toBe("inja_friday_col");
  });

  it("maps INJA weekend days to INJA_weekend collection", () => {
    expect(resolveCollectionName("INJA_saturday")).toBe("inja_weekend_col");
    expect(resolveCollectionName("INJA_sunday")).toBe("inja_weekend_col");
  });

  it("maps JAIN directions identically", () => {
    expect(resolveCollectionName("JAIN_monday")).toBe("jain_weekday_col");
    expect(resolveCollectionName("JAIN_friday")).toBe("jain_friday_col");
    expect(resolveCollectionName("JAIN_sunday")).toBe("jain_weekend_col");
  });

  it("weekday bustypes all resolve to the same value", () => {
    const mon = resolveCollectionName("INJA_monday");
    const tue = resolveCollectionName("INJA_tuesday");
    const wed = resolveCollectionName("INJA_wednesday");
    const thu = resolveCollectionName("INJA_thursday");
    expect(mon).toBe(tue);
    expect(tue).toBe(wed);
    expect(wed).toBe(thu);
  });

  it("returns null for invalid bustypes", () => {
    expect(resolveCollectionName("INVALID")).toBeNull();
    expect(resolveCollectionName("INJA_holiday")).toBeNull();
    expect(resolveCollectionName("")).toBeNull();
    expect(resolveCollectionName(null)).toBeNull();
    expect(resolveCollectionName(undefined)).toBeNull();
  });

  it("returns null for bustypes with wrong structure", () => {
    expect(resolveCollectionName("INJA")).toBeNull();
    expect(resolveCollectionName("INJA_monday_extra")).toBeNull();
  });

  it("returns null for unknown direction with valid day", () => {
    // Config doesn't have UNKNOWN_weekday, so should return null
    expect(resolveCollectionName("UNKNOWN_monday")).toBeNull();
  });
});

// --- findNextBusId ---

describe("findNextBusId", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    // Set time to 2026-03-01 10:00:00 KST
    jest.setSystemTime(new Date("2026-03-01T01:00:00.000Z"));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("returns null for empty array", () => {
    expect(findNextBusId([])).toBeNull();
  });

  it("returns null when no buses are available", () => {
    const docs = [
      { _id: "id1", isAvailableBus: false, operatingHours: "10:30" },
    ];
    expect(findNextBusId(docs)).toBeNull();
  });

  it("returns null when all buses have passed", () => {
    const docs = [
      { _id: "id1", isAvailableBus: true, operatingHours: "09:00" },
      { _id: "id2", isAvailableBus: true, operatingHours: "09:30" },
    ];
    expect(findNextBusId(docs)).toBeNull();
  });

  it("returns the earliest future available bus", () => {
    const docs = [
      { _id: "early", isAvailableBus: true, operatingHours: "10:30" },
      { _id: "late", isAvailableBus: true, operatingHours: "11:00" },
      { _id: "passed", isAvailableBus: true, operatingHours: "09:00" },
    ];
    expect(findNextBusId(docs)).toBe("early");
  });

  it("skips unavailable buses even if they are sooner", () => {
    const docs = [
      { _id: "disabled", isAvailableBus: false, operatingHours: "10:10" },
      { _id: "available", isAvailableBus: true, operatingHours: "10:30" },
    ];
    expect(findNextBusId(docs)).toBe("available");
  });

  it("handles single available future bus", () => {
    const docs = [
      { _id: "only", isAvailableBus: true, operatingHours: "12:00" },
    ];
    expect(findNextBusId(docs)).toBe("only");
  });
});
