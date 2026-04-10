const { ObjectId } = require("mongodb");
const {
  VALID_SUMMARY_TYPES,
  normalizeSummaryType,
  buildSummaryBrief,
  buildSummaryFull,
  toListItem,
  toDetailItem,
} = require("../features/notices/notices.transform");

// Helper: minimal-but-realistic raw notice doc
function makeDoc(overrides = {}) {
  return {
    _id: new ObjectId("66a1b2c3d4e5f6a7b8c9d0e1"),
    sourceDeptId: "skku-main",
    articleNo: 136023,
    department: "학부통합(학사)",
    title: "[모집] 테스트 공지",
    category: "행사/세미나",
    author: "안찬웅",
    date: "2026-04-10",
    views: 100,
    sourceUrl: "https://www.skku.edu/xxx",
    attachments: [{ name: "a.pdf", url: "https://x/a" }],
    contentHash: "abc123",
    editCount: 0,
    crawledAt: new Date("2026-04-10T03:00:00.000Z"),
    ...overrides,
  };
}

describe("normalizeSummaryType", () => {
  it("passes through known types", () => {
    expect(normalizeSummaryType("action_required")).toBe("action_required");
    expect(normalizeSummaryType("event")).toBe("event");
    expect(normalizeSummaryType("informational")).toBe("informational");
  });

  it("coerces unknown types to informational", () => {
    expect(normalizeSummaryType("weird_thing")).toBe("informational");
    expect(normalizeSummaryType(undefined)).toBe("informational");
    expect(normalizeSummaryType(null)).toBe("informational");
    expect(normalizeSummaryType("")).toBe("informational");
  });

  it("exposes VALID_SUMMARY_TYPES as a Set with exactly 3 values", () => {
    expect(VALID_SUMMARY_TYPES).toBeInstanceOf(Set);
    expect(VALID_SUMMARY_TYPES.size).toBe(3);
    expect(VALID_SUMMARY_TYPES.has("action_required")).toBe(true);
    expect(VALID_SUMMARY_TYPES.has("event")).toBe(true);
    expect(VALID_SUMMARY_TYPES.has("informational")).toBe(true);
  });
});

describe("buildSummaryBrief", () => {
  it("returns null when summaryAt is missing", () => {
    expect(buildSummaryBrief(makeDoc({ summaryAt: undefined }))).toBeNull();
    expect(buildSummaryBrief(makeDoc({ summaryAt: null }))).toBeNull();
  });

  it("returns exactly 3 fields: oneLiner, type, endAt", () => {
    const doc = makeDoc({
      summaryAt: new Date(),
      summaryOneLiner: "한 줄 요약",
      summaryType: "action_required",
      summaryPeriods: [
        {
          label: null,
          startDate: "2026-04-01",
          startTime: "09:00",
          endDate: "2026-04-09",
          endTime: "18:00",
        },
      ],
      summaryLocations: [{ label: null, detail: "경영관 33101호" }], // should NOT leak into brief
      summary: "본문 요약",                                            // should NOT leak into brief
      summaryDetails: { target: "x" },                                // should NOT leak into brief
    });
    const brief = buildSummaryBrief(doc);
    expect(Object.keys(brief).sort()).toEqual(["endAt", "oneLiner", "type"]);
    expect(brief.oneLiner).toBe("한 줄 요약");
    expect(brief.type).toBe("action_required");
    expect(brief.endAt).toEqual({ date: "2026-04-09", time: "18:00" });
  });

  it("derives endAt from periods[0] (first period), not the last", () => {
    // 등록금 1차/2차 — list cell must show 1차 (earlier/primary) deadline.
    const doc = makeDoc({
      summaryAt: new Date(),
      summaryType: "action_required",
      summaryPeriods: [
        { label: "1차 납부",    startDate: "2026-02-10", startTime: null, endDate: "2026-02-14", endTime: null },
        { label: "2차 추가 납부", startDate: "2026-02-24", startTime: null, endDate: "2026-02-26", endTime: null },
      ],
    });
    const brief = buildSummaryBrief(doc);
    expect(brief.endAt).toEqual({ date: "2026-02-14", time: null });
    expect(brief.endAt.date).not.toBe("2026-02-26"); // explicit: not the last period
  });

  it("returns endAt null when summaryPeriods is []", () => {
    const doc = makeDoc({ summaryAt: new Date(), summaryPeriods: [] });
    expect(buildSummaryBrief(doc).endAt).toBeNull();
  });

  it("returns endAt null when summaryPeriods is missing (undefined)", () => {
    const doc = makeDoc({ summaryAt: new Date() });
    expect(buildSummaryBrief(doc).endAt).toBeNull();
  });

  it("returns endAt null when periods[0] has neither endDate nor endTime (start-only period)", () => {
    const doc = makeDoc({
      summaryAt: new Date(),
      summaryPeriods: [
        { label: null, startDate: "2026-04-15", startTime: "14:00", endDate: null, endTime: null },
      ],
    });
    expect(buildSummaryBrief(doc).endAt).toBeNull();
  });

  it("allows endAt.date null when only endTime is present", () => {
    const doc = makeDoc({
      summaryAt: new Date(),
      summaryPeriods: [
        { label: null, startDate: null, startTime: null, endDate: null, endTime: "23:59" },
      ],
    });
    expect(buildSummaryBrief(doc).endAt).toEqual({ date: null, time: "23:59" });
  });

  it("allows endAt.time null when only endDate is present", () => {
    // Sample 3 from AI server: deadline-only notice.
    const doc = makeDoc({
      summaryAt: new Date(),
      summaryPeriods: [
        { label: null, startDate: null, startTime: null, endDate: "2026-04-20", endTime: null },
      ],
    });
    expect(buildSummaryBrief(doc).endAt).toEqual({ date: "2026-04-20", time: null });
  });

  it("does NOT leak startDate/startTime/endDate/endTime as top-level brief keys", () => {
    const doc = makeDoc({
      summaryAt: new Date(),
      summaryPeriods: [
        { label: null, startDate: "2026-04-01", startTime: "09:00", endDate: "2026-04-09", endTime: "18:00" },
      ],
    });
    const brief = buildSummaryBrief(doc);
    expect(brief).not.toHaveProperty("startDate");
    expect(brief).not.toHaveProperty("startTime");
    expect(brief).not.toHaveProperty("endDate");
    expect(brief).not.toHaveProperty("endTime");
    expect(brief).not.toHaveProperty("periods");
    expect(brief).not.toHaveProperty("locations");
  });

  it("coerces unknown summaryType to informational", () => {
    const doc = makeDoc({ summaryAt: new Date(), summaryType: "marketing" });
    expect(buildSummaryBrief(doc).type).toBe("informational");
  });

  it("nulls out missing optional fields", () => {
    const doc = makeDoc({ summaryAt: new Date(), summaryType: "event" });
    const brief = buildSummaryBrief(doc);
    expect(brief.oneLiner).toBeNull();
    expect(brief.endAt).toBeNull();
  });
});

describe("buildSummaryFull", () => {
  it("returns null when summaryAt is missing", () => {
    expect(buildSummaryFull(makeDoc({}))).toBeNull();
  });

  it("includes text, oneLiner, type, periods, locations, details, model, generatedAt", () => {
    const at = new Date("2026-04-09T11:52:02.769Z");
    const periods = [
      { label: null, startDate: "2026-04-03", startTime: "09:00", endDate: "2026-04-09", endTime: "18:00" },
    ];
    const locations = [{ label: null, detail: "경영관 33101호" }];
    const doc = makeDoc({
      summaryAt: at,
      summary: "본문 요약이에요",
      summaryOneLiner: "한 줄",
      summaryType: "event",
      summaryPeriods: periods,
      summaryLocations: locations,
      summaryDetails: { target: "학부생", action: null, host: "x", impact: null },
      summaryModel: "gpt-4.1-mini-2025-04-14",
    });
    const full = buildSummaryFull(doc);
    expect(Object.keys(full).sort()).toEqual([
      "details", "generatedAt", "locations", "model", "oneLiner", "periods", "text", "type",
    ]);
    expect(full.text).toBe("본문 요약이에요"); // v2 key: `text`, not `body`
    expect(full.oneLiner).toBe("한 줄");
    expect(full.type).toBe("event");
    expect(full.periods).toEqual(periods);
    expect(full.locations).toEqual(locations);
    expect(full.details).toEqual({ target: "학부생", action: null, host: "x", impact: null });
    expect(full.model).toBe("gpt-4.1-mini-2025-04-14");
    expect(full.generatedAt).toBe(at);
  });

  it("passes multi-period + multi-location case through unchanged (등록금 1차/2차 × 인사캠/자과캠)", () => {
    const periods = [
      { label: "1차 납부",    startDate: "2026-02-10", startTime: null, endDate: "2026-02-14", endTime: null },
      { label: "2차 추가 납부", startDate: "2026-02-24", startTime: null, endDate: "2026-02-26", endTime: null },
    ];
    const locations = [
      { label: "인사캠", detail: "600주년기념관 재무팀" },
      { label: "자과캠", detail: "학생회관 재무팀" },
    ];
    const doc = makeDoc({
      summaryAt: new Date(),
      summaryType: "action_required",
      summaryPeriods: periods,
      summaryLocations: locations,
    });
    const full = buildSummaryFull(doc);
    expect(full.periods).toEqual(periods);
    expect(full.locations).toEqual(locations);
  });

  it("defaults summaryPeriods/summaryLocations to [] when missing", () => {
    const doc = makeDoc({ summaryAt: new Date(), summaryType: "informational" });
    const full = buildSummaryFull(doc);
    expect(full.periods).toEqual([]);
    expect(full.locations).toEqual([]);
  });

  it("details is null when summaryDetails is missing", () => {
    const doc = makeDoc({ summaryAt: new Date() });
    expect(buildSummaryFull(doc).details).toBeNull();
  });

  it("must NOT expose flat startDate/startTime/endDate/endTime or `body` key", () => {
    const doc = makeDoc({
      summaryAt: new Date(),
      summary: "x",
      summaryPeriods: [
        { label: null, startDate: "2026-04-03", startTime: "09:00", endDate: "2026-04-09", endTime: "18:00" },
      ],
    });
    const full = buildSummaryFull(doc);
    expect(full).not.toHaveProperty("body");
    expect(full).not.toHaveProperty("startDate");
    expect(full).not.toHaveProperty("startTime");
    expect(full).not.toHaveProperty("endDate");
    expect(full).not.toHaveProperty("endTime");
    expect(full.text).toBe("x");
  });
});

describe("toListItem", () => {
  it("maps core fields and derives boolean flags", () => {
    const doc = makeDoc({ contentHash: "h1", attachments: [{ name: "a", url: "u" }], editCount: 2 });
    const item = toListItem(doc);
    expect(item.id).toBe("66a1b2c3d4e5f6a7b8c9d0e1");
    expect(item.deptId).toBe("skku-main");
    expect(item.articleNo).toBe(136023);
    expect(item.hasContent).toBe(true);
    expect(item.hasAttachments).toBe(true);
    expect(item.isEdited).toBe(true);
  });

  it("hasContent false when contentHash is null or undefined", () => {
    expect(toListItem(makeDoc({ contentHash: null })).hasContent).toBe(false);
    expect(toListItem(makeDoc({ contentHash: undefined })).hasContent).toBe(false);
  });

  it("hasAttachments false for empty or missing array", () => {
    expect(toListItem(makeDoc({ attachments: [] })).hasAttachments).toBe(false);
    expect(toListItem(makeDoc({ attachments: undefined })).hasAttachments).toBe(false);
  });

  it("isEdited false when editCount is 0 or missing", () => {
    expect(toListItem(makeDoc({ editCount: 0 })).isEdited).toBe(false);
    expect(toListItem(makeDoc({ editCount: undefined })).isEdited).toBe(false);
  });

  it("converts empty string category/author to null", () => {
    const item = toListItem(makeDoc({ category: "", author: "" }));
    expect(item.category).toBeNull();
    expect(item.author).toBeNull();
  });

  it("defaults views to 0 when missing", () => {
    expect(toListItem(makeDoc({ views: undefined })).views).toBe(0);
  });

  it("does NOT include content/cleanHtml/contentText keys", () => {
    const doc = makeDoc({
      content: "<p>body</p>",
      cleanHtml: "<p>body</p>",
      contentText: "body",
    });
    const item = toListItem(doc);
    expect(item).not.toHaveProperty("content");
    expect(item).not.toHaveProperty("cleanHtml");
    expect(item).not.toHaveProperty("contentText");
    expect(item).not.toHaveProperty("contentHtml");
  });

  it("summary is brief (3 fields) not full", () => {
    const doc = makeDoc({
      summaryAt: new Date(),
      summaryOneLiner: "한줄",
      summaryType: "action_required",
      summaryPeriods: [
        { label: null, startDate: null, startTime: null, endDate: "2026-04-09", endTime: null },
      ],
      summary: "긴 본문 요약",
      summaryDetails: { target: "x" },
      summaryLocations: [{ label: null, detail: "어딘가" }],
    });
    const item = toListItem(doc);
    expect(Object.keys(item.summary).sort()).toEqual(["endAt", "oneLiner", "type"]);
    expect(item.summary.endAt).toEqual({ date: "2026-04-09", time: null });
    expect(item.summary).not.toHaveProperty("text");
    expect(item.summary).not.toHaveProperty("details");
    expect(item.summary).not.toHaveProperty("periods");
    expect(item.summary).not.toHaveProperty("locations");
  });

  it("summary is null when summaryAt missing", () => {
    expect(toListItem(makeDoc({})).summary).toBeNull();
  });
});

describe("toDetailItem", () => {
  it("renames content→contentHtml and includes contentText", () => {
    const doc = makeDoc({ content: "<p>h</p>", contentText: "h" });
    const item = toDetailItem(doc);
    expect(item.contentHtml).toBe("<p>h</p>");
    expect(item.contentText).toBe("h");
    expect(item).not.toHaveProperty("content");
  });

  it("contentHtml is null (not empty string) when content is missing", () => {
    const item = toDetailItem(makeDoc({ content: undefined }));
    expect(item.contentHtml).toBeNull();
    expect(item).not.toHaveProperty("content");
  });

  it("contentText is null when missing", () => {
    expect(toDetailItem(makeDoc({ contentText: undefined })).contentText).toBeNull();
  });

  it("editInfo is null when editCount is 0", () => {
    expect(toDetailItem(makeDoc({ editCount: 0 })).editInfo).toBeNull();
  });

  it("editInfo has count + history when editCount > 0", () => {
    const history = [{ source: "tier1", detectedAt: "2026-04-09T00:00:00Z" }];
    const item = toDetailItem(makeDoc({ editCount: 3, editHistory: history }));
    expect(item.editInfo).toEqual({ count: 3, history });
  });

  it("editInfo.history defaults to empty array when missing", () => {
    const item = toDetailItem(makeDoc({ editCount: 1, editHistory: undefined }));
    expect(item.editInfo).toEqual({ count: 1, history: [] });
  });

  it("summary is full (includes text, periods, locations, details, model) when summaryAt present", () => {
    const periods = [
      { label: null, startDate: "2026-04-15", startTime: "14:00", endDate: "2026-04-15", endTime: null },
    ];
    const locations = [{ label: null, detail: "경영관 33101호" }];
    const doc = makeDoc({
      summaryAt: new Date(),
      summary: "본문",
      summaryType: "informational",
      summaryPeriods: periods,
      summaryLocations: locations,
      summaryDetails: { host: "x" },
      summaryModel: "m",
    });
    const item = toDetailItem(doc);
    expect(item.summary.text).toBe("본문");
    expect(item.summary.periods).toEqual(periods);
    expect(item.summary.locations).toEqual(locations);
    expect(item.summary.details).toEqual({ host: "x" });
    expect(item.summary.model).toBe("m");
  });

  it("attachments map to {name, url} pairs only", () => {
    const doc = makeDoc({
      attachments: [{ name: "a.pdf", url: "https://x/a", extra: "ignored" }],
    });
    const item = toDetailItem(doc);
    expect(item.attachments).toEqual([{ name: "a.pdf", url: "https://x/a" }]);
  });

  it("does NOT leak cleanHtml, contentHash, summaryContentHash, isDeleted", () => {
    const doc = makeDoc({
      cleanHtml: "<p>x</p>",
      contentHash: "h",
      summaryContentHash: "h",
      summaryFailures: 0,
      isDeleted: false,
      consecutiveFailures: 0,
      detailPath: "/x",
    });
    const item = toDetailItem(doc);
    expect(item).not.toHaveProperty("cleanHtml");
    expect(item).not.toHaveProperty("contentHash");
    expect(item).not.toHaveProperty("summaryContentHash");
    expect(item).not.toHaveProperty("summaryFailures");
    expect(item).not.toHaveProperty("isDeleted");
    expect(item).not.toHaveProperty("consecutiveFailures");
    expect(item).not.toHaveProperty("detailPath");
  });
});
