const express = require("express");
const router = express.Router();
const asyncHandler = require("../../lib/asyncHandler");
const { getHSSCBusList } = require("./hssc.fetcher");
const { HSSCStations } = require("./hssc.stations");

router.get("/v1/buslocation", asyncHandler(async (req, res) => {
  const response = getHSSCBusList();
  res.json(response);
}));

router.get("/v1/busstation", asyncHandler(async (req, res) => {
  const dynamicBusData = getHSSCBusList();

  const metadata = {
    currentTime: new Date().toLocaleTimeString("en-US", {
      timeZone: "Asia/Seoul",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    }),
    totalBuses: dynamicBusData.length,
    lastStationIndex: 10,
  };
  res.json({ metadata, HSSCStations });
}));

module.exports = router;
