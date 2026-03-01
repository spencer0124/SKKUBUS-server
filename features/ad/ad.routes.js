const express = require("express");
const router = express.Router();
const asyncHandler = require("../../lib/asyncHandler");

function getAdDetail() {
  return {
    image: "https://i.imgur.com/VEJpasQ.png",
    image2: "",
    link: "http://pf.kakao.com/_cjxexdG",
    showtext: true,
    text: "스꾸버스 카카오톡 채널 - 문의하기",
    showtext2: false,
    text2: "인자셔틀 - 토/일/공휴일 운행없음",
    link2: "https://forms.gle/3Zmytp6z15ww1KXXA",
  };
}

router.get("/v1/addetail", asyncHandler(async (req, res) => {
  res.json(getAdDetail());
}));

// Statistics counters (in-memory, resets on restart)
let menu1_view = 0;
let menu1_click = 0;
let menu2_view = 0;
let menu2_click = 0;
let menu3_view = 0;
let menu3_click = 0;

router.get("/v1/statistics/menu1/view", asyncHandler(async (req, res) => {
  menu1_view++;
  res.json({ count: menu1_view });
}));

router.get("/v1/statistics/menu1/click", asyncHandler(async (req, res) => {
  menu1_click++;
  res.json({ count: menu1_click });
}));

router.get("/v1/statistics/menu2/view", asyncHandler(async (req, res) => {
  menu2_view++;
  res.json({ count: menu2_view });
}));

router.get("/v1/statistics/menu2/click", asyncHandler(async (req, res) => {
  menu2_click++;
  res.json({ count: menu2_click });
}));

router.get("/v1/statistics/menu3/view", asyncHandler(async (req, res) => {
  menu3_view++;
  res.json({ count: menu3_view });
}));

router.get("/v1/statistics/menu3/click", asyncHandler(async (req, res) => {
  menu3_click++;
  res.json({ count: menu3_click });
}));

module.exports = router;
