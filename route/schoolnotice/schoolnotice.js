const express = require("express");
const router = express.Router();
module.exports = router;

const getNoticeList = require("./fetchschoolnotice.js");

router.get("/v1/all", async (req, res) => {
  // real
  response = await getNoticeList.getNoticeList();
  res.json(response);

  // test;
  // res.json([
  //   {
  //     sequence: "1",
  //     stationName: "몰라임마",
  //     carNumber: "101",
  //     eventDate: "상관없어 임마",
  //     estimatedTime: 50,
  //   },
  //   {
  //     sequence: "10",
  //     stationName: "몰라임마",
  //     carNumber: "2049",
  //     eventDate: "상관없어 임마",
  //     estimatedTime: 20,
  //   },
  //   {
  //     sequence: "10",
  //     stationName: "몰라임마",
  //     carNumber: "1023",
  //     eventDate: "상관없어 임마",
  //     estimatedTime: 120,
  //   },
  // ]);
});
