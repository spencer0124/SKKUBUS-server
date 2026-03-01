const axios = require("axios");
const pollers = require("../../lib/pollers");

var arrmsg1 = "정보 없음";

async function updateStation() {
  try {
    const config = require("../../lib/config");
    const response = await axios.get(config.api.stationHyehwa);
    const apiData = response.data.msgBody.itemList;
    arrmsg1 = apiData[0].arrmsg1;
  } catch (error) {
    console.error(error);
  }
}

function getStationInfo() {
  console.log("Serving getStationInfo: ", arrmsg1);
  return arrmsg1;
}

pollers.registerPoller(updateStation, 15000, "station");

module.exports = { getStationInfo };
