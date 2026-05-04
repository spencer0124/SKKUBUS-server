/**
 * Internal-only routes for the notices feature.
 *
 * The crawler pings POST /internal/notices/dispatch-pending at the end of
 * each crawl cycle. The handler scans for push-ready, un-dispatched
 * notices and fans them out via the deployed sendNotification Cloud
 * Function. The body is metadata-only (source/cycleId/crawledAt) and is
 * used solely for log correlation; the work is the sweep itself.
 *
 * Auth: shared secret in the X-Internal-Token header, compared in
 * constant time. No Firebase auth here — the caller is the crawler
 * service, not an end user.
 */

const express = require("express");
const crypto = require("crypto");
const router = express.Router();
const asyncHandler = require("../../lib/asyncHandler");
const config = require("../../lib/config");
const logger = require("../../lib/logger");
const { sweepPending } = require("./notices.dispatcher");

function tokensMatch(provided, expected) {
  if (typeof provided !== "string" || typeof expected !== "string") return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

router.post(
  "/dispatch-pending",
  asyncHandler(async (req, res) => {
    const expected = config.notices.dispatch.internalToken;
    const provided = req.get("x-internal-token");
    if (!tokensMatch(provided, expected)) {
      return res.error(401, "UNAUTHORIZED", "invalid or missing X-Internal-Token");
    }

    const body = req.body || {};
    const triggerSource =
      typeof body.source === "string" && body.source ? body.source : "internal";
    logger.debug(
      { source: triggerSource, cycleId: body.cycleId, crawledAt: body.crawledAt },
      "[dispatch] ping received"
    );

    const summary = await sweepPending(triggerSource);
    return res.success(summary);
  })
);

module.exports = router;
