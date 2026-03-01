const axios = require("axios");
const pollers = require("../../lib/pollers");
const { Jongro02stationMapping, Jongro07stationMapping } = require("./jongro.stations");

let filteredBusStations = {};
let filteredBusLocations = {};
const busStationTimes = {};

const busStationMapping = {
  "02": Jongro02stationMapping,
  "07": Jongro07stationMapping,
};

async function updateJongroBusLocation(url, busnumber) {
  try {
    const response = await axios.get(url);
    const apiData = response.data.msgBody.itemList;
    const moment = require("moment-timezone");

    const currentTime = moment().tz("Asia/Seoul").toDate();

    if (!filteredBusLocations[busnumber]) {
      filteredBusLocations[busnumber] = [];
    }
    if (!busStationTimes[busnumber]) {
      busStationTimes[busnumber] = {};
    }

    filteredBusLocations[busnumber].length = 0;

    apiData.forEach((item) => {
      const { lastStnId, tmX, tmY, plainNo } = item;

      let estimatedTime = 0;
      const currentBusStationTimes = busStationTimes[busnumber];

      if (
        (currentTime - new Date(currentBusStationTimes[lastStnId])) /
          1000 /
          60 >
        10
      ) {
        delete currentBusStationTimes[lastStnId];
      }

      if (currentBusStationTimes[lastStnId]) {
        const lastRecordTime = new Date(currentBusStationTimes[lastStnId]);
        estimatedTime = Math.round((currentTime - lastRecordTime) / 1000);
      } else {
        currentBusStationTimes[lastStnId] = currentTime.toISOString();
      }

      filteredBusLocations[busnumber].push({
        sequence: busStationMapping[busnumber][lastStnId].sequence.toString(),
        stationName: busStationMapping[busnumber][lastStnId].stationName,
        carNumber: plainNo.slice(-4),
        eventDate: currentBusStationTimes[lastStnId],
        estimatedTime: estimatedTime,

        stationId: lastStnId,
        latitude: tmY,
        longitude: tmX,
        recordTime: currentBusStationTimes[lastStnId],
      });
    });
  } catch (error) {
    console.error(error);
  }
}

async function updateJongroBusList(url, busnumber) {
  try {
    const response = await axios.get(url);
    const apiData = response.data.msgBody.itemList;

    if (!filteredBusStations[busnumber]) {
      filteredBusStations[busnumber] = [];
    }

    filteredBusStations[busnumber].length = 0;

    apiData.forEach((item) => {
      const { stId, staOrd, stNm, plainNo1, mkTm, arsId, arrmsg1 } = item;
      filteredBusStations[busnumber].push({
        stationId: stId,
        sequence: staOrd,
        stationName: stNm,
        carNumber: plainNo1.slice(-4),
        eventDate: mkTm,
        stationNumber: arsId,
        eta: arrmsg1,
      });
    });
  } catch (error) {
    console.error(error);
  }
}

function getJongroBusList(busnumber) {
  console.log("Serving getJongroBusList: ", filteredBusStations[busnumber]);
  return filteredBusStations[busnumber];
}

function getJongroBusLocation(busnumber) {
  console.log(
    "Serving getJongroBusLocation: ",
    filteredBusLocations[busnumber]
  );
  return filteredBusLocations[busnumber];
}

pollers.registerPoller(() => {
  const config = require("../../lib/config");
  updateJongroBusList(config.api.jongro07List, "07").catch(console.error);
  updateJongroBusList(config.api.jongro02List, "02").catch(console.error);
  updateJongroBusLocation(config.api.jongro07Loc, "07").catch(console.error);
  updateJongroBusLocation(config.api.jongro02Loc, "02").catch(console.error);
}, 15000, "jongro");

module.exports = { getJongroBusList, getJongroBusLocation };
