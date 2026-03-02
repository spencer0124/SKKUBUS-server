const express = require("express");
const router = express.Router();
const asyncHandler = require("../../lib/asyncHandler");
const { option1 } = require("./search.building");
const { option1_detail } = require("./search.building-detail");
const { option3 } = require("./search.space");

router.get("/all/:inputquery", asyncHandler(async (req, res) => {
  const option1_hssc = await option1(req.params.inputquery, 1);
  const option1_nsc = await option1(req.params.inputquery, 2);

  const option1_hsscCount = option1_hssc.length;
  const option1_nscCount = option1_nsc.length;
  const option1_totalCount = option1_hssc.length + option1_nsc.length;

  const option3_hssc = await option3(req.params.inputquery, 1);
  const option3_nsc = await option3(req.params.inputquery, 2);

  const option3_hsscCount = option3_hssc.length;
  const option3_nscCount = option3_nsc.length;
  const option3_totalCount = option3_hssc.length + option3_nsc.length;

  const total_hsscCount = option1_hsscCount + option3_hsscCount;
  const total_nscCount = option1_nscCount + option3_nscCount;
  const total_totalCount = total_hsscCount + total_nscCount;

  res.json({
    metaData: {
      keyword: req.params.inputquery,
      total_totalCount,
      total_hsscCount,
      total_nscCount,
      option1_totalCount,
      option1_hsscCount,
      option1_nscCount,
      option3_totalCount,
      option3_hsscCount,
      option3_nscCount,
    },
    option1Items: { hssc: option1_hssc, nsc: option1_nsc },
    option3Items: { hssc: option3_hssc, nsc: option3_nsc },
  });
}));

router.get("/detail/:buildNo/:id", asyncHandler(async (req, res) => {
  const mergedResults = await option1_detail(req.params.buildNo, req.params.id);
  res.json(mergedResults);
}));

router.get("/option3/:inputquery", asyncHandler(async (req, res) => {
  const option3_hssc = await option3(req.params.inputquery, 1);
  const option3_nsc = await option3(req.params.inputquery, 2);
  const option3_hsscCount = option3_hssc.length;
  const option3_nscCount = option3_nsc.length;
  const option3_totalCount = option3_hssc.length + option3_nsc.length;

  res.json({
    metaData: {
      keyword: req.params.inputquery,
      option3_totalCount,
      option3_hsscCount,
      option3_nscCount,
    },
    option3Items: { hssc: option3_hssc, nsc: option3_nsc },
  });
}));

module.exports = router;
