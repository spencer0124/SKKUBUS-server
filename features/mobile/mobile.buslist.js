const AppColors = { deepgreen: "003626", green: "4CAF50" };

function getBusList() {
  return {
    metaData: {
      busList_count: 4,
    },
    busList: [
      {
        title: "인사캠 셔틀버스",
        subtitle: "정차소(인문.농구장) ↔ 600주년 기념관",
        busTypeText: "성대",
        busTypeBgColor: AppColors.deepgreen,
        pageLink: "/MainbusMain",
        pageWebviewLink: null,
        altPageLink: "https://namu.wiki/w/%EB%8F%84%EB%A7%9D%EC%B3%90",
        useAltPageLink: false,
        noticeText: null,
        showAnimation: false,
        showNoticeText: false,
      },
      {
        title: "인자셔틀",
        subtitle: "인사캠 ↔ 자과캠",
        busTypeText: "성대",
        busTypeBgColor: AppColors.deepgreen,
        pageLink: "/eskara",
        pageWebviewLink: null,
        altPageLink: "https://namu.wiki/w/%EB%8F%84%EB%A7%9D%EC%B3%90",
        useAltPageLink: false,
        noticeText: "25년도 2학기 인자셔틀 시간표 업데이트",
        showAnimation: false,
        showNoticeText: true,
      },
      {
        title: "종로 02",
        subtitle: "성균관대학교 ↔ 종각역YMCA",
        busTypeText: "마을",
        busTypeBgColor: AppColors.green,
        pageLink: "/MainbusMain",
        pageWebviewLink: null,
        altPageLink:
          "http://m.bus.go.kr/mBus/bus.bms?search=%EC%A2%85%EB%A1%9C02&searchType=B",
        useAltPageLink: false,
        noticeText: null,
        showAnimation: false,
        showNoticeText: false,
      },
      {
        title: "종로 07",
        subtitle: "명륜새마을금고 ↔ 명륜새마을금고",
        busTypeText: "마을",
        busTypeBgColor: AppColors.green,
        pageLink: "/MainbusMain",
        pageWebviewLink: null,
        altPageLink:
          "http://m.bus.go.kr/mBus/bus.bms?search=%EC%A2%85%EB%A1%9C07&searchType=B",
        useAltPageLink: false,
        noticeText: null,
        showAnimation: false,
        showNoticeText: false,
      },
    ],
  };
}

module.exports = { getBusList };
