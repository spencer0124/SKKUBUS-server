const { getBusGroups, computeEtag } = require("../features/bus/bus-config.data");

describe("getBusGroups", () => {
  // Test 1: Returns 5 groups
  it("returns groups array with 5 items", () => {
    const groups = getBusGroups("ko");
    expect(Array.isArray(groups)).toBe(true);
    expect(groups).toHaveLength(5);
  });

  // Test 2: Each group has required fields
  it("each group has id, screenType, label, visibility, card, screen", () => {
    const groups = getBusGroups("ko");
    for (const g of groups) {
      expect(g).toHaveProperty("id");
      expect(g).toHaveProperty("screenType");
      expect(g).toHaveProperty("label");
      expect(g).toHaveProperty("visibility");
      expect(g).toHaveProperty("card");
      expect(g).toHaveProperty("screen");
    }
  });

  // Test 3: Realtime groups have screen.endpoint
  it("realtime groups have screen.endpoint", () => {
    const groups = getBusGroups("ko");
    const realtime = groups.filter((g) => g.screenType === "realtime");
    expect(realtime.length).toBeGreaterThan(0);
    for (const g of realtime) {
      expect(g.screen).toHaveProperty("endpoint");
      expect(g.screen.endpoint).toMatch(/^\/bus\/realtime\/ui\//);
    }
  });

  // Test 4: Schedule groups have services[], defaultServiceId, routeBadges
  it("schedule groups have services with weekEndpoint, defaultServiceId, routeBadges", () => {
    const groups = getBusGroups("ko");
    const schedule = groups.filter((g) => g.screenType === "schedule");
    expect(schedule.length).toBeGreaterThan(0);
    for (const g of schedule) {
      expect(g.screen).toHaveProperty("defaultServiceId");
      expect(g.screen).toHaveProperty("services");
      expect(g.screen).toHaveProperty("routeBadges");
      expect(Array.isArray(g.screen.services)).toBe(true);
      for (const svc of g.screen.services) {
        expect(svc).toHaveProperty("serviceId");
        expect(svc).toHaveProperty("label");
        expect(svc).toHaveProperty("weekEndpoint");
        expect(svc.weekEndpoint).toMatch(/^\/bus\/schedule\/data\//);
      }
    }
  });

  // Test 5: Campus has heroCard
  it("campus has heroCard with etaEndpoint and showUntilMinutesBefore", () => {
    const groups = getBusGroups("ko");
    const campus = groups.find((g) => g.id === "campus");
    expect(campus.screen.heroCard).toBeDefined();
    expect(campus.screen.heroCard).toMatchObject({
      etaEndpoint: "/bus/campus/eta",
      showUntilMinutesBefore: 0,
    });
  });

  // Test 6: Fasttrack has dateRange visibility
  it("fasttrack has dateRange visibility with valid ISO dates", () => {
    const groups = getBusGroups("ko");
    const fasttrack = groups.find((g) => g.id === "fasttrack");
    expect(fasttrack.visibility.type).toBe("dateRange");
    expect(fasttrack.visibility.from).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(fasttrack.visibility.until).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  // Test 7: Non-fasttrack groups have always visibility
  it("non-fasttrack groups have visibility.type always", () => {
    const groups = getBusGroups("ko");
    const nonFt = groups.filter((g) => g.id !== "fasttrack");
    for (const g of nonFt) {
      expect(g.visibility).toEqual({ type: "always" });
    }
  });

  // Test 8: Group order
  it("group order is hssc, campus, fasttrack, jongro02, jongro07", () => {
    const groups = getBusGroups("ko");
    const ids = groups.map((g) => g.id);
    expect(ids).toEqual(["hssc", "campus", "fasttrack", "jongro02", "jongro07"]);
  });

  // Test 9: English translations differ
  it("English translations differ from Korean", () => {
    const ko = getBusGroups("ko");
    const en = getBusGroups("en");
    expect(en[0].label).not.toBe(ko[0].label);
  });

  // Test 10: Unsupported language falls back to Korean
  it("unsupported language falls back to Korean", () => {
    const ko = getBusGroups("ko");
    const xx = getBusGroups("xx");
    expect(xx[0].label).toBe(ko[0].label);
  });
});

describe("computeEtag", () => {
  // Test 11: ETag format
  it("ETag matches md5 hex format", () => {
    const etag = computeEtag("ko");
    expect(etag).toMatch(/^"[a-f0-9]{32}"$/);
  });

  // Test 12: If-None-Match → same ETag
  it("same language returns same ETag", () => {
    const e1 = computeEtag("ko");
    const e2 = computeEtag("ko");
    expect(e1).toBe(e2);
  });

  // Test 13: Different ETag per language
  it("different ETag per language", () => {
    const ko = computeEtag("ko");
    const en = computeEtag("en");
    expect(ko).not.toBe(en);
  });
});
