/**
 * Safety-net cron sweep for FCM dispatch.
 *
 * Primary trigger is the crawler's cycle-end ping to the internal route.
 * This cron exists only to recover when that ping is lost (network blip,
 * crawler crash before ping, server restart in flight, etc.). Cadence is
 * configurable via NOTICES_DISPATCH_SWEEP_MS (default 30 min) and is
 * deliberately slow so it doesn't compete with the ping for normal runs.
 *
 * Registration is gated by DISPATCH_SWEEP_ENABLED=true so api-only pods
 * never even register this poller. The pollers module already guards
 * against overlapping ticks, and `sweepPending` enforces in-process
 * single-flight + cross-instance atomic claim, so multiple replicas
 * accidentally enabled would not double-dispatch — but they would double
 * the read load on `notices`, which is wasteful.
 */

const config = require("../../lib/config");
const logger = require("../../lib/logger");
const pollers = require("../../lib/pollers");
const { sweepPending } = require("./notices.dispatcher");

if (process.env.DISPATCH_SWEEP_ENABLED === "true") {
  pollers.registerPoller(
    async () => {
      try {
        await sweepPending("cron");
      } catch (err) {
        logger.error(
          { err: err && err.message ? err.message : String(err) },
          "[dispatch] cron sweep failed"
        );
      }
    },
    config.notices.dispatch.sweepCronIntervalMs,
    "notices-dispatch-sweep"
  );
} else {
  logger.debug(
    "[dispatch] DISPATCH_SWEEP_ENABLED not set; safety-net cron disabled (ping-only mode)"
  );
}
