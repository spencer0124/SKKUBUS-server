const axios = require("axios");
const { encodeQuery } = require("./search.helpers");

const searchOption1_building =
  "https://www.skku.edu/skku/about/campusInfo/campusMap.do?mode=buildList&mode=list&srSearchValue=";

const processBuildItem = (item) => {
  return {
    metaData: {
      buildNo: item.buildNo ? item.buildNo : null,
      id: item.id,
      floorinfoAvail: item.buildNo != null && item.id != null ? true : false,
      imgpath: "https://www.skku.edu" + item.filePath + item.encodeNm,
      createdDate: item.createDt,
      updatedDate: item.updateDt,
    },
    buildingInfo: {
      campusCd: item.campusCd,
      latitude: item.latitude,
      longtitude: item.longtitude,
      buildName_kr: item.buildNm,
      buildName_en: item.buildNmEng,
      describe_kr: item.krText,
      describe_en: item.enText,
      handicappedElevatorAvail:
        item.handicappedElevatorYn == "Y" ? true : false,
      handicappedToiletAvail: item.handicappedToiletYn == "Y" ? true : false,
    },
  };
};

async function option1(inputQuery, campusType) {
  const encodedQuery = encodeQuery(inputQuery);

  const Response = await axios.get(
    `${searchOption1_building}${encodedQuery}&campusCd=${campusType}`
  );

  const processedResponse = Response.data.buildItems.map(processBuildItem);

  return processedResponse;
}

module.exports = { option1 };
