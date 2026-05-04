/**
 * Tests for the FCM dispatch path:
 *   - features/notices/notices.topics.js          (pure topic builder)
 *   - features/notices/notices.dispatcher.js      (sweep + dispatchOne)
 *   - features/notices/notices.internal.routes.js (the cycle-end ping route)
 *   - features/notices/notices.dispatch.poller.js (env-gated cron registration)
 *
 * Mocking strategy mirrors notices-data.test.js: stub lib/db before any
 * module that consumes it is required, so the dispatcher reads from our
 * controlled `mockCollection` rather than connecting to a real Mongo.
 */

const { ObjectId } = require("mongodb");
const express = require("express");
const request = require("supertest");

const mockCollection = {
  findOneAndUpdate: jest.fn(),
  updateOne: jest.fn().mockResolvedValue({ acknowledged: true }),
};
const mockDb = { collection: jest.fn().mockReturnValue(mockCollection) };
const mockClient = { db: jest.fn().mockReturnValue(mockDb) };

jest.mock("../lib/db", () => ({
  getClient: jest.fn(() => mockClient),
}));

const { buildTopics } = require("../features/notices/notices.topics");
const dispatcher = require("../features/notices/notices.dispatcher");
const internalRoutes = require("../features/notices/notices.internal.routes");
const config = require("../lib/config");

function makeNotice(extra = {}) {
  return {
    _id: new ObjectId(),
    sourceId: "skku-notice02",
    articleNo: 1234,
    title: "공지 제목",
    summaryOneLiner: "한 줄 요약",
    category: "academic",
    aiSummaryAt: new Date("2026-05-04T01:00:00Z"),
    pushedAt: null,
    pushAttempts: 0,
    pushError: null,
    dispatchClaimedAt: null,
    crawledAt: new Date(),
    isDeleted: false,
    ...extra,
  };
}

function buildInternalApp() {
  // Mirror just enough of the prod middleware to drive the route.
  const app = express();
  app.use(express.json());
  // responseHelper minimal stub — routes use res.success / res.error.
  app.use((req, res, next) => {
    res.success = (data) => res.json({ data });
    res.error = (status, code, message) =>
      res.status(status).json({ error: { code, message } });
    next();
  });
  app.use("/internal/notices", internalRoutes);
  // Surface async errors as 500s in tests. Express requires the arity-4
  // signature to recognize this as an error handler.
  app.use((err, req, res, next) => {
    void next;
    res.status(500).json({ error: { code: "TEST_ERROR", message: err.message } });
  });
  return app;
}

beforeEach(() => {
  jest.clearAllMocks();
  // Reset fetch between tests; each test stubs its own behavior.
  global.fetch = jest.fn();
});

afterEach(() => {
  delete global.fetch;
});

// ──────────────────────────────────────────────────────────
// Topic builder
// ──────────────────────────────────────────────────────────
describe("buildTopics", () => {
  it("emits picker:<sourceId> for picker tab membership", () => {
    expect(buildTopics({ sourceId: "arch" })).toContain("dept:arch");
  });

  it("emits category:<tab.id> for fixed tab membership", () => {
    expect(buildTopics({ sourceId: "skku-notice02" })).toContain(
      "category:academic"
    );
  });

  it("returns [] for an unknown sourceId", () => {
    expect(buildTopics({ sourceId: "does-not-exist" })).toEqual([]);
  });

  it("returns [] for a missing/invalid sourceId", () => {
    expect(buildTopics({})).toEqual([]);
    expect(buildTopics({ sourceId: null })).toEqual([]);
    expect(buildTopics({ sourceId: 42 })).toEqual([]);
    expect(buildTopics(null)).toEqual([]);
  });

  it("dedupes: a sourceId that maps once produces no duplicates", () => {
    const t = buildTopics({ sourceId: "arch" });
    expect(new Set(t).size).toBe(t.length);
  });
});

// ──────────────────────────────────────────────────────────
// dispatchOne
// ──────────────────────────────────────────────────────────
describe("dispatchOne", () => {
  it("marks pushedAt and skips fetch when topics are empty", async () => {
    const notice = makeNotice({ sourceId: "does-not-exist" });
    const out = await dispatcher.dispatchOne(notice);
    expect(out.result).toBe("skippedNoTopics");
    expect(global.fetch).not.toHaveBeenCalled();
    expect(mockCollection.updateOne).toHaveBeenCalledWith(
      { _id: notice._id },
      expect.objectContaining({
        $set: expect.objectContaining({
          pushedAt: expect.any(Date),
          dispatchClaimedAt: null,
        }),
        $inc: { pushAttempts: 1 },
      })
    );
  });

  it("marks pushedAt and releases lease on 2xx", async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ sent: 5, failed: 0, cleanedUp: 0 }),
    });

    const notice = makeNotice();
    const out = await dispatcher.dispatchOne(notice);
    expect(out.result).toBe("sent");
    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [url, opts] = global.fetch.mock.calls[0];
    expect(url).toBe(config.notices.dispatch.functionUrl);
    expect(opts.headers["X-API-Key"]).toBe(config.notices.dispatch.apiKey);
    const sent = JSON.parse(opts.body);
    expect(sent.type).toBe("notice");
    expect(sent.noticeId).toBe(String(notice._id));
    expect(sent.topics).toEqual(expect.arrayContaining(["category:academic"]));
    expect(sent.title_ko).toBe(notice.title);
    expect(sent.body_ko).toBe(notice.summaryOneLiner);

    expect(mockCollection.updateOne).toHaveBeenCalledWith(
      { _id: notice._id },
      expect.objectContaining({
        $set: expect.objectContaining({
          pushedAt: expect.any(Date),
          dispatchClaimedAt: null,
          pushError: null,
        }),
        $inc: { pushAttempts: 1 },
      })
    );
  });

  it("records pushError, releases lease, leaves pushedAt null on 5xx", async () => {
    global.fetch.mockResolvedValueOnce({
      ok: false,
      status: 502,
      text: async () => JSON.stringify({ error: "bad gateway" }),
    });

    const notice = makeNotice();
    const out = await dispatcher.dispatchOne(notice);
    expect(out.result).toBe("failed");

    const update = mockCollection.updateOne.mock.calls[0][1];
    expect(update.$set).toHaveProperty("dispatchClaimedAt", null);
    expect(update.$set.pushError).toMatch(/502/);
    expect(update.$set).not.toHaveProperty("pushedAt");
    expect(update.$inc).toEqual({ pushAttempts: 1 });
  });

  it("treats network errors as failure and releases the lease", async () => {
    global.fetch.mockRejectedValueOnce(new Error("ECONNRESET"));

    const notice = makeNotice();
    const out = await dispatcher.dispatchOne(notice);
    expect(out.result).toBe("failed");
    const update = mockCollection.updateOne.mock.calls[0][1];
    expect(update.$set).toHaveProperty("dispatchClaimedAt", null);
    expect(update.$set.pushError).toMatch(/ECONNRESET/);
    expect(update.$set).not.toHaveProperty("pushedAt");
  });
});

// ──────────────────────────────────────────────────────────
// sweepPending
// ──────────────────────────────────────────────────────────
describe("sweepPending", () => {
  function withSuccessfulFetch() {
    global.fetch.mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ sent: 1, failed: 0, cleanedUp: 0 }),
    });
  }

  it("returns processed=0 when nothing matches the claim filter", async () => {
    mockCollection.findOneAndUpdate.mockResolvedValue(null);
    const summary = await dispatcher.sweepPending("test");
    expect(summary.status).toBe("ok");
    expect(summary.processed).toBe(0);
    expect(summary.sent).toBe(0);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("dispatches each claimed row until the queue is empty", async () => {
    withSuccessfulFetch();
    const a = makeNotice();
    const b = makeNotice({ sourceId: "lib-hssc", category: undefined });
    mockCollection.findOneAndUpdate
      .mockResolvedValueOnce(a)
      .mockResolvedValueOnce(b)
      .mockResolvedValue(null);

    const summary = await dispatcher.sweepPending("test");
    expect(summary.processed).toBe(2);
    expect(summary.sent).toBe(2);
    expect(summary.failed).toBe(0);
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it("isolates per-row failures: one failure does not stop the loop", async () => {
    const a = makeNotice();
    const b = makeNotice();
    mockCollection.findOneAndUpdate
      .mockResolvedValueOnce(a)
      .mockResolvedValueOnce(b)
      .mockResolvedValue(null);

    global.fetch
      .mockRejectedValueOnce(new Error("timeout"))
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ sent: 1, failed: 0, cleanedUp: 0 }),
      });

    const summary = await dispatcher.sweepPending("test");
    expect(summary.processed).toBe(2);
    expect(summary.sent).toBe(1);
    expect(summary.failed).toBe(1);
  });

  it("supports the legacy {value} return shape from findOneAndUpdate", async () => {
    withSuccessfulFetch();
    const notice = makeNotice();
    mockCollection.findOneAndUpdate
      .mockResolvedValueOnce({ value: notice, lastErrorObject: {}, ok: 1 })
      .mockResolvedValue(null);
    const summary = await dispatcher.sweepPending("test");
    expect(summary.processed).toBe(1);
    expect(summary.sent).toBe(1);
  });

  it("submits the configured filter to findOneAndUpdate (gate fields)", async () => {
    mockCollection.findOneAndUpdate.mockResolvedValue(null);
    await dispatcher.sweepPending("test");
    const [filter, update] = mockCollection.findOneAndUpdate.mock.calls[0];
    expect(filter.pushedAt).toBeNull();
    // partial-index-friendly form: matches the partialFilterExpression on
    // `dispatch_pending_idx` exactly so the planner uses the index.
    expect(filter.aiSummaryAt).toEqual({ $type: "date" });
    // Age gate uses `crawledAt` (crawler-emitted) — `createdAt` does not
    // exist on notices docs. Schema verified against prod 2026-05-04.
    expect(filter.crawledAt).toBeDefined();
    expect(filter.crawledAt.$gt).toBeInstanceOf(Date);
    expect(filter.pushAttempts).toEqual({
      $lt: config.notices.dispatch.maxAttempts,
    });
    expect(filter.$or).toEqual(
      expect.arrayContaining([
        { dispatchClaimedAt: null },
        { dispatchClaimedAt: { $exists: false } },
        expect.objectContaining({ dispatchClaimedAt: { $lt: expect.any(Date) } }),
      ])
    );
    expect(update.$set.dispatchClaimedAt).toBeInstanceOf(Date);
  });

  it("respects sweepBatchCap as the per-tick blast-radius cap", async () => {
    const original = config.notices.dispatch.sweepBatchCap;
    config.notices.dispatch.sweepBatchCap = 2;
    try {
      withSuccessfulFetch();
      mockCollection.findOneAndUpdate.mockImplementation(async () =>
        makeNotice()
      );
      const summary = await dispatcher.sweepPending("test");
      expect(summary.processed).toBe(2);
      expect(global.fetch).toHaveBeenCalledTimes(2);
    } finally {
      config.notices.dispatch.sweepBatchCap = original;
    }
  });
});

// ──────────────────────────────────────────────────────────
// Internal route
// ──────────────────────────────────────────────────────────
describe("POST /internal/notices/dispatch-pending", () => {
  it("rejects requests with a missing token", async () => {
    const app = buildInternalApp();
    const res = await request(app)
      .post("/internal/notices/dispatch-pending")
      .send({ source: "test" });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHORIZED");
  });

  it("rejects requests with a wrong token (constant-time)", async () => {
    const app = buildInternalApp();
    const res = await request(app)
      .post("/internal/notices/dispatch-pending")
      .set("X-Internal-Token", "wrong-token")
      .send({});
    expect(res.status).toBe(401);
  });

  it("returns the sweep summary on the happy path", async () => {
    mockCollection.findOneAndUpdate.mockResolvedValue(null);
    const app = buildInternalApp();
    const res = await request(app)
      .post("/internal/notices/dispatch-pending")
      .set("X-Internal-Token", config.notices.dispatch.internalToken)
      .send({ source: "crawler-main", cycleId: "abc" });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("ok");
    expect(res.body.data.source).toBe("crawler-main");
    expect(res.body.data.processed).toBe(0);
  });
});

// ──────────────────────────────────────────────────────────
// Cron poller registration gate
// ──────────────────────────────────────────────────────────
describe("notices.dispatch.poller registration", () => {
  it("skips registerPoller when DISPATCH_SWEEP_ENABLED is unset", () => {
    jest.isolateModules(() => {
      const pollers = require("../lib/pollers");
      const spy = jest.spyOn(pollers, "registerPoller");
      delete process.env.DISPATCH_SWEEP_ENABLED;
      require("../features/notices/notices.dispatch.poller");
      expect(spy).not.toHaveBeenCalled();
      spy.mockRestore();
    });
  });

  it("registers when DISPATCH_SWEEP_ENABLED=true", () => {
    jest.isolateModules(() => {
      const pollers = require("../lib/pollers");
      const spy = jest.spyOn(pollers, "registerPoller");
      process.env.DISPATCH_SWEEP_ENABLED = "true";
      require("../features/notices/notices.dispatch.poller");
      expect(spy).toHaveBeenCalledTimes(1);
      const [, intervalMs, name] = spy.mock.calls[0];
      expect(intervalMs).toBe(config.notices.dispatch.sweepCronIntervalMs);
      expect(name).toBe("notices-dispatch-sweep");
      delete process.env.DISPATCH_SWEEP_ENABLED;
      spy.mockRestore();
    });
  });
});
