const { Router } = require("express");
const crypto = require("crypto");
const asyncHandler = require("../../lib/asyncHandler");
const { t } = require("../../lib/i18n");
const serviceConfig = require("./service.config");
const { resolveWeek, resolveSmartSchedule } = require("./schedule.data");

const router = Router();

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * GET /data/:serviceId/week?from=YYYY-MM-DD
 * Returns 7-day resolved schedule for a service.
 */
router.get("/data/:serviceId/week", asyncHandler(async (req, res) => {
  const { serviceId } = req.params;
  const from = req.query.from;

  req.log.warn({ serviceId }, "deprecated: /week endpoint called, use /smart");

  // Validate from format if provided
  if (from !== undefined && !DATE_RE.test(from)) {
    return res.error(400, "INVALID_DATE_FORMAT", "from must be YYYY-MM-DD");
  }

  // Check serviceId exists
  if (!serviceConfig[serviceId]) {
    return res.error(404, "SERVICE_NOT_FOUND", `Unknown serviceId: ${serviceId}`);
  }

  const data = await resolveWeek(serviceId, from);
  if (!data) {
    return res.error(404, "SERVICE_NOT_FOUND", `Unknown serviceId: ${serviceId}`);
  }

  // Compute ETag
  const bodyJson = JSON.stringify(data);
  const hash = crypto.createHash("md5").update(bodyJson).digest("hex");
  const etag = `"week-${serviceId}-${data.from}-${hash}"`;

  // 304 check
  if (req.headers["if-none-match"] === etag) {
    return res.status(304).end();
  }

  res.set("ETag", etag);
  res.set("Cache-Control", "public, max-age=300");
  res.success(data);
}));

/**
 * GET /data/:serviceId/smart
 * Returns the most relevant week with auto-selected date, hidden days filtered out.
 */
router.get("/data/:serviceId/smart", asyncHandler(async (req, res) => {
  const { serviceId } = req.params;

  if (!serviceConfig[serviceId]) {
    return res.error(404, "SERVICE_NOT_FOUND", `Unknown serviceId: ${serviceId}`);
  }

  const result = await resolveSmartSchedule(serviceId);
  if (!result) {
    return res.error(404, "SERVICE_NOT_FOUND", `Unknown serviceId: ${serviceId}`);
  }

  // Spread for immutability; inject i18n message for non-active statuses
  const data = result.status === "active"
    ? { ...result }
    : { ...result, message: t(`schedule.${result.status}`, req.lang) };

  // Compute ETag — use from for active, status for suspended/noData
  const bodyJson = JSON.stringify(data);
  const hash = crypto.createHash("md5").update(bodyJson).digest("hex");
  const etag = `"smart-${serviceId}-${data.from || data.status}-${hash}"`;

  if (req.headers["if-none-match"] === etag) {
    return res.status(304).end();
  }

  res.set("ETag", etag);
  res.set("Cache-Control", "public, max-age=300");
  res.success(data);
}));

module.exports = router;
