const express = require("express");
const router = express.Router();
const asyncHandler = require("../../lib/asyncHandler");
const { getData } = require("./campus.data");

router.get("/v1/campus/:bustype", asyncHandler(async (req, res) => {
  const { bustype } = req.params;
  const response = await getData(bustype);
  res.json({ result: response });
}));

module.exports = router;
