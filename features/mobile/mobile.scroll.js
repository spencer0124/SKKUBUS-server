function getScrollComponent() {
  return {
    metaData: {
      item_count: 3,
    },
    itemList: [
      {
        title: "인사캠 건물지도",
        icon: "Icons.outbound",
        pageLink: "/customwebview",
        altPageLink: "https://namu.wiki/w/%EB%8F%84%EB%A7%9D%EC%B3%90",
        useAltPageLink: false,
      },
      {
        title: "자과캠 건물지도",
        icon: "Icons.outbound",
        pageLink: "/customwebview",
        altPageLink: "https://namu.wiki/w/%EB%8F%84%EB%A7%9D%EC%B3%90",
        useAltPageLink: false,
      },
      {
        title: "버스 분실물",
        icon: "Icons.bus_alert",
        pageLink: "/customwebview",
        altPageLink: "https://namu.wiki/w/%EB%8F%84%EB%A7%9D%EC%B3%90",
        useAltPageLink: false,
      },
    ],
  };
}

module.exports = { getScrollComponent };
