const express = require("express");
const router = express.Router();
const asyncHandler = require("../../lib/asyncHandler");
const { getStationInfo } = require("./station.fetcher");
const { getHSSCBusList } = require("../bus/hssc.fetcher");
const { StationHSSCStations } = require("./station.data");

let HSSCStations = StationHSSCStations;

router.get("/v1/:stationId", asyncHandler(async (req, res) => {
  const stationId = req.params.stationId;

  const dynamicBusData = getHSSCBusList();

  HSSCStations = HSSCStations.map((station) => {
    const busesInProximity = dynamicBusData
      .filter((bus) => parseInt(bus.sequence) <= station.sequence)
      .sort(
        (a, b) =>
          station.sequence -
          parseInt(a.sequence) -
          (station.sequence - parseInt(b.sequence))
      );

    const nextBus = busesInProximity[0];

    if (nextBus) {
      const remainingStations = station.sequence - parseInt(nextBus.sequence);

      if (remainingStations == 0 && nextBus.estimatedTime < 60) {
        return {
          ...station,
          eta: "도착 또는 출발",
        };
      } else if (remainingStations == 0 && busesInProximity[1] != undefined) {
        const nextBus = busesInProximity[1];
        const remainingStations = station.sequence - parseInt(nextBus.sequence);
        if (nextBus.sequence == 10) {
          if (busesInProximity[2] != undefined) {
            console.log("busesInProximity[0]: ", busesInProximity[0]);
            console.log("busesInProximity[1]: ", busesInProximity[1]);
            console.log("busesInProximity[2]: ", busesInProximity[2]);
            console.log("busesInProximity[3]: ", busesInProximity[3]);
            console.log("busesInProximity[4]: ", busesInProximity[4]);

            const nextBus = busesInProximity[2];
            const remainingStations =
              station.sequence - parseInt(nextBus.sequence);
            return {
              ...station,
              eta: remainingStations + " 정거장 전",
            };
          }

          return {
            ...station,
            eta: "도착 정보 없음",
          };
        }
        return {
          ...station,
          eta: remainingStations + " 정거장 전",
        };
      } else if (remainingStations == 0 && busesInProximity[1] == undefined) {
        return {
          ...station,
          eta: "도착 정보 없음",
        };
      }

      return {
        ...station,
        eta: remainingStations + " 정거장 전",
      };
    } else {
      return {
        ...station,
        eta: "도착 정보 없음",
      };
    }
  });

  const hyehwaStation = HSSCStations.find(
    (station) => station.stationName === "혜화역(승차장)"
  );
  const hssceta1 = hyehwaStation ? hyehwaStation.eta : "도착 정보 없음";

  if (stationId == "01592") {
    res.json({
      metaData: {
        success: true,
        total_count: 2,
      },
      StationData: [
        {
          busNm: "종로07",
          busSupportTime: true,
          msg1_showmessage: true,
          msg1_message: getStationInfo(),
          msg1_remainStation: null,
          msg1_remainSeconds: null,
          msg2_showmessage: false,
          msg2_message: null,
          msg2_remainStation: null,
          msg2_remainSeconds: null,
        },
        {
          busNm: "인사캠셔틀",
          busSupportTime: false,
          msg1_showmessage: true,
          msg1_message: hssceta1,
          msg1_remainStation: null,
          msg1_remainSeconds: null,
          msg2_showmessage: true,
          msg2_message: null,
          msg2_remainStation: null,
          msg2_remainSeconds: null,
        },
      ],
    });
  } else {
    res.json([]);
  }
}));

module.exports = router;
