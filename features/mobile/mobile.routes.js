const express = require("express");
const router = express.Router();
const asyncHandler = require("../../lib/asyncHandler");
const { getBusList } = require("./mobile.buslist");
const { getScrollComponent } = require("./mobile.scroll");

router.get("/v1/mainpage/buslist", asyncHandler(async (req, res) => {
  res.json(getBusList());
}));

router.get("/v1/mainpage/scrollcomponent", asyncHandler(async (req, res) => {
  res.json(getScrollComponent());
}));

module.exports = router;
