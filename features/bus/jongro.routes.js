const express = require("express");
const router = express.Router();
const asyncHandler = require("../../lib/asyncHandler");
const { getJongroBusList, getJongroBusLocation } = require("./jongro.fetcher");
const { Jongro02Stations, Jongro07Stations } = require("./jongro.stations");

const Jongrotations = {
  "07": Jongro07Stations,
  "02": Jongro02Stations,
};

router.get("/v1/busstation/:line", asyncHandler(async (req, res) => {
  const busLine = req.params.line;

  const response = getJongroBusList(busLine);
  const response2 = getJongroBusLocation(busLine);

  const metadata = {
    currentTime: new Date().toLocaleTimeString("en-US", {
      timeZone: "Asia/Seoul",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    }),
    totalBuses: response2 == undefined ? 0 : response2.length,
    lastStationIndex: busLine === "07" ? 18 : 25,
  };

  Jongrotations[busLine].forEach((item) => {
    if (Array.isArray(response)) {
      const station = response.find(
        (station) => station.stationName === item.stationName
      );
      if (station) {
        item.eta = station.eta;
      }
    }
  });

  var HSSCStations = Jongrotations[busLine];

  res.json({ metadata, HSSCStations });
}));

router.get("/v1/buslocation/:line", asyncHandler(async (req, res) => {
  const busLine = req.params.line;

  let response = getJongroBusLocation(busLine);
  if (response == undefined) {
    res.json([]);
  } else {
    response = response.map((station) => ({
      ...station,
      isLastBus: false,
    }));

    res.json(response);
  }
}));

module.exports = router;
