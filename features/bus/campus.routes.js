const express = require("express");
const router = express.Router();
const asyncHandler = require("../../lib/asyncHandler");
const { getData } = require("./campus.data");
const { getEtaData } = require("./campus-eta.data");

// Must be before /:bustype to avoid being caught by the param route
router.get("/eta", asyncHandler(async (req, res) => {
  const data = await getEtaData();
  res.success(data);
}));

router.get("/:direction/:dayType", asyncHandler(async (req, res) => {
  const direction = req.params.direction.toLowerCase();
  const dayType = req.params.dayType.toLowerCase();
  const response = await getData(direction, dayType);
  res.success(response);
}));

module.exports = router;
