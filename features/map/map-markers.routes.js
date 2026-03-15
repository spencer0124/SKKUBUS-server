const { Router } = require("express");
const asyncHandler = require("../../lib/asyncHandler");
const { getCampusMarkers } = require("./map-markers.data");

const router = Router();

/**
 * GET /map/markers/campus
 * Returns all campus building markers (both HSSC and NSC).
 * Client filters by `campus` field.
 */
router.get("/campus", asyncHandler(async (req, res) => {
  const data = await getCampusMarkers();
  res.success(data);
}));

module.exports = router;
