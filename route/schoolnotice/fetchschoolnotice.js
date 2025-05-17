const axios = require("axios");
const cheerio = require("cheerio");
require("dotenv").config();

// Base URLs
const baseUrl1 = "https://www.skku.edu/skku/campus/skk_comm/notice08.do";
const baseUrl2 = "https://student.skku.edu/student/notice2.do";
const baseUrl3 = "https://hakbu.skku.edu/hakbu/community/under_notice.do";

// 통합된 공지사항 리스트
let filteredResult = [];

// 최근 6개월 이내의 날짜인지 확인하는 함수
function isWithinSixMonths(dateString) {
  const noticeDate = new Date(dateString);
  const now = new Date();
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(now.getMonth() - 6);

  return noticeDate >= sixMonthsAgo;
}

// 첫 번째 API 데이터 가져오기 (type1)
async function fetchType1() {
  const results = [];
  try {
    const response = await axios.get(
      process.env.API_SCHOOLNOTICE_PROD || baseUrl1
    );
    const html = response.data;
    const $ = cheerio.load(html);

    $(".board-list-wrap > li").each((_, element) => {
      const title = $(element)
        .find(".board-list-content-title a")
        .text()
        .trim();
      const href = $(element).find(".board-list-content-title a").attr("href");
      const date = $(element)
        .find(".board-list-content-info > ul > li:nth-child(3)")
        .text()
        .trim();

      if (title && href && date && isWithinSixMonths(date)) {
        results.push({
          title,
          link: `${baseUrl1}${href}`,
          date,
          type: "type1",
        });
      }
    });
  } catch (error) {
    console.error("Error fetching Type1 notices: ", error);
  }
  return results;
}

// 두 번째 API 데이터 가져오기 (type2)
async function fetchType2() {
  const results = [];
  try {
    const response = await axios.get(
      `${baseUrl2}?mode=list&srCategoryId1=&srSearchKey=article_title&srSearchVal=%EC%85%94%ED%8B%80`
    );
    const html = response.data;
    const $ = cheerio.load(html);

    $("li").each((_, element) => {
      const title = $(element)
        .find(".board-thumb-content-title a span")
        .text()
        .trim();
      const href = $(element).find(".board-thumb-content-title a").attr("href");
      const rawDate = $(element)
        .find(".board-thumb-content-date")
        .text()
        .trim();

      const date = rawDate
        .replace(/\D+/g, "")
        .replace(/(\d{4})(\d{2})(\d{2})/, "$1-$2-$3");

      if (title && href && date && isWithinSixMonths(date)) {
        results.push({
          title,
          link: `${baseUrl2}${href}`,
          date,
          type: "type2",
        });
      }
    });
  } catch (error) {
    console.error("Error fetching Type2 notices: ", error);
  }
  return results;
}

// 세 번째 API 데이터 가져오기 (type3)
async function fetchType3() {
  const results = [];
  try {
    const response = await axios.get(
      `${baseUrl3}?mode=list&srCategoryId1=&srSearchKey=&srSearchVal=%EC%85%94%ED%8B%80`
    );
    const html = response.data;
    const $ = cheerio.load(html);

    $(".board-list-wrap > li").each((_, element) => {
      const title = $(element)
        .find(".board-list-content-title a")
        .text()
        .trim();
      const href = $(element).find(".board-list-content-title a").attr("href");
      const date = $(element)
        .find(".board-list-content-info > ul > li:nth-child(3)")
        .text()
        .trim();

      if (title && href && date && isWithinSixMonths(date)) {
        results.push({
          title,
          link: `${baseUrl3}${href}`,
          date,
          type: "type3",
        });
      }
    });
  } catch (error) {
    console.error("Error fetching Type3 notices: ", error);
  }
  return results;
}

// 세 데이터를 병합하여 중복 제거 및 최신순 정렬
async function updateNoticeList() {
  try {
    const [type1Notices, type2Notices, type3Notices] = await Promise.all([
      fetchType1(),
      fetchType2(),
      fetchType3(),
    ]);

    const allNotices = [...type1Notices, ...type2Notices, ...type3Notices];

    // 중복 제거 (제목과 날짜가 모두 동일한 경우)
    const uniqueNotices = allNotices.reduce((acc, current) => {
      const duplicate = acc.find(
        (notice) =>
          notice.title === current.title && notice.date === current.date
      );
      if (!duplicate) {
        acc.push(current);
      }
      return acc;
    }, []);

    // 최신순 정렬
    filteredResult = uniqueNotices.sort(
      (a, b) => new Date(b.date) - new Date(a.date)
    );

    console.log("Updated Notice List: ", filteredResult);
  } catch (error) {
    console.error("Error updating notice list: ", error);
  }
}

// 60분마다 공지사항 업데이트
setInterval(
  updateNoticeList,
  600000 * 6
  // 15000
);

// 통합된 결과 반환
function getNoticeList() {
  console.log("Serving Notice List: ", filteredResult);
  return filteredResult;
}

module.exports = { getNoticeList };
