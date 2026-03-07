const { getBusConfigs, CONFIG_VERSION } = require("../features/bus/bus-config.data");

describe("getBusConfigs", () => {
  it("returns all 4 route configs", () => {
    const configs = getBusConfigs("ko");
    const ids = Object.keys(configs);
    expect(ids).toEqual(
      expect.arrayContaining(["hssc", "jongro07", "jongro02", "campus"])
    );
    expect(ids).toHaveLength(4);
  });

  it("every config has required common fields", () => {
    const configs = getBusConfigs("ko");
    for (const [id, config] of Object.entries(configs)) {
      expect(config).toMatchObject({
        id,
        screenType: expect.stringMatching(/^(realtime|schedule|webview)$/),
        display: {
          name: expect.any(String),
          themeColor: expect.stringMatching(/^[0-9A-Fa-f]{6}$/),
          iconType: expect.any(String),
        },
      });
    }
  });

  it("realtime configs have required realtime fields", () => {
    const configs = getBusConfigs("ko");
    const realtimeConfigs = Object.values(configs).filter(
      (c) => c.screenType === "realtime"
    );
    expect(realtimeConfigs.length).toBeGreaterThan(0);
    for (const config of realtimeConfigs) {
      expect(config.realtime).toMatchObject({
        stationsEndpoint: expect.stringMatching(/^\/bus\//),
        locationsEndpoint: expect.stringMatching(/^\/bus\//),
        refreshInterval: expect.any(Number),
      });
      expect(config.realtime.refreshInterval).toBeGreaterThan(0);
    }
  });

  it("schedule config has required schedule fields", () => {
    const configs = getBusConfigs("ko");
    const campus = configs.campus;
    expect(campus.screenType).toBe("schedule");
    expect(campus.schedule).toMatchObject({
      directions: expect.any(Array),
      serviceCalendar: {
        defaultServiceDays: expect.any(Array),
        exceptions: expect.any(Array),
      },
      routeTypes: expect.any(Object),
    });
    expect(campus.schedule.directions.length).toBeGreaterThan(0);
  });

  it("direction endpoints use {dayType} template", () => {
    const configs = getBusConfigs("ko");
    const directions = configs.campus.schedule.directions;
    for (const dir of directions) {
      expect(dir.endpoint).toContain("{dayType}");
      expect(dir.id).toBeTruthy();
      expect(dir.label).toBeTruthy();
    }
  });

  it("returns translated names for English", () => {
    const ko = getBusConfigs("ko");
    const en = getBusConfigs("en");
    expect(en.hssc.display.name).not.toBe(ko.hssc.display.name);
    expect(en.hssc.display.name).toBe("HSSC Shuttle Bus");
  });

  it("falls back to Korean for unsupported language", () => {
    const ko = getBusConfigs("ko");
    const xx = getBusConfigs("xx");
    expect(xx.hssc.display.name).toBe(ko.hssc.display.name);
  });

  it("service calendar days are valid (0-6)", () => {
    const configs = getBusConfigs("ko");
    const days = configs.campus.schedule.serviceCalendar.defaultServiceDays;
    for (const d of days) {
      expect(d).toBeGreaterThanOrEqual(0);
      expect(d).toBeLessThanOrEqual(6);
    }
  });

  it("exception dates are valid ISO format", () => {
    const configs = getBusConfigs("ko");
    const exceptions = configs.campus.schedule.serviceCalendar.exceptions;
    for (const ex of exceptions) {
      expect(ex.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(typeof ex.service).toBe("boolean");
      expect(typeof ex.reason).toBe("string");
    }
  });
});

describe("CONFIG_VERSION", () => {
  it("is a positive integer", () => {
    expect(Number.isInteger(CONFIG_VERSION)).toBe(true);
    expect(CONFIG_VERSION).toBeGreaterThan(0);
  });
});
