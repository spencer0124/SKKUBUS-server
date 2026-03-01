const axios = require("axios");

const searchOption1_building =
  "https://www.skku.edu/skku/about/campusInfo/campusMap.do?mode=buildInfo";

async function option1_detail(buildNo, id) {
  const Response = await axios.get(
    `${searchOption1_building}&buildNo=${buildNo}&id=${id}`
  );

  let availableFloors = new Set(
    Response.data.floorItem.map((item) => item.floor_nm)
  );
  availableFloors = Array.from(availableFloors).sort((a, b) => {
    const isABasement = a.startsWith("지하");
    const isBBasement = b.startsWith("지하");
    if (isABasement && !isBBasement) {
      return -1;
    } else if (!isABasement && isBBasement) {
      return 1;
    }
    return a.localeCompare(b, undefined, {
      numeric: true,
      sensitivity: "base",
    });
  });

  const groupedFloorItems = availableFloors.reduce((acc, floor) => {
    acc[floor] = Response.data.floorItem.filter(
      (item) => item.floor_nm === floor
    );
    return acc;
  }, {});

  return {
    item: Response.data.item,
    availableFloor: availableFloors,
    floorItem: groupedFloorItems,
  };
}

module.exports = { option1_detail };
