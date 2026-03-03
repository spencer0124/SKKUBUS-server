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

router.get("/:bustype", asyncHandler(async (req, res) => {
  const { bustype } = req.params;
  const response = await getData(bustype);
  res.success(response);
}));

module.exports = router;
