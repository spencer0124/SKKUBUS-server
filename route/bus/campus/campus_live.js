const express = require("express");
const router = express.Router();
const { MongoClient } = require("mongodb");
const { CronJob } = require("cron");
const moment = require("moment-timezone");
const axios = require("axios");

require("dotenv").config();

const url = process.env.MONGO_URL;
const database = process.env.MONGO_DB_NAME_BUS_CAMPUS;
const client = new MongoClient(url);

async function getData(campusbustype) {
  // 1. 네이버 API를 사용하여 대중교통 길찾기 정보 가져오기
  // 2. 네이버 API를 사용하여 인자셔틀 길찾기 정보 가져오기
  // + 인자셔틀 시간표 반영
}

var SeoulLatLon = "37.587347%2C126.99414";
var SuwonLatLon = "37.296362%2C126.970565";

async function callNaverDirection5(start, goal) {
  try {
    const response = await axios.get(
      "https://naveropenapi.apigw.ntruss.com/map-direction/v1/driving",
      {
        params: {
          start,
          goal,
        },
        headers: {
          "x-ncp-apigw-api-key-id": process.env.NAVER_API_KEY_ID,
          "x-ncp-apigw-api-key": process.env.NAVER_API_KEY,
        },
      }
    );

    const apiData = response.data;
    // console.log(apiData);
    // return apiData;

    print("result!");
    console.log(apiData);
  } catch (error) {
    console.error("API 요청 실패:", error.message);
  }
}

callNaverDirection5(SeoulLatLon, SuwonLatLon);

router.get("/v1/campus/live/:campusbustype", async (req, res) => {
  const { campusbustype } = req.params;
  const response = await getData(campusbustype);

  res.json({ result: response });
});

module.exports = router;
